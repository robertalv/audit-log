/// <reference types="vite/client" />
import { test } from "vitest";
import schema from "./schema.js";
import { convexTest } from "convex-test";
import aggregate from "@convex-dev/aggregate/test";

export const modules = import.meta.glob("./**/*.*s");

export function initConvexTest() {
  const t = convexTest(schema, modules);
  // Register aggregate sub-components
  aggregate.register(t, "aggregateBySeverity");
  aggregate.register(t, "aggregateByAction");
  return t;
}
test("setup", () => {});
