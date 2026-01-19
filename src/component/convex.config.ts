import { defineComponent } from "convex/server";
import aggregate from "@convex-dev/aggregate/convex.config";

const component = defineComponent("auditLog");

// Aggregate for efficient counting by severity
component.use(aggregate, { name: "aggregateBySeverity" });

// Aggregate for efficient counting by action
component.use(aggregate, { name: "aggregateByAction" });

export default component;
