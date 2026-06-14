export type RequirementStep = {
  keyword: string;
  content: string;
};

export type RequirementScenario = {
  name: string;
  steps: RequirementStep[];
};

export type RequirementNode = {
  id: string;
  name: string;
  type: "FOLDER" | "ATOMIC";
  description: string;
  dependencies: string[];
  children: RequirementNode[];
  scenarios: RequirementScenario[];
};

type UnknownRecord = Record<string, unknown>;

type LineToken = {
  indent: number;
  text: string;
};

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function quoteYaml(value: string): string {
  const escaped = value.replaceAll("\\", "\\\\").replaceAll("'", "''");
  return `'${escaped}'`;
}

function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  if (value === "[]") {
    return [];
  }
  if (value === "{}") {
    return {};
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'").replaceAll("\\\\", "\\");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

function tokenizeYaml(input: string): LineToken[] {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => ({
      indent: line.match(/^ */)?.[0].length ?? 0,
      text: line.trimEnd(),
    }))
    .filter((line) => line.text.trim().length > 0 && !line.text.trimStart().startsWith("#"))
    .map((line) => ({
      indent: line.indent,
      text: line.text.trim(),
    }));
}

function parseBlock(tokens: LineToken[], startIndex: number, indent: number): [unknown, number] {
  if (startIndex >= tokens.length) {
    return [{}, startIndex];
  }
  const token = tokens[startIndex];
  if (token.text.startsWith("- ")) {
    return parseArray(tokens, startIndex, indent);
  }
  return parseObject(tokens, startIndex, indent);
}

function parseObject(tokens: LineToken[], startIndex: number, indent: number): [UnknownRecord, number] {
  const result: UnknownRecord = {};
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent < indent) {
      break;
    }
    if (token.indent > indent) {
      index += 1;
      continue;
    }
    if (token.text.startsWith("- ")) {
      break;
    }

    const separator = token.text.indexOf(":");
    if (separator === -1) {
      index += 1;
      continue;
    }

    const key = token.text.slice(0, separator).trim();
    const rawValue = token.text.slice(separator + 1).trim();

    if (!rawValue) {
      if (index + 1 < tokens.length && tokens[index + 1].indent > indent) {
        const [nested, nextIndex] = parseBlock(tokens, index + 1, tokens[index + 1].indent);
        result[key] = nested;
        index = nextIndex;
        continue;
      }
      result[key] = {};
      index += 1;
      continue;
    }

    result[key] = parseScalar(rawValue);
    index += 1;
  }

  return [result, index];
}

function parseArray(tokens: LineToken[], startIndex: number, indent: number): [unknown[], number] {
  const items: unknown[] = [];
  let index = startIndex;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token.indent < indent) {
      break;
    }
    if (token.indent !== indent || !token.text.startsWith("- ")) {
      break;
    }

    const rest = token.text.slice(2).trim();
    if (!rest) {
      if (index + 1 < tokens.length && tokens[index + 1].indent > indent) {
        const [nested, nextIndex] = parseBlock(tokens, index + 1, tokens[index + 1].indent);
        items.push(nested);
        index = nextIndex;
        continue;
      }
      items.push("");
      index += 1;
      continue;
    }

    if (rest.includes(":")) {
      const separator = rest.indexOf(":");
      const key = rest.slice(0, separator).trim();
      const rawValue = rest.slice(separator + 1).trim();
      const item: UnknownRecord = {};
      item[key] = rawValue ? parseScalar(rawValue) : "";
      index += 1;

      while (index < tokens.length) {
        const next = tokens[index];
        if (next.indent < indent + 2) {
          break;
        }
        if (next.indent === indent && next.text.startsWith("- ")) {
          break;
        }
        if (next.indent === indent + 2 && next.text.startsWith("- ")) {
          const [nestedArray, nextIndex] = parseArray(tokens, index, indent + 2);
          if (Array.isArray(item[key]) && item[key].length === 0) {
            item[key] = nestedArray;
          } else if (item[key] === "") {
            item[key] = nestedArray;
          }
          index = nextIndex;
          continue;
        }
        if (next.indent >= indent + 2) {
          const [nestedObject, nextIndex] = parseObject(tokens, index, indent + 2);
          Object.assign(item, nestedObject);
          index = nextIndex;
          continue;
        }
      }

      items.push(item);
      continue;
    }

    items.push(parseScalar(rest));
    index += 1;
  }

  return [items, index];
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function normalizeScenario(input: unknown): RequirementScenario {
  const source = isRecord(input) ? input : {};
  const rawSteps = Array.isArray(source.steps) ? source.steps : [];
  return {
    name: String(source.name ?? "New scenario").trim() || "New scenario",
    steps: rawSteps
      .map((step) => {
        const stepSource = isRecord(step) ? step : {};
        return {
          keyword: String(stepSource.keyword ?? "GIVEN").trim().toUpperCase() || "GIVEN",
          content: String(stepSource.content ?? "").trim(),
        };
      })
      .filter((step) => step.content),
  };
}

