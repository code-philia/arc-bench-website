import { createBrowserRouter } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import CompetitionDetailPage from "../pages/CompetitionDetailPage";
import HomePage from "../pages/HomePage";
import LoginPage from "../pages/LoginPage";
import PlaygroundPage from "../pages/PlaygroundPage";
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
    ],
  },
]);
