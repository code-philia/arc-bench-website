import { useMemo, useState, type ReactNode } from "react";

type DocSectionKey = "overview" | "events" | "traceability" | "git" | "runtime";

const sectionLabels: Record<DocSectionKey, string> = {
  overview: "Overview",
  events: "Event Client",
  traceability: "Traceability Client",
  git: "Git Client",
  runtime: "Runtime Guide",
};

const runtimeBootstrapExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()

print(runtime.paths.project_dir)
print(runtime.paths.runner_events_path)
print(runtime.paths.traceability_db_path)
`;

const eventExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()

runtime.events.mark_design_done("REQ-1", "Flow design is finalized")
runtime.events.mark_implementation_done("REQ-1", "Main page and form logic are implemented")
runtime.events.mark_test_passed("REQ-1", "Local validation passed")
runtime.events.mark_test_failed("REQ-2", "Pagination assertions are still failing")

runtime.events.emit_runner_state("paused", "Waiting for external input")
runtime.events.emit_refresh_signal(
    reason="artifacts_updated",
    submission=True,
    logs=True,
    traceability_selected=True,
    traceability_all=True,
    preview=True,
)
`;

const traceabilityExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()
runtime.traceability.init_db()

runtime.traceability.upsert_requirement(
    req_id="REQ-2.2",
    name="User Login",
    description="Registered users can log in with email and password",
    scenarios=[
        {
            "id": "REQ-2.2-SCN-1",
            "name": "happy path",
            "steps": [{"keyword": "WHEN", "content": "user submits valid credentials"}],
        }
    ],
)

runtime.traceability.upsert_interface(
    interface_id="IF-LOGIN-API",
    req_ids=["REQ-2.2"],
    type="API",
    content="POST /api/auth/login",
    file_path="backend/src/routes/auth.py",
    first_line="18",
    implemented=False,
)

runtime.traceability.set_interface_implemented(
    "IF-LOGIN-API",
    True,
    "Login handler is connected",
)

runtime.traceability.upsert_test(
    test_id="TEST-LOGIN-E2E",
    req_id="REQ-2.2",
    type="E2E",
    file_path="tests/login.spec.ts",
    first_line="7",
    interface_ids=["IF-LOGIN-API"],
    passed=True,
    scenario_id="REQ-2.2-SCN-1",
)

runtime.traceability.upsert_node_state("REQ-2.2", "PASSED")
`;

const gitExample = `from arcbench_agent_runtime import AgentRuntime

runtime = AgentRuntime.from_env()

runtime.git.ensure_repo(create_initial_commit=True)

with open("README.md", "a", encoding="utf-8") as handle:
    handle.write("\\nImplementation note\\n")

committed = runtime.git.commit("REQ-1 (design): finalize login flow")
print("committed:", committed)
print("head:", runtime.git.current_head())

