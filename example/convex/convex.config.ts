import { defineApp } from "convex/server";
import auditLog from "@convex-dev/audit-log/convex.config.js";

const app = defineApp();
app.use(auditLog, { name: "auditLog" });

export default app;
