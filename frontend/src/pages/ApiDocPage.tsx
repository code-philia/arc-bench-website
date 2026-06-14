import { useMemo, useState } from "react";

type DocTabKey = "python" | "javascript" | "typescript";

const codeExamples: Record<DocTabKey, string> = {
  python: `from arcbench_visual import (
    mark_design_done,
    mark_implementation_done,
    mark_test_failed,
    mark_test_passed,
)

mark_design_done("REQ-1", "Flow design is finalized")
mark_implementation_done("REQ-1", "Main page and form logic are implemented")
mark_test_passed("REQ-1", "Local validation passed")
mark_test_failed("REQ-2", "Pagination assertions are still failing")
`,
  javascript: `import {
  markDesignDone,
  markImplementationDone,
  markTestFailed,
  markTestPassed,
} from "/workspace/sdk/arcbench_visual.js";

markDesignDone("REQ-1", "State machine is planned");
markImplementationDone("REQ-1", "Frontend interactions are complete");
markTestPassed("REQ-1", "Smoke test succeeded");
markTestFailed("REQ-2", "Pagination test is still failing");
`,
  typescript: `import {
  markDesignDone,
  markImplementationDone,
  markTestFailed,
  markTestPassed,
} from "/workspace/sdk/arcbench_visual.ts";

markDesignDone("REQ-1", "Data contract is defined");
markImplementationDone("REQ-1", "API integration is done");
markTestPassed("REQ-1", "Primary path verification passed");
markTestFailed("REQ-2", "Retry state is not stable yet");
`,
};

const tabLabels: Record<DocTabKey, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
};

export default function ApiDocPage() {
  const [activeTab, setActiveTab] = useState<DocTabKey>("python");
  const activeCode = useMemo(() => codeExamples[activeTab], [activeTab]);

  return (
    <div className="page api-doc-page">
      <div className="api-doc-shell">
        <header className="api-doc-header">
          <div className="api-doc-kicker">ArcBench Runtime API</div>
          <h1>Requirement Visualization API</h1>
          <p>
            The runtime exposes a built-in SDK for reporting requirement node progress from inside the execution
            container. The submission detail page consumes these events and updates the requirement canvas in real
            time.
          </p>
        </header>

        <div className="api-doc-body">
          <aside className="api-doc-toc">
            <a href="#overview">Overview</a>
            <a href="#node-id">Node ID</a>
            <a href="#states">States</a>
            <a href="#api">API</a>
            <a href="#examples">Examples</a>
            <a href="#runtime">Runtime Notes</a>
          </aside>

          <article className="api-doc-content">
            <section id="overview" className="api-doc-section-block">
              <h2>Overview</h2>
              <p>
                Use this API to mark individual requirement nodes during design, implementation, and testing. Each API
                call emits one JSONL event into the runner artifacts directory. The frontend polls these events and
                applies node color, focus, and highlight animation updates.
              </p>
            </section>

            <section id="node-id" className="api-doc-section-block">
              <h2>Node ID</h2>
              <p>
                All APIs identify a requirement point by <code>nodeId</code>. The value must be the exact requirement
                tree node id, such as <code>ROOT</code>, <code>REQ-1</code>, or a custom child id.
              </p>
              <table className="api-doc-table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>nodeId</code></td>
                    <td><code>string</code></td>
                    <td>Yes</td>
                    <td>Exact requirement tree node id.</td>
                  </tr>
                  <tr>
                    <td><code>message</code></td>
                    <td><code>string</code></td>
                    <td>No</td>
                    <td>Optional human-readable progress note shown in the event stream.</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="states" className="api-doc-section-block">
              <h2>States</h2>
              <table className="api-doc-table">
                <thead>
                  <tr>
                    <th>Operation</th>
                    <th>Canvas Color</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>markDesignDone</code> / <code>mark_design_done</code></td>
                    <td>
                      <span className="api-doc-color-chip design" />
                      Orange
                    </td>
                    <td>Design for this requirement node is complete.</td>
                  </tr>
                  <tr>
                    <td><code>markImplementationDone</code> / <code>mark_implementation_done</code></td>
                    <td>
                      <span className="api-doc-color-chip implement" />
                      Blue
                    </td>
                    <td>Implementation for this requirement node is complete.</td>
                  </tr>
                  <tr>
                    <td><code>markTestPassed</code> / <code>mark_test_passed</code></td>
                    <td>
                      <span className="api-doc-color-chip test-passed" />
                      Green
                    </td>
                    <td>Testing for this requirement node passed.</td>
                  </tr>
                  <tr>
                    <td><code>markTestFailed</code> / <code>mark_test_failed</code></td>
                    <td>
                      <span className="api-doc-color-chip test-failed" />
                      Light red
                    </td>
                    <td>Testing for this requirement node failed.</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="api" className="api-doc-section-block">
              <h2>API</h2>
              <table className="api-doc-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Signature</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>mark_design_done</code></td>
                    <td><code>(node_id, message=None)</code></td>
                    <td>Emit a design-complete event for one node.</td>
                  </tr>
                  <tr>
                    <td><code>mark_implementation_done</code></td>
                    <td><code>(node_id, message=None)</code></td>
                    <td>Emit an implementation-complete event for one node.</td>
                  </tr>
                  <tr>
                    <td><code>mark_test_passed</code></td>
                    <td><code>(node_id, message=None)</code></td>
                    <td>Emit a passing test event for one node.</td>
                  </tr>
                  <tr>
                    <td><code>mark_test_failed</code></td>
                    <td><code>(node_id, message=None)</code></td>
                    <td>Emit a failing test event for one node.</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section id="examples" className="api-doc-section-block">
              <h2>Examples</h2>
              <div className="api-doc-tabs" role="tablist" aria-label="Language examples">
                {(Object.keys(tabLabels) as DocTabKey[]).map((tabKey) => (
                  <button
                    key={tabKey}
                    type="button"
                    className={`api-doc-tab${activeTab === tabKey ? " active" : ""}`}
                    onClick={() => setActiveTab(tabKey)}
                  >
                    {tabLabels[tabKey]}
                  </button>
                ))}
              </div>
              <pre className="api-doc-code"><code>{activeCode}</code></pre>
            </section>

            <section id="runtime" className="api-doc-section-block">
              <h2>Runtime Notes</h2>
              <p>
                The Python SDK can be imported directly with <code>from arcbench_visual import ...</code>. The
                JavaScript and TypeScript SDK files are injected into <code>/workspace/sdk/</code>. All implementations
                append JSONL payloads to <code>/workspace/artifacts/runner-events.jsonl</code>.
              </p>
              <p>
                These APIs are lightweight status markers. Use them at meaningful milestones instead of calling them on
                every low-level step.
              </p>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}
