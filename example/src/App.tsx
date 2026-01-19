import "./App.css";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Id } from "../convex/_generated/dataModel";

type TabId = "events" | "search" | "data" | "security" | "reports" | "admin";

function App() {
  const [activeTab, setActiveTab] = useState<TabId>("events");

  const tabs: { id: TabId; label: string }[] = [
    { id: "events", label: "Live Events" },
    { id: "search", label: "Search" },
    { id: "data", label: "Data CRUD" },
    { id: "security", label: "Security" },
    { id: "reports", label: "Reports" },
    { id: "admin", label: "Admin" },
  ];

  return (
    <div className="app">
      <header className="header">
        <h1>audit-log</h1>
        <p>convex component demo</p>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="layout">
        <div className="main-panel">
          {activeTab === "events" && <EventsTab />}
          {activeTab === "search" && <SearchTab />}
          {activeTab === "data" && <DataTab />}
          {activeTab === "security" && <SecurityTab />}
          {activeTab === "reports" && <ReportsTab />}
          {activeTab === "admin" && <AdminTab />}
        </div>
        <div className="side-panel">
          <StatsPanel />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EVENTS TAB - Quick event generation + live log view
// ============================================================================
function EventsTab() {
  return (
    <div className="tab-content">
      <ActionsPanel />
      <LogsPanel />
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
                {log.diff !== undefined && log.diff !== null && (
                  <div className="diff-view">
                    <div className="diff-label">Changes:</div>
                    <pre>{JSON.stringify(log.diff, null, 2)}</pre>
                  </div>
                )}
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

// ============================================================================
// SEARCH TAB - Filter and search audit logs
// ============================================================================
function SearchTab() {
  const [severity, setSeverity] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState(50);

  const severityOptions = ["info", "warning", "error", "critical"];

  const filters = {
    severity: severity.length > 0 ? severity : undefined,
    actions: action ? [action] : undefined,
    fromTimestamp: fromDate ? new Date(fromDate).getTime() : undefined,
    toTimestamp: toDate ? new Date(toDate).getTime() : undefined,
    limit,
  };

  const logs = useQuery(api.example.searchAuditLogs, filters);

  const toggleSeverity = (s: string) => {
    setSeverity((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  return (
    <div className="tab-content">
      <section className="filter-section">
        <h2>Search Filters</h2>
        
        <div className="filter-group">
          <label>Severity</label>
          <div className="filter-chips">
            {severityOptions.map((s) => (
              <button
                key={s}
                className={`chip ${s}${severity.includes(s) ? " active" : ""}`}
                onClick={() => toggleSeverity(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <label>Action</label>
          <input
            type="text"
            placeholder="e.g., user.created"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>From</label>
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>To</label>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Limit</label>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="clear-btn" onClick={() => {
          setSeverity([]);
          setAction("");
          setFromDate("");
          setToDate("");
          setLimit(50);
        }}>
          clear_filters
        </button>
      </section>

      <section className="results-section">
        <h2>Results ({logs?.items.length ?? 0})</h2>
        <div className="log-list">
          {logs === undefined && <div className="loading">searching</div>}
          {logs?.items.length === 0 && <div className="empty">no results</div>}
          {logs?.items.map((log: Log) => (
            <LogRow key={log._id} log={log} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// DATA TAB - User and Document CRUD operations
// ============================================================================
function DataTab() {
  return (
    <div className="tab-content">
      <UsersSection />
      <DocumentsSection />
    </div>
  );
}

function UsersSection() {
  const users = useQuery(api.example.listUsers, {});
  const createUser = useMutation(api.example.createUser);
  const updateUser = useMutation(api.example.updateUser);
  const deleteUser = useMutation(api.example.deleteUser);
  
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");

  const handleCreate = async () => {
    if (!newName || !newEmail) return;
    await createUser({ name: newName, email: newEmail, role: newRole });
    setNewName("");
    setNewEmail("");
    setNewRole("user");
  };

  const handleUpdate = async (userId: Id<"users">) => {
    await updateUser({ userId, name: editName, role: editRole });
    setEditingId(null);
  };

  return (
    <section className="crud-section">
      <h2>Users</h2>
      
      <div className="form-row">
        <input placeholder="name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input placeholder="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
        <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
          <option value="user">user</option>
          <option value="admin">admin</option>
          <option value="moderator">moderator</option>
        </select>
        <button onClick={handleCreate}>create</button>
      </div>

      <div className="data-list">
        {users === undefined && <div className="loading">loading</div>}
        {users?.length === 0 && <div className="empty">no users</div>}
        {users?.map((user) => (
          <div key={user._id} className="data-row">
            {editingId === user._id ? (
              <>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                <span className="data-field">{user.email}</span>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="moderator">moderator</option>
                </select>
                <button onClick={() => handleUpdate(user._id)}>save</button>
                <button onClick={() => setEditingId(null)}>cancel</button>
              </>
            ) : (
              <>
                <span className="data-field name">{user.name}</span>
                <span className="data-field email">{user.email}</span>
                <span className="data-field role">{user.role}</span>
                <button onClick={() => { setEditingId(user._id); setEditName(user.name); setEditRole(user.role); }}>edit</button>
                <button className="warn" onClick={() => deleteUser({ userId: user._id })}>delete</button>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentsSection() {
  const documents = useQuery(api.example.listDocuments, {});
  const createDocument = useMutation(api.example.createDocument);
  const updateDocument = useMutation(api.example.updateDocument);
  
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [viewHistoryId, setViewHistoryId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTitle) return;
    await createDocument({ title: newTitle, content: newContent || "..." });
    setNewTitle("");
    setNewContent("");
  };

  const handleUpdate = async (docId: Id<"documents">) => {
    await updateDocument({ documentId: docId, title: editTitle, content: editContent });
    setEditingId(null);
  };

  return (
    <section className="crud-section">
      <h2>Documents</h2>
      
      <div className="form-row">
        <input placeholder="title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        <input placeholder="content" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
        <button onClick={handleCreate}>create</button>
      </div>

      <div className="data-list">
        {documents === undefined && <div className="loading">loading</div>}
        {documents?.length === 0 && <div className="empty">no documents</div>}
        {documents?.map((doc) => (
          <div key={doc._id}>
            <div className="data-row">
              {editingId === doc._id ? (
                <>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  <input value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                  <button onClick={() => handleUpdate(doc._id)}>save</button>
                  <button onClick={() => setEditingId(null)}>cancel</button>
                </>
              ) : (
                <>
                  <span className="data-field title">{doc.title}</span>
                  <span className="data-field content">{doc.content.slice(0, 50)}{doc.content.length > 50 ? "..." : ""}</span>
                  <button onClick={() => { setEditingId(doc._id); setEditTitle(doc.title); setEditContent(doc.content); }}>edit</button>
                  <button onClick={() => setViewHistoryId(viewHistoryId === doc._id ? null : doc._id)}>
                    {viewHistoryId === doc._id ? "hide_history" : "history"}
                  </button>
                </>
              )}
            </div>
            {viewHistoryId === doc._id && <DocumentHistory documentId={doc._id} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function DocumentHistory({ documentId }: { documentId: string }) {
  const history = useQuery(api.example.getDocumentHistory, { documentId });

  return (
    <div className="history-panel">
      <h4>Change History</h4>
      {history === undefined && <div className="loading">loading</div>}
      {history && history.length === 0 && <div className="empty">no history</div>}
      {history && history.map((log: Log) => (
        <div key={log._id} className="history-entry">
          <span className="history-time">{formatTime(log.timestamp)}</span>
          <span className="history-action">{log.action}</span>
          {log.diff !== undefined && log.diff !== null && <pre className="history-diff">{JSON.stringify(log.diff, null, 2)}</pre>}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SECURITY TAB - Real-time security monitoring
// ============================================================================
function SecurityTab() {
  const securityEvents = useQuery(api.example.watchSecurityEvents);
  const anomalies = useQuery(api.example.detectLoginAnomalies);

  return (
    <div className="tab-content">
      <section className="security-section">
        <h2>
          Critical Events
          <span className="live-indicator" />
        </h2>
        <div className="security-list">
          {securityEvents === undefined && <div className="loading">monitoring</div>}
          {securityEvents && securityEvents.length === 0 && <div className="empty">no critical events</div>}
          {securityEvents && securityEvents.map((log: Log) => (
            <div key={log._id} className={`security-event ${log.severity}`}>
              <div className="security-header">
                <span className={`severity-badge ${log.severity}`}>{log.severity}</span>
                <span className="security-action">{log.action}</span>
                <span className="security-time">{formatTime(log.timestamp)}</span>
              </div>
              <div className="security-details">
                <span>Actor: {log.actorId || "unknown"}</span>
                {log.resourceType && <span>Resource: {log.resourceType}/{log.resourceId}</span>}
                {log.ipAddress && <span>IP: {log.ipAddress}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="anomalies-section">
        <h2>Detected Anomalies</h2>
        {!anomalies?.length && <div className="no-anomalies">no anomalies detected</div>}
        {anomalies?.map((a: Anomaly, i: number) => (
          <div key={i} className="anomaly-card">
            <div className="anomaly-header">
              <strong>{a.action}</strong>
              <span className="anomaly-severity">threshold exceeded</span>
            </div>
            <div className="anomaly-stats">
              <span>{a.count} occurrences</span>
              <span>in {a.windowMinutes} minutes</span>
              <span>threshold: {a.threshold}</span>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

// ============================================================================
// REPORTS TAB - Generate and export compliance reports
// ============================================================================
function ReportsTab() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [format, setFormat] = useState<"json" | "csv">("json");
  const [reportData, setReportData] = useState<string | null>(null);

  const report = useQuery(
    api.example.generateComplianceReport,
    startDate && endDate
      ? {
          startDate: new Date(startDate).getTime(),
          endDate: new Date(endDate).getTime(),
          format,
        }
      : "skip"
  );

  const handleGenerate = () => {
    if (report) {
      setReportData(typeof report.data === "string" ? report.data : JSON.stringify(report.data, null, 2));
    }
  };

  const handleDownload = () => {
    if (!reportData) return;
    const blob = new Blob([reportData], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tab-content">
      <section className="report-config-section">
        <h2>Generate Compliance Report</h2>
        
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>End Date</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value as "json" | "csv")}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
        </div>

        <div className="report-actions">
          <button onClick={handleGenerate}>generate_report</button>
          {reportData && <button onClick={handleDownload}>download_{format}</button>}
        </div>

        {report && (
          <div className="report-summary">
            <span>Records: {report.totalRecords}</span>
            {report.truncated && <span className="warn-text">truncated to 10,000</span>}
          </div>
        )}
      </section>

      {reportData && (
        <section className="report-preview-section">
          <h2>Preview</h2>
          <pre className="report-preview">{reportData.slice(0, 5000)}{reportData.length > 5000 ? "\n..." : ""}</pre>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN TAB - Cleanup and maintenance tools
// ============================================================================
function AdminTab() {
  const cleanupLogs = useMutation(api.example.cleanupOldLogs);
  const [olderThanDays, setOlderThanDays] = useState(90);
  const [cleanupResult, setCleanupResult] = useState<{ deletedCount: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleCleanup = async () => {
    setIsRunning(true);
    try {
      const result = await cleanupLogs({ olderThanDays });
      setCleanupResult(result);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="tab-content">
      <section className="admin-section">
        <h2>Log Cleanup</h2>
        <p className="admin-description">
          Remove old audit logs to manage storage. Critical severity logs are preserved.
        </p>
        
        <div className="admin-form">
          <div className="filter-group">
            <label>Delete logs older than (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={olderThanDays}
              onChange={(e) => setOlderThanDays(Number(e.target.value))}
            />
          </div>
          <button 
            className="warn" 
            onClick={handleCleanup}
            disabled={isRunning}
          >
            {isRunning ? "running..." : "run_cleanup"}
          </button>
        </div>

        {cleanupResult && (
          <div className="admin-result">
            Deleted {cleanupResult.deletedCount} log entries
          </div>
        )}
      </section>

      <section className="admin-section">
        <h2>PII Redaction Demo</h2>
        <p className="admin-description">
          The audit log automatically redacts sensitive fields: email, phone, ssn, password.
          Create a user to see redacted metadata in the logs.
        </p>
        <div className="pii-example">
          <code>
            {`// Stored as:\n{\n  email: "[REDACTED]",\n  phone: "[REDACTED]"\n}`}
          </code>
        </div>
      </section>

      <section className="admin-section">
        <h2>Aggregate Backfill</h2>
        <p className="admin-description">
          If you upgraded from v0.1.x, run the backfill to populate aggregate counts for existing logs.
          This enables O(log n) statistics queries.
        </p>
        <BackfillPanel />
      </section>
    </div>
  );
}

function BackfillPanel() {
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [result, setResult] = useState<{ processed: number; isDone: boolean } | null>(null);

  // Note: backfillAggregates would need to be exposed as a mutation
  // For now, show the concept
  return (
    <div className="admin-form">
      <button 
        onClick={() => {
          setStatus("running");
          // Simulated - actual backfill would call api.example.backfillAggregates
          setTimeout(() => {
            setStatus("done");
            setResult({ processed: 0, isDone: true });
          }, 1000);
        }}
        disabled={status === "running"}
      >
        {status === "running" ? "running..." : "run_backfill"}
      </button>
      {result && (
        <div className="admin-result">
          {result.isDone ? "Backfill complete" : `Processed ${result.processed} records...`}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STATS PANEL - Always visible sidebar
// ============================================================================
function StatsPanel() {
  const stats = useQuery(api.example.getAuditStats, { hoursBack: 24 });
  const anomalies = useQuery(api.example.detectLoginAnomalies);

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

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
function LogRow({ log }: { log: Log }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="log-entry" onClick={() => setExpanded(!expanded)}>
      <div className="log-line">
        <span className="log-time">{formatTime(log.timestamp)}</span>
        <span className={`log-severity ${log.severity}`}>{log.severity}</span>
        <span className="log-action">{log.action}</span>
        <span className="log-actor">{log.actorId || "system"}</span>
      </div>
      {expanded && (
        <div className="log-details">
          {log.resourceType && <div>resource: {log.resourceType}/{log.resourceId}</div>}
          {log.diff !== undefined && log.diff !== null && <pre>{JSON.stringify(log.diff, null, 2)}</pre>}
          {log.metadata !== undefined && log.metadata !== null && (
            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TYPES & UTILITIES
// ============================================================================
interface Log {
  _id: string;
  action: string;
  actorId?: string;
  timestamp: number;
  severity: "info" | "warning" | "error" | "critical";
  resourceType?: string;
  resourceId?: string;
  metadata?: unknown;
  diff?: unknown;
  ipAddress?: string;
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
