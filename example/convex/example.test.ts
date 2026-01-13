import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { initConvexTest } from "./setup.test";
import { api } from "./_generated/api";

describe("audit log example", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  test("createUser logs an audit event", async () => {
    const t = initConvexTest();

    // Create a user
    const userId = await t.mutation(api.example.createUser, {
      name: "Test User",
      email: "test@example.com",
      role: "admin",
    });

    expect(userId).toBeDefined();

    // Check that we can query the user's activity
    const activity = await t.query(api.example.getUserActivity, {
      userId: "anonymous", // Default actor since no auth identity set
      limit: 10,
    });

    // Should have at least one log entry for the user creation
    expect(activity.length).toBeGreaterThanOrEqual(1);
  });

  test("getAuditStats returns statistics", async () => {
    const t = initConvexTest();

    const stats = await t.query(api.example.getAuditStats, {
      hoursBack: 24,
    });

    expect(stats).toBeDefined();
    expect(typeof stats.totalCount).toBe("number");
  });

  test("watchSecurityEvents returns events", async () => {
    const t = initConvexTest();

    const events = await t.query(api.example.watchSecurityEvents, {});

    expect(events).toBeDefined();
    expect(Array.isArray(events)).toBe(true);
  });

  test("searchAuditLogs with filters", async () => {
    const t = initConvexTest();

    const results = await t.query(api.example.searchAuditLogs, {
      severity: ["info", "warning"],
      limit: 10,
    });

    expect(results).toBeDefined();
    expect(results.items).toBeDefined();
    expect(Array.isArray(results.items)).toBe(true);
  });
});
