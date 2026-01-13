import { httpRouter } from "convex/server";

const http = httpRouter();

// The audit log component doesn't require HTTP routes for basic functionality.
// If you need to expose audit log data via HTTP (e.g., for external integrations),
// you can add custom routes here:

// http.route({
//   path: "/api/audit-logs",
//   method: "GET",
//   handler: httpAction(async (ctx, request) => {
//     const logs = await ctx.runQuery(api.example.searchAuditLogs, {
//       limit: 100,
//     });
//     return new Response(JSON.stringify(logs), {
//       headers: { "Content-Type": "application/json" },
//     });
//   }),
// });

export default http;
