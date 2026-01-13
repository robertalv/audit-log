/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("audit log component", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("can log a basic audit event", async () => {
    const t = initConvexTest();

    const logId = await t.mutation(api.lib.log, {
      action: "user.login",
      actorId: "user123",
      severity: "info",
      metadata: { method: "password" },
    });

    expect(logId).toBeDefined();

    const result = await t.query(api.lib.get, { id: logId });
    expect(result).not.toBeNull();
    expect(result?.action).toBe("user.login");
    expect(result?.actorId).toBe("user123");
    expect(result?.severity).toBe("info");
  });

  test("can log a change event with diff", async () => {
    const t = initConvexTest();

    const logId = await t.mutation(api.lib.logChange, {
      action: "document.updated",
      actorId: "user123",
      resourceType: "documents",
      resourceId: "doc456",
      before: { title: "Old Title" },
      after: { title: "New Title" },
      generateDiff: true,
    });

    expect(logId).toBeDefined();

    const result = await t.query(api.lib.get, { id: logId });
    expect(result).not.toBeNull();
    expect(result?.before).toEqual({ title: "Old Title" });
    expect(result?.after).toEqual({ title: "New Title" });
    expect(result?.diff).toContain("title");
  });

  test("can query by resource", async () => {
    const t = initConvexTest();

    // Log some events for a resource
    await t.mutation(api.lib.log, {
      action: "document.created",
      resourceType: "documents",
      resourceId: "doc123",
      severity: "info",
    });

    await t.mutation(api.lib.log, {
      action: "document.updated",
      resourceType: "documents",
      resourceId: "doc123",
      severity: "info",
    });

    const results = await t.query(api.lib.queryByResource, {
      resourceType: "documents",
      resourceId: "doc123",
    });

    expect(results).toHaveLength(2);
  });

  test("can query by actor", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.log, {
      action: "user.login",
      actorId: "user123",
      severity: "info",
    });

    await t.mutation(api.lib.log, {
      action: "user.logout",
      actorId: "user123",
      severity: "info",
    });

    const results = await t.query(api.lib.queryByActor, {
      actorId: "user123",
    });

    expect(results).toHaveLength(2);
  });

  test("can query by severity", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.log, {
      action: "user.login",
      severity: "info",
    });

    await t.mutation(api.lib.log, {
      action: "user.login.failed",
      severity: "warning",
    });

    await t.mutation(api.lib.log, {
      action: "security.breach",
      severity: "critical",
    });

    const criticalEvents = await t.query(api.lib.queryBySeverity, {
      severity: ["critical"],
    });

    expect(criticalEvents).toHaveLength(1);
    expect(criticalEvents[0].action).toBe("security.breach");
  });

  test("can get stats", async () => {
    const t = initConvexTest();

    await t.mutation(api.lib.log, {
      action: "user.login",
      actorId: "user1",
      severity: "info",
    });

    await t.mutation(api.lib.log, {
      action: "user.login",
      actorId: "user2",
      severity: "info",
    });

    await t.mutation(api.lib.log, {
      action: "user.login.failed",
      severity: "warning",
    });

    const stats = await t.query(api.lib.getStats, {});

    expect(stats.totalCount).toBe(3);
    expect(stats.bySeverity.info).toBe(2);
    expect(stats.bySeverity.warning).toBe(1);
    expect(stats.topActions).toContainEqual({ action: "user.login", count: 2 });
  });

  test("can bulk log events", async () => {
    const t = initConvexTest();

    const ids = await t.mutation(api.lib.logBulk, {
      events: [
        { action: "event1", severity: "info" },
        { action: "event2", severity: "info" },
        { action: "event3", severity: "warning" },
      ],
    });

    expect(ids).toHaveLength(3);
  });
});
