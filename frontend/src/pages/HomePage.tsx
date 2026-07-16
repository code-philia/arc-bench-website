import {
  ArrowRightOutlined,
  CodeOutlined,
  ExperimentOutlined,
  PlayCircleOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary, RequirementSummary, SubmissionSummary } from "../lib/types";

type SurfaceKey = "playground" | "competition" | "research";

type SurfaceCard = {
  key: SurfaceKey;
  title: string;
  eyebrow: string;
  description: string;
  accentClass: string;
  icon: React.ReactNode;
  stats: Array<{ label: string; value: string }>;
  href?: string;
  comingSoon?: boolean;
};

function submissionTitle(submission: SubmissionSummary) {
  return submission.display_name || submission.model_name || submission.id;
}

export default function HomePage() {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("playground");

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => setRequirements([]));
    api.listCompetitions().then(setCompetitions).catch(() => setCompetitions([]));
    api.listSubmissions().then((items) => setSubmissions(items.slice(0, 4))).catch(() => setSubmissions([]));
  }, []);

  const webRequirementCount = requirements.filter((item) => item.category === "web").length;
  const totalTests = requirements.reduce((sum, item) => sum + item.total_tests, 0);
  const passedSubmissions = submissions.filter((item) => item.status === "PASSED").length;
  const publicCompetitionCount = competitions.filter((item) => item.is_public).length;

  const surfaces = useMemo<SurfaceCard[]>(
    () => [
      {
        key: "playground",
        title: "Playground",
        eyebrow: "Interactive drafting",
        description:
          "Design requirements, inspect benchmark structure, and iterate in a lower-pressure workspace before formal evaluation.",
        accentClass: "playground",
        icon: <PlayCircleOutlined />,
        href: "/playground",
        stats: [
          { label: "Requirement sets", value: `${requirements.length}` },
          { label: "Web tasks", value: `${webRequirementCount}` },
        ],
      },
      {
        key: "competition",
        title: "Competition",
        eyebrow: "Scored benchmark runs",
        description:
          "Browse active benchmark tracks, review task inventories, and move into scored submission workflows with shared evaluation rules.",
        accentClass: "competition",
        icon: <TrophyOutlined />,
        href: "/requirements",
        stats: [
          { label: "Competition tracks", value: `${competitions.length}` },
          { label: "Public packs", value: `${publicCompetitionCount}` },
        ],
      },
      {
        key: "research",
        title: "Research",
        eyebrow: "Artifacts and findings",
        description:
          "Aggregate benchmark outcomes, compare execution evidence, and prepare a home for papers, repos, and methodology notes.",
        accentClass: "research",
        icon: <ExperimentOutlined />,
        comingSoon: true,
        stats: [
          { label: "Tracked runs", value: `${submissions.length}` },
          { label: "Passed runs", value: `${passedSubmissions}` },
        ],
      },
    ],
    [competitions.length, passedSubmissions, publicCompetitionCount, requirements.length, submissions.length, webRequirementCount],
  );

  const activeCard = surfaces.find((item) => item.key === activeSurface) ?? surfaces[0];
  const featuredCompetition = competitions[0] ?? null;
  const featuredRequirement = requirements[0] ?? null;
  const featuredSubmission = submissions[0] ?? null;

  return (
    <div className="page home-page home-page-redesign">
      <div className="home-layout home-layout-redesign">
        <section className="home-stage">
          <div className="home-stage-copy">
            <div className="home-stage-kicker">
              <span className="home-stage-kicker-mark">ArcBench</span>
              <span className="home-stage-kicker-copy">Agent Benchmark Platform</span>
            </div>

            <h1 className="home-stage-title">
              A benchmark workspace for <span className="gradient">building</span>, <span className="gradient">competing</span>, and <span className="gradient">studying</span> software engineering agents.
            </h1>
          </div>

          <div className="home-surface-grid" role="tablist" aria-label="Homepage surfaces">
            {surfaces.map((surface) => {
              const isActive = surface.key === activeSurface;
              const cardBody = (
                <>
                  <div className="home-surface-main">
                    <div className={`home-surface-icon ${surface.accentClass}`}>{surface.icon}</div>
                    <div className="home-surface-text">
                      <div className="home-surface-eyebrow">{surface.eyebrow}</div>
                      <h2>{surface.title}</h2>
                    </div>
                    <div className="home-surface-arrow" aria-hidden="true">
                      <ArrowRightOutlined />
                    </div>
                  </div>

                  <div className="home-surface-support">
                    <p>{surface.description}</p>
                  </div>
                </>
              );

              return surface.href && !surface.comingSoon ? (
                <Link
                  key={surface.key}
                  to={surface.href}
                  className={`home-surface-card ${surface.accentClass} ${isActive ? "active" : ""}`}
                  onMouseEnter={() => setActiveSurface(surface.key)}
                  onFocus={() => setActiveSurface(surface.key)}
                >
                  {cardBody}
                </Link>
              ) : (
                <button
                  key={surface.key}
                  type="button"
                  className={`home-surface-card ${surface.accentClass} ${isActive ? "active" : ""} is-static`}
                  onMouseEnter={() => setActiveSurface(surface.key)}
                  onFocus={() => setActiveSurface(surface.key)}
                  onClick={() => setActiveSurface(surface.key)}
                >
                  {cardBody}
                </button>
              );
            })}
          </div>
        </section>
      </div>
      <footer className="home-icp-footer" aria-label="ICP filing">
        <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">
          蒙ICP备2026006682号
        </a>
      </footer>
    </div>
  );
}
