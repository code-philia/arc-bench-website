import { useState } from "react";

type DocSectionKey = "overview" | "nodes" | "traceability" | "git";

const sectionLabels: Record<DocSectionKey, string> = {
  overview: "Overview",
  nodes: "Node State",
  traceability: "Traceability",
  git: "Git",
};

const overviewDiagram = String.raw`Agent code
    |
    | call Agent Runtime SDK
    v
arcbench_agent_runtime
    |-- write traceability.db
    |-- atomically refresh traceability.snapshot.json
    |-- append runner-events.jsonl
    v
ArcBench backend file watcher
    |-- detect new lines in runner-events.jsonl
    |-- parse fixed event payloads
    |-- notify frontend which panel should refresh
    v
Frontend
    |-- request latest submission status
    |-- request latest traceability data
    |-- request latest commit / preview data
    v
UI updates in real time`;

const nodeStateExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()

runtime.events.mark_run_started("Agent execution started")

runtime.events.mark_design_done("REQ-1", "Login flow design completed")
runtime.events.mark_implementation_done("REQ-1", "Login page and API are wired")
runtime.events.mark_test_passed("REQ-1", "Smoke test passed")
runtime.events.mark_test_failed("REQ-2", "Retry scenario is still failing")

runtime.events.mark_run_completed("Agent execution finished")`;

const traceabilityExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()
runtime.traceability.init_db()

runtime.traceability.upsert_interface(
    interface_id="IF-LOGIN-API",
    req_ids=["REQ-1"],
    type="API",
    content="POST /api/auth/login",
    file_path="backend/src/routes/auth.py",
    first_line="18",
)

runtime.traceability.set_interface_implemented(
    "IF-LOGIN-API",
    True,
    "Login handler is connected",
)

runtime.traceability.upsert_test(
    test_id="TEST-LOGIN-E2E",
    req_id="REQ-1",
    type="E2E",
    file_path="tests/login.spec.ts",
    first_line="7",
    interface_ids=["IF-LOGIN-API"],
)

runtime.traceability.set_test_pass_status("TEST-LOGIN-E2E", True)
runtime.traceability.upsert_node_state("REQ-1", "PASSED")`;

const gitExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()

runtime.git.ensure_repo()

# write files into runtime.paths.project_dir here

runtime.git.commit("REQ-1: implement login flow")

# optional recovery helpers
runtime.git.rollback_last_commit()
# runtime.git.reset_to_commit("<commit_oid>")
# runtime.git.restore_worktree()
# runtime.git.clean_untracked()`;

function CodeBlock({ source }: { source: string }) {
  return (
    <div className="api-doc-code-block">
      <div className="api-doc-code-toolbar">
        <span className="api-doc-code-lang-label">Python</span>
      </div>
      <pre className="api-doc-code">
        <code>{source}</code>
      </pre>
    </div>
  );
}

function OverviewPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Execution Flow</h2>
        <p>
          Your agent should call the built-in <code>arcbench_agent_runtime</code> package. The SDK owns the fixed event
          protocol, writes <code>runner-events.jsonl</code>, updates the live <code>traceability.db</code>, refreshes
          <code> traceability.snapshot.json </code>, and lets the backend drive frontend refreshes from the snapshot
          instead of reading the live database.
        </p>
        <CodeBlock source={overviewDiagram} />
      </section>

      <section className="api-doc-section-block">
        <h2>What The Frontend Does</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>SDK action</th>
              <th>Backend reaction</th>
              <th>Frontend result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mark a node state</td>
              <td>Read new runner event lines</td>
              <td>Requirement tree and status panel update</td>
            </tr>
            <tr>
              <td>Write traceability data</td>
              <td>Parse traceability event or refresh signal</td>
              <td>Traceability panels reload latest data</td>
            </tr>
            <tr>
              <td>Create or rollback git commits</td>
              <td>Trigger commit-history and preview refresh</td>
              <td>Commit list and preview snapshot update</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Usage Rule</h2>
        <p>
          Do not construct event payloads manually. Call high-level SDK methods only. Event <code>type</code>,
          refresh flags, and file formats are fixed by the runtime package.
        </p>
      </section>
    </>
  );
}

