import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import schema from "./schema.js";
import {
  vSeverity,
  vAuditEventInput,
  vChangeEventInput,
  vQueryFilters,
  vPagination,
  vCleanupOptions,
  vConfigOptions,
  type Severity,
} from "./shared.js";

const auditLogValidator = schema.tables.auditLogs.validator.extend({
  _id: v.id("auditLogs"),
  _creationTime: v.number(),
});

/**
 * Log a single audit event.
 */
export const log = mutation({
  args: vAuditEventInput.fields,
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    const logId = await ctx.db.insert("auditLogs", {
      ...args,
      timestamp,
    });

    return logId;
  },
});

/**
 * Log a change event with before/after states and optional diff generation.
 */
export const logChange = mutation({
  args: vChangeEventInput.fields,
  returns: v.id("auditLogs"),
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    let diff: string | undefined;

    if (args.generateDiff && args.before && args.after) {
      diff = generateDiff(args.before, args.after);
    }

    const logId = await ctx.db.insert("auditLogs", {
      action: args.action,
      actorId: args.actorId,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      before: args.before,
      after: args.after,
      diff,
      severity: args.severity ?? "info",
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      sessionId: args.sessionId,
      tags: args.tags,
      retentionCategory: args.retentionCategory,
      timestamp,
    });

    return logId;
  },
});

/**
 * Log multiple audit events in a single transaction.
 */
export const logBulk = mutation({
  args: {
    events: v.array(vAuditEventInput),
  },
  returns: v.array(v.id("auditLogs")),
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const ids: string[] = [];

    for (const event of args.events) {
      const logId = await ctx.db.insert("auditLogs", {
        ...event,
        timestamp,
      });
      ids.push(logId);
    }

    return ids as any;
  },
});

/**
 * Query audit logs by resource.
 */
export const queryByResource = query({
  args: {
    resourceType: v.string(),
    resourceId: v.string(),
    limit: v.optional(v.number()),
    fromTimestamp: v.optional(v.number()),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("auditLogs")
      .withIndex("by_resource", (q) =>
        q.eq("resourceType", args.resourceType).eq("resourceId", args.resourceId)
      )
      .order("desc");

    if (args.fromTimestamp) {
      q = ctx.db
        .query("auditLogs")
        .withIndex("by_resource", (q) =>
          q
            .eq("resourceType", args.resourceType)
            .eq("resourceId", args.resourceId)
            .gte("timestamp", args.fromTimestamp!)
        )
        .order("desc");
    }

    return await q.take(args.limit ?? 50);
  },
});

/**
 * Query audit logs by actor (user).
 */
export const queryByActor = query({
  args: {
    actorId: v.string(),
    limit: v.optional(v.number()),
    fromTimestamp: v.optional(v.number()),
    actions: v.optional(v.array(v.string())),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("auditLogs")
      .withIndex("by_actor_timestamp", (q) => q.eq("actorId", args.actorId))
      .order("desc")
      .take(args.limit ?? 50);

    if (args.fromTimestamp) {
      results = results.filter((log) => log.timestamp >= args.fromTimestamp!);
    }

    if (args.actions && args.actions.length > 0) {
      results = results.filter((log) => args.actions!.includes(log.action));
    }

    return results;
  },
});

/**
 * Query audit logs by severity level.
 */
export const queryBySeverity = query({
  args: {
    severity: v.array(vSeverity),
    limit: v.optional(v.number()),
    fromTimestamp: v.optional(v.number()),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    const allResults = [];

    for (const sev of args.severity) {
      const results = await ctx.db
        .query("auditLogs")
        .withIndex("by_severity_timestamp", (q) => q.eq("severity", sev))
        .order("desc")
        .take(args.limit ?? 50);

      allResults.push(...results);
    }

    return allResults
      .filter((log) =>
        args.fromTimestamp ? log.timestamp >= args.fromTimestamp : true
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, args.limit ?? 50);
  },
});

/**
 * Query audit logs by action type.
 */
export const queryByAction = query({
  args: {
    action: v.string(),
    limit: v.optional(v.number()),
    fromTimestamp: v.optional(v.number()),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("auditLogs")
      .withIndex("by_action_timestamp", (q) => q.eq("action", args.action))
      .order("desc")
      .take(args.limit ?? 50);

    if (args.fromTimestamp) {
      results = results.filter((log) => log.timestamp >= args.fromTimestamp!);
    }

    return results;
  },
});

/**
 * Advanced search with multiple filters.
 */
