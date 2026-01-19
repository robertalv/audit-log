import { TableAggregate } from "@convex-dev/aggregate";
import type { DataModel } from "./_generated/dataModel.js";
import { components } from "./_generated/api.js";

/**
 * Aggregate for efficiently counting audit logs by severity.
 *
 * Namespace: [severity]
 * Key: timestamp (for time-range queries)
 *
 * This enables O(log n) counting operations like:
 * - Count all "critical" logs in the last hour
 * - Count all "error" logs since a specific timestamp
 */
export const aggregateBySeverity = new TableAggregate<{
  Namespace: [string]; // [severity]
  Key: number; // timestamp
  DataModel: DataModel;
  TableName: "auditLogs";
}>(components.aggregateBySeverity, {
  namespace: (doc) => [doc.severity],
  sortKey: (doc) => doc.timestamp,
});

/**
 * Aggregate for efficiently counting audit logs by action.
 *
 * Namespace: [action]
 * Key: timestamp (for time-range queries)
 *
 * This enables O(log n) counting operations like:
 * - Count all "user.login" actions in the last 5 minutes (for anomaly detection)
 * - Get top actions by count in a time range
 */
export const aggregateByAction = new TableAggregate<{
  Namespace: [string]; // [action]
  Key: number; // timestamp
  DataModel: DataModel;
  TableName: "auditLogs";
}>(components.aggregateByAction, {
  namespace: (doc) => [doc.action],
  sortKey: (doc) => doc.timestamp,
});
