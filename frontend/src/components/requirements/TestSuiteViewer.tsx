import { CodeOutlined, FileTextOutlined } from "@ant-design/icons";
import { useMemo } from "react";

import type { RequirementTestFile } from "../../lib/types";

type TestCase = { name: string; code: string };

function extractTestCases(content: string): TestCase[] {
  const cases: TestCase[] = [];
  const matcher = /\b(?:test|it)(?:\.(?:only|skip))?\s*\(\s*(["'`])([^"'`]+)\1/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(content))) {
    let index = content.indexOf("(", match.index);
    let depth = 0;
    let quote = "";
    let escaped = false;
    for (; index < content.length; index += 1) {
      const character = content[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        continue;
      }
      if (character === "\"" || character === "'" || character === "`") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          index += 1;
          break;
        }
      }
    }
    cases.push({ name: match[2], code: content.slice(match.index, index).trim() });
    matcher.lastIndex = index;
  }
  return cases;
}

export default function TestSuiteViewer({ files }: { files: RequirementTestFile[] }) {
  const filesWithCases = useMemo(() => files.map((file) => ({ ...file, cases: extractTestCases(file.content) })), [files]);

  if (files.length === 0) {
    return <div className="test-suite-empty"><FileTextOutlined /><div><strong>No tests found</strong><p>This task does not include test files in its test directory.</p></div></div>;
  }

  return (
    <section className="test-suite-viewer" aria-label="Task tests">
      <div className="test-suite-intro"><CodeOutlined /><span>{files.length} test file{files.length === 1 ? "" : "s"}</span></div>
      {filesWithCases.map((file) => (
        <details key={file.path} className="test-suite-file">
          <summary><FileTextOutlined /><span>{file.path}</span><small>{file.cases.length ? `${file.cases.length} case${file.cases.length === 1 ? "" : "s"}` : "source"}</small></summary>
          <div className="test-suite-file-body">
            {file.cases.length ? file.cases.map((testCase, index) => (
              <details key={`${testCase.name}-${index}`} className="test-suite-case">
                <summary>{testCase.name}</summary>
                <pre><code>{testCase.code}</code></pre>
              </details>
            )) : <pre><code>{file.content}</code></pre>}
          </div>
        </details>
      ))}
    </section>
  );
}
