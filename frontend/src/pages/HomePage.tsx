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
              A benchmark workspace for <span className="gradient">building</span>, <span className="gradient">competing</span>, and <span className="gradient">studying</span> agent behavior.
            </h1>

            <p className="home-stage-description">
              Start from the surface that matches your goal. The homepage acts as a routing layer: each area has a distinct intent, a clearer preview, and lighter interaction before deeper workflows.
            </p>

            <div className="home-stage-metrics">
              <div className="home-stage-metric">
                <span className="home-stage-metric-value">{requirements.length}</span>
                <span className="home-stage-metric-label">Requirements</span>
              </div>
              <div className="home-stage-metric">
                <span className="home-stage-metric-value">{competitions.length}</span>
                <span className="home-stage-metric-label">Tracks</span>
              </div>
              <div className="home-stage-metric">
                <span className="home-stage-metric-value">{totalTests}</span>
                <span className="home-stage-metric-label">Tests</span>
              </div>
            </div>
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
                    <div className="home-surface-stats">
                      {surface.stats.map((stat) => (
                        <div key={stat.label} className="home-surface-stat">
                          <strong>{stat.value}</strong>
                          <span>{stat.label}</span>
                        </div>
                      ))}
                    </div>
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

        <section className="home-preview-band">
          <div className="home-preview-panel">
            <div className="home-preview-header">
              <div>
                <div className="home-preview-label">Surface Preview</div>
                <h3>{activeCard.title}</h3>
              </div>
              {activeCard.comingSoon ? <span className="home-preview-chip">Planned</span> : <span className="home-preview-chip active">Available</span>}
            </div>

            <div className="home-preview-content">
              {activeSurface === "playground" ? (
                <>
                  <div className="home-preview-block">
                    <span className="home-preview-block-label">Focus</span>
                    <strong>Interactive requirement design and exploratory submission setup</strong>
                  </div>
                  <div className="home-preview-list">
                    <div className="home-preview-item">
                      <CodeOutlined />
                      <span>Enter from a drafting-first workflow before pushing agents into scored evaluation.</span>
                    </div>
                    <div className="home-preview-item">
                      <CodeOutlined />
                      <span>Keep the entry lightweight and closer to requirement authoring, test inspection, and structure learning.</span>
                    </div>
                  </div>
                </>
              ) : null}

              {activeSurface === "competition" ? (
                <>
                  <div className="home-preview-grid">
                    <div className="home-preview-record">
                      <span className="home-preview-block-label">Featured track</span>
                      <strong>{featuredCompetition?.title ?? "No competition data"}</strong>
                      <p>{featuredCompetition?.summary ?? "Competition summaries will appear here once data is available."}</p>
                    </div>
                    <div className="home-preview-record">
                      <span className="home-preview-block-label">Task snapshot</span>
                      <strong>{featuredRequirement?.title ?? "No task loaded"}</strong>
                      <p>{featuredRequirement?.summary ?? "Task examples can be previewed here to help users choose an entry path."}</p>
                    </div>
                  </div>
                </>
              ) : null}

              {activeSurface === "research" ? (
                <>
                  <div className="home-preview-block">
                    <span className="home-preview-block-label">Intent</span>
                    <strong>Evidence-oriented browsing for benchmark outcomes, artifacts, and research context</strong>
                  </div>
                  <div className="home-preview-grid compact">
                    <div className="home-preview-record">
                      <span className="home-preview-block-label">Latest run</span>
                      <strong>{featuredSubmission ? submissionTitle(featuredSubmission) : "No recent run"}</strong>
                      <p>
                        {featuredSubmission
                          ? `${featuredSubmission.status} on ${featuredSubmission.requirement_id}`
                          : "Once research views are added, benchmark run evidence can be surfaced here."}
                      </p>
                    </div>
                    <div className="home-preview-record muted">
                      <span className="home-preview-block-label">Planned modules</span>
                      <strong>Rankings, papers, repos</strong>
                      <p>Use this space to expose publication context and cross-run comparisons without forcing users into submission flows.</p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          <div className="home-quick-column">
            <div className="home-quick-card">
              <div className="home-preview-label">Current data</div>
              <div className="home-quick-list">
                <div className="home-quick-item">
                  <span>Requirements</span>
                  <strong>{requirements.length}</strong>
                </div>
                <div className="home-quick-item">
                  <span>Competitions</span>
                  <strong>{competitions.length}</strong>
                </div>
                <div className="home-quick-item">
                  <span>Recent runs</span>
                  <strong>{submissions.length}</strong>
                </div>
              </div>
            </div>

            <div className="home-quick-card">
              <div className="home-preview-label">Design direction</div>
              <p className="home-quick-note">
                This homepage is now organized as three destination cards with hover and focus previews, so the user understands where to go before entering deeper pages.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
