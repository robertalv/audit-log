import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import {
  formatTimestamp,
  getSeverityColor,
} from "@convex-dev/audit-log/react";

function App() {
  const [activeTab, setActiveTab] = useState<"demo" | "logs" | "stats">("demo");

  return (
    <div className="app">
      <h1>Audit Log Demo</h1>

      <div className="tabs">
        <button
          className={activeTab === "demo" ? "active" : ""}
          onClick={() => setActiveTab("demo")}
        >
          Generate Events
        </button>
        <button
          className={activeTab === "logs" ? "active" : ""}
          onClick={() => setActiveTab("logs")}
        >
          View Logs
        </button>
        <button
          className={activeTab === "stats" ? "active" : ""}
          onClick={() => setActiveTab("stats")}
        >
          Statistics
        </button>
      </div>

      <div className="content">
        {activeTab === "demo" && <DemoSection />}
        {activeTab === "logs" && <LogsSection />}
        {activeTab === "stats" && <StatsSection />}
      </div>
    </div>
  );
}

function DemoSection() {
  const createUser = useMutation(api.example.createUser);
  const deleteUser = useMutation(api.example.deleteUser);
  const createDocument = useMutation(api.example.createDocument);
  const logFailedLogin = useMutation(api.example.logFailedLogin);
  const logUnauthorizedAccess = useMutation(api.example.logUnauthorizedAccess);

  const [userName, setUserName] = useState("John Doe");
  const [userEmail, setUserEmail] = useState("john@example.com");
  const [lastUserId, setLastUserId] = useState<string | null>(null);

  const handleCreateUser = async () => {
    const userId = await createUser({
      name: userName,
      email: userEmail,
      role: "user",
    });
    setLastUserId(userId);
  };

  const handleDeleteUser = async () => {
    if (lastUserId) {
      await deleteUser({ userId: lastUserId as any });
      setLastUserId(null);
    }
  };

  return (
    <div className="section">
      <div className="card">
        <h3>User Management</h3>
        <div className="form-group">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Name"
          />
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="Email"
          />
        </div>
        <div className="button-group">
          <button onClick={handleCreateUser}>Create User</button>
          <button onClick={handleDeleteUser} disabled={!lastUserId}>
            Delete User
          </button>
        </div>
        {lastUserId && <p className="info">User ID: {lastUserId}</p>}
      </div>

      <div className="card">
        <h3>Document Operations</h3>
        <button
          onClick={() =>
            createDocument({
              title: "Sample Document " + Date.now(),
              content: "This is a sample document content.",
            })
          }
        >
          Create Document
        </button>
      </div>

      <div className="card">
        <h3>Security Events</h3>
        <div className="button-group">
          <button
            onClick={() =>
              logFailedLogin({
                email: "hacker@evil.com",
                ipAddress: "192.168.1.100",
                userAgent: "Mozilla/5.0",
              })
            }
          >
            Failed Login
          </button>
          <button
            onClick={() =>
              logUnauthorizedAccess({
                resourceType: "documents",
                resourceId: "secret-doc-123",
                attemptedAction: "delete",
              })
            }
          >
            Unauthorized Access
          </button>
        </div>
      </div>
    </div>
  );
}

function LogsSection() {
  const securityEvents = useQuery(api.example.watchSecurityEvents);
  const searchResult = useQuery(api.example.searchAuditLogs, {
    limit: 50,
  });

  return (
    <div className="section">
      <div className="logs-grid">
        <div className="card">
          <h3>All Events</h3>
          <div className="log-list">
            {searchResult?.items?.map((log: LogEntryProps["log"]) => (
              <LogEntry key={log._id} log={log} />
            ))}
            {(!searchResult?.items || searchResult.items.length === 0) && (
              <p className="empty">No audit logs yet.</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3>Security Events</h3>
          <div className="log-list">
            {securityEvents?.map((log: LogEntryProps["log"]) => (
              <LogEntry key={log._id} log={log} />
            ))}
            {(!securityEvents || securityEvents.length === 0) && (
              <p className="empty">No security events.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsSection() {
  const stats = useQuery(api.example.getAuditStats, { hoursBack: 24 });
  const anomalies = useQuery(api.example.detectLoginAnomalies);

  if (!stats) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="section">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalCount}</div>
          <div className="stat-label">Total (24h)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bySeverity.info}</div>
          <div className="stat-label">Info</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bySeverity.warning}</div>
          <div className="stat-label">Warning</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bySeverity.error}</div>
          <div className="stat-label">Error</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.bySeverity.critical}</div>
          <div className="stat-label">Critical</div>
        </div>
      </div>

      <div className="analytics-row">
        <div className="card">
          <h3>Top Actions</h3>
          <ul className="list">
            {stats.topActions.map((item: { action: string; count: number }, i: number) => (
              <li key={i}>
                <span>{item.action}</span>
                <span>{item.count}</span>
              </li>
            ))}
            {stats.topActions.length === 0 && <li className="empty">No actions.</li>}
          </ul>
        </div>

        <div className="card">
          <h3>Top Actors</h3>
          <ul className="list">
            {stats.topActors.map((item: { actorId: string; count: number }, i: number) => (
              <li key={i}>
                <span>{item.actorId}</span>
                <span>{item.count}</span>
              </li>
            ))}
            {stats.topActors.length === 0 && <li className="empty">No actors.</li>}
          </ul>
        </div>

        <div className="card">
          <h3>Anomalies</h3>
          {anomalies && anomalies.length > 0 ? (
            <ul className="list">
              {anomalies.map((anomaly: { action: string; count: number; windowMinutes: number; threshold: number }, i: number) => (
                <li key={i}>
                  <span>{anomaly.action}</span>
                  <span>{anomaly.count} in {anomaly.windowMinutes}m</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No anomalies</p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LOG ENTRY COMPONENT
// =============================================================================

interface LogEntryProps {
  log: {
    _id: string;
    action: string;
    actorId?: string;
    timestamp: number;
    severity: "info" | "warning" | "error" | "critical";
    resourceType?: string;
    resourceId?: string;
    metadata?: unknown;
    diff?: string;
  };
}

function LogEntry({ log }: LogEntryProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="log-entry"
      onClick={() => setExpanded(!expanded)}
      style={{ borderLeftColor: getSeverityColor(log.severity) }}
    >
      <div className="log-header">
        <span className="severity-badge" style={{ backgroundColor: getSeverityColor(log.severity) }}>
          {log.severity}
        </span>
        <span className="log-action">{log.action}</span>
        <span className="log-time">{formatTimestamp(log.timestamp)}</span>
      </div>

      {expanded && (
        <div className="log-details">
          <div className="detail-row">
            <span>Actor:</span>
            <span>{log.actorId ?? "N/A"}</span>
          </div>
          {log.resourceType && (
            <div className="detail-row">
              <span>Resource:</span>
              <span>{log.resourceType}/{log.resourceId}</span>
            </div>
          )}
          {log.diff && (
            <div className="detail-row">
              <span>Changes:</span>
              <pre>{log.diff}</pre>
            </div>
          )}
          {log.metadata !== undefined && log.metadata !== null && (
            <div className="detail-row">
              <span>Metadata:</span>
              <pre>{JSON.stringify(log.metadata as Record<string, unknown>, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