export const search = query({
  args: {
    filters: vQueryFilters,
    pagination: vPagination,
  },
  returns: v.object({
    items: v.array(auditLogValidator),
    cursor: v.union(v.string(), v.null()),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { filters, pagination } = args;
    const limit = pagination.limit;

    let results = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit * 10);

    if (filters.fromTimestamp) {
      results = results.filter((log) => log.timestamp >= filters.fromTimestamp!);
    }
    if (filters.toTimestamp) {
      results = results.filter((log) => log.timestamp <= filters.toTimestamp!);
    }
    if (filters.severity && filters.severity.length > 0) {
      results = results.filter((log) =>
        filters.severity!.includes(log.severity)
      );
    }
    if (filters.actions && filters.actions.length > 0) {
      results = results.filter((log) => filters.actions!.includes(log.action));
    }
    if (filters.resourceTypes && filters.resourceTypes.length > 0) {
      results = results.filter(
        (log) =>
          log.resourceType && filters.resourceTypes!.includes(log.resourceType)
      );
    }
    if (filters.actorIds && filters.actorIds.length > 0) {
      results = results.filter(
        (log) => log.actorId && filters.actorIds!.includes(log.actorId)
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(
        (log) =>
          log.tags && filters.tags!.some((tag) => log.tags!.includes(tag))
      );
    }

    // Apply cursor-based pagination
    let startIndex = 0;
    if (pagination.cursor) {
      const cursorIndex = results.findIndex(
        (log) => log._id === pagination.cursor
      );
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const paginatedResults = results.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < results.length;
    const cursor = paginatedResults.length > 0
      ? paginatedResults[paginatedResults.length - 1]._id
      : null;

    return {
      items: paginatedResults,
      cursor,
      hasMore,
    };
  },
});

/**
 * Watch for critical events (real-time subscription).
 */
export const watchCritical = query({
  args: {
    severity: v.optional(v.array(vSeverity)),
    limit: v.optional(v.number()),
  },
  returns: v.array(auditLogValidator),
  handler: async (ctx, args) => {
    const severityLevels = args.severity ?? ["error", "critical"];
    const limit = args.limit ?? 20;

    const allResults = [];

    for (const sev of severityLevels) {
      const results = await ctx.db
        .query("auditLogs")
        .withIndex("by_severity_timestamp", (q) => q.eq("severity", sev as Severity))
        .order("desc")
        .take(limit);

      allResults.push(...results);
    }

    return allResults
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});

/**
 * Get a single audit log by ID.
 */
export const get = query({
  args: {
    id: v.string(),
  },
  returns: v.union(v.null(), auditLogValidator),
  handler: async (ctx, args) => {
    try {
      const result = await ctx.db.get(args.id as any);
      // Only return if it's an audit log (not a config document)
      if (result && "action" in result) {
        return result;
      }
      return null;
    } catch {
      return null;
    }
  },
});

/**
 * Clean up old audit logs based on retention policies.
 */
export const cleanup = mutation({
  args: vCleanupOptions.fields,
  returns: v.number(),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    const olderThanDays = args.olderThanDays ?? 90;
    const cutoffTimestamp = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const preserveSeverity = args.preserveSeverity ?? [];

    // Get logs older than cutoff
    const oldLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", cutoffTimestamp))
      .take(batchSize);

    let deletedCount = 0;

    for (const log of oldLogs) {
      // Skip preserved severity levels
      if (preserveSeverity.includes(log.severity)) {
        continue;
      }

      // Skip specific retention categories if specified
      if (args.retentionCategory && log.retentionCategory !== args.retentionCategory) {
        continue;
      }

      await ctx.db.delete(log._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

/**
 * Get current configuration.
 */
export const getConfig = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("config"),
      _creationTime: v.number(),
      defaultRetentionDays: v.number(),
      criticalRetentionDays: v.number(),
      piiFieldsToRedact: v.array(v.string()),
      samplingEnabled: v.boolean(),
      samplingRate: v.number(),
      customRetention: v.optional(
        v.array(
          v.object({
            category: v.string(),
            retentionDays: v.number(),
          })
        )
      ),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("config").first();
  },
});

/**
 * Update configuration.
 */
export const updateConfig = mutation({
  args: vConfigOptions.fields,
  returns: v.id("config"),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("config").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...(args.defaultRetentionDays !== undefined && {
          defaultRetentionDays: args.defaultRetentionDays,
        }),
        ...(args.criticalRetentionDays !== undefined && {
          criticalRetentionDays: args.criticalRetentionDays,
        }),
        ...(args.piiFieldsToRedact !== undefined && {
          piiFieldsToRedact: args.piiFieldsToRedact,
        }),
        ...(args.samplingEnabled !== undefined && {
          samplingEnabled: args.samplingEnabled,
        }),
        ...(args.samplingRate !== undefined && {
          samplingRate: args.samplingRate,
        }),
        ...(args.customRetention !== undefined && {
          customRetention: args.customRetention,
        }),
      });
      return existing._id;
    }

    // Create new config with defaults
    return await ctx.db.insert("config", {
      defaultRetentionDays: args.defaultRetentionDays ?? 90,
      criticalRetentionDays: args.criticalRetentionDays ?? 365,
      piiFieldsToRedact: args.piiFieldsToRedact ?? [],
      samplingEnabled: args.samplingEnabled ?? false,
      samplingRate: args.samplingRate ?? 1.0,
      customRetention: args.customRetention,
    });
  },
});

/**
 * Detect anomalies based on event frequency patterns.
 */
