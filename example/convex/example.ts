import { mutation, query } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { AuditLog, exposeAuditLogApi, AuditActions } from "convex-audit-log";
import { v } from "convex/values";
import { Auth } from "convex/server";

const auditLog = new AuditLog(components.auditLog, {
  piiFields: ["email", "phone", "ssn", "password"],
});

/**
 * Create a new user and log the event.
 */
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
    });

    await auditLog.log(ctx, {
      action: AuditActions.USER_CREATED,
      actorId: await getAuthUserId(ctx),
      resourceType: "users",
      resourceId: userId,
      severity: "info",
      metadata: {
        name: args.name,
        email: args.email,
        role: args.role,
      },
      tags: ["user-management"],
    });

    return userId;
  },
});

/**
 * Update a user and track the changes.
 */
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const before = await ctx.db.get(args.userId);
    if (!before) throw new Error("User not found");

    const updates: Record<string, string> = {};
    if (args.name) updates.name = args.name;
    if (args.email) updates.email = args.email;
    if (args.role) updates.role = args.role;

    await ctx.db.patch(args.userId, updates);

    const after = await ctx.db.get(args.userId);

    await auditLog.logChange(ctx, {
      action: AuditActions.USER_UPDATED,
      actorId: await getAuthUserId(ctx),
      resourceType: "users",
      resourceId: args.userId,
      before,
      after,
      generateDiff: true,
      severity: "info",
      tags: ["user-management"],
    });

    return after;
  },
});

/**
 * Delete a user with warning-level audit.
 */
export const deleteUser = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    await ctx.db.delete(args.userId);

    await auditLog.log(ctx, {
      action: AuditActions.USER_DELETED,
      actorId: await getAuthUserId(ctx),
      resourceType: "users",
      resourceId: args.userId,
      severity: "warning",
      metadata: {
        deletedUserName: user.name,
      },
      tags: ["user-management", "destructive"],
    });

    return { deleted: true };
  },
});

/**
 * Create a new document and log the event.
 */
export const createDocument = mutation({
  args: {
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);

    const docId = await ctx.db.insert("documents", {
      title: args.title,
      content: args.content,
      ownerId,
    });

    await auditLog.log(ctx, {
      action: AuditActions.RECORD_CREATED,
      actorId: ownerId,
      resourceType: "documents",
      resourceId: docId,
      severity: "info",
      metadata: {
        title: args.title,
        contentLength: args.content.length,
      },
    });

    return docId;
  },
});

/**
 * Update a document and track the changes.
 */
export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const before = await ctx.db.get(args.documentId);
    if (!before) throw new Error("Document not found");

    const updates: Record<string, string> = {};
    if (args.title) updates.title = args.title;
    if (args.content) updates.content = args.content;

    await ctx.db.patch(args.documentId, updates);
    const after = await ctx.db.get(args.documentId);

    await auditLog.logChange(ctx, {
      action: AuditActions.RECORD_UPDATED,
      actorId: await getAuthUserId(ctx),
      resourceType: "documents",
      resourceId: args.documentId,
      before: { title: before.title, content: before.content },
      after: { title: after!.title, content: after!.content },
      generateDiff: true,
      severity: "info",
    });

    return after;
  },
});

/**
 * Log a failed login attempt.
 */
export const logFailedLogin = mutation({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await auditLog.log(ctx, {
      action: AuditActions.USER_LOGIN_FAILED,
      actorId: args.email,
      severity: "warning",
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      metadata: {
        reason: "invalid_credentials",
      },
      tags: ["authentication", "security"],
    });
  },
});

/**
 * Log unauthorized access.
 */
export const logUnauthorizedAccess = mutation({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
    attemptedAction: v.string(),
  },
  handler: async (ctx, args) => {
    await auditLog.log(ctx, {
      action: AuditActions.UNAUTHORIZED_ACCESS,
      actorId: await getAuthUserId(ctx),
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      severity: "critical",
      metadata: {
        attemptedAction: args.attemptedAction,
      },
      tags: ["security", "access-control"],
    });
  },
});

/**
 * Get document history (all changes to a specific document).
 */
export const getDocumentHistory = query({
  args: {
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    return await auditLog.queryByResource(ctx, {
      resourceType: "documents",
      resourceId: args.documentId,
      limit: 50,
    });
  },
});

/**
 * Get user activity (all actions by a specific user).
 */
export const getUserActivity = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await auditLog.queryByActor(ctx, {
      actorId: args.userId,
      limit: args.limit ?? 50,
    });
  },
});

/**
 * Watch critical security events in real-time.
 */
export const watchSecurityEvents = query({
  args: {},
  handler: async (ctx) => {
    return await auditLog.watchCritical(ctx, {
      severity: ["warning", "error", "critical"],
      limit: 20,
    });
  },
});

/**
 * Get audit log statistics.
 */
export const getAuditStats = query({
  args: {
    hoursBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hoursBack ?? 24;
    return await auditLog.getStats(ctx, {
      fromTimestamp: Date.now() - hoursBack * 60 * 60 * 1000,
    });
  },
});

/**
 * Detect anomalies in login attempts.
 */
export const detectLoginAnomalies = query({
  args: {},
  handler: async (ctx) => {
    return await auditLog.detectAnomalies(ctx, [
      { action: AuditActions.USER_LOGIN_FAILED, threshold: 5, windowMinutes: 5 },
      { action: AuditActions.UNAUTHORIZED_ACCESS, threshold: 3, windowMinutes: 10 },
    ]);
  },
});

/**
 * Advanced search with filters.
 */
export const searchAuditLogs = query({
  args: {
    severity: v.optional(v.array(v.string())),
    actions: v.optional(v.array(v.string())),
    fromTimestamp: v.optional(v.number()),
    toTimestamp: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await auditLog.search(ctx, {
      filters: {
        severity: args.severity as any,
        actions: args.actions,
        fromTimestamp: args.fromTimestamp,
        toTimestamp: args.toTimestamp,
      },
      pagination: {
        limit: args.limit ?? 50,
      },
    });
  },
});

/**
 * Generate a compliance report.
 */
export const generateComplianceReport = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    format: v.union(v.literal("json"), v.literal("csv")),
  },
  handler: async (ctx, args) => {
    return await auditLog.generateReport(ctx, {
      startDate: args.startDate,
      endDate: args.endDate,
      format: args.format,
      includeFields: [
        "timestamp",
        "action",
        "actorId",
        "resourceType",
        "resourceId",
        "severity",
        "ipAddress",
      ],
      groupBy: "action",
    });
  },
});

/**
 * Clean up old logs.
 */
export const cleanupOldLogs = mutation({
  args: {
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const deletedCount = await auditLog.cleanup(ctx, {
      olderThanDays: args.olderThanDays ?? 90,
      preserveSeverity: ["critical"],
      batchSize: 100,
    });

    return { deletedCount };
  },
});

export const {
  queryByResource,
  queryByActor,
  getStats,
  watchCritical,
} = exposeAuditLogApi(components.auditLog, {
  auth: async (ctx, operation) => {
    const userId = await getAuthUserId(ctx);
    if (!userId && operation.type !== "read") {
      throw new Error("Unauthorized");
    }
    return userId;
  },
});

async function getAuthUserId(ctx: { auth: Auth }): Promise<string> {
  return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
}