function NodeStatePage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Node State APIs</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>runtime.events.mark_design_done(node_id, message=None)</code></td>
              <td>Mark design phase completed for one requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_implementation_done(node_id, message=None)</code></td>
              <td>Mark implementation phase completed for one requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_test_passed(node_id, message=None)</code></td>
              <td>Mark testing phase passed for one requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_test_failed(node_id, message=None)</code></td>
              <td>Mark testing phase failed for one requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_run_started(message=None)</code></td>
              <td>Mark the whole agent run as started.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_run_completed(message=None)</code></td>
              <td>Mark the whole agent run as completed.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_run_failed(message=None)</code></td>
              <td>Mark the whole agent run as failed.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock source={nodeStateExample} />
      </section>
    </>
  );
}

function TraceabilityPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Core APIs</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Method group</th>
              <th>Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Database lifecycle</td>
              <td><code>init_db(reset=False)</code></td>
            </tr>
            <tr>
              <td>Requirements and scenarios</td>
              <td><code>upsert_requirement</code>, <code>update_requirement_fields</code>, <code>delete_requirement</code>, <code>upsert_scenario</code>, <code>delete_scenario</code></td>
            </tr>
            <tr>
              <td>Interfaces</td>
              <td><code>upsert_interface</code>, <code>update_interface_fields</code>, <code>set_interface_implemented</code>, <code>delete_interface</code></td>
            </tr>
            <tr>
              <td>Tests</td>
              <td><code>upsert_test</code>, <code>update_test_fields</code>, <code>set_test_pass_status</code>, <code>delete_test</code></td>
            </tr>
            <tr>
              <td>Node status and links</td>
              <td><code>upsert_node_state</code>, <code>delete_node_state</code>, <code>insert_call_edge</code>, <code>delete_call_edge</code></td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Automatic Refresh</h2>
        <p>
          These APIs update <code>traceability.db</code>, atomically refresh <code>traceability.snapshot.json</code>,
          and append the corresponding fixed-format events into <code>runner-events.jsonl</code>. The backend watches
          new event lines, reloads data from the snapshot, and the frontend refreshes the affected traceability views
          automatically.
        </p>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock source={traceabilityExample} />
      </section>
    </>
  );
}

function GitPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Git APIs</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>runtime.git.ensure_repo(create_initial_commit=True)</code></td>
              <td>Initialize the repository and configure runtime git identity.</td>
            </tr>
            <tr>
              <td><code>runtime.git.commit(message)</code></td>
              <td>Create one commit and trigger commit-history and preview refresh.</td>
            </tr>
            <tr>
              <td><code>runtime.git.rollback_last_commit(hard=False)</code></td>
              <td>Rollback the latest commit.</td>
            </tr>
            <tr>
              <td><code>runtime.git.reset_to_commit(commit_oid, hard=True)</code></td>
              <td>Reset the repository to a target commit.</td>
            </tr>
            <tr>
              <td><code>runtime.git.restore_worktree()</code></td>
              <td>Discard working tree changes.</td>
            </tr>
            <tr>
              <td><code>runtime.git.clean_untracked()</code></td>
              <td>Remove untracked files.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Manual File Sync Case</h2>
        <p>
          If you change git state or traceability artifacts outside the SDK, call
          <code> runtime.events.notify_commit_history_changed(...) </code> or
          <code> runtime.events.notify_traceability_changed(...) </code> after the manual write so ArcBench can refresh
          the right panels without exposing raw event payloads.
        </p>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock source={gitExample} />
      </section>
    </>
  );
}

export default function ApiDocPage() {
  const [activeSection, setActiveSection] = useState<DocSectionKey>("overview");

  return (
    <div className="page api-doc-page">
      <div className="api-doc-shell">
        <header className="api-doc-header">
          <div className="api-doc-kicker">ArcBench Runtime API</div>
          <h1>Agent Runtime SDK</h1>
          <p>
            Use the built-in Python SDK to update requirement states, maintain traceability data, perform git
            operations, and let ArcBench refresh the frontend through the runner event stream automatically.
          </p>
        </header>

        <div className="api-doc-body">
          <aside className="api-doc-toc">
            {(Object.keys(sectionLabels) as DocSectionKey[]).map((sectionKey) => (
              <button
                key={sectionKey}
                type="button"
                className={`api-doc-nav-button${activeSection === sectionKey ? " active" : ""}`}
                onClick={() => setActiveSection(sectionKey)}
              >
                {sectionLabels[sectionKey]}
              </button>
            ))}
          </aside>

          <article className="api-doc-content">
            {activeSection === "overview" ? <OverviewPage /> : null}
            {activeSection === "nodes" ? <NodeStatePage /> : null}
            {activeSection === "traceability" ? <TraceabilityPage /> : null}
            {activeSection === "git" ? <GitPage /> : null}
          </article>
        </div>
      </div>
    </div>
  );
}
