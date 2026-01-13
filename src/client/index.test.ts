import { describe, expect, test } from "vitest";
import { exposeAuditLogApi } from "./index.js";
import { anyApi, type ApiFromModules } from "convex/server";
import { components, initConvexTest } from "./setup.test.js";

// Re-export the audit log API for testing
export const { queryByResource, queryByActor, getStats, watchCritical } =
  exposeAuditLogApi(components.auditLog, {
    auth: async (ctx, _operation) => {
      return (await ctx.auth.getUserIdentity())?.subject ?? "anonymous";
    },
  });

const testApi = (
  anyApi as unknown as ApiFromModules<{
    "index.test": {
      queryByResource: typeof queryByResource;
      queryByActor: typeof queryByActor;
      getStats: typeof getStats;
      watchCritical: typeof watchCritical;
    };
  }>
)["index.test"];

describe("client tests", () => {
  test("should be able to query by resource (empty at start)", async () => {
    const t = initConvexTest().withIdentity({
      subject: "user1",
    });

    const logs = await t.query(testApi.queryByResource, {
      resourceType: "documents",
      resourceId: "doc123",
    });

    expect(logs).toHaveLength(0);
  });

  test("should be able to get stats (empty at start)", async () => {
    const t = initConvexTest().withIdentity({
      subject: "user1",
    });

    const stats = await t.query(testApi.getStats, {});

    expect(stats).toBeDefined();
    expect(stats.totalCount).toBe(0);
  });

  test("should be able to watch critical events (empty at start)", async () => {
    const t = initConvexTest().withIdentity({
      subject: "user1",
    });

    const criticalEvents = await t.query(testApi.watchCritical, {
      limit: 10,
    });

    expect(criticalEvents).toHaveLength(0);
  });
});
