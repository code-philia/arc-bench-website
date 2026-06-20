import type { QuickStartStep } from "./types";

export const QUICK_START_REQUIREMENT_ID = "12306";
export const QUICK_START_TASK_TYPE = "web";
export const QUICK_START_DISPLAY_NAME = "Quick Start Demo Agent";
export const QUICK_START_MODEL_NAME = "ArcBench Demo Runtime";

export const QUICK_START_PYTHON_SNIPPET = `from arcbench_visual import (
    mark_design_done,
    mark_implementation_done,
    mark_test_passed,
)

mark_design_done("REQ-1", "Flow design is finalized")
mark_implementation_done("REQ-1", "Main page and form logic are implemented")
mark_test_passed("REQ-1", "Local validation passed")
`;

export const QUICK_START_STEPS: QuickStartStep[] = [
  {
    id: "home-task-type",
    route: "/playground",
    targetId: "quickstart-task-type-web",
    title: "Step 1/8",
    message: "Choose task type (web application).",
    buttonLabel: "Next",
    allowTargetClick: true,
    preferredPlacement: "left",
  },
  {
    id: "task-list-item",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}`,
    targetId: "quickstart-task-item",
    title: "Step 2/8",
    message: "Choose one task (railway ticket booking system).",
    buttonLabel: "Next",
    allowTargetClick: true,
    preferredPlacement: "up",
  },
  {
    id: "detail-contents",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}`,
    targetId: "quickstart-contents",
    title: "Step 3/8",
    message: "Requirements are presented in a tree structure, allowing you to select and view a specific requirement node.",
    buttonLabel: "Next",
    allowTargetClick: true,
    preferredPlacement: "right",
  },
  {
    id: "detail-document",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}`,
    targetId: "quickstart-document",
    title: "Step 4/8",
    message: "Each requirement node contains attributes such as description, scenario, dependencies, etc.",
    buttonLabel: "Next",
    preferredPlacement: "left",
  },
  {
    id: "detail-submit",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}`,
    targetId: "quickstart-submit",
    title: "Step 5/8",
    message: "Upload your agent code, fill in the required information, and click Submit (we have pre-filled it here).",
    buttonLabel: "Next",
    allowTargetClick: true,
    preferredPlacement: "left",
  },
  {
    id: "submission-canvas",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}/submissions/__dynamic__`,
    targetId: "quickstart-submission-canvas",
    title: "Step 6/8",
    message: "You can observe the process of requirements being implemented step by step, view the test results, and inspect your program's standard output.",
    buttonLabel: "Next",
    preferredPlacement: "left",
  },
  {
    id: "submission-node-detail",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}/submissions/__dynamic__`,
    targetId: "quickstart-submission-node-detail",
    title: "Step 7/8",
    message: "Click on a requirement node to quickly access the corresponding requirement details and its current status.",
    buttonLabel: "Next",
    preferredPlacement: "left",
  },
  {
    id: "submission-api-doc",
    route: `/playground/task-bank/${QUICK_START_TASK_TYPE}/${QUICK_START_REQUIREMENT_ID}/submissions/__dynamic__`,
    targetId: "quickstart-nav-api-doc",
    title: "Step 8/8",
    message: "To enable real-time monitoring of requirement implementation progress, you can integrate the APIs we provide into your agent code. For example, in Python, you can use these APIs to update the status of requirement nodes as below. For more detailed API documentation, please refer to the API Doc.",
    buttonLabel: "Done",
    codeSnippet: QUICK_START_PYTHON_SNIPPET,
    preferredPlacement: "down",
  },
];
