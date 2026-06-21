import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

import type { RequirementNode } from "../../lib/taskTree";

type RequirementNodeDetailContentProps = {
  node: RequirementNode;
  mode?: "editable" | "readonly";
  onNodeChange?: (updater: (node: RequirementNode) => RequirementNode) => void;
  onNodeIdChange?: (nextId: string) => void;
};

export default function RequirementNodeDetailContent({
  node,
  mode = "readonly",
  onNodeChange,
  onNodeIdChange,
}: RequirementNodeDetailContentProps) {
  const editable = mode === "editable";

  const updateNode = (updater: (node: RequirementNode) => RequirementNode) => {
    if (!editable || !onNodeChange) {
      return;
    }
    onNodeChange(updater);
  };

  if (!editable) {
    return (
      <div className="readonly-node-detail">
        <div className="readonly-detail-grid">
          <div className="readonly-detail-card">
            <span>Requirement ID</span>
            <strong>{node.id}</strong>
          </div>
          <div className="readonly-detail-card">
            <span>Type</span>
            <strong>{node.type}</strong>
          </div>
          <div className="readonly-detail-card">
            <span>Dependencies</span>
            <strong>{node.dependencies.length}</strong>
          </div>
          <div className="readonly-detail-card">
            <span>Scenarios</span>
            <strong>{node.scenarios.length}</strong>
          </div>
        </div>

        <div className="readonly-detail-section">
          <div className="readonly-detail-label">Title</div>
          <div className="readonly-detail-body">{node.name || "Untitled requirement."}</div>
        </div>

        <div className="readonly-detail-section">
          <div className="readonly-detail-label">Description</div>
          <div className="readonly-detail-body">
            {node.description || "No description available."}
          </div>
        </div>

        {node.dependencies.length > 0 ? (
          <div className="readonly-detail-section">
            <div className="readonly-detail-label">Dependencies</div>
            <div className="readonly-detail-tags">
              {node.dependencies.map((dependency) => (
                <span key={dependency} className="task-node-chip folder">
                  {dependency}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="readonly-detail-section">
          <div className="readonly-detail-label">Scenarios</div>
          {node.scenarios.length === 0 ? (
            <div className="readonly-detail-body empty">No scenarios available.</div>
          ) : (
            <div className="readonly-scenario-list">
              {node.scenarios.map((scenario, scenarioIndex) => (
                <div key={`${node.id}-scenario-${scenarioIndex}`} className="readonly-scenario-card">
                  <strong>{scenario.name}</strong>
                  {scenario.steps.length === 0 ? (
                    <div className="readonly-detail-body empty">No steps defined.</div>
                  ) : (
                    <div className="readonly-scenario-steps">
                      {scenario.steps.map((step, stepIndex) => (
                        <div key={`${node.id}-scenario-${scenarioIndex}-step-${stepIndex}`} className="readonly-scenario-step">
                          <span>{step.keyword}</span>
                          <div>{step.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
        <textarea
          className="text-area"
          rows={4}
          value={node.description}
          readOnly={!editable}
          onChange={(event) => updateNode((currentNode) => ({ ...currentNode, description: event.target.value }))}
        />
      </label>

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
