import {
  queryGeneric,
  mutationGeneric,
} from "convex/server";
import type {
  Auth,
  GenericDataModel,
  GenericQueryCtx,
  GenericMutationCtx,
} from "convex/server";
import { v } from "convex/values";

/**
 * The component API type. This is a placeholder that will be properly typed
 * when the user imports from their generated component types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AuditLogComponentApi = any;

/**
 * Severity levels for audit events.
 */
export type Severity = "info" | "warning" | "error" | "critical";

/**
 * Input for creating an audit event.
 */
export interface AuditEventInput {
  action: string;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
  severity: Severity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  tags?: string[];
  retentionCategory?: string;
}

/**
 * Input for creating a change tracking event.
 */
export interface ChangeEventInput {
  action: string;
  actorId?: string;
  resourceType: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
  generateDiff?: boolean;
  severity?: Severity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  tags?: string[];
  retentionCategory?: string;
}

/**
 * Query filters for searching audit logs.
 */
export interface QueryFilters {
  severity?: Severity[];
  actions?: string[];
  resourceTypes?: string[];
  actorIds?: string[];
  fromTimestamp?: number;
  toTimestamp?: number;
  tags?: string[];
}

/**
 * Pagination options.
 */
export interface PaginationOptions {
  cursor?: string;
  limit: number;
}

/**
 * Anomaly detection pattern.
 */
export interface AnomalyPattern {
  action: string;
  threshold: number;
  windowMinutes: number;
}

/**
 * Cleanup options for retention policies.
 */
export interface CleanupOptions {
  olderThanDays?: number;
  preserveSeverity?: Severity[];
  retentionCategory?: string;
  batchSize?: number;
}

/**
 * Configuration options for the audit log component.
 */
export interface AuditLogOptions {
  defaultRetentionDays?: number;
  criticalRetentionDays?: number;
  piiFields?: string[];
  samplingEnabled?: boolean;
  samplingRate?: number;
}

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

/**
 * Client wrapper for the Audit Log component.
 *
 * @example
 * ```typescript
 * import { AuditLog } from "@convex-dev/audit-log";
 * import { components } from "./_generated/api";
 *
 * const auditLog = new AuditLog(components.auditLog, {
 *   piiFields: ["email", "phone", "ssn"],
 * });
 *
 * // In your mutation
 * await auditLog.log(ctx, {
 *   action: "user.login",
 *   actorId: userId,
 *   severity: "info",
 * });
 * ```
 */
export class AuditLog {
  public component: AuditLogComponentApi;
  public options: AuditLogOptions;
  private piiFields: Set<string>;

  constructor(component: AuditLogComponentApi, options: AuditLogOptions = {}) {
    this.component = component;
    this.options = options;
    this.piiFields = new Set(options.piiFields ?? []);
  }

  /**
   * Log a single audit event.
   */
  async log(ctx: MutationCtx, event: AuditEventInput): Promise<string> {
    if (this.options.samplingEnabled && this.options.samplingRate) {
      if (Math.random() > this.options.samplingRate) {
        return "";
      }
    }

    const sanitizedEvent = this.redactPII(event);

    return await ctx.runMutation(this.component.lib.log, sanitizedEvent);
  }

  /**
   * Log a change event with before/after states.
   */
  async logChange(ctx: MutationCtx, event: ChangeEventInput): Promise<string> {
    const sanitizedEvent = {
      ...event,
      before: event.before ? this.redactPIIFromObject(event.before) : undefined,
      after: event.after ? this.redactPIIFromObject(event.after) : undefined,
    };

    return await ctx.runMutation(this.component.lib.logChange, sanitizedEvent);
  }

  /**
   * Log multiple events in a single transaction.
   */
  async logBulk(ctx: MutationCtx, events: AuditEventInput[]): Promise<string[]> {
    const sanitizedEvents = events.map((event) => this.redactPII(event));
    return await ctx.runMutation(this.component.lib.logBulk, {
      events: sanitizedEvents,
    });
  }

