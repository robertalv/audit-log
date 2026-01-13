"use client";

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

export type Severity = "info" | "warning" | "error" | "critical";

export interface AuditLogEntry {
  _id: string;
  _creationTime: number;
  action: string;
  actorId?: string;
  timestamp: number;
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
  severity: Severity;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  tags?: string[];
  before?: unknown;
  after?: unknown;
  diff?: string;
  retentionCategory?: string;
}

export interface AuditLogStats {
  totalCount: number;
  bySeverity: {
    info: number;
    warning: number;
    error: number;
    critical: number;
  };
  topActions: { action: string; count: number }[];
  topActors: { actorId: string; count: number }[];
}

export interface Anomaly {
  action: string;
  count: number;
  threshold: number;
  windowMinutes: number;
  detectedAt: number;
}

/**
 * Hook to query audit logs by resource.
 * Provides real-time updates when the audit log changes.
 *
 * @example
 * ```tsx
 * import { useAuditLogByResource } from "@convex-dev/audit-log/react";
 * import { api } from "../convex/_generated/api";
 *
 * function DocumentHistory({ documentId }: { documentId: string }) {
 *   const logs = useAuditLogByResource(api.auditLog.queryByResource, {
 *     resourceType: "documents",
 *     resourceId: documentId,
 *     limit: 20,
 *   });
 *
 *   if (!logs) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {logs.map((log) => (
 *         <li key={log._id}>
 *           {log.action} by {log.actorId} at {new Date(log.timestamp).toLocaleString()}
 *         </li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAuditLogByResource(
  queryRef: FunctionReference<
    "query",
    "public",
    { resourceType: string; resourceId: string; limit?: number; fromTimestamp?: number },
    AuditLogEntry[]
  >,
  args: {
    resourceType: string;
    resourceId: string;
    limit?: number;
    fromTimestamp?: number;
  }
): AuditLogEntry[] | undefined {
  return useQuery(queryRef, args);
}

/**
 * Hook to query audit logs by actor (user).
 *
 * @example
 * ```tsx
 * import { useAuditLogByActor } from "@convex-dev/audit-log/react";
 * import { api } from "../convex/_generated/api";
 *
 * function UserActivity({ userId }: { userId: string }) {
 *   const logs = useAuditLogByActor(api.auditLog.queryByActor, {
 *     actorId: userId,
 *     limit: 50,
 *   });
 *
 *   if (!logs) return <div>Loading...</div>;
 *
 *   return (
 *     <ul>
 *       {logs.map((log) => (
 *         <li key={log._id}>{log.action}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useAuditLogByActor(
  queryRef: FunctionReference<
    "query",
    "public",
    { actorId: string; limit?: number; fromTimestamp?: number; actions?: string[] },
    AuditLogEntry[]
  >,
  args: {
    actorId: string;
    limit?: number;
    fromTimestamp?: number;
    actions?: string[];
  }
): AuditLogEntry[] | undefined {
  return useQuery(queryRef, args);
}

/**
 * Hook to watch critical events in real-time.
 *
 * @example
 * ```tsx
 * import { useWatchCriticalEvents } from "@convex-dev/audit-log/react";
 * import { api } from "../convex/_generated/api";
 *
 * function SecurityAlerts() {
 *   const criticalEvents = useWatchCriticalEvents(api.auditLog.watchCritical, {
 *     limit: 10,
 *   });
 *
 *   if (!criticalEvents) return <div>Loading...</div>;
 *
 *   return (
 *     <div className="alerts">
 *       {criticalEvents.map((event) => (
 *         <div key={event._id} className={`alert alert-${event.severity}`}>
 *           {event.action}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useWatchCriticalEvents(
  queryRef: FunctionReference<
    "query",
    "public",
    { severity?: Severity[]; limit?: number },
    AuditLogEntry[]
  >,
  args?: {
    severity?: Severity[];
    limit?: number;
  }
): AuditLogEntry[] | undefined {
  return useQuery(queryRef, args ?? {});
}

/**
 * Hook to get audit log statistics.
 *
 * @example
 * ```tsx
 * import { useAuditLogStats } from "@convex-dev/audit-log/react";
 * import { api } from "../convex/_generated/api";
 *
 * function Dashboard() {
 *   const stats = useAuditLogStats(api.auditLog.getStats, {
 *     fromTimestamp: Date.now() - 24 * 60 * 60 * 1000, // Last 24 hours
 *   });
 *
 *   if (!stats) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h2>Total Events: {stats.totalCount}</h2>
 *       <div>Critical: {stats.bySeverity.critical}</div>
 *       <div>Errors: {stats.bySeverity.error}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAuditLogStats(
  queryRef: FunctionReference<
    "query",
    "public",
    { fromTimestamp?: number; toTimestamp?: number },
    AuditLogStats
  >,
  args?: {
    fromTimestamp?: number;
    toTimestamp?: number;
  }
): AuditLogStats | undefined {
  return useQuery(queryRef, args ?? {});
}

/**
 * Hook to detect anomalies in real-time.
 *
 * @example
 * ```tsx
 * import { useAnomalyDetection } from "@convex-dev/audit-log/react";
 * import { api } from "../convex/_generated/api";
 *
 * function AnomalyMonitor() {
 *   const anomalies = useAnomalyDetection(api.auditLog.detectAnomalies, {
 *     patterns: [
 *       { action: "user.login.failed", threshold: 5, windowMinutes: 5 },
 *       { action: "record.deleted", threshold: 10, windowMinutes: 1 },
 *     ],
 *   });
 *
 *   if (!anomalies) return <div>Loading...</div>;
 *   if (anomalies.length === 0) return <div>No anomalies detected</div>;
 *
 *   return (
 *     <div className="anomalies">
 *       {anomalies.map((anomaly, i) => (
 *         <div key={i} className="anomaly-alert">
 *           {anomaly.action}: {anomaly.count} events in {anomaly.windowMinutes} minutes
 *           (threshold: {anomaly.threshold})
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useAnomalyDetection(
  queryRef: FunctionReference<
    "query",
    "public",
    { patterns: { action: string; threshold: number; windowMinutes: number }[] },
    Anomaly[]
  >,
  args: {
    patterns: { action: string; threshold: number; windowMinutes: number }[];
  }
): Anomaly[] | undefined {
  return useQuery(queryRef, args);
}

/**
 * Formats a timestamp to a human-readable string.
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Returns a CSS class name based on severity.
 */
export function getSeverityClass(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "audit-severity-critical";
    case "error":
      return "audit-severity-error";
    case "warning":
      return "audit-severity-warning";
    case "info":
    default:
      return "audit-severity-info";
  }
}

/**
 * Returns a color based on severity (for inline styles).
 */
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "#dc2626"; // red-600
    case "error":
      return "#ea580c"; // orange-600
    case "warning":
      return "#ca8a04"; // yellow-600
    case "info":
    default:
      return "#2563eb"; // blue-600
  }
}