function normalizeNode(input: unknown, fallbackId: string): RequirementNode {
  const source = isRecord(input) ? input : {};
  const type = String(source.type ?? "FOLDER").trim().toUpperCase();
  const children = Array.isArray(source.children)
    ? source.children.map((child, index) => normalizeNode(child, `${fallbackId}-${index + 1}`))
    : [];
  const scenarios = Array.isArray(source.scenarios) ? source.scenarios.map(normalizeScenario) : [];

  return {
    id: String(source.id ?? fallbackId).trim() || fallbackId,
    name: String(source.name ?? fallbackId).trim() || fallbackId,
    type: type === "ATOMIC" ? "ATOMIC" : "FOLDER",
    description: String(source.description ?? "").trim(),
    dependencies: asStringArray(source.dependencies),
    children,
    scenarios,
  };
}

export function createDefaultTaskTree(): RequirementNode {
  return {
    id: "ROOT",
    name: "New Requirement Tree",
    type: "FOLDER",
    description: "Describe the product goal, business scope, and the user value that this task should cover.",
    dependencies: [],
    children: [
      {
        id: "REQ-1",
        name: "Core Experience",
        type: "ATOMIC",
        description: "Describe the first end-to-end behavior that the target application must support.",
        dependencies: [],
        children: [],
        scenarios: [
          {
            name: "Primary happy path",
            steps: [
              { keyword: "GIVEN", content: "The application is available to the user." },
              { keyword: "WHEN", content: "The user opens the main workflow." },
              { keyword: "THEN", content: "The expected result is rendered and usable." },
            ],
          },
        ],
      },
    ],
    scenarios: [],
  };
}

export function parseTaskTreeYaml(yamlContent: string): RequirementNode {
  const tokens = tokenizeYaml(yamlContent);
  const [parsed] = parseBlock(tokens, 0, 0);
  return normalizeNode(parsed, "ROOT");
}

function renderScenarioYaml(scenario: RequirementScenario, indent: number): string[] {
  const pad = " ".repeat(indent);
  const lines = [`${pad}- name: ${quoteYaml(scenario.name)}`];
  if (scenario.steps.length === 0) {
    lines.push(`${pad}  steps: []`);
    return lines;
  }
  lines.push(`${pad}  steps:`);
  scenario.steps.forEach((step) => {
    lines.push(`${pad}    - keyword: ${step.keyword}`);
    lines.push(`${pad}      content: ${quoteYaml(step.content)}`);
  });
  return lines;
}

function renderNodeYaml(node: RequirementNode, indent: number): string[] {
  const pad = " ".repeat(indent);
  const lines = [
    `${pad}id: ${node.id}`,
    `${pad}name: ${quoteYaml(node.name)}`,
    `${pad}type: ${node.type}`,
    `${pad}description: ${quoteYaml(node.description)}`,
    `${pad}dependencies: ${node.dependencies.length === 0 ? "[]" : ""}`,
  ];

  if (node.dependencies.length > 0) {
    node.dependencies.forEach((dependency) => {
      lines.push(`${pad}  - ${dependency}`);
    });
  }

  if (node.children.length > 0) {
    lines.push(`${pad}children:`);
    node.children.forEach((child) => {
      const childLines = renderNodeYaml(child, indent + 2);
      childLines.forEach((line, index) => {
        if (index === 0) {
          lines.push(`${pad}  - ${line.trimStart()}`);
        } else {
          lines.push(`${pad}    ${line.trimStart()}`);
        }
      });
    });
  } else if (node.type === "FOLDER") {
    lines.push(`${pad}children: []`);
  }

  if (node.scenarios.length > 0) {
    lines.push(`${pad}scenarios:`);
    node.scenarios.forEach((scenario) => {
      lines.push(...renderScenarioYaml(scenario, indent + 2));
    });
  }

  return lines;
}