  /**
   * Query audit logs by resource.
   */
  async queryByResource(
    ctx: QueryCtx,
    args: {
      resourceType: string;
      resourceId: string;
      limit?: number;
      fromTimestamp?: number;
    }
  ) {
    return await ctx.runQuery(this.component.lib.queryByResource, args);
  }

  /**
   * Query audit logs by actor (user).
   */
  async queryByActor(
    ctx: QueryCtx,
    args: {
      actorId: string;
      limit?: number;
      fromTimestamp?: number;
      actions?: string[];
    }
  ) {
    return await ctx.runQuery(this.component.lib.queryByActor, args);
  }

  /**
   * Query audit logs by severity.
   */
  async queryBySeverity(
    ctx: QueryCtx,
    args: {
      severity: Severity[];
      limit?: number;
      fromTimestamp?: number;
    }
  ) {
    return await ctx.runQuery(this.component.lib.queryBySeverity, args);
  }

  /**
   * Query audit logs by action.
   */
  async queryByAction(
    ctx: QueryCtx,
    args: {
      action: string;
      limit?: number;
      fromTimestamp?: number;
    }
  ) {
    return await ctx.runQuery(this.component.lib.queryByAction, args);
  }

  /**
   * Advanced search with multiple filters.
   */
  async search(
    ctx: QueryCtx,
    args: {
      filters: QueryFilters;
      pagination: PaginationOptions;
    }
  ) {
    return await ctx.runQuery(this.component.lib.search, args);
  }

  /**
   * Watch for critical events (real-time subscription).
   */
  async watchCritical(
    ctx: QueryCtx,
    args?: {
      severity?: Severity[];
      limit?: number;
    }
  ) {
    return await ctx.runQuery(this.component.lib.watchCritical, args ?? {});
  }

  /**
   * Get a single audit log by ID.
   */
  async get(ctx: QueryCtx, id: string) {
    return await ctx.runQuery(this.component.lib.get, { id });
  }

  /**
   * Get statistics for audit logs.
   */
  async getStats(
    ctx: QueryCtx,
    args?: {
      fromTimestamp?: number;
      toTimestamp?: number;
    }
  ) {
    return await ctx.runQuery(this.component.lib.getStats, args ?? {});
  }

  /**
   * Detect anomalies based on event patterns.
   */
  async detectAnomalies(ctx: QueryCtx, patterns: AnomalyPattern[]) {
    return await ctx.runQuery(this.component.lib.detectAnomalies, { patterns });
  }

  /**
   * Generate a report of audit logs.
   */
  async generateReport(
    ctx: QueryCtx,
    args: {
      startDate: number;
      endDate: number;
      format: "json" | "csv";
      includeFields?: string[];
      groupBy?: string;
    }
  ) {
    return await ctx.runQuery(this.component.lib.generateReport, args);
  }

  /**
   * Clean up old audit logs based on retention policies.
   */
  async cleanup(ctx: MutationCtx, options?: CleanupOptions): Promise<number> {
    return await ctx.runMutation(this.component.lib.cleanup, options ?? {});
  }

  /**
   * Get current configuration.
   */
  async getConfig(ctx: QueryCtx) {
    return await ctx.runQuery(this.component.lib.getConfig, {});
  }

  /**
   * Update configuration.
   */
  async updateConfig(
    ctx: MutationCtx,
    options: {
      defaultRetentionDays?: number;
      criticalRetentionDays?: number;
      piiFieldsToRedact?: string[];
      samplingEnabled?: boolean;
      samplingRate?: number;
      customRetention?: { category: string; retentionDays: number }[];
    }
  ) {
    return await ctx.runMutation(this.component.lib.updateConfig, options);
  }

  private redactPII(event: AuditEventInput): AuditEventInput {
    if (!event.metadata || this.piiFields.size === 0) {
      return event;
    }

    return {
      ...event,
      metadata: this.redactPIIFromObject(event.metadata),
    };
  }

