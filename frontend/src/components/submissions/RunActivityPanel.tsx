import type { SubmissionLogs } from "../../lib/types";

type RunActivityPanelProps = {
  logs: SubmissionLogs | null;
  refreshing: boolean;
  lastRefreshedAt: string | null;
  onRefresh: () => void;
  compact?: boolean;
};

/** A deliberately plain, shared view of persistent run events and console output. */
export default function RunActivityPanel({
  logs,
  refreshing,
  lastRefreshedAt,
  onRefresh,
  compact = false,
}: RunActivityPanelProps) {
  const stdout = logs?.stdout ?? "";
  const stderr = logs?.stderr ?? "";
  const outputLineCount = [stdout, stderr].filter(Boolean).reduce((total, value) => total + value.split(/\r?\n/).length, 0);
  return (
    <div className={`${compact ? "stdio-view" : "space-y-5 p-5"} run-activity-panel`}>
      <div className="run-activity-header flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
        <div className="run-activity-heading">
          <span className="run-activity-dot" aria-hidden="true" />
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Run activity</div>
            {lastRefreshedAt ? <div className="mt-1 text-xs text-[var(--text-muted)]">Last refreshed at {lastRefreshedAt}</div> : null}
          </div>
        </div>
        <button
          type="button"
          className="btn-outline"
          disabled={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Refreshing…" : "Refresh logs"}
        </button>
      </div>

      <div className="run-activity-events">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Activity</div>
        <div className="space-y-3">
          {(logs?.runner_events ?? []).length > 0 ? (logs?.runner_events ?? []).map((event) => (
            <div key={event.event_id} className="border-l-2 border-[var(--border)] pl-3 text-sm">
              <div className="font-medium text-[var(--text)]">{event.stage}</div>
              <div className="mt-1 text-[var(--text-dim)]">{event.summary}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {event.timestamp}{event.heartbeat ? " · heartbeat" : ""}
              </div>
            </div>
          )) : <div className="text-sm text-[var(--text-muted)]">No structured activity yet.</div>}
        </div>
      </div>

      <div className="run-output-section">
        <div className="run-output-heading">
          <div>
            <div className="run-panel-kicker">Process output</div>
            <div className="run-panel-caption">Separate streams from the evaluation container</div>
          </div>
          {outputLineCount > 0 ? <span className="run-output-count">{outputLineCount} lines</span> : null}
        </div>
        <div className="run-output-streams">
          {(["stdout", "stderr"] as const).map((stream) => {
            const value = stream === "stdout" ? stdout : stderr;
            return <section className={`run-output-stream run-output-stream--${stream}`} key={stream}>
              <header><span>{stream}</span><small>{value ? `${value.split(/\r?\n/).length} lines` : "empty"}</small></header>
              <pre className={`${compact ? "stdio-code-view" : "log-panel"} ${value ? "has-output" : "is-empty"}`}>{value || `No ${stream} output.`}</pre>
            </section>;
          })}
        </div>
      </div>
    </div>
  );
}
