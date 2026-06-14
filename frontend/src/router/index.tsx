import { createBrowserRouter } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import CompetitionDetailPage from "../pages/CompetitionDetailPage";
import CreateTaskPage from "../pages/CreateTaskPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import MyTaskDetailPage from "../pages/MyTaskDetailPage";
import MyTasksPage from "../pages/MyTasksPage";
import PlaygroundPage from "../pages/PlaygroundPage";
import PlaygroundRequirementDetailPage from "../pages/PlaygroundRequirementDetailPage";
import PlaygroundTaskListPage from "../pages/PlaygroundTaskListPage";
import ResearchPage from "../pages/ResearchPage";
import RegisterPage from "../pages/RegisterPage";
import RequirementDetailPage from "../pages/RequirementDetailPage";
import RequirementsPage from "../pages/RequirementsPage";
import SubmissionDetailPage from "../pages/SubmissionDetailPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "requirements", element: <RequirementsPage /> },
      { path: "competitions/:competitionId", element: <CompetitionDetailPage /> },
      { path: "requirements/:requirementId", element: <RequirementDetailPage /> },
      { path: "submissions/:submissionId", element: <SubmissionDetailPage /> },
      { path: "playground", element: <PlaygroundPage /> },
      { path: "playground/task-bank/:taskType", element: <PlaygroundTaskListPage /> },
      { path: "playground/task-bank/:taskType/:requirementId", element: <PlaygroundRequirementDetailPage /> },
      { path: "playground/create-task", element: <CreateTaskPage /> },
      { path: "playground/my-tasks", element: <MyTasksPage /> },
      { path: "playground/my-tasks/:taskId", element: <MyTaskDetailPage /> },
      { path: "research", element: <ResearchPage /> },
    ],
  },
]);