  private redactPIIFromObject(obj: unknown): unknown {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactPIIFromObject(item));
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (this.piiFields.has(key.toLowerCase())) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.redactPIIFromObject(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }
}

/**
 * Create an exposed API for the audit log component.
 * This allows you to re-export functions that can be called from React clients.
 *
 * @example
 * ```typescript
 * // In convex/auditLog.ts
 * import { exposeAuditLogApi } from "@convex-dev/audit-log";
 * import { components } from "./_generated/api";
 *
 * export const { queryByResource, queryByActor, getStats } = exposeAuditLogApi(
 *   components.auditLog,
 *   {
 *     auth: async (ctx, operation) => {
 *       const userId = await getAuthUserId(ctx);
 *       if (!userId) throw new Error("Unauthorized");
 *       return userId;
 *     },
 *   }
 * );
 * ```
 */
export function exposeAuditLogApi(
  component: AuditLogComponentApi,
  options: {
    /**
     * Authentication function that runs before each operation.
     * Should throw an error if the user is not authorized.
     */
    auth: (
      ctx: { auth: Auth },
      operation:
        | { type: "read" }
        | { type: "write" }
        | { type: "admin" }
    ) => Promise<string>;
  }
) {
  return {
    /**
     * Query audit logs by resource.
     */
    queryByResource: queryGeneric({
      args: {
        resourceType: v.string(),
        resourceId: v.string(),
        limit: v.optional(v.number()),
        fromTimestamp: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.queryByResource, args);
      },
    }),

    /**
     * Query audit logs by actor.
     */
    queryByActor: queryGeneric({
      args: {
        actorId: v.string(),
        limit: v.optional(v.number()),
        fromTimestamp: v.optional(v.number()),
        actions: v.optional(v.array(v.string())),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.queryByActor, args);
      },
    }),

    /**
     * Get statistics.
     */
    getStats: queryGeneric({
      args: {
        fromTimestamp: v.optional(v.number()),
        toTimestamp: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.getStats, args);
      },
    }),

    /**
     * Watch critical events.
     */
    watchCritical: queryGeneric({
      args: {
        limit: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "read" });
        return await ctx.runQuery(component.lib.watchCritical, args);
      },
    }),

    /**
     * Clean up old logs (admin only).
     */
    cleanup: mutationGeneric({
      args: {
        olderThanDays: v.optional(v.number()),
        batchSize: v.optional(v.number()),
      },
      handler: async (ctx, args) => {
        await options.auth(ctx, { type: "admin" });
        return await ctx.runMutation(component.lib.cleanup, args);
      },
    }),
  };
}

/**
 * Common action names for consistency.
 */
export const AuditActions = {
  USER_LOGIN: "user.login",
  USER_LOGIN_FAILED: "user.login.failed",
  USER_LOGOUT: "user.logout",
  USER_SIGNUP: "user.signup",
  PASSWORD_CHANGED: "user.password.changed",
  PASSWORD_RESET_REQUESTED: "user.password.reset_requested",
  PASSWORD_RESET_COMPLETED: "user.password.reset_completed",
  MFA_ENABLED: "user.mfa.enabled",
  MFA_DISABLED: "user.mfa.disabled",
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_ROLE_CHANGED: "user.role.changed",
  USER_PERMISSIONS_CHANGED: "user.permissions.changed",
  RECORD_CREATED: "record.created",
  RECORD_UPDATED: "record.updated",
  RECORD_DELETED: "record.deleted",
  RECORD_VIEWED: "record.viewed",
  RECORD_EXPORTED: "record.exported",
  SETTINGS_CHANGED: "settings.changed",
  API_KEY_CREATED: "api_key.created",
  API_KEY_REVOKED: "api_key.revoked",
  UNAUTHORIZED_ACCESS: "security.unauthorized_access",
  SUSPICIOUS_ACTIVITY: "security.suspicious_activity",
  RATE_LIMIT_EXCEEDED: "security.rate_limit_exceeded",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];
