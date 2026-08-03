import { DeleteOutlined, PaperClipOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "antd";
import { useEffect, useRef, useState } from "react";

import DescriptionAttachmentPreview from "./DescriptionAttachmentPreview";
import { collectDescriptionAttachments, inferAttachmentKind } from "../../lib/descriptionMedia";
import { autoStructureNodeFromDescription, type RequirementNode } from "../../lib/taskTree";
import type { SubmissionTaskAssets } from "../../lib/types";

type RequirementNodeDetailContentProps = {
  node: RequirementNode;
  mode?: "editable" | "readonly";
  onNodeChange?: (updater: (node: RequirementNode) => RequirementNode) => void;
  onNodeIdChange?: (nextId: string) => void;
  taskAssets?: SubmissionTaskAssets | null;
  onDescriptionAttachmentUpload?: (file: File) => Promise<string>;
  onDescriptionAttachmentDelete?: (relativePath: string) => Promise<void>;
  dependencyOptions?: Array<{ id: string; name: string }>;
  showTypeField?: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAttachmentPath(rawPath: string) {
  return rawPath.trim().replace(/^\.\//, "");
}

function removeAttachmentReferences(description: string, rawPath: string) {
  const normalizedPath = normalizeAttachmentPath(rawPath);
  const pathPattern = escapeRegExp(normalizedPath);
  const optionalDotSlashPathPattern = normalizedPath.startsWith("reference/") || normalizedPath.startsWith("assets/")
    ? `(?:\\./)?${pathPattern}`
    : pathPattern;

  return description
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\(${optionalDotSlashPathPattern}\\)`, "g"), "")
    .replace(new RegExp(`^\\s*${optionalDotSlashPathPattern}\\s*$`, "gm"), "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function RequirementNodeDetailContent({
  node,
  mode = "readonly",
  onNodeChange,
  onNodeIdChange,
  taskAssets = null,
  onDescriptionAttachmentUpload,
  onDescriptionAttachmentDelete,
  dependencyOptions = [],
  showTypeField = true,
}: RequirementNodeDetailContentProps) {
  const editable = mode === "editable";
  const descriptionValue = node.description || "No description available.";
  const descriptionAttachments = collectDescriptionAttachments(node.description || "", taskAssets, node.images);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const dependencyPickerRef = useRef<HTMLDivElement | null>(null);
  const [deletingAttachmentPath, setDeletingAttachmentPath] = useState<string | null>(null);
  const [dependencyPickerOpen, setDependencyPickerOpen] = useState(false);
  const availableDependencyOptions = dependencyOptions.filter((option) => option.id !== node.id);

  const updateNode = (updater: (node: RequirementNode) => RequirementNode) => {
    if (!editable || !onNodeChange) {
      return;
    }
    onNodeChange(updater);
  };

  useEffect(() => {
    setDependencyPickerOpen(false);
  }, [node.id]);

  useEffect(() => {
    const closeDependencyPicker = (event: MouseEvent) => {
      if (!dependencyPickerRef.current?.contains(event.target as Node)) {
        setDependencyPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", closeDependencyPicker);
    return () => document.removeEventListener("mousedown", closeDependencyPicker);
  }, []);

  const addDependency = (dependencyId: string) => {
    if (!dependencyId || node.dependencies.includes(dependencyId)) {
      return;
    }
    updateNode((currentNode) => ({
      ...currentNode,
      dependencies: [...currentNode.dependencies, dependencyId],
    }));
    setDependencyPickerOpen(false);
  };

  const insertDescriptionAttachment = async (file: File) => {
    if (!editable || !onDescriptionAttachmentUpload) {
      return;
    }
    try {
      const relativePath = await onDescriptionAttachmentUpload(file);
      const markdownToken = inferAttachmentKind(file.name) === "image"
        ? `![${file.name}](${relativePath})`
        : `[${file.name}](${relativePath})`;
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

  const removeDescriptionAttachment = async (rawPath: string) => {
    if (!editable) {
      return;
    }
    const nextDescription = removeAttachmentReferences(node.description || "", rawPath);
    const normalizedPath = normalizeAttachmentPath(rawPath);
    const managedReferencePath = normalizedPath.replace(/^reference\//, "");
    try {
      setDeletingAttachmentPath(normalizedPath);
      if (normalizedPath.startsWith("reference/") && onDescriptionAttachmentDelete) {
        await onDescriptionAttachmentDelete(managedReferencePath);
      }
      updateNode((currentNode) => ({
        ...currentNode,
        description: nextDescription,
      }));
      message.success("Attachment deleted.");
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setDeletingAttachmentPath((current) => (current === normalizedPath ? null : current));
    }
  };

  const removeDeclaredImage = (rawPath: string) => {
    if (!editable) {
      return;
    }
    const normalizedPath = normalizeAttachmentPath(rawPath);
    updateNode((currentNode) => ({
      ...currentNode,
      images: (currentNode.images ?? []).filter((image) => normalizeAttachmentPath(image.path) !== normalizedPath),
    }));
    message.success("Declared image removed.");
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

          {showTypeField ? (
            <label className="field-stack">
              <span>Type</span>
              <input className="text-input" value={node.type} readOnly />
            </label>
          ) : null}

          <label className="field-stack" style={{ gridColumn: "1 / -1" }}>
            <span>Dependencies</span>
            <div className="dependency-chip-list readonly">
              {node.dependencies.length > 0 ? node.dependencies.map((dependencyId) => (
                <span key={`${node.id}-${dependencyId}`} className="dependency-chip">
                  {dependencyId}
                </span>
              )) : (
                <span className="dependency-empty-copy">No dependencies</span>
              )}
            </div>
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

        {descriptionAttachments.length > 0 ? (
          <div className="requirement-detail-image-section">
            <div className="requirement-detail-image-title">Reference Attachments</div>
            <div className="requirement-detail-image-grid">
              {descriptionAttachments.map((attachment, index) => (
                <DescriptionAttachmentPreview
                  key={`${node.id}-readonly-attachment-${index}`}
                  attachment={attachment}
                />
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

        {showTypeField ? (
          <label className="field-stack">
            <span>Type</span>
            <input className="text-input" value={node.type} readOnly />
          </label>
        ) : null}

        <label className="field-stack" style={{ gridColumn: "1 / -1" }}>
          <span>Dependencies</span>
          <div ref={dependencyPickerRef} className={`dependency-picker${dependencyPickerOpen ? " open" : ""}`}>
            <button
              type="button"
              className="dependency-picker-trigger"
              aria-haspopup="listbox"
              aria-expanded={dependencyPickerOpen}
              onClick={() => setDependencyPickerOpen((current) => !current)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setDependencyPickerOpen(false);
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setDependencyPickerOpen((current) => !current);
                }
              }}
            >
              <span>Select dependency to add...</span>
              <span className="dependency-picker-chevron" aria-hidden="true" />
            </button>
            {dependencyPickerOpen ? (
              <div className="dependency-picker-menu" role="listbox" aria-label="Available dependencies">
                {availableDependencyOptions.length > 0 ? availableDependencyOptions.map((option) => {
                  const alreadySelected = node.dependencies.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className="dependency-picker-option"
                      role="option"
                      aria-selected={alreadySelected}
                      disabled={alreadySelected}
                      onClick={() => addDependency(option.id)}
                    >
                      <strong>{option.id}</strong>
                      <span>{option.name}</span>
                      {alreadySelected ? <em>Added</em> : null}
                    </button>
                  );
                }) : (
                  <div className="dependency-picker-empty">No available dependencies</div>
                )}
              </div>
            ) : null}
          </div>
          <div className="dependency-chip-list">
            {node.dependencies.length > 0 ? node.dependencies.map((dependencyId) => (
              <span key={`${node.id}-${dependencyId}`} className="dependency-chip">
                <span>{dependencyId}</span>
                <button
                  type="button"
                  className="dependency-chip-remove"
                  onClick={() =>
                    updateNode((currentNode) => ({
                      ...currentNode,
                      dependencies: currentNode.dependencies.filter((item) => item !== dependencyId),
                    }))
                  }
                  aria-label={`Remove dependency ${dependencyId}`}
                >
                  x
                </button>
              </span>
            )) : (
              <span className="dependency-empty-copy">No dependencies selected</span>
            )}
          </div>
        </label>
      </div>

      <div className="field-stack">
        <span>Description</span>
        <div className="requirement-detail-description-actions">
          <button
            type="button"
            className="mini-btn detail-toolbar-like-btn"
            onClick={() => descriptionAttachmentInputRef.current?.click()}
            disabled={!editable || !onDescriptionAttachmentUpload}
          >
            <PaperClipOutlined /> Upload Attachment
          </button>
          <input
            ref={descriptionAttachmentInputRef}
            className="visually-hidden"
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void insertDescriptionAttachment(file);
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
          onBlur={(event) => updateNode((currentNode) => autoStructureNodeFromDescription(currentNode, event.target.value))}
        />
      </div>

      {descriptionAttachments.length > 0 ? (
        <div className="requirement-detail-image-section">
          <div className="requirement-detail-image-title">Reference Attachments</div>
          <div className="requirement-detail-image-grid">
            {descriptionAttachments.map((attachment, index) => (
              <DescriptionAttachmentPreview
                key={`${node.id}-editable-attachment-${index}`}
                attachment={attachment}
                onDelete={attachment.source === "images"
                  ? () => removeDeclaredImage(attachment.rawPath)
                  : () => void removeDescriptionAttachment(attachment.rawPath)}
                deleting={attachment.source === "images" ? false : deletingAttachmentPath === normalizeAttachmentPath(attachment.rawPath)}
              />
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
              className="mini-btn detail-toolbar-like-btn"
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