export const detectAnomalies = query({
  args: {
    patterns: v.array(
      v.object({
        action: v.string(),
        threshold: v.number(),
        windowMinutes: v.number(),
      })
    ),
  },
  returns: v.array(
    v.object({
      action: v.string(),
      count: v.number(),
      threshold: v.number(),
      windowMinutes: v.number(),
      detectedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const anomalies = [];
    const now = Date.now();

    for (const pattern of args.patterns) {
      const windowStart = now - pattern.windowMinutes * 60 * 1000;

      const events = await ctx.db
        .query("auditLogs")
        .withIndex("by_action_timestamp", (q) =>
          q.eq("action", pattern.action).gte("timestamp", windowStart)
        )
        .collect();

      if (events.length >= pattern.threshold) {
        anomalies.push({
          action: pattern.action,
          count: events.length,
          threshold: pattern.threshold,
          windowMinutes: pattern.windowMinutes,
          detectedAt: now,
        });
      }
    }

    return anomalies;
  },
});

/**
 * Generate a report of audit logs.
 */
export const generateReport = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeFields: v.optional(v.array(v.string())),
    groupBy: v.optional(v.string()),
  },
  returns: v.object({
    format: v.union(v.literal("json"), v.literal("csv")),
    data: v.string(),
    generatedAt: v.number(),
    recordCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", args.startDate).lte("timestamp", args.endDate)
      )
      .collect();

    const includeFields = args.includeFields ?? [
      "timestamp",
      "action",
      "actorId",
      "resourceType",
      "resourceId",
      "severity",
    ];

    const filteredLogs = logs.map((log) => {
      const filtered: Record<string, unknown> = {};
      for (const field of includeFields) {
        if (field in log) {
          filtered[field] = (log as Record<string, unknown>)[field];
        }
      }
      return filtered;
    });

    let data: string;

    if (args.format === "csv") {
      // Generate CSV
      const headers = includeFields.join(",");
      const rows = filteredLogs.map((log) =>
        includeFields
          .map((field) => {
            const value = log[field];
            if (value === undefined || value === null) return "";
            if (typeof value === "string") return `"${value.replace(/"/g, '""')}"`;
            return String(value);
          })
          .join(",")
      );
      data = [headers, ...rows].join("\n");
    } else {
      // Generate JSON
      if (args.groupBy && includeFields.includes(args.groupBy)) {
        // Group by specified field
        const grouped: Record<string, typeof filteredLogs> = {};
        for (const log of filteredLogs) {
          const key = String(log[args.groupBy] ?? "unknown");
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(log);
        }
        data = JSON.stringify(grouped, null, 2);
      } else {
        data = JSON.stringify(filteredLogs, null, 2);
      }
    }

    return {
      format: args.format,
      data,
      generatedAt: Date.now(),
      recordCount: filteredLogs.length,
    };
  },
});

/**
 * Get statistics for audit logs.
 */
export const getStats = query({
  args: {
    fromTimestamp: v.optional(v.number()),
    toTimestamp: v.optional(v.number()),
  },
  returns: v.object({
    totalCount: v.number(),
    bySeverity: v.object({
      info: v.number(),
      warning: v.number(),
      error: v.number(),
      critical: v.number(),
    }),
    topActions: v.array(
      v.object({
        action: v.string(),
        count: v.number(),
      })
    ),
    topActors: v.array(
      v.object({
        actorId: v.string(),
        count: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const fromTimestamp = args.fromTimestamp ?? Date.now() - 24 * 60 * 60 * 1000;
    const toTimestamp = args.toTimestamp ?? Date.now();

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", fromTimestamp).lte("timestamp", toTimestamp)
      )
      .collect();

    // Count by severity
    const bySeverity = {
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    };

    const actionCounts: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};

    for (const log of logs) {
      bySeverity[log.severity]++;

      actionCounts[log.action] = (actionCounts[log.action] ?? 0) + 1;

      if (log.actorId) {
        actorCounts[log.actorId] = (actorCounts[log.actorId] ?? 0) + 1;
      }
    }

    // Get top 10 actions
    const topActions = Object.entries(actionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));

    // Get top 10 actors
    const topActors = Object.entries(actorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([actorId, count]) => ({ actorId, count }));

    return {
      totalCount: logs.length,
      bySeverity,
      topActions,
      topActors,
    };
  },
});

/**
 * Generate a simple diff between two objects.
 */
function generateDiff(before: unknown, after: unknown): string {
  const changes: string[] = [];

  if (typeof before !== "object" || typeof after !== "object") {
    return `Changed from ${JSON.stringify(before)} to ${JSON.stringify(after)}`;
  }

  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;

  // Check for removed keys
  for (const key of Object.keys(beforeObj)) {
    if (!(key in afterObj)) {
      changes.push(`- ${key}: ${JSON.stringify(beforeObj[key])}`);
    }
  }

  // Check for added or changed keys
  for (const key of Object.keys(afterObj)) {
    if (!(key in beforeObj)) {
      changes.push(`+ ${key}: ${JSON.stringify(afterObj[key])}`);
    } else if (JSON.stringify(beforeObj[key]) !== JSON.stringify(afterObj[key])) {
      changes.push(
        `~ ${key}: ${JSON.stringify(beforeObj[key])} → ${JSON.stringify(afterObj[key])}`
      );
    }
  }

  return changes.join("\n");
}
