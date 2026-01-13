import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

function App() {
  return (
    <div className="app">
      <header className="header">
        <h1>audit-log</h1>
        <p>convex component demo</p>
      </header>

      <div className="layout">
        <div className="left-panel">
          <ActionsPanel />
          <LogsPanel />
        </div>
        <div className="right-panel">
          <StatsPanel />
        </div>
      </div>
    </div>
  );
}

function ActionsPanel() {
  const createUser = useMutation(api.example.createUser);
  const createDocument = useMutation(api.example.createDocument);
  const logFailedLogin = useMutation(api.example.logFailedLogin);
  const logUnauthorizedAccess = useMutation(api.example.logUnauthorizedAccess);

  return (
    <section className="actions-section">
      <h2>Generate Events</h2>
      <div className="actions">
        <button onClick={() => createUser({ name: "user_" + Date.now(), email: "u@test.io", role: "user" })}>
          create_user
        </button>
        <button onClick={() => createDocument({ title: "doc_" + Date.now(), content: "..." })}>
          create_document
        </button>
        <button className="warn" onClick={() => logFailedLogin({ email: "h@ck.er", ipAddress: "192.168.1.1" })}>
          failed_login
        </button>
        <button className="critical" onClick={() => logUnauthorizedAccess({ resourceType: "secrets", resourceId: "key-001", attemptedAction: "read" })}>
          unauthorized_access
        </button>
      </div>
    </section>
  );
}

function LogsPanel() {
  const logs = useQuery(api.example.searchAuditLogs, { limit: 50 });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="logs-section">
      <h2>
        Live Events
        <span className="live-indicator" key={logs?.items?.length ?? 0} />
      </h2>
      <div className="log-list">
        {logs === undefined && <div className="loading">loading</div>}
        {logs?.items.length === 0 && <div className="empty">no events yet - click buttons above</div>}
        {logs?.items.map((log: Log, index: number) => (
          <div 
            key={log._id} 
            className={`log-entry${index === 0 ? " new" : ""}`}
            onClick={() => setExpanded(expanded === log._id ? null : log._id)}
          >
            <div className="log-line">
              <span className="log-time">{formatTime(log.timestamp)}</span>
              <span className={`log-severity ${log.severity}`}>{log.severity}</span>
              <span className="log-action">{log.action}</span>
              <span className="log-actor">{log.actorId || "system"}</span>
            </div>
            {expanded === log._id && (
              <div className="log-details">
                {log.resourceType && <div>resource: {log.resourceType}/{log.resourceId}</div>}
                {log.metadata !== undefined && log.metadata !== null && (
                  <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StatsPanel() {
  const stats = useQuery(api.example.getAuditStats, { hoursBack: 24 });
  const anomalies = useQuery(api.example.detectLoginAnomalies);

  // Use keys based on values to trigger CSS animations when they change
  const totalKey = stats?.totalCount ?? 0;
  const infoKey = stats?.bySeverity.info ?? 0;
  const warnKey = stats?.bySeverity.warning ?? 0;
  const errorKey = stats?.bySeverity.error ?? 0;
  const criticalKey = stats?.bySeverity.critical ?? 0;

  return (
    <section className="stats-section">
      <h2>
        24h Stats
        <span className="live-indicator" key={totalKey} />
      </h2>

      {!stats ? (
        <div className="loading">loading</div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat">
              <div className="stat-value changed" key={`total-${totalKey}`}>{stats.totalCount}</div>
              <div className="stat-label">total</div>
            </div>
            <div className="stat">
              <div className="stat-value info changed" key={`info-${infoKey}`}>{stats.bySeverity.info}</div>
              <div className="stat-label">info</div>
            </div>
            <div className="stat">
              <div className="stat-value warn changed" key={`warn-${warnKey}`}>{stats.bySeverity.warning}</div>
              <div className="stat-label">warn</div>
            </div>
            <div className="stat">
              <div className="stat-value error changed" key={`error-${errorKey}`}>{stats.bySeverity.error}</div>
              <div className="stat-label">error</div>
            </div>
            <div className="stat">
              <div className="stat-value critical changed" key={`critical-${criticalKey}`}>{stats.bySeverity.critical}</div>
              <div className="stat-label">critical</div>
            </div>
          </div>

          <div className="stats-block">
            <h3>Top Actions</h3>
            <ul>
              {stats.topActions.length === 0 && <li><span>no data</span><span></span></li>}
              {stats.topActions.slice(0, 5).map((a: { action: string; count: number }, i: number) => (
                <li key={i}><span>{a.action}</span><span>{a.count}</span></li>
              ))}
            </ul>
          </div>

          <div className="stats-block">
            <h3>Anomalies</h3>
            {!anomalies?.length && <div className="no-anomalies">none detected</div>}
            {anomalies?.map((a: Anomaly, i: number) => (
              <div key={i} className="anomaly">
                <strong>{a.action}</strong>
                <span>{a.count} in {a.windowMinutes}m</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

interface Log {
  _id: string;
  action: string;
  actorId?: string;
  timestamp: number;
  severity: "info" | "warning" | "error" | "critical";
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
}

interface Anomaly {
  action: string;
  count: number;
  threshold: number;
  windowMinutes: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default App;
