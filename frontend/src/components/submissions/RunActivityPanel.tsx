import { useState } from "react";

import type { SubmissionLogs } from "../../lib/types";

type RunActivityPanelProps = {
  logs: SubmissionLogs | null;
  refreshing: boolean;
  lastRefreshedAt: string | null;
  onRefresh: () => void;
  compact?: boolean;
};

/** A deliberately plain, shared view of process output. */
export default function RunActivityPanel({
  logs,
  refreshing,
  lastRefreshedAt,
  onRefresh,
  compact = false,
}: RunActivityPanelProps) {
  const stdout = logs?.stdout ?? "";
  const stderr = logs?.stderr ?? "";
  const [selectedStream, setSelectedStream] = useState<"stdout" | "stderr">("stdout");
  const output = selectedStream === "stdout" ? stdout : stderr;
  const outputLineCount = output ? output.split(/\r?\n/).length : 0;
  return (
    <div className={`${compact ? "stdio-view" : "space-y-5 p-5"} run-activity-panel`}>
      <div className="run-output-toolbar">
        <div className="run-output-stream-selector">
          <label htmlFor="run-output-stream">Output</label>
          <select
            id="run-output-stream"
            value={selectedStream}
            onChange={(event) => setSelectedStream(event.target.value as "stdout" | "stderr")}
          >
            <option value="stdout">stdout</option>
            <option value="stderr">stderr</option>
          </select>
          <span>{outputLineCount > 0 ? `${outputLineCount} lines` : "empty"}</span>
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
      <div className="run-output-section">
        <pre className={`${compact ? "stdio-code-view" : "log-panel"} run-output-console run-output-console--${selectedStream} ${output ? "has-output" : "is-empty"}`}>
          {output || `No ${selectedStream} output.`}
        </pre>
        {lastRefreshedAt ? <div className="run-output-refreshed">Last refreshed at {lastRefreshedAt}</div> : null}
      </div>
    </div>
  );
}
