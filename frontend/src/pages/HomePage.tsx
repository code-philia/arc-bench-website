import {
  ArrowRightOutlined,
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
  icon: React.ReactNode;
  href?: string;
  comingSoon?: boolean;
};

const surfaceToneClasses: Record<
  SurfaceKey,
  {
    icon: string;
    selected: string;
    idle: string;
  }
> = {
  playground: {
    icon: "bg-[var(--accent-glow)] text-[var(--accent)]",
    selected: "border-[var(--accent)] bg-[var(--accent-glow)] shadow-[0_10px_30px_rgba(0,184,148,0.12)]",
    idle: "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-light)] hover:bg-[var(--bg-elevated)]",
  },
  competition: {
    icon: "bg-[var(--warn-glow)] text-[var(--warn)]",
    selected: "border-[var(--warn)] bg-[var(--warn-glow)] shadow-[0_10px_30px_rgba(224,149,32,0.12)]",
    idle: "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-light)] hover:bg-[var(--bg-elevated)]",
  },
  research: {
    icon: "bg-[var(--fail-glow)] text-[var(--fail)]",
    selected: "border-[var(--fail)] bg-[var(--fail-glow)] shadow-[0_10px_30px_rgba(230,57,80,0.1)]",
    idle: "border-[var(--border)] bg-[var(--bg)] hover:border-[var(--border-light)] hover:bg-[var(--bg-elevated)]",
  },
};

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
        icon: <PlayCircleOutlined />,
        href: "/playground",
      },
      {
        key: "competition",
        title: "Competition",
        eyebrow: "Scored benchmark runs",
        description:
          "Browse active benchmark tracks, review task inventories, and move into scored submission workflows with shared evaluation rules.",
        icon: <TrophyOutlined />,
        href: "/requirements",
      },
      {
        key: "research",
        title: "Research",
        eyebrow: "Artifacts and findings",
        description:
          "Aggregate benchmark outcomes, compare execution evidence, and prepare a home for papers, repos, and methodology notes.",
        icon: <ExperimentOutlined />,
        comingSoon: true,
      },
    ],
    [competitions.length, passedSubmissions, publicCompetitionCount, requirements.length, submissions.length, webRequirementCount],
  );

  return (
    <div className="page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
        <section className="flex min-h-[420px] items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-8 lg:p-10">
          <div className="max-w-[760px]">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[var(--accent-glow)] px-3 py-1 font-semibold text-[var(--accent)]">
                ArcBench
              </span>
              <span className="text-[var(--text-dim)]">Agent Benchmark Platform</span>
            </div>

            <h1 className="text-[2.5rem] font-semibold leading-[1.08] text-[var(--text)] sm:text-[3.35rem]">
              A benchmark workspace for <span className="text-[var(--accent)]">building</span>,{" "}
              <span className="text-[var(--accent)]">competing</span>, and{" "}
              <span className="text-[var(--accent)]">studying</span> software engineering agents.
            </h1>
          </div>
        </section>

        <aside className="grid gap-3" role="tablist" aria-label="Homepage surfaces">
          {surfaces.map((surface) => {
            const isActive = surface.key === activeSurface;
            const tone = surfaceToneClasses[surface.key];
            const cardClassName = [
              "group flex min-h-[132px] flex-col justify-between rounded-xl border p-4 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              isActive ? tone.selected : tone.idle,
            ].join(" ");
            const cardBody = (
              <>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${tone.icon}`}>
                    {surface.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold uppercase text-[var(--text-muted)]">{surface.eyebrow}</div>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{surface.title}</h2>
                  </div>
                  <ArrowRightOutlined className="mt-1 text-sm text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--text)]" />
                </div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-dim)]">{surface.description}</p>
              </>
            );

            return surface.href && !surface.comingSoon ? (
              <Link
                key={surface.key}
                to={surface.href}
                className={cardClassName}
                onMouseEnter={() => setActiveSurface(surface.key)}
                onFocus={() => setActiveSurface(surface.key)}
              >
                {cardBody}
              </Link>
            ) : (
              <button
                key={surface.key}
                type="button"
                className={cardClassName}
                onMouseEnter={() => setActiveSurface(surface.key)}
                onFocus={() => setActiveSurface(surface.key)}
                onClick={() => setActiveSurface(surface.key)}
              >
                {cardBody}
              </button>
            );
          })}
        </aside>
      </div>
      <footer className="px-5 pb-8 text-center text-xs text-[var(--text-muted)]" aria-label="ICP filing">
        <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">
          &#33945;ICP&#22791;2026006682&#21495;
        </a>
      </footer>
    </div>
  );
}
