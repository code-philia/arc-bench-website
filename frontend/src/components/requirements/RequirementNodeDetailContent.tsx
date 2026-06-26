import { DeleteOutlined, PaperClipOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useRef } from "react";

import type { RequirementNode } from "../../lib/taskTree";
import type { SubmissionTaskAssets } from "../../lib/types";

type RequirementNodeDetailContentProps = {
  node: RequirementNode;
  mode?: "editable" | "readonly";
  onNodeChange?: (updater: (node: RequirementNode) => RequirementNode) => void;
  onNodeIdChange?: (nextId: string) => void;
  taskAssets?: SubmissionTaskAssets | null;
  onDescriptionImageUpload?: (file: File) => Promise<string>;
};

const IMAGE_MARKDOWN_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

function joinResourceUrl(baseUrl: string, relativePath: string) {
  if (!baseUrl) {
    return relativePath;
  }
  const normalizedBasePath = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBasePath}${relativePath.replace(/^\/+/, "")}`;
}

function resolveDescriptionImageSrc(rawPath: string, taskAssets?: SubmissionTaskAssets | null) {
  const trimmedPath = rawPath.trim();
  if (!trimmedPath) {
    return "";
  }
  if (/^(https?:|data:)/i.test(trimmedPath)) {
    return trimmedPath;
  }
  if (trimmedPath.startsWith("./reference/") || trimmedPath.startsWith("reference/")) {
    const relativePath = trimmedPath.replace(/^\.\//, "").replace(/^reference\//, "");
    return taskAssets?.references_base_url ? joinResourceUrl(taskAssets.references_base_url, relativePath) : trimmedPath;
  }
  if (trimmedPath.startsWith("./assets/") || trimmedPath.startsWith("assets/")) {
    const relativePath = trimmedPath.replace(/^\.\//, "").replace(/^assets\//, "");
    return taskAssets?.assets_base_url ? joinResourceUrl(taskAssets.assets_base_url, relativePath) : trimmedPath;
  }
  return trimmedPath;
}

function collectDescriptionImages(description: string, taskAssets?: SubmissionTaskAssets | null) {
  const images: Array<{ alt: string; src: string }> = [];
  const seen = new Set<string>();

  for (const match of description.matchAll(IMAGE_MARKDOWN_PATTERN)) {
    const alt = (match[1] || "").trim();
    const src = resolveDescriptionImageSrc(match[2] || "", taskAssets);
    if (!src || seen.has(src)) {
      continue;
    }
    seen.add(src);
    images.push({ alt, src });
  }

  const lines = description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (IMAGE_MARKDOWN_PATTERN.test(line)) {
      IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
      continue;
    }
    IMAGE_MARKDOWN_PATTERN.lastIndex = 0;
    const rawPath = resolveDescriptionImageSrc(line, taskAssets);
    if (!rawPath) {
      continue;
    }
    const looksLikeImagePath =
      /\.(png|jpe?g|gif|webp|svg)$/i.test(line) ||
      /^(https?:|data:)/i.test(line) ||
      /^(?:\.\/)?(?:reference|assets)\//i.test(line);
    if (!looksLikeImagePath || seen.has(rawPath)) {
      continue;
    }
    seen.add(rawPath);
    images.push({ alt: "", src: rawPath });
  }

  return images;
}

export default function RequirementNodeDetailContent({
  node,
  mode = "readonly",
  onNodeChange,
  onNodeIdChange,
  taskAssets = null,
  onDescriptionImageUpload,
}: RequirementNodeDetailContentProps) {
  const editable = mode === "editable";
  const descriptionValue = node.description || "No description available.";
  const descriptionImages = collectDescriptionImages(node.description || "", taskAssets);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionImageInputRef = useRef<HTMLInputElement | null>(null);

  const updateNode = (updater: (node: RequirementNode) => RequirementNode) => {
    if (!editable || !onNodeChange) {
      return;
    }
    onNodeChange(updater);
  };

  const insertDescriptionImage = async (file: File) => {
    if (!editable || !onDescriptionImageUpload) {
      return;
    }
    try {
      const relativePath = await onDescriptionImageUpload(file);
      const markdownToken = `![image](${relativePath})`;
      const textarea = descriptionInputRef.current;
      const currentDescription = node.description || "";
      const selectionStart = textarea?.selectionStart ?? currentDescription.length;
      const selectionEnd = textarea?.selectionEnd ?? currentDescription.length;
      const needsLeadingNewline = selectionStart > 0 && currentDescription[selectionStart - 1] !== "\n";
      const prefix = currentDescription.slice(0, selectionStart);
      const suffix = currentDescription.slice(selectionEnd);
      const insertion = `${needsLeadingNewline ? "\n" : ""}${markdownToken}`;
      updateNode((currentNode) => ({
        ...currentNode,
        description: `${prefix}${insertion}${suffix}`,
      }));
      window.setTimeout(() => {
        const input = descriptionInputRef.current;
        if (!input) {
          return;
        }
        const caret = prefix.length + insertion.length;
        input.focus();
        input.setSelectionRange(caret, caret);
      }, 0);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  if (!editable) {
    return (
      <>
        <div className="create-task-detail-grid">
          <label className="field-stack">
            <span>Requirement ID</span>
            <input className="text-input" value={node.id} readOnly />
          </label>

          <label className="field-stack">
            <span>Title</span>
            <input className="text-input" value={node.name} readOnly />
          </label>

          <label className="field-stack">
            <span>Type</span>
            <input className="text-input" value={node.type} readOnly />
          </label>

          <label className="field-stack">
            <span>Dependencies</span>
            <input
              className="text-input"
              value={node.dependencies.length > 0 ? node.dependencies.join(", ") : "No dependencies"}
              readOnly
            />
          </label>
        </div>

        <label className="field-stack">
          <span>Description</span>
          <textarea
            className="text-area"
            rows={4}
            value={descriptionValue}
            readOnly
          />
        </label>

        {descriptionImages.length > 0 ? (
          <div className="requirement-detail-image-section">
            <div className="requirement-detail-image-title">Reference Images</div>
            <div className="requirement-detail-image-grid">
              {descriptionImages.map((image, index) => (
                <figure key={`${node.id}-readonly-image-${index}`} className="requirement-detail-image-card">
                  <img src={image.src} alt={image.alt || `Reference ${index + 1}`} loading="lazy" />
                  {image.alt ? <figcaption>{image.alt}</figcaption> : null}
                </figure>
              ))}
            </div>
          </div>
        ) : null}

        <div className="scenario-editor compact">
          <div className="scenario-editor-head">
            <strong>{node.scenarios.length} scenarios</strong>
          </div>

          {node.scenarios.length === 0 ? (
            <div className="scenario-card scenario-card-readonly-empty">
              <div className="scenario-empty-copy">No scenarios available.</div>
            </div>
          ) : (
            node.scenarios.map((scenario, scenarioIndex) => (
              <div key={`${node.id}-scenario-${scenarioIndex}`} className="scenario-card">
                <div className="scenario-card-top readonly">
                  <strong>{scenario.name}</strong>
                  <span className="scenario-card-meta">
                    {scenario.steps.length} step{scenario.steps.length === 1 ? "" : "s"}
                  </span>
                </div>

                {scenario.steps.length === 0 ? (
                  <div className="scenario-empty-copy">No steps defined.</div>
                ) : (
                  <div className="scenario-steps">
                    {scenario.steps.map((step, stepIndex) => (
                      <div key={`${node.id}-scenario-${scenarioIndex}-step-${stepIndex}`} className="scenario-step-readonly">
                        <span className="scenario-step-keyword">{step.keyword}</span>
                        <div className="scenario-step-body">{step.content || "No step content."}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="create-task-detail-grid">
        <label className="field-stack">
          <span>Requirement ID</span>
          <input
            className="text-input"
            value={node.id}
            readOnly={!editable}
            onChange={(event) => {
              const nextId = event.target.value;
              updateNode((currentNode) => ({ ...currentNode, id: nextId }));
              onNodeIdChange?.(nextId);
            }}
          />
        </label>

        <label className="field-stack">
          <span>Title</span>
          <input
            className="text-input"
            value={node.name}
            readOnly={!editable}
            onChange={(event) => updateNode((currentNode) => ({ ...currentNode, name: event.target.value }))}
          />
        </label>

        <label className="field-stack">
          <span>Type</span>
          {editable ? (
            <select
              className="text-input"
              value={node.type}
              onChange={(event) =>
                updateNode((currentNode) => ({
                  ...currentNode,
                  type: event.target.value as RequirementNode["type"],
                  children: event.target.value === "ATOMIC" ? [] : currentNode.children,
                  scenarios:
                    currentNode.scenarios.length > 0 ? currentNode.scenarios : [{ name: "New scenario", steps: [] }],
                }))
              }
            >
              <option value="FOLDER">FOLDER</option>
              <option value="ATOMIC">ATOMIC</option>
            </select>
          ) : (
            <input className="text-input" value={node.type} readOnly />
          )}
        </label>

        <label className="field-stack">
          <span>Dependencies</span>
          <input
            className="text-input"
            placeholder="REQ-1, REQ-2"
            value={node.dependencies.join(", ")}
            readOnly={!editable}
            onChange={(event) =>
              updateNode((currentNode) => ({
                ...currentNode,
                dependencies: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              }))
            }
          />
        </label>
      </div>

      <label className="field-stack">
        <span>Description</span>
        <div className="requirement-detail-description-actions">
          <button
            type="button"
            className="mini-btn"
            onClick={() => descriptionImageInputRef.current?.click()}
            disabled={!editable || !onDescriptionImageUpload}
          >
            <PaperClipOutlined /> Upload Image
          </button>
          <input
            ref={descriptionImageInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void insertDescriptionImage(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </div>
        <textarea
          ref={descriptionInputRef}
          className="text-area"
          rows={4}
          value={node.description}
          readOnly={!editable}
          onChange={(event) => updateNode((currentNode) => ({ ...currentNode, description: event.target.value }))}
        />
      </label>

      {descriptionImages.length > 0 ? (
        <div className="requirement-detail-image-section">
          <div className="requirement-detail-image-title">Reference Images</div>
          <div className="requirement-detail-image-grid">
            {descriptionImages.map((image, index) => (
              <figure key={`${node.id}-editable-image-${index}`} className="requirement-detail-image-card">
                <img src={image.src} alt={image.alt || `Reference ${index + 1}`} loading="lazy" />
                {image.alt ? <figcaption>{image.alt}</figcaption> : null}
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      <div className="scenario-editor compact">
        <div className="scenario-editor-head">
          <strong>{node.scenarios.length} scenarios</strong>
          {editable ? (
            <button
              type="button"
              className="mini-btn"
              onClick={() =>
                updateNode((currentNode) => ({
                  ...currentNode,
                  scenarios: [...currentNode.scenarios, { name: `Scenario ${currentNode.scenarios.length + 1}`, steps: [] }],
                }))
              }
            >
              <PlusOutlined /> Add Scenario
            </button>
          ) : null}
        </div>

        {node.scenarios.map((scenario, scenarioIndex) => (
          <div key={`${node.id}-scenario-${scenarioIndex}`} className="scenario-card">
            <div className="scenario-card-top">
              <input
                className="text-input"
                value={scenario.name}
                readOnly={!editable}
                onChange={(event) =>
                  updateNode((currentNode) => ({
                    ...currentNode,
                    scenarios: currentNode.scenarios.map((item, index) =>
                      index === scenarioIndex ? { ...item, name: event.target.value } : item,
                    ),
                  }))
                }
              />
              {editable ? (
                <button
                  type="button"
                  className="icon-only-btn"
                  onClick={() =>
                    updateNode((currentNode) => ({
                      ...currentNode,
                      scenarios: currentNode.scenarios.filter((_, index) => index !== scenarioIndex),
                    }))
                  }
                >
                  <DeleteOutlined />
                </button>
              ) : null}
            </div>

            <div className="scenario-steps">
              {scenario.steps.map((step, stepIndex) => (
                <div key={`${scenarioIndex}-${stepIndex}`} className="scenario-step-row">
                  {editable ? (
                    <select
                      className="text-input scenario-keyword"
                      value={step.keyword}
                      onChange={(event) =>
                        updateNode((currentNode) => ({
                          ...currentNode,
                          scenarios: currentNode.scenarios.map((item, index) =>
                            index === scenarioIndex
                              ? {
                                  ...item,
                                  steps: item.steps.map((scenarioStep, nestedIndex) =>
                                    nestedIndex === stepIndex
                                      ? { ...scenarioStep, keyword: event.target.value }
                                      : scenarioStep,
                                  ),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      <option value="GIVEN">GIVEN</option>
                      <option value="WHEN">WHEN</option>
                      <option value="THEN">THEN</option>
                      <option value="AND">AND</option>
                    </select>
                  ) : (
                    <input className="text-input scenario-keyword" value={step.keyword} readOnly />
                  )}
                  <input
                    className="text-input"
                    value={step.content}
                    readOnly={!editable}
                    onChange={(event) =>
                      updateNode((currentNode) => ({
                        ...currentNode,
                        scenarios: currentNode.scenarios.map((item, index) =>
                          index === scenarioIndex
                            ? {
                                ...item,
                                steps: item.steps.map((scenarioStep, nestedIndex) =>
                                  nestedIndex === stepIndex
                                    ? { ...scenarioStep, content: event.target.value }
                                    : scenarioStep,
                                ),
                              }
                            : item,
                        ),
                      }))
                    }
                  />
                  {editable ? (
                    <button
                      type="button"
                      className="icon-only-btn"
                      onClick={() =>
                        updateNode((currentNode) => ({
                          ...currentNode,
                          scenarios: currentNode.scenarios.map((item, index) =>
                            index === scenarioIndex
                              ? {
                                  ...item,
                                  steps: item.steps.filter((_, nestedIndex) => nestedIndex !== stepIndex),
                                }
                              : item,
                          ),
                        }))
                      }
                    >
                      <DeleteOutlined />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {editable ? (
              <button
                type="button"
                className="mini-btn"
                onClick={() =>
                  updateNode((currentNode) => ({
                    ...currentNode,
                    scenarios: currentNode.scenarios.map((item, index) =>
                      index === scenarioIndex
                        ? {
                            ...item,
                            steps: [...item.steps, { keyword: "GIVEN", content: "" }],
                          }
                        : item,
                    ),
                  }))
                }
              >
                <PlusOutlined /> Add Step
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