export function taskTreeToYaml(node: RequirementNode): string {
  return renderNodeYaml(node, 0).join("\n").trim();
}

type MarkdownSection = {
  heading: string;
  body: string[];
};

function buildMarkdownSections(node: RequirementNode, sections: MarkdownSection[]) {
  const title = `## ${node.id} ${node.name}`;
  const body: string[] = [];

  if (node.description) {
    body.push(node.description);
  }
  if (node.dependencies.length > 0) {
    body.push(`Depends on: ${node.dependencies.map((item) => `\`${item}\``).join(", ")}.`);
  }
  if (node.children.length > 0) {
    body.push("### Included chapters");
    body.push(...node.children.map((child) => `- \`${child.id}\` ${child.name}`));
  }
  if (node.scenarios.length > 0) {
    body.push("### Acceptance scenarios");
    node.scenarios.forEach((scenario) => {
      body.push(`#### ${scenario.name}`);
      if (scenario.steps.length === 0) {
        body.push("- No steps defined yet.");
        return;
      }
      body.push(...scenario.steps.map((step) => `- **${step.keyword}** ${step.content}`));
    });
  }

  sections.push({ heading: title, body });
  node.children.forEach((child) => buildMarkdownSections(child, sections));
}

function flattenChapterList(nodes: RequirementNode[], depth: number): string[] {
  return nodes.flatMap((node) => {
    const prefix = `${"  ".repeat(depth)}-`;
    return [`${prefix} \`${node.id}\` ${node.name}`, ...flattenChapterList(node.children, depth + 1)];
  });
}

export function taskTreeToMarkdown(root: RequirementNode): string {
  const sections: MarkdownSection[] = [];
  buildMarkdownSections(root, sections);

  const intro = [
    `# ${root.name}`,
    "",
    root.description || "Task description is not available yet.",
    "",
  ];

  const sectionMarkdown = sections
    .map((section) => [section.heading, "", ...section.body, ""].join("\n"))
    .join("\n");

  return [...intro, sectionMarkdown.trim()].join("\n").trim();
}

export function findNodeById(root: RequirementNode, nodeId: string): RequirementNode | null {
  if (root.id === nodeId) {
    return root;
  }
  for (const child of root.children) {
    const match = findNodeById(child, nodeId);
    if (match) {
      return match;
    }
  }
  return null;
}

export function updateNodeInTree(
  root: RequirementNode,
  nodeId: string,
  updater: (node: RequirementNode) => RequirementNode,
): RequirementNode {
  if (root.id === nodeId) {
    return updater(root);
  }
  return {
    ...root,
    children: root.children.map((child) => updateNodeInTree(child, nodeId, updater)),
  };
}

export function removeNodeFromTree(root: RequirementNode, nodeId: string): RequirementNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== nodeId)
      .map((child) => removeNodeFromTree(child, nodeId)),
  };
}

export function appendChildNode(root: RequirementNode, parentId: string, child: RequirementNode): RequirementNode {
  return updateNodeInTree(root, parentId, (node) => ({
    ...node,
    type: "FOLDER",
    children: [...node.children, child],
  }));
}

export function appendSiblingNode(root: RequirementNode, nodeId: string, sibling: RequirementNode): RequirementNode {
  if (root.children.some((child) => child.id === nodeId)) {
    return {
      ...root,
      type: "FOLDER",
      children: [...root.children, sibling],
    };
  }

  return {
    ...root,
    children: root.children.map((child) => appendSiblingNode(child, nodeId, sibling)),
  };
}

export function nextChildId(parent: RequirementNode): string {
  if (parent.id === "ROOT") {
    return `REQ-${parent.children.length + 1}`;
  }
  return `${parent.id}.${parent.children.length + 1}`;
}

export function buildNewChildNode(parent: RequirementNode): RequirementNode {
  const id = nextChildId(parent);
  return {
    id,
    name: `New chapter ${parent.children.length + 1}`,
    type: "ATOMIC",
    description: "",
    dependencies: [],
    children: [],
    scenarios: [{ name: "New scenario", steps: [] }],
  };
}

export function summarizeTaskTree(root: RequirementNode) {
  let nodeCount = 0;
  let atomicCount = 0;
  const visit = (node: RequirementNode) => {
    nodeCount += 1;
    if (node.type === "ATOMIC") {
      atomicCount += 1;
    }
    node.children.forEach(visit);
  };
  visit(root);
  return { nodeCount, atomicCount };
}
