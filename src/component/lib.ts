import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
} from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
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
import { aggregateBySeverity, aggregateByAction } from "./aggregates.js";

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

    // Insert into aggregates for efficient counting
    const doc = (await ctx.db.get(logId))!;
    await aggregateBySeverity.insert(ctx, doc);
    await aggregateByAction.insert(ctx, doc);

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

    // Insert into aggregates for efficient counting
    const doc = (await ctx.db.get(logId))!;
    await aggregateBySeverity.insert(ctx, doc);
    await aggregateByAction.insert(ctx, doc);

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

      // Insert into aggregates for efficient counting
      const doc = (await ctx.db.get(logId))!;
      await aggregateBySeverity.insert(ctx, doc);
      await aggregateByAction.insert(ctx, doc);
    }

    return ids as Id<"auditLogs">[];
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

      // Delete from aggregates first
      await aggregateBySeverity.delete(ctx, log);
      await aggregateByAction.delete(ctx, log);

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
 * Uses aggregates for efficient O(log n) counting instead of reading all documents.
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

      // Use aggregate for efficient counting - O(log n) instead of reading all documents
      const count = await aggregateByAction.count(ctx, {
        namespace: [pattern.action],
        bounds: {
          lower: { key: windowStart, inclusive: true },
        },
      });

      if (count >= pattern.threshold) {
        anomalies.push({
          action: pattern.action,
          count,
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
 * Maximum number of records to include in a single report.
 * This prevents unbounded queries from reading too many documents.
 */
const MAX_REPORT_RECORDS = 10000;

/**
 * Generate a report of audit logs.
 * Note: Limited to MAX_REPORT_RECORDS to prevent unbounded queries.
 * For larger exports, use pagination or scheduled exports.
 */
export const generateReport = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    format: v.union(v.literal("json"), v.literal("csv")),
    includeFields: v.optional(v.array(v.string())),
    groupBy: v.optional(v.string()),
    maxRecords: v.optional(v.number()),
  },
  returns: v.object({
    format: v.union(v.literal("json"), v.literal("csv")),
    data: v.string(),
    generatedAt: v.number(),
    recordCount: v.number(),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.min(args.maxRecords ?? MAX_REPORT_RECORDS, MAX_REPORT_RECORDS);

    const logs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", args.startDate).lte("timestamp", args.endDate)
      )
      .take(limit + 1); // Fetch one extra to detect truncation

    const truncated = logs.length > limit;
    const logsToProcess = truncated ? logs.slice(0, limit) : logs;

    const includeFields = args.includeFields ?? [
      "timestamp",
      "action",
      "actorId",
      "resourceType",
      "resourceId",
      "severity",
    ];

    const filteredLogs = logsToProcess.map((log) => {
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
      truncated,
    };
  },
});

/**
 * Maximum number of logs to read for computing top actions/actors.
 * Severity counts use aggregates for O(log n) performance.
 */
const MAX_STATS_SAMPLE_SIZE = 1000;

/**
 * Get statistics for audit logs.
 * Uses aggregates for efficient O(log n) severity counting.
 * Top actions/actors are computed from a bounded sample for performance.
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
    // Use provided fromTimestamp or default to 24 hours ago
    const fromTimestamp = args.fromTimestamp ?? Date.now() - 24 * 60 * 60 * 1000;

    // Build bounds for aggregate queries
    const bounds: { lower: { key: number; inclusive: boolean }; upper?: { key: number; inclusive: boolean } } = {
      lower: { key: fromTimestamp, inclusive: true },
    };
    if (args.toTimestamp) {
      bounds.upper = { key: args.toTimestamp, inclusive: true };
    }

    // Use aggregates for efficient O(log n) severity counting
    const [infoCount, warningCount, errorCount, criticalCount] = await Promise.all([
      aggregateBySeverity.count(ctx, { namespace: ["info"], bounds }),
      aggregateBySeverity.count(ctx, { namespace: ["warning"], bounds }),
      aggregateBySeverity.count(ctx, { namespace: ["error"], bounds }),
      aggregateBySeverity.count(ctx, { namespace: ["critical"], bounds }),
    ]);

    const bySeverity = {
      info: infoCount,
      warning: warningCount,
      error: errorCount,
      critical: criticalCount,
    };

    const totalCount = infoCount + warningCount + errorCount + criticalCount;

    // For top actions and actors, we need to read a sample of logs
    // Limited to MAX_STATS_SAMPLE_SIZE to prevent unbounded queries
    const recentLogs = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", fromTimestamp))
      .order("desc")
      .take(MAX_STATS_SAMPLE_SIZE);

    // Apply toTimestamp filter in memory if specified
    const logs = args.toTimestamp
      ? recentLogs.filter((log) => log.timestamp <= args.toTimestamp!)
      : recentLogs;

    const actionCounts: Record<string, number> = {};
    const actorCounts: Record<string, number> = {};

    for (const log of logs) {
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
      totalCount,
      bySeverity,
      topActions,
      topActors,
    };
  },
});

/**
 * Backfill aggregates for existing audit log data.
 * Run this once after upgrading to populate the aggregate tables.
 * This is an internal mutation that should be called from the client wrapper.
 */
export const backfillAggregates = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    let query = ctx.db.query("auditLogs").order("asc");

    // Resume from cursor if provided
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as Id<"auditLogs">);
      if (cursorDoc && "timestamp" in cursorDoc) {
        query = ctx.db
          .query("auditLogs")
          .withIndex("by_timestamp", (q) => q.gt("timestamp", cursorDoc.timestamp))
          .order("asc");
      }
    }

    const docs = await query.take(batchSize + 1);
    const hasMore = docs.length > batchSize;
    const toProcess = hasMore ? docs.slice(0, batchSize) : docs;

    for (const doc of toProcess) {
      // Insert into both aggregates
      await aggregateBySeverity.insertIfDoesNotExist(ctx, doc);
      await aggregateByAction.insertIfDoesNotExist(ctx, doc);
    }

    const lastDoc = toProcess[toProcess.length - 1];

    return {
      processed: toProcess.length,
      cursor: hasMore && lastDoc ? lastDoc._id : null,
      isDone: !hasMore,
    };
  },
});

/**
 * Public mutation to trigger backfill. Call this to populate aggregates.
 */
export const runBackfill = mutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;

    let query = ctx.db.query("auditLogs").order("asc");

    // Resume from cursor if provided
    if (args.cursor) {
      const cursorDoc = await ctx.db.get(args.cursor as Id<"auditLogs">);
      if (cursorDoc && "timestamp" in cursorDoc) {
        query = ctx.db
          .query("auditLogs")
          .withIndex("by_timestamp", (q) => q.gt("timestamp", cursorDoc.timestamp))
          .order("asc");
      }
    }

    const docs = await query.take(batchSize + 1);
    const hasMore = docs.length > batchSize;
    const toProcess = hasMore ? docs.slice(0, batchSize) : docs;

    for (const doc of toProcess) {
      // Insert into both aggregates (idempotent)
      await aggregateBySeverity.insertIfDoesNotExist(ctx, doc);
      await aggregateByAction.insertIfDoesNotExist(ctx, doc);
    }

    const lastDoc = toProcess[toProcess.length - 1];

    return {
      processed: toProcess.length,
      cursor: hasMore && lastDoc ? lastDoc._id : null,
      isDone: !hasMore,
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
