import { v } from "convex/values";
import type { Infer } from "convex/values";

/**
 * Severity levels for audit events.
 */
export const vSeverity = v.union(
  v.literal("info"),
  v.literal("warning"),
  v.literal("error"),
  v.literal("critical")
);

/**
 * Base audit event validator (without timestamp - added automatically).
 */
export const vAuditEventInput = v.object({
  action: v.string(),
  actorId: v.optional(v.string()),
  resourceType: v.optional(v.string()),
  resourceId: v.optional(v.string()),
  metadata: v.optional(v.any()),
  severity: vSeverity,
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  retentionCategory: v.optional(v.string()),
});

/**
 * Change tracking event validator.
 */
export const vChangeEventInput = v.object({
  action: v.string(),
  actorId: v.optional(v.string()),
  resourceType: v.string(),
  resourceId: v.string(),
  before: v.optional(v.any()),
  after: v.optional(v.any()),
  generateDiff: v.optional(v.boolean()),
  severity: v.optional(vSeverity),
  ipAddress: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  retentionCategory: v.optional(v.string()),
});

/**
 * Query filters validator.
 */
export const vQueryFilters = v.object({
  severity: v.optional(v.array(vSeverity)),
  actions: v.optional(v.array(v.string())),
  resourceTypes: v.optional(v.array(v.string())),
  actorIds: v.optional(v.array(v.string())),
  fromTimestamp: v.optional(v.number()),
  toTimestamp: v.optional(v.number()),
  tags: v.optional(v.array(v.string())),
});

/**
 * Pagination validator.
 */
export const vPagination = v.object({
  cursor: v.optional(v.string()),
  limit: v.number(),
});

/**
 * Report format validator.
 */
export const vReportFormat = v.union(
  v.literal("json"),
  v.literal("csv")
);

/**
 * Anomaly pattern validator.
 */
export const vAnomalyPattern = v.object({
  action: v.string(),
  threshold: v.number(),
  windowMinutes: v.number(),
});

/**
 * Cleanup options validator.
 */
export const vCleanupOptions = v.object({
  olderThanDays: v.optional(v.number()),
  preserveSeverity: v.optional(v.array(vSeverity)),
  retentionCategory: v.optional(v.string()),
  batchSize: v.optional(v.number()),
});

/**
 * Configuration options validator.
 */
export const vConfigOptions = v.object({
  defaultRetentionDays: v.optional(v.number()),
  criticalRetentionDays: v.optional(v.number()),
  piiFieldsToRedact: v.optional(v.array(v.string())),
  samplingEnabled: v.optional(v.boolean()),
  samplingRate: v.optional(v.number()),
  customRetention: v.optional(
    v.array(
      v.object({
        category: v.string(),
        retentionDays: v.number(),
      })
    )
  ),
});

export type Severity = Infer<typeof vSeverity>;
export type AuditEventInput = Infer<typeof vAuditEventInput>;
export type ChangeEventInput = Infer<typeof vChangeEventInput>;
export type QueryFilters = Infer<typeof vQueryFilters>;
export type Pagination = Infer<typeof vPagination>;
export type ReportFormat = Infer<typeof vReportFormat>;
export type AnomalyPattern = Infer<typeof vAnomalyPattern>;
export type CleanupOptions = Infer<typeof vCleanupOptions>;
export type ConfigOptions = Infer<typeof vConfigOptions>;

/**
 * Full audit event with generated fields.
 */
export type AuditEvent = AuditEventInput & {
  _id: string;
  _creationTime: number;
  timestamp: number;
  before?: unknown;
  after?: unknown;
  diff?: string;
};

/**
 * Paginated result type.
 */
export type PaginatedResult<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
};

/**
 * Anomaly detection result.
 */
export type Anomaly = {
  action: string;
  count: number;
  threshold: number;
  windowMinutes: number;
  detectedAt: number;
};

/**
 * Report result type.
 */
export type Report = {
  format: ReportFormat;
  data: string;
  generatedAt: number;
  recordCount: number;
};
