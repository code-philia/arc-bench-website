import { createBrowserRouter } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import ApiDocPage from "../pages/ApiDocPage";
import CompetitionDetailPage from "../pages/CompetitionDetailPage";
import CompetitionTaskPage from "../pages/CompetitionTaskPage";
import CreateTaskPage from "../pages/CreateTaskPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import MyTaskDetailPage from "../pages/MyTaskDetailPage";
import MyTasksPage from "../pages/MyTasksPage";
import NotificationsPage from "../pages/NotificationsPage";
import PlaygroundPage from "../pages/PlaygroundPage";
import PlaygroundRequirementDetailPage from "../pages/PlaygroundRequirementDetailPage";
import PlaygroundSubmissionDetailPage from "../pages/PlaygroundSubmissionDetailPage";
import PlaygroundTaskListPage from "../pages/PlaygroundTaskListPage";
import ProfilePage from "../pages/ProfilePage";
import ResearchPage from "../pages/ResearchPage";
import RegisterPage from "../pages/RegisterPage";
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
      { path: "profile", element: <ProfilePage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "requirements", element: <RequirementsPage /> },
      { path: "api-doc", element: <ApiDocPage /> },
      { path: "competitions/:competitionId", element: <CompetitionDetailPage /> },
      { path: "competitions/:competitionId/tasks/:requirementId", element: <CompetitionTaskPage /> },
      { path: "runs/:submissionId", element: <SubmissionDetailPage /> },
      { path: "requirements/:requirementId", element: <PlaygroundRequirementDetailPage /> },
      { path: "submissions/:submissionId", element: <SubmissionDetailPage /> },
      { path: "playground", element: <PlaygroundPage /> },
      { path: "playground/arc-bench/:taskType", element: <PlaygroundTaskListPage /> },
      { path: "playground/arc-bench/:taskType/:requirementId", element: <PlaygroundRequirementDetailPage /> },
      { path: "playground/arc-bench/:taskType/:requirementId/submissions/:submissionId", element: <PlaygroundSubmissionDetailPage /> },
      { path: "playground/task-bank/:taskType", element: <PlaygroundTaskListPage /> },
      { path: "playground/task-bank/:taskType/:requirementId", element: <PlaygroundRequirementDetailPage /> },
      { path: "playground/task-bank/:taskType/:requirementId/submissions/:submissionId", element: <PlaygroundSubmissionDetailPage /> },
      { path: "playground/create-task", element: <CreateTaskPage /> },
      { path: "playground/my-tasks", element: <MyTasksPage /> },
      { path: "playground/my-tasks/:taskId", element: <MyTaskDetailPage /> },
      { path: "playground/my-tasks/:taskId/submissions/:submissionId", element: <PlaygroundSubmissionDetailPage /> },
      { path: "playground/my-tasks/:taskId/edit", element: <CreateTaskPage /> },
      { path: "research", element: <ResearchPage /> },
    ],
  },
]);