runtime.git.rollback_last_commit(hard=True)
`;

const PY_KEYWORDS = new Set([
  "import", "from", "def", "class", "return", "if", "else", "elif",
  "for", "while", "try", "except", "None", "True", "False", "as",
  "in", "not", "and", "or", "with", "pass", "raise", "yield", "lambda",
]);

function tokenNode(kind: string, text: string): ReactNode {
  return <span className={`code-token code-${kind}`}>{text}</span>;
}

function highlightPythonLine(line: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let index = 0;

  while (index < line.length) {
    if (line[index] === "#") {
      tokens.push(tokenNode("comment", line.slice(index)));
      break;
    }

    const quote = line[index];
    if (quote === "\"" || quote === "'") {
      let cursor = index + 1;
      while (cursor < line.length && line[cursor] !== quote) {
        if (line[cursor] === "\\") cursor += 1;
        cursor += 1;
      }
      if (cursor < line.length) cursor += 1;
      tokens.push(tokenNode("string", line.slice(index, cursor)));
      index = cursor;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[index])) {
      let cursor = index;
      while (cursor < line.length && /[a-zA-Z0-9_]/.test(line[cursor])) cursor += 1;
      const word = line.slice(index, cursor);
      if (PY_KEYWORDS.has(word)) {
        tokens.push(tokenNode("keyword", word));
      } else if (cursor < line.length && line[cursor] === "(") {
        tokens.push(tokenNode("function", word));
      } else {
        tokens.push(<span>{word}</span>);
      }
      index = cursor;
      continue;
    }

    tokens.push(<span>{line[index]}</span>);
    index += 1;
  }

  return tokens;
}

function CodeBlock({ source }: { source: string }) {
  const highlighted = useMemo(() => source.split(/\r?\n/).map((line) => highlightPythonLine(line)), [source]);

  return (
    <div className="api-doc-code-block">
      <div className="api-doc-code-toolbar">
        <span className="api-doc-code-lang-label">Python</span>
      </div>
      <pre className="api-doc-code">
        <code>
          {highlighted.map((line, index) => (
            <div key={index} className="code-line">
              {line.length ? line : " "}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function OverviewPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Python SDK</h2>
        <p>
          The Python package <code>arcbench_agent_runtime</code> exposes the Agent Runtime SDK. Create one runtime
          object with <code>AgentRuntime.from_env()</code>, then access the grouped clients on it:
          <code>runtime.events</code>, <code>runtime.traceability</code>, and <code>runtime.git</code>.
        </p>
        <div className="api-doc-callout-grid">
          <article className="api-doc-callout-card">
            <strong>Events client</strong>
            <p>Emit requirement-state, runner-state, and refresh signals into <code>runner-events.jsonl</code>.</p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Traceability store</strong>
            <p>Operate directly on the per-run <code>traceability.db</code> and emit synchronization signals.</p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Git client</strong>
            <p>Initialize repos, commit generated artifacts, and roll back history inside the workspace project.</p>
          </article>
        </div>
      </section>

      <section className="api-doc-section-block">
        <h2>Bootstrap Example</h2>
        <CodeBlock source={runtimeBootstrapExample} />
      </section>

      <section className="api-doc-section-block">
        <h2>Recommended Usage</h2>
        <p>
          Use <code>AgentRuntime.from_env()</code> once near the start of <code>main.py</code>, then pass the runtime
          object through your agent workflow. All node-state updates, traceability mutations, and git actions should go
          through this SDK.
        </p>
      </section>

      <section className="api-doc-section-block">
        <h2>Automatic Registration</h2>
        <p>
          Before your agent starts, the runtime can materialize the traceability database and your execution environment
          already provides the standard artifact paths. Your agent should register the concrete interfaces, tests, node
          states, and git actions it produces during the run.
        </p>
      </section>
    </>
  );
}

function EventsPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Requirement and Runner Events</h2>
        <p>
          These APIs write directly into <code>/workspace/artifacts/runner-events.jsonl</code>. They drive the canvas
          state machine, execution status, and frontend refresh behavior.
        </p>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Client Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>runtime.events.mark_design_done(node_id, message=None)</code></td>
              <td>Emit a design-completed state for a requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_implementation_done(node_id, message=None)</code></td>
              <td>Emit an implementation-completed state for a requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_test_passed(node_id, message=None)</code></td>
              <td>Emit a passed testing state for a requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.mark_test_failed(node_id, message=None)</code></td>
              <td>Emit a failed testing state for a requirement node.</td>
            </tr>
            <tr>
              <td><code>runtime.events.emit_runner_state(state, message=None)</code></td>
              <td>Publish a runner lifecycle state such as <code>paused</code> or <code>completed</code>.</td>
            </tr>
            <tr>
              <td><code>runtime.events.emit_refresh_signal(...)</code></td>
              <td>Ask the website to refresh submission, traceability, preview, or commit history panels.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock source={eventExample} />
      </section>
    </>
  );
}

function TraceabilityPage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Database Lifecycle</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>runtime.traceability.init_db(reset=False)</code></td>
              <td>Create all runtime tables if they do not exist.</td>
            </tr>
            <tr>
              <td><code>runtime.traceability.init_db(reset=True)</code></td>
              <td>Drop and recreate the runtime tables.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>CRUD Surface</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Entity</th>
              <th>Create / Update</th>
              <th>Read</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>requirements</code></td>
              <td><code>upsert_requirement</code>, <code>update_requirement_fields</code></td>
              <td><code>get_requirement</code>, <code>list_requirements</code></td>
              <td><code>delete_requirement</code></td>
            </tr>
            <tr>
              <td><code>scenarios</code></td>
              <td><code>upsert_scenario</code></td>
              <td><code>get_scenario</code>, <code>list_scenarios</code></td>
              <td><code>delete_scenario</code></td>
            </tr>
            <tr>
              <td><code>interfaces</code></td>
              <td><code>upsert_interface</code>, <code>update_interface_fields</code>, <code>set_interface_implemented</code></td>
              <td><code>get_interface</code>, <code>list_interfaces</code></td>
              <td><code>delete_interface</code></td>
            </tr>
            <tr>
              <td><code>tests</code></td>
              <td><code>upsert_test</code>, <code>update_test_fields</code>, <code>set_test_pass_status</code></td>
              <td><code>get_test</code>, <code>list_tests</code></td>
              <td><code>delete_test</code></td>
            </tr>
            <tr>
              <td><code>node_states</code></td>
              <td><code>upsert_node_state</code></td>
              <td><code>get_node_state</code>, <code>list_node_states</code></td>
              <td><code>delete_node_state</code></td>
            </tr>
            <tr>
              <td><code>call_edges</code></td>
              <td><code>insert_call_edge</code></td>
              <td><code>list_call_edges</code></td>
              <td><code>delete_call_edge</code></td>
            </tr>
          </tbody>
        </table>
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
        <h2>Repository Operations</h2>
        <p>
          The git client operates inside <code>runtime.paths.project_dir</code>. It also emits refresh signals so the
          website can update commit history and preview state after repository changes.
        </p>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>runtime.git.ensure_repo(create_initial_commit=True)</code></td>
              <td>Initialize a repo, configure identity, maintain the ArcBench gitignore block, and optionally create an initial commit.</td>
            </tr>
            <tr>
              <td><code>runtime.git.commit(message)</code></td>
              <td>Stage all changes and create one commit. Returns <code>False</code> if there is nothing to commit.</td>
            </tr>
            <tr>
              <td><code>runtime.git.rollback_last_commit(hard=False)</code></td>
              <td>Reset to <code>HEAD~1</code> with a soft or hard rollback.</td>
            </tr>
            <tr>
              <td><code>runtime.git.reset_to_commit(commit_oid, hard=True)</code></td>
              <td>Reset the repository to a specific commit.</td>
            </tr>
            <tr>
              <td><code>runtime.git.restore_worktree()</code></td>
              <td>Discard tracked working-tree changes with <code>git reset --hard</code>.</td>
            </tr>
            <tr>
              <td><code>runtime.git.clean_untracked()</code></td>
              <td>Remove untracked files and directories with <code>git clean -fd</code>.</td>
            </tr>
            <tr>
              <td><code>runtime.git.current_head()</code></td>
              <td>Return the current commit SHA, or <code>None</code> when HEAD does not exist yet.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock source={gitExample} />
      </section>
    </>
  );
}

function RuntimePage() {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Workspace Paths</h2>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Path</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>/workspace/task/requirements.yaml</code></td>
              <td>Structured requirement tree input for the run.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/runner-events.jsonl</code></td>
              <td>Event stream consumed by the website for requirement states, refreshes, and runtime signals.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/traceability.db</code></td>
              <td>SQLite database used by the traceability client.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/demo-test-statuses.json</code></td>
              <td>Auxiliary demo status store used for test and requirement pass/fail overlays.</td>
            </tr>
            <tr>
              <td><code>/workspace/template</code></td>
              <td>Generated project directory used by the git client.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Python Entry Point</h2>
        <p>
          The recommended pattern is to create the runtime once near the start of <code>main.py</code>, then pass that
          object through your agent workflow. This keeps all event, database, and git operations bound to the same
          runtime paths resolved from environment variables.
        </p>
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
          <div className="api-doc-kicker">Agent Runtime SDK</div>
          <h1>Agent Runtime SDK</h1>
          <p>
            The Agent Runtime SDK centers on <code>AgentRuntime.from_env()</code>. It exposes a unified Python
            interface for event emission, traceability database operations, and git automation inside the execution
            container.
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
            {activeSection === "events" ? <EventsPage /> : null}
            {activeSection === "traceability" ? <TraceabilityPage /> : null}
            {activeSection === "git" ? <GitPage /> : null}
            {activeSection === "runtime" ? <RuntimePage /> : null}
          </article>
        </div>
      </div>
    </div>
  );
}
