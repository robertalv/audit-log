/// <reference types="vite/client" />
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";
import aggregate from "@convex-dev/aggregate/test";

const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register the component with the test convex instance.
 * @param t - The test convex instance, e.g. from calling `convexTest`.
 * @param name - The name of the component, as registered in convex.config.ts.
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "auditLog",
) {
  t.registerComponent(name, schema, modules);
  // Register aggregate sub-components
  aggregate.register(t, `${name}/aggregateBySeverity`);
  aggregate.register(t, `${name}/aggregateByAction`);
}
export default { register, schema, modules };
