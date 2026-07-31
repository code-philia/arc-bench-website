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
  return (
    <div className={compact ? "stdio-view" : "space-y-5 p-5"}>
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text)]">Run activity</div>
          {lastRefreshedAt ? <div className="mt-1 text-xs text-[var(--text-muted)]">Last refreshed at {lastRefreshedAt}</div> : null}
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

      <div>
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

      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Complete logs</div>
        <pre className={compact ? "stdio-code-view" : "log-panel"}>{logs?.console || "No console output yet."}</pre>
      </div>
    </div>
  );
}
