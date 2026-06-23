import { useMemo, useState, type ReactNode } from "react";

type LanguageKey = "python" | "javascript" | "typescript";
type DocSectionKey = "overview" | "visual" | "traceability" | "runtime";

const sectionLabels: Record<DocSectionKey, string> = {
  overview: "Overview",
  visual: "Visualization API",
  traceability: "Traceability API",
  runtime: "Runtime Notes",
};

const languageLabels: Record<LanguageKey, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
};

const visualExamples: Record<LanguageKey, string> = {
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

const traceabilityExamples: Record<LanguageKey, string> = {
  python: `from arcbench_visual import (
    register_interface,
    register_test,
    set_interface_implemented,
)

register_interface(
    "IF-LOGIN-API",
    req_ids=["REQ-2.2"],
    type="API",
    content="POST /api/auth/login",
    file_path="backend/src/routes/auth.py",
    first_line="18",
    implemented=False,
)

set_interface_implemented("IF-LOGIN-API", True, "Login handler is connected")

register_test(
    "TEST-LOGIN-E2E",
    req_id="REQ-2.2",
    scenario_id="REQ-2.2-SCN-1",
    type="E2E",
    file_path="tests/login.spec.ts",
    first_line="7",
)
`,
  javascript: `import {
  registerInterface,
  registerTest,
  setInterfaceImplemented,
} from "/workspace/sdk/arcbench_visual.js";

registerInterface(
  "IF-LOGIN-API",
  ["REQ-2.2"],
  "API",
  "POST /api/auth/login",
  "backend/src/routes/auth.ts",
  "18",
  false,
);

setInterfaceImplemented("IF-LOGIN-API", true, "Login handler is connected");

registerTest(
  "TEST-LOGIN-E2E",
  "REQ-2.2",
  "E2E",
  "tests/login.spec.ts",
  "7",
  "REQ-2.2-SCN-1",
);
`,
  typescript: `import {
  registerInterface,
  registerTest,
  setInterfaceImplemented,
} from "/workspace/sdk/arcbench_visual.ts";

registerInterface(
  "IF-LOGIN-API",
  ["REQ-2.2"],
  "API",
  "POST /api/auth/login",
  "backend/src/routes/auth.ts",
  "18",
  false,
);

setInterfaceImplemented("IF-LOGIN-API", true, "Login handler is connected");

registerTest(
  "TEST-LOGIN-E2E",
  "REQ-2.2",
  "E2E",
  "tests/login.spec.ts",
  "7",
  "REQ-2.2-SCN-1",
);
`,
};

const PY_KEYWORDS = new Set([
  "import", "from", "def", "class", "return", "if", "else", "elif",
  "for", "while", "try", "except", "None", "True", "False", "as",
  "in", "not", "and", "or", "with", "pass", "raise", "yield", "lambda",
]);

const JS_KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "function",
  "return", "if", "else", "for", "while", "try", "catch", "throw",
  "new", "class", "extends", "async", "await", "of", "in", "typeof",
  "instanceof", "default", "switch", "case", "break", "continue",
  "null", "undefined", "true", "false",
]);

function tokenNode(kind: string, text: string): ReactNode {
  return <span className={`code-token code-${kind}`}>{text}</span>;
}

