import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api, components } from "./_generated/api";

interface AuditLogEntry {
  _id: string;
  action: string;
  actorId?: string;
  timestamp: number;
  severity: "info" | "warning" | "error" | "critical";
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  diff?: unknown;
}

describe("audit log example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  // ============================================
  // User CRUD Operations
  // ============================================

  describe("user operations", () => {
    test("createUser logs an audit event", async () => {
      const t = initConvexTest();

      const userId = await t.mutation(api.example.createUser, {
        name: "Test User",
        email: "test@example.com",
        role: "admin",
      });

      expect(userId).toBeDefined();

      // Check that we can query the user's activity
      const activity = await t.query(api.example.getUserActivity, {
        userId: "anonymous",
        limit: 10,
      });

      expect(activity.length).toBeGreaterThanOrEqual(1);
      expect(activity[0].action).toBe("user.created");
      expect(activity[0].resourceType).toBe("users");
      expect(activity[0].resourceId).toBe(userId);
    });

    test("updateUser logs a change event with diff", async () => {
      const t = initConvexTest();

      // Create a user first
      const userId = await t.mutation(api.example.createUser, {
        name: "Original Name",
        email: "original@example.com",
        role: "user",
      });

      // Update the user
      const updated = await t.mutation(api.example.updateUser, {
        userId,
        name: "Updated Name",
        role: "admin",
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.role).toBe("admin");

      // Query using the component directly for user resource
      const history = await t.query(components.auditLog.lib.queryByResource, {
        resourceType: "users",
        resourceId: userId,
      });

      // Should have create and update events
      expect(history.length).toBe(2);

      // Most recent should be the update (descending order)
      const updateEvent = history.find((e) => e.action === "user.updated");
      expect(updateEvent).toBeDefined();
      expect(updateEvent?.diff).toContain("name");
      expect(updateEvent?.before).toMatchObject({ name: "Original Name" });
      expect(updateEvent?.after).toMatchObject({ name: "Updated Name" });
    });

    test("deleteUser logs a warning-level event", async () => {
      const t = initConvexTest();

      // Create a user first
      const userId = await t.mutation(api.example.createUser, {
        name: "To Be Deleted",
        email: "delete@example.com",
        role: "user",
      });

      // Delete the user
      const result = await t.mutation(api.example.deleteUser, { userId });
      expect(result.deleted).toBe(true);

      // Query security events (which includes warnings)
      const events = await t.query(api.example.watchSecurityEvents, {});

      // Should have a warning-level delete event
      const deleteEvent = events.find((e: AuditLogEntry) => e.action === "user.deleted");
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent?.severity).toBe("warning");
      expect(deleteEvent?.metadata?.deletedUserName).toBe("To Be Deleted");
    });
  });

  // ============================================
  // Document CRUD Operations
  // ============================================

  describe("document operations", () => {
    test("createDocument logs an audit event", async () => {
      const t = initConvexTest();

      const content = "This is test content for the document.";
      const docId = await t.mutation(api.example.createDocument, {
        title: "Test Document",
        content,
      });

      expect(docId).toBeDefined();

      // Query the document history
      const history = await t.query(api.example.getDocumentHistory, {
        documentId: docId,
      });

      expect(history.length).toBe(1);
      expect(history[0].action).toBe("record.created");
      expect(history[0].metadata?.title).toBe("Test Document");
      expect(history[0].metadata?.contentLength).toBe(content.length);
    });

    test("updateDocument logs a change event with before/after", async () => {
      const t = initConvexTest();

      // Create a document
      const docId = await t.mutation(api.example.createDocument, {
        title: "Original Title",
        content: "Original content",
      });

      // Update the document
      await t.mutation(api.example.updateDocument, {
        documentId: docId,
        title: "New Title",
        content: "Updated content with more text",
      });

      // Query the document history
      const history = await t.query(api.example.getDocumentHistory, {
        documentId: docId,
      });

      expect(history.length).toBe(2);

      // Most recent should be the update
      const updateEvent = history[0];
      expect(updateEvent.action).toBe("record.updated");
      expect(updateEvent.before?.title).toBe("Original Title");
      expect(updateEvent.after?.title).toBe("New Title");
      expect(updateEvent.diff).toBeDefined();
    });

    test("multiple document updates maintain full history", async () => {
      const t = initConvexTest();

      const docId = await t.mutation(api.example.createDocument, {
        title: "V1",
        content: "First version",
      });

      await t.mutation(api.example.updateDocument, {
        documentId: docId,
        title: "V2",
      });

      await t.mutation(api.example.updateDocument, {
        documentId: docId,
        title: "V3",
      });

      await t.mutation(api.example.updateDocument, {
        documentId: docId,
        title: "V4",
      });

      const history = await t.query(api.example.getDocumentHistory, {
        documentId: docId,
      });

      // 1 create + 3 updates = 4 events
      expect(history.length).toBe(4);
    });
  });

  // ============================================
  // Security Events
  // ============================================

  describe("security events", () => {
    test("logFailedLogin records warning-level event", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.logFailedLogin, {
        email: "attacker@example.com",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
      });

      const events = await t.query(api.example.watchSecurityEvents, {});

      const failedLogin = events.find((e: AuditLogEntry) => e.action === "user.login.failed");
      expect(failedLogin).toBeDefined();
      expect(failedLogin?.severity).toBe("warning");
      expect(failedLogin?.ipAddress).toBe("192.168.1.100");
      expect(failedLogin?.actorId).toBe("attacker@example.com");
    });

    test("logUnauthorizedAccess records critical-level event", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.logUnauthorizedAccess, {
        resourceType: "admin-panel",
        resourceId: "settings",
        attemptedAction: "delete-all-users",
      });

      const events = await t.query(api.example.watchSecurityEvents, {});

      const unauthorized = events.find(
        (e: AuditLogEntry) => e.action === "security.unauthorized_access"
      );
      expect(unauthorized).toBeDefined();
      expect(unauthorized?.severity).toBe("critical");
      expect(unauthorized?.metadata?.attemptedAction).toBe("delete-all-users");
    });

    test("multiple failed logins are recorded", async () => {
      const t = initConvexTest();

      // Simulate brute force attempt
      for (let i = 0; i < 5; i++) {
        await t.mutation(api.example.logFailedLogin, {
          email: "victim@example.com",
          ipAddress: "10.0.0.1",
        });
      }

      const events = await t.query(api.example.watchSecurityEvents, {});
      const failedLogins = events.filter(
        (e: AuditLogEntry) => e.action === "user.login.failed"
      );

      expect(failedLogins.length).toBe(5);
    });
  });

  // ============================================
  // Anomaly Detection
  // ============================================

  describe("anomaly detection", () => {
    test("detectLoginAnomalies returns empty when below threshold", async () => {
      const t = initConvexTest();

      // Log only 2 failed logins (below threshold of 5)
      await t.mutation(api.example.logFailedLogin, {
        email: "user1@example.com",
      });
      await t.mutation(api.example.logFailedLogin, {
        email: "user2@example.com",
      });

      const anomalies = await t.query(api.example.detectLoginAnomalies, {});

      // Should not detect anomaly (threshold is 5)
      const loginAnomaly = anomalies.find(
        (a) => a.action === "user.login.failed"
      );
      expect(loginAnomaly).toBeUndefined();
    });

    test("detectLoginAnomalies detects when threshold exceeded", async () => {
      const t = initConvexTest();

      // Log 6 failed logins (above threshold of 5)
      for (let i = 0; i < 6; i++) {
        await t.mutation(api.example.logFailedLogin, {
          email: `attacker${i}@example.com`,
        });
      }

      const anomalies = await t.query(api.example.detectLoginAnomalies, {});

      const loginAnomaly = anomalies.find(
        (a) => a.action === "user.login.failed"
      );
      expect(loginAnomaly).toBeDefined();
      expect(loginAnomaly?.count).toBeGreaterThanOrEqual(5);
      expect(loginAnomaly?.threshold).toBe(5);
    });

    test("detectLoginAnomalies detects unauthorized access anomalies", async () => {
      const t = initConvexTest();

      // Log 4 unauthorized access attempts (above threshold of 3)
      for (let i = 0; i < 4; i++) {
        await t.mutation(api.example.logUnauthorizedAccess, {
          resourceType: "admin",
          resourceId: `resource-${i}`,
          attemptedAction: "read",
        });
      }

      const anomalies = await t.query(api.example.detectLoginAnomalies, {});

      const accessAnomaly = anomalies.find(
        (a) => a.action === "security.unauthorized_access"
      );
      expect(accessAnomaly).toBeDefined();
      expect(accessAnomaly?.count).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================
  // Statistics
  // ============================================

  describe("statistics", () => {
    test("getAuditStats returns correct counts", async () => {
      const t = initConvexTest();

      // Create some events with different severities
      await t.mutation(api.example.createUser, {
        name: "User 1",
        email: "user1@example.com",
        role: "user",
      });
      await t.mutation(api.example.createUser, {
        name: "User 2",
        email: "user2@example.com",
        role: "admin",
      });
      await t.mutation(api.example.logFailedLogin, {
        email: "attacker@example.com",
      });
      await t.mutation(api.example.logUnauthorizedAccess, {
        resourceType: "secret",
        resourceId: "data",
        attemptedAction: "read",
      });

      const stats = await t.query(api.example.getAuditStats, { hoursBack: 24 });

      expect(stats.totalCount).toBe(4);
      expect(stats.bySeverity.info).toBe(2); // 2 user creations
      expect(stats.bySeverity.warning).toBe(1); // 1 failed login
      expect(stats.bySeverity.critical).toBe(1); // 1 unauthorized access
    });

    test("getAuditStats returns top actions", async () => {
      const t = initConvexTest();

      // Create multiple user events
      for (let i = 0; i < 3; i++) {
        await t.mutation(api.example.createUser, {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          role: "user",
        });
      }

      const stats = await t.query(api.example.getAuditStats, { hoursBack: 24 });

      expect(stats.topActions.length).toBeGreaterThan(0);
      const userCreated = stats.topActions.find(
        (a) => a.action === "user.created"
      );
      expect(userCreated?.count).toBe(3);
    });
  });

  // ============================================
  // Search and Filtering
  // ============================================

  describe("search and filtering", () => {
    test("searchAuditLogs filters by severity", async () => {
      const t = initConvexTest();

      // Create events with different severities
      await t.mutation(api.example.createUser, {
        name: "Normal User",
        email: "normal@example.com",
        role: "user",
      });
      await t.mutation(api.example.logFailedLogin, {
        email: "attacker@example.com",
      });

      const infoOnly = await t.query(api.example.searchAuditLogs, {
        severity: ["info"],
        limit: 10,
      });

      expect(infoOnly.items.every((item) => item.severity === "info")).toBe(
        true
      );
    });

    test("searchAuditLogs filters by actions", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.createUser, {
        name: "Test",
        email: "test@example.com",
        role: "user",
      });
      await t.mutation(api.example.createDocument, {
        title: "Doc",
        content: "Content",
      });

      const userActionsOnly = await t.query(api.example.searchAuditLogs, {
        actions: ["user.created"],
        limit: 10,
      });

      expect(
        userActionsOnly.items.every((item) => item.action === "user.created")
      ).toBe(true);
    });

    test("searchAuditLogs returns pagination info", async () => {
      const t = initConvexTest();

      // Create 5 events
      for (let i = 0; i < 5; i++) {
        await t.mutation(api.example.createUser, {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          role: "user",
        });
      }

      const page1 = await t.query(api.example.searchAuditLogs, {
        limit: 2,
      });

      expect(page1.items.length).toBe(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.cursor).toBeDefined();
    });
  });

  // ============================================
  // Report Generation
  // ============================================

  describe("report generation", () => {
    test("generateComplianceReport returns JSON format", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.createUser, {
        name: "Report User",
        email: "report@example.com",
        role: "user",
      });

      const now = Date.now();
      const report = await t.query(api.example.generateComplianceReport, {
        startDate: now - 24 * 60 * 60 * 1000,
        endDate: now + 1000,
        format: "json",
      });

      expect(report.format).toBe("json");
      expect(report.recordCount).toBeGreaterThan(0);
      expect(typeof report.data).toBe("string");

      const parsed = JSON.parse(report.data);
      expect(parsed).toBeDefined();
    });

    test("generateComplianceReport returns CSV format", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.createUser, {
        name: "CSV User",
        email: "csv@example.com",
        role: "user",
      });

      const now = Date.now();
      const report = await t.query(api.example.generateComplianceReport, {
        startDate: now - 24 * 60 * 60 * 1000,
        endDate: now + 1000,
        format: "csv",
      });

      expect(report.format).toBe("csv");
      expect(report.data).toContain("timestamp,action,actorId");
      expect(report.recordCount).toBeGreaterThan(0);
    });

    test("generateComplianceReport includes truncated flag", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.createUser, {
        name: "Test",
        email: "test@example.com",
        role: "user",
      });

      const now = Date.now();
      const report = await t.query(api.example.generateComplianceReport, {
        startDate: now - 24 * 60 * 60 * 1000,
        endDate: now + 1000,
        format: "json",
      });

      // With few records, should not be truncated
      expect(report.truncated).toBe(false);
    });
  });

  // ============================================
  // Cleanup
  // ============================================

  describe("cleanup", () => {
    test("cleanupOldLogs returns deleted count", async () => {
      const t = initConvexTest();

      // Create some logs
      await t.mutation(api.example.createUser, {
        name: "Old User",
        email: "old@example.com",
        role: "user",
      });

      // Cleanup with 0 days should delete nothing since logs are new
      const result = await t.mutation(api.example.cleanupOldLogs, {
        olderThanDays: 90,
      });

      expect(typeof result.deletedCount).toBe("number");
      // Logs are fresh, so nothing should be deleted
      expect(result.deletedCount).toBe(0);
    });
  });

  // ============================================
  // Backfill Aggregates (New Feature)
  // ============================================

  describe("backfill aggregates", () => {
    test("runBackfill processes existing records", async () => {
      const t = initConvexTest();

      // Create some audit log entries
      await t.mutation(api.example.createUser, {
        name: "Backfill User 1",
        email: "backfill1@example.com",
        role: "user",
      });
      await t.mutation(api.example.createUser, {
        name: "Backfill User 2",
        email: "backfill2@example.com",
        role: "admin",
      });

      // Run backfill - since we use aggregates now, this tests the backfill mutation
      const result = await t.mutation(components.auditLog.lib.runBackfill, {
        batchSize: 10,
      });

      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(typeof result.isDone).toBe("boolean");
    });

    test("runBackfill supports cursor-based pagination", async () => {
      const t = initConvexTest();

      // Create several audit log entries
      for (let i = 0; i < 5; i++) {
        await t.mutation(api.example.createUser, {
          name: `Batch User ${i}`,
          email: `batch${i}@example.com`,
          role: "user",
        });
      }

      // Run backfill with small batch size
      const result1 = await t.mutation(components.auditLog.lib.runBackfill, {
        batchSize: 2,
      });

      // If there are more records, we should get a cursor
      if (!result1.isDone) {
        expect(result1.cursor).toBeDefined();

        // Continue with cursor
        const result2 = await t.mutation(components.auditLog.lib.runBackfill, {
          cursor: result1.cursor ?? undefined,
          batchSize: 2,
        });

        expect(result2.processed).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ============================================
  // Query by Resource/Actor
  // ============================================

  describe("query helpers", () => {
    test("getDocumentHistory returns events for specific resource", async () => {
      const t = initConvexTest();

      // Create two documents
      const doc1 = await t.mutation(api.example.createDocument, {
        title: "Doc 1",
        content: "Content 1",
      });
      const doc2 = await t.mutation(api.example.createDocument, {
        title: "Doc 2",
        content: "Content 2",
      });

      // Update only doc1
      await t.mutation(api.example.updateDocument, {
        documentId: doc1,
        title: "Doc 1 Updated",
      });

      // Query history for doc1 only
      const history = await t.query(api.example.getDocumentHistory, {
        documentId: doc1,
      });

      expect(history.length).toBe(2); // create + update
      expect(history.every((e: AuditLogEntry) => e.resourceId === doc1)).toBe(true);
    });

    test("getUserActivity returns events for specific actor", async () => {
      const t = initConvexTest();

      // All events will be from "anonymous" in tests
      await t.mutation(api.example.createUser, {
        name: "Activity User",
        email: "activity@example.com",
        role: "user",
      });

      const activity = await t.query(api.example.getUserActivity, {
        userId: "anonymous",
        limit: 5,
      });

      expect(activity.length).toBeGreaterThan(0);
      expect(activity.every((e: AuditLogEntry) => e.actorId === "anonymous")).toBe(true);
    });
  });

  // ============================================
  // Exposed API
  // ============================================

  describe("exposed API", () => {
    test("exposeAuditLogApi functions work correctly", async () => {
      const t = initConvexTest();

      // Create some data
      await t.mutation(api.example.createDocument, {
        title: "API Test Doc",
        content: "Testing the exposed API",
      });

      // Test queryByResource via exposed API
      const resourceLogs = await t.query(api.example.queryByResource, {
        resourceType: "documents",
        resourceId: "test-id",
      });

      expect(Array.isArray(resourceLogs)).toBe(true);
    });

    test("getStats returns proper structure", async () => {
      const t = initConvexTest();

      const stats = await t.query(api.example.getStats, {});

      expect(stats).toHaveProperty("totalCount");
      expect(stats).toHaveProperty("bySeverity");
      expect(stats).toHaveProperty("topActions");
      expect(stats).toHaveProperty("topActors");
      expect(stats.bySeverity).toHaveProperty("info");
      expect(stats.bySeverity).toHaveProperty("warning");
      expect(stats.bySeverity).toHaveProperty("error");
      expect(stats.bySeverity).toHaveProperty("critical");
    });

    test("watchCritical returns security events", async () => {
      const t = initConvexTest();

      await t.mutation(api.example.logUnauthorizedAccess, {
        resourceType: "test",
        resourceId: "123",
        attemptedAction: "delete",
      });

      const critical = await t.query(api.example.watchCritical, {});

      expect(Array.isArray(critical)).toBe(true);
      expect(critical.length).toBeGreaterThan(0);
    });
  });
});
