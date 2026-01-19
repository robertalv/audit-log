/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          olderThanDays?: number;
          preserveSeverity?: Array<"info" | "warning" | "error" | "critical">;
          retentionCategory?: string;
        },
        number,
        Name
      >;
      detectAnomalies: FunctionReference<
        "query",
        "internal",
        {
          patterns: Array<{
            action: string;
            threshold: number;
            windowMinutes: number;
          }>;
        },
        Array<{
          action: string;
          count: number;
          detectedAt: number;
          threshold: number;
          windowMinutes: number;
        }>,
        Name
      >;
      generateReport: FunctionReference<
        "query",
        "internal",
        {
          endDate: number;
          format: "json" | "csv";
          groupBy?: string;
          includeFields?: Array<string>;
          maxRecords?: number;
          startDate: number;
        },
        {
          data: string;
          format: "json" | "csv";
          generatedAt: number;
          recordCount: number;
          truncated: boolean;
        },
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        },
        Name
      >;
      getConfig: FunctionReference<
        "query",
        "internal",
        {},
        null | {
          _creationTime: number;
          _id: string;
          criticalRetentionDays: number;
          customRetention?: Array<{ category: string; retentionDays: number }>;
          defaultRetentionDays: number;
          piiFieldsToRedact: Array<string>;
          samplingEnabled: boolean;
          samplingRate: number;
        },
        Name
      >;
      getStats: FunctionReference<
        "query",
        "internal",
        { fromTimestamp?: number; toTimestamp?: number },
        {
          bySeverity: {
            critical: number;
            error: number;
            info: number;
            warning: number;
          };
          topActions: Array<{ action: string; count: number }>;
          topActors: Array<{ actorId: string; count: number }>;
          totalCount: number;
        },
        Name
      >;
      log: FunctionReference<
        "mutation",
        "internal",
        {
          action: string;
          actorId?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          userAgent?: string;
        },
        string,
        Name
      >;
      logBulk: FunctionReference<
        "mutation",
        "internal",
        {
          events: Array<{
            action: string;
            actorId?: string;
            ipAddress?: string;
            metadata?: any;
            resourceId?: string;
            resourceType?: string;
            retentionCategory?: string;
            sessionId?: string;
            severity: "info" | "warning" | "error" | "critical";
            tags?: Array<string>;
            userAgent?: string;
          }>;
        },
        Array<string>,
        Name
      >;
      logChange: FunctionReference<
        "mutation",
        "internal",
        {
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          generateDiff?: boolean;
          ipAddress?: string;
          resourceId: string;
          resourceType: string;
          retentionCategory?: string;
          sessionId?: string;
          severity?: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          userAgent?: string;
        },
        string,
        Name
      >;
      queryByAction: FunctionReference<
        "query",
        "internal",
        { action: string; fromTimestamp?: number; limit?: number },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>,
        Name
      >;
      queryByActor: FunctionReference<
        "query",
        "internal",
        {
          actions?: Array<string>;
          actorId: string;
          fromTimestamp?: number;
          limit?: number;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>,
        Name
      >;
      queryByResource: FunctionReference<
        "query",
        "internal",
        {
          fromTimestamp?: number;
          limit?: number;
          resourceId: string;
          resourceType: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>,
        Name
      >;
      queryBySeverity: FunctionReference<
        "query",
        "internal",
        {
          fromTimestamp?: number;
          limit?: number;
          severity: Array<"info" | "warning" | "error" | "critical">;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>,
        Name
      >;
      runBackfill: FunctionReference<
        "mutation",
        "internal",
        { batchSize?: number; cursor?: string },
        { cursor: string | null; isDone: boolean; processed: number },
        Name
      >;
      search: FunctionReference<
        "query",
        "internal",
        {
          filters: {
            actions?: Array<string>;
            actorIds?: Array<string>;
            fromTimestamp?: number;
            resourceTypes?: Array<string>;
            severity?: Array<"info" | "warning" | "error" | "critical">;
            tags?: Array<string>;
            toTimestamp?: number;
          };
          pagination: { cursor?: string; limit: number };
        },
        {
          cursor: string | null;
          hasMore: boolean;
          items: Array<{
            _creationTime: number;
            _id: string;
            action: string;
            actorId?: string;
            after?: any;
            before?: any;
            diff?: string;
            ipAddress?: string;
            metadata?: any;
            resourceId?: string;
            resourceType?: string;
            retentionCategory?: string;
            sessionId?: string;
            severity: "info" | "warning" | "error" | "critical";
            tags?: Array<string>;
            timestamp: number;
            userAgent?: string;
          }>;
        },
        Name
      >;
      updateConfig: FunctionReference<
        "mutation",
        "internal",
        {
          criticalRetentionDays?: number;
          customRetention?: Array<{ category: string; retentionDays: number }>;
          defaultRetentionDays?: number;
          piiFieldsToRedact?: Array<string>;
          samplingEnabled?: boolean;
          samplingRate?: number;
        },
        string,
        Name
      >;
      watchCritical: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          severity?: Array<"info" | "warning" | "error" | "critical">;
        },
        Array<{
          _creationTime: number;
          _id: string;
          action: string;
          actorId?: string;
          after?: any;
          before?: any;
          diff?: string;
          ipAddress?: string;
          metadata?: any;
          resourceId?: string;
          resourceType?: string;
          retentionCategory?: string;
          sessionId?: string;
          severity: "info" | "warning" | "error" | "critical";
          tags?: Array<string>;
          timestamp: number;
          userAgent?: string;
        }>,
        Name
      >;
    };
  };
