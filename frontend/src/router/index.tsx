import { createBrowserRouter } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import CompetitionDetailPage from "../pages/CompetitionDetailPage";
import HomePage from "../pages/HomePage";
import PlaygroundPage from "../pages/PlaygroundPage";
import RequirementDetailPage from "../pages/RequirementDetailPage";
import RequirementsPage from "../pages/RequirementsPage";
import SubmissionDetailPage from "../pages/SubmissionDetailPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "requirements", element: <RequirementsPage /> },
      { path: "competitions/:competitionId", element: <CompetitionDetailPage /> },
      { path: "requirements/:requirementId", element: <RequirementDetailPage /> },
      { path: "submissions/:submissionId", element: <SubmissionDetailPage /> },
      { path: "playground", element: <PlaygroundPage /> },
    ],
  },
]);
