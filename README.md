# Convex Audit Log Component

[![npm version](https://badge.fury.io/js/convex-audit-log.svg)](https://badge.fury.io/js/convex-audit-log)

A comprehensive audit logging component for Convex that helps you track user actions, API calls, and system events with built-in compliance features.

## Features

- **Automatic Event Capture** - Log who, what, when, and where for any action
- **Change Tracking** - Record before/after states with automatic diff generation
- **PII Redaction** - Built-in privacy controls for sensitive data
- **Flexible Querying** - Query by actor, resource, severity, time range, and more
- **Real-time Monitoring** - Subscribe to critical events as they happen
- **Anomaly Detection** - Detect unusual patterns in event frequency
- **Report Generation** - Export audit logs as JSON or CSV
- **Configurable Retention** - Automatic cleanup with customizable policies
- **React Hooks** - Pre-built hooks for common UI patterns

## Installation

```bash
npm install convex-audit-log
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the component:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import auditLog from "convex-audit-log/convex.config.js";

const app = defineApp();
app.use(auditLog);

export default app;
```

## Quick Start

### 1. Create an AuditLog Client

```ts
// convex/auditLog.ts
import { AuditLog } from "convex-audit-log";
import { components } from "./_generated/api";

export const auditLog = new AuditLog(components.auditLog, {
  // Optional: Configure PII fields to automatically redact
  piiFields: ["email", "phone", "ssn", "password"],
});
```

### 2. Log Events in Your Mutations

```ts
import { mutation } from "./_generated/server";
import { auditLog } from "./auditLog";

export const updateUserProfile = mutation({
  args: { userId: v.id("users"), name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    // Get current state
    const before = await ctx.db.get(args.userId);

    // Perform the update
    await ctx.db.patch(args.userId, { name: args.name, email: args.email });

    // Get new state
    const after = await ctx.db.get(args.userId);

    // Log the change with automatic diff
    await auditLog.logChange(ctx, {
      action: "user.profile.updated",
      actorId: ctx.auth.getUserIdentity()?.subject,
      resourceType: "users",
      resourceId: args.userId,
      before,
      after,
      generateDiff: true,
      severity: "info",
    });

    return after;
  },
});
```

### 3. Query Audit Logs

```ts
import { query } from "./_generated/server";
import { auditLog } from "./auditLog";

// Get all changes to a specific document
export const getDocumentHistory = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    return await auditLog.queryByResource(ctx, {
      resourceType: "documents",
      resourceId: args.documentId,
      limit: 50,
    });
  },
});

// Get all actions by a specific user
export const getUserActivity = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await auditLog.queryByActor(ctx, {
      actorId: args.userId,
      limit: 50,
    });
  },
});

// Watch for critical security events
export const watchSecurityEvents = query({
  handler: async (ctx) => {
    return await auditLog.watchCritical(ctx, {
      severity: ["warning", "error", "critical"],
      limit: 20,
    });
  },
});
```

## API Reference

### Severity Levels

| Level | Description |
|-------|-------------|
| `info` | Regular operations (login, profile update) |
| `warning` | Potentially concerning actions (password change, permission change) |
| `error` | Failed operations or errors |
| `critical` | Security-sensitive events (unauthorized access, data breaches) |

### Core Methods

#### `log(ctx, event)`

Log a single audit event.

```ts
await auditLog.log(ctx, {
  action: "user.login",
  actorId: userId,
  severity: "info",
  metadata: { method: "password" },
  tags: ["authentication"],
});
```

#### `logChange(ctx, event)`

Log a change event with before/after states.

```ts
await auditLog.logChange(ctx, {
  action: "document.updated",
  actorId: userId,
  resourceType: "documents",
  resourceId: docId,
  before: { title: "Old Title" },
  after: { title: "New Title" },
  generateDiff: true, // Automatically generate diff
  severity: "info",
});
```

#### `logBulk(ctx, events)`

Log multiple events in a single transaction.

```ts
await auditLog.logBulk(ctx, [
  { action: "document.created", severity: "info", ... },
  { action: "notification.sent", severity: "info", ... },
]);
```

### Query Methods

#### `queryByResource(ctx, args)`

Query logs for a specific resource.

```ts
const history = await auditLog.queryByResource(ctx, {
  resourceType: "documents",
  resourceId: docId,
  limit: 50,
  fromTimestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // Last 7 days
});
```

#### `queryByActor(ctx, args)`

Query logs for a specific actor.

```ts
const activity = await auditLog.queryByActor(ctx, {
  actorId: userId,
  limit: 50,
  actions: ["user.login", "user.logout"], // Optional filter
});
```

#### `search(ctx, args)`

Advanced search with multiple filters.

```ts
const results = await auditLog.search(ctx, {
  filters: {
    severity: ["warning", "error", "critical"],
    actions: ["user.login.failed"],
    fromTimestamp: Date.now() - 24 * 60 * 60 * 1000,
    tags: ["security"],
  },
  pagination: { limit: 100 },
});
```

#### `watchCritical(ctx, args)`

Subscribe to critical events in real-time.

```ts
const criticalEvents = await auditLog.watchCritical(ctx, {
  severity: ["error", "critical"],
  limit: 20,
});
```

### Analytics Methods

#### `getStats(ctx, args)`

Get statistics for audit logs.

```ts
const stats = await auditLog.getStats(ctx, {
  fromTimestamp: Date.now() - 24 * 60 * 60 * 1000,
});
// Returns: { totalCount, bySeverity, topActions, topActors }
```

#### `detectAnomalies(ctx, patterns)`

Detect anomalies based on event frequency.

```ts
const anomalies = await auditLog.detectAnomalies(ctx, [
  { action: "user.login.failed", threshold: 5, windowMinutes: 5 },
  { action: "record.deleted", threshold: 50, windowMinutes: 60 },
]);
```

#### `generateReport(ctx, args)`

Generate a compliance report.

```ts
const report = await auditLog.generateReport(ctx, {
  startDate: startOfMonth,
  endDate: endOfMonth,
  format: "csv", // or "json"
  includeFields: ["timestamp", "action", "actorId", "resourceType"],
  groupBy: "action",
});
```

### Maintenance Methods

#### `cleanup(ctx, options)`

Clean up old audit logs based on retention policies.

```ts
const deletedCount = await auditLog.cleanup(ctx, {
  olderThanDays: 90,
  preserveSeverity: ["critical"], // Keep critical events forever
  batchSize: 100,
});
```

## React Hooks

```tsx
import {
  useAuditLogByResource,
  useWatchCriticalEvents,
  useAuditLogStats,
  formatTimestamp,
  getSeverityColor,
} from "convex-audit-log/react";
import { api } from "../convex/_generated/api";

function DocumentHistory({ documentId }: { documentId: string }) {
  const logs = useAuditLogByResource(api.auditLog.queryByResource, {
    resourceType: "documents",
    resourceId: documentId,
    limit: 20,
  });

  if (!logs) return <div>Loading...</div>;

  return (
    <ul>
      {logs.map((log) => (
        <li key={log._id} style={{ borderLeftColor: getSeverityColor(log.severity) }}>
          <strong>{log.action}</strong>
          <span>{formatTimestamp(log.timestamp)}</span>
        </li>
      ))}
    </ul>
  );
}
```

## Pre-defined Action Constants

Use the provided action constants for consistency:

```ts
import { AuditActions } from "convex-audit-log";

await auditLog.log(ctx, {
  action: AuditActions.USER_LOGIN,
  // ...
});
```

Available actions:
- `USER_LOGIN`, `USER_LOGIN_FAILED`, `USER_LOGOUT`, `USER_SIGNUP`
- `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED`
- `MFA_ENABLED`, `MFA_DISABLED`
- `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- `USER_ROLE_CHANGED`, `USER_PERMISSIONS_CHANGED`
- `RECORD_CREATED`, `RECORD_UPDATED`, `RECORD_DELETED`, `RECORD_VIEWED`, `RECORD_EXPORTED`
- `SETTINGS_CHANGED`, `API_KEY_CREATED`, `API_KEY_REVOKED`
- `UNAUTHORIZED_ACCESS`, `SUSPICIOUS_ACTIVITY`, `RATE_LIMIT_EXCEEDED`

## Exposing API to React Clients

```ts
// convex/auditLog.ts
import { exposeAuditLogApi } from "convex-audit-log";
import { components } from "./_generated/api";

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
```

## Testing

```ts
import { test } from "vitest";
import { convexTest } from "convex-test";
import auditLogComponent from "convex-audit-log/test";
import schema from "./schema";

test("audit logging", async () => {
  const t = convexTest(schema);
  auditLogComponent.register(t);

  await t.run(async (ctx) => {
    // Test your audit log functionality
  });
});
```

## Example App

Run the example app to see the component in action:

```sh
npm install
npm run dev
```

The example app includes:
- Event generation demo
- Real-time log viewer
- Analytics dashboard with statistics
- Anomaly detection monitoring

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development instructions.

## License

Apache-2.0
