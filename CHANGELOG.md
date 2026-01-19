# Changelog

## 0.2.0

### Performance Improvements

- **Added `@convex-dev/aggregate` for O(log n) counting operations**
  - Severity counts in `getStats` now use aggregates instead of reading all documents
  - Anomaly detection in `detectAnomalies` uses aggregates for efficient threshold checking
  - Added `aggregateBySeverity` and `aggregateByAction` sub-components

- **Fixed unbounded queries that could cause performance issues at scale**
  - `getStats`: Severity counts use aggregates; top actions/actors limited to 1000 document sample
  - `detectAnomalies`: Uses aggregate counts instead of `.collect()`
  - `generateReport`: Now limited to 10,000 records max with `truncated` flag in response

### New Features

- **Backfill support for existing data**
  - Added `runBackfill` mutation to populate aggregates for existing audit logs
  - Added `backfillAggregates` method to client wrapper
  - Supports cursor-based pagination for large datasets

### Breaking Changes

- `generateReport` response now includes a `truncated: boolean` field
- `generateReport` accepts optional `maxRecords` argument (default: 10,000)
- Users upgrading should run `backfillAggregates` once to populate aggregate tables

### Migration Guide

After upgrading to 0.2.0, run the backfill to populate aggregates:

```typescript
// In a mutation or action
let cursor: string | null = null;
let isDone = false;
while (!isDone) {
  const result = await auditLog.backfillAggregates(ctx, { cursor });
  cursor = result.cursor;
  isDone = result.isDone;
  console.log(`Processed ${result.processed} records`);
}
```

## 0.1.1

- Fix real-time reactivity for stats and anomaly detection queries
- Add visual animations for real-time updates in demo app
  - New log entries flash and slide in
  - Stats values animate when they change
  - Enhanced live indicator with glow effect
  - Anomaly alerts shake and flash on detection
- Improve query performance by removing unnecessary upper bounds

## 0.1.0

- Initial public release with core audit logging functionality
- Support for logging events, change tracking, and bulk operations
- Query APIs for resource, actor, severity, and action-based searches
- Statistics and anomaly detection
- Compliance report generation
- React hooks for real-time subscriptions
- PII redaction and retention policies

## 0.0.0

- Initial release.