function highlightLine(line: string, lang: LanguageKey): ReactNode[] {
  const tokens: ReactNode[] = [];
  const keywords = lang === "python" ? PY_KEYWORDS : JS_KEYWORDS;
  let index = 0;

  while (index < line.length) {
    if (line[index] === "#" && lang === "python") {
      tokens.push(tokenNode("comment", line.slice(index)));
      break;
    }
    if (line[index] === "/" && line[index + 1] === "/") {
      tokens.push(tokenNode("comment", line.slice(index)));
      break;
    }

    const quote = line[index];
    if (quote === "\"" || quote === "'" || quote === "`") {
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
      if (keywords.has(word)) {
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

function CodeBlock({
  activeLanguage,
  onChangeLanguage,
  source,
}: {
  activeLanguage: LanguageKey;
  onChangeLanguage: (language: LanguageKey) => void;
  source: Record<LanguageKey, string>;
}) {
  const code = source[activeLanguage];
  const highlighted = useMemo(() => {
    return code.split(/\r?\n/).map((line) => highlightLine(line, activeLanguage));
  }, [activeLanguage, code]);

  return (
    <div className="api-doc-code-block">
      <div className="api-doc-code-toolbar">
        <span className="api-doc-code-lang-label">{languageLabels[activeLanguage]}</span>
        <div className="api-doc-code-tabs" role="tablist" aria-label="Language examples">
          {(Object.keys(languageLabels) as LanguageKey[]).map((language) => (
            <button
              key={language}
              type="button"
              className={`api-doc-code-tab${activeLanguage === language ? " active" : ""}`}
              onClick={() => onChangeLanguage(language)}
            >
              {languageLabels[language]}
            </button>
          ))}
        </div>
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
        <h2>Execution Contract</h2>
        <p>
          ArcBench injects a built-in runtime SDK into the execution workspace. Your agent can use it to report
          requirement-node progress and register traceability assets generated during the run.
        </p>
        <div className="api-doc-callout-grid">
          <article className="api-doc-callout-card">
            <strong>Visualization stream</strong>
            <p>Writes requirement progress events into <code>/workspace/artifacts/runner-events.jsonl</code>.</p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Traceability stream</strong>
            <p>Writes interface and test asset events into <code>/workspace/artifacts/traceability-events.jsonl</code>.</p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Execution database</strong>
            <p>Runner materializes a per-run <code>/workspace/artifacts/traceability.db</code> SQLite database.</p>
          </article>
        </div>
      </section>

      <section className="api-doc-section-block">
        <h2>Automatic Registration</h2>
        <p>
          Before your agent starts, the runtime parses <code>requirements.yaml</code> and automatically registers every
          requirement node and scenario. You only need to register the remaining assets you create: interfaces and tests.
        </p>
        <table className="api-doc-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Source</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>requirements</code></td>
              <td><code>requirements.yaml</code></td>
              <td>Automatically before agent execution</td>
            </tr>
            <tr>
              <td><code>scenarios</code></td>
              <td><code>requirements.yaml</code></td>
              <td>Automatically before agent execution</td>
            </tr>
            <tr>
              <td><code>interfaces</code></td>
              <td>Agent SDK calls</td>
              <td>Whenever your code defines or updates an interface</td>
            </tr>
            <tr>
              <td><code>tests</code></td>
              <td>Agent SDK calls</td>
              <td>Whenever your code defines a test asset</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

function VisualizationPage({
  language,
  onLanguageChange,
}: {
  language: LanguageKey;
  onLanguageChange: (language: LanguageKey) => void;
}) {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Requirement State APIs</h2>
        <p>
          Use these APIs to drive the canvas state machine on the submission detail page. The node id must match the
          exact id in the requirement tree, such as <code>ROOT</code>, <code>REQ-1</code>, or <code>REQ-2.3</code>.
        </p>
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
              <td><span className="api-doc-color-chip design" />Orange</td>
              <td>Design for this requirement node is complete.</td>
            </tr>
            <tr>
              <td><code>markImplementationDone</code> / <code>mark_implementation_done</code></td>
              <td><span className="api-doc-color-chip implement" />Blue</td>
              <td>Implementation for this requirement node is complete.</td>
            </tr>
            <tr>
              <td><code>markTestPassed</code> / <code>mark_test_passed</code></td>
              <td><span className="api-doc-color-chip test-passed" />Green</td>
              <td>Testing for this requirement node passed.</td>
            </tr>
            <tr>
              <td><code>markTestFailed</code> / <code>mark_test_failed</code></td>
              <td><span className="api-doc-color-chip test-failed" />Light red</td>
              <td>Testing for this requirement node failed.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock activeLanguage={language} onChangeLanguage={onLanguageChange} source={visualExamples} />
      </section>
    </>
  );
}

function TraceabilityPage({
  language,
  onLanguageChange,
}: {
  language: LanguageKey;
  onLanguageChange: (language: LanguageKey) => void;
}) {
  return (
    <>
      <section className="api-doc-section-block">
        <h2>Interface APIs</h2>
        <p>
          Register each interface asset once you define it, then update its implementation state when the code path is
          actually completed. This keeps the TRACEABILITY panel aligned with the generated project.
        </p>
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
              <td><code>register_interface</code></td>
              <td><code>(interface_id, req_ids, type, content, file_path=None, first_line=None, implemented=False, callers=None, callees=None)</code></td>
              <td>Create or replace one interface asset row.</td>
            </tr>
            <tr>
              <td><code>set_interface_implemented</code></td>
              <td><code>(interface_id, implemented, message=None)</code></td>
              <td>Switch the interface implementation status.</td>
            </tr>
            <tr>
              <td><code>mark_interface_implemented</code></td>
              <td><code>(interface_id, message=None)</code></td>
              <td>Shortcut for marking one interface as implemented.</td>
            </tr>
            <tr>
              <td><code>mark_interface_unimplemented</code></td>
              <td><code>(interface_id, message=None)</code></td>
              <td>Shortcut for marking one interface as not implemented.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Test APIs</h2>
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
              <td><code>register_test</code></td>
              <td><code>(test_id, req_id, type, file_path=None, first_line=None, scenario_id=None)</code></td>
              <td>Create or replace one test asset row linked to a requirement and optionally to a scenario.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Accepted Types</h2>
        <div className="api-doc-callout-grid">
          <article className="api-doc-callout-card">
            <strong>Interface types</strong>
            <p><code>UI</code>, <code>API</code>, <code>FUNC</code>, <code>DB</code></p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Test types</strong>
            <p><code>Unit</code>, <code>Integration</code>, <code>E2E</code></p>
          </article>
          <article className="api-doc-callout-card">
            <strong>Relationship fields</strong>
            <p><code>req_ids</code>, <code>scenario_id</code>, <code>callers</code>, <code>callees</code></p>
          </article>
        </div>
      </section>

      <section className="api-doc-section-block">
        <h2>Example</h2>
        <CodeBlock activeLanguage={language} onChangeLanguage={onLanguageChange} source={traceabilityExamples} />
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
              <td>Preferred structured requirement tree input for the run.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/runner-events.jsonl</code></td>
              <td>Requirement visualization event stream.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/traceability-events.jsonl</code></td>
              <td>Raw interface/test asset event stream written by the SDK.</td>
            </tr>
            <tr>
              <td><code>/workspace/artifacts/traceability.db</code></td>
              <td>SQLite database materialized by the runner for this execution.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="api-doc-section-block">
        <h2>Import Paths</h2>
        <p>
          Python can import directly from <code>arcbench_visual</code>. JavaScript and TypeScript SDK files are injected
          into <code>/workspace/sdk/arcbench_visual.js</code> and <code>/workspace/sdk/arcbench_visual.ts</code>.
        </p>
      </section>

      <section className="api-doc-section-block">
        <h2>Recommended Usage</h2>
        <p>
          Emit requirement states only at meaningful milestones. Register interfaces and tests as soon as they become
          concrete artifacts, then toggle interface implementation status when code is actually wired.
        </p>
      </section>
    </>
  );
}

export default function ApiDocPage() {
  const [activeSection, setActiveSection] = useState<DocSectionKey>("overview");
  const [activeLanguage, setActiveLanguage] = useState<LanguageKey>("python");

  return (
    <div className="page api-doc-page">
      <div className="api-doc-shell">
        <header className="api-doc-header">
          <div className="api-doc-kicker">ArcBench Runtime API</div>
          <h1>Visualization and Traceability SDK</h1>
          <p>
            The runtime exposes a built-in SDK for progress reporting and asset registration inside the execution
            container. Use it to update requirement-node states on the canvas and to populate the per-run traceability
            database with interfaces and tests.
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
            {activeSection === "visual" ? (
              <VisualizationPage language={activeLanguage} onLanguageChange={setActiveLanguage} />
            ) : null}
            {activeSection === "traceability" ? (
              <TraceabilityPage language={activeLanguage} onLanguageChange={setActiveLanguage} />
            ) : null}
            {activeSection === "runtime" ? <RuntimePage /> : null}
          </article>
        </div>
      </div>
    </div>
  );
}
