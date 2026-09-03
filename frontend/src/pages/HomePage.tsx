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
    text: string;
    selected: string;
    idle: string;
  }
> = {
  playground: {
    icon: "bg-[var(--bg)] text-[var(--tag-mint-text)]",
    text: "text-[var(--tag-mint-text)]",
    selected: "border-[#bfe7ce] bg-[var(--tag-mint-bg)] shadow-[0_10px_30px_rgba(33,118,83,0.08)]",
    idle: "border-[#d2eddb] bg-[var(--tag-mint-bg)] hover:border-[#a9dbbb]",
  },
  competition: {
    icon: "bg-[var(--bg)] text-[var(--tag-orange-text)]",
    text: "text-[var(--tag-orange-text)]",
    selected: "border-[#f0c7ac] bg-[var(--tag-orange-bg)] shadow-[0_10px_30px_rgba(169,77,20,0.08)]",
    idle: "border-[#f5d9c7] bg-[var(--tag-orange-bg)] hover:border-[#e8bda0]",
  },
  research: {
    icon: "bg-[var(--bg)] text-[var(--tag-sky-text)]",
    text: "text-[var(--tag-sky-text)]",
    selected: "border-[#bfd5f3] bg-[var(--tag-sky-bg)] shadow-[0_10px_30px_rgba(65,109,168,0.08)]",
    idle: "border-[#d4e2f7] bg-[var(--tag-sky-bg)] hover:border-[#abc6ea]",
  },
};

export default function HomePage() {
  const [requirements, setRequirements] = useState<RequirementSummary[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [activeSurface, setActiveSurface] = useState<SurfaceKey>("playground");
  const [activeFeatureSlide, setActiveFeatureSlide] = useState(0);

  useEffect(() => {
    api.listRequirements().then(setRequirements).catch(() => setRequirements([]));
    api.listCompetitions().then(setCompetitions).catch(() => setCompetitions([]));
    api.listRuns().then((items) => setSubmissions(items.slice(0, 4))).catch(() => setSubmissions([]));
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
        href: "/competition",
      },
      {
        key: "research",
        title: "Research",
        eyebrow: "Artifacts and findings",
        description:
          "Aggregate benchmark outcomes, compare execution evidence, and prepare a home for papers, repos, and methodology notes.",
        icon: <ExperimentOutlined />,
        href: "/research",
      },
    ],
    [competitions.length, passedSubmissions, publicCompetitionCount, requirements.length, submissions.length, webRequirementCount],
  );

  return (
    <div className="page landing-page home-page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
        <section className="landing-hero landing-card tone-sky flex min-h-[420px] items-center rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)] sm:p-8 lg:p-10">
          <div className="max-w-[760px]">
            <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[var(--accent-glow)] px-3 py-1 font-semibold text-[var(--accent)]">
                ArcBench
              </span>
              <span className="text-[var(--text-dim)]">Agent Benchmark Platform</span>
            </div>

            <h1 className="text-[2.5rem] font-semibold leading-[1.08] text-[var(--text)] sm:text-[3.35rem]">
              A benchmark workspace for <span className="text-[var(--tag-mint-text)]">building</span>,{" "}
              <span className="text-[var(--tag-mint-text)]">competing</span>, and{" "}
              <span className="text-[var(--tag-mint-text)]">studying</span> software engineering agents.
            </h1>
          </div>
        </section>

        <aside className="grid gap-3" role="tablist" aria-label="Homepage surfaces">
          {surfaces.map((surface) => {
            const isActive = surface.key === activeSurface;
            const tone = surfaceToneClasses[surface.key];
            const cardClassName = [
              "landing-card group flex min-h-[132px] flex-col justify-between rounded-xl border p-4 text-left transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
              isActive ? tone.selected : tone.idle,
            ].join(" ");
            const cardBody = (
              <>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${tone.icon}`}>
                    {surface.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold uppercase ${tone.text}`}>{surface.eyebrow}</div>
                    <h2 className={`mt-1 text-lg font-semibold ${tone.text}`}>{surface.title}</h2>
                  </div>
                  <ArrowRightOutlined className={`mt-1 text-sm transition group-hover:translate-x-0.5 ${tone.text}`} />
                </div>
                <p className={`mt-4 text-sm leading-6 ${tone.text}`}>{surface.description}</p>
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

      {/* <section className="mx-auto w-full max-w-[1180px] px-5 pb-10 lg:px-8 lg:pb-12" aria-labelledby="feature-showcase-title">
        <div className="mb-4 border-y border-[var(--border)] py-5">
          <div className="max-w-[720px]">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase text-[var(--text-muted)]">
              <span className="font-mono text-[var(--text)]">{activeSlide.code}/03</span>
              <span className="h-px w-10 bg-[var(--border-light)]" />
              <span>{activeSlide.eyebrow}</span>
            </div>
            <h2 id="feature-showcase-title" className="mt-2 text-2xl font-semibold leading-tight text-[var(--text)]">
              {activeSlide.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-dim)]">
              {activeFeatureSlide === 0
                ? "A compact grammar and graph view for structured multi-modal requirements."
                : activeFeatureSlide === 1
                  ? "Watch how structured requirements become a runnable system."
                  : "Watch how implementation evidence stays connected to requirement nodes."}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_16px_44px_rgba(0,0,0,0.18)]" aria-live="polite">
          <span className="pointer-events-none absolute left-0 top-0 h-5 w-5 border-l border-t border-[var(--text-muted)]" />
          <span className="pointer-events-none absolute right-0 top-0 h-5 w-5 border-r border-t border-[var(--text-muted)]" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[var(--text-muted)]" />
          <span className="pointer-events-none absolute bottom-0 right-0 h-5 w-5 border-b border-r border-[var(--text-muted)]" />
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeFeatureSlide * 100}%)` }}
          >
            <article
              id="feature-slide-meta-model"
              role="tabpanel"
              className="w-full shrink-0"
              aria-label="Meta-Model of Requirement"
            >
              <div className="grid items-stretch gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr] lg:p-5">
                <div className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] lg:h-[600px]">
                  <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] sm:px-5">
                    Grammar / BNF
                  </div>
                  <pre className="m-0 overflow-auto bg-[var(--bg-elevated)] p-5 font-mono text-sm leading-6 sm:p-6">
                    <code className="block">
                      {requirementMetaModelBnf.map((line, lineIndex) => (
                        <span key={`bnf-line-${lineIndex}`} className="block min-h-6">
                          {line.length === 0 ? (
                            <span>&nbsp;</span>
                          ) : (
                            line.map((token, tokenIndex) => (
                              <span
                                key={`bnf-token-${lineIndex}-${tokenIndex}`}
                                className={bnfToneClassNames[token.tone ?? "plain"]}
                              >
                                {token.text}
                              </span>
                            ))
                          )}
                        </span>
                      ))}
                    </code>
                  </pre>
                </div>

                <div className="grid min-h-[560px] grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] lg:h-[600px]">
                  <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] sm:px-5">
                    Requirement Graph Example
                  </div>
                  <div className="overflow-auto p-4 sm:p-5">
                    <img
                      src="/paper-assets/requirement-example.png"
                      alt="Requirement document example showing requirement nodes, dependency edges, scenarios, and Gherkin steps"
                      className="w-full max-w-full rounded-md border border-[var(--border)] object-contain"
                    />
                  </div>
                </div>
              </div>
            </article>

            <article
              id="feature-slide-compilation"
              role="tabpanel"
              className="w-full shrink-0"
              aria-label="Compilation Process"
            >
              <div className="p-4 lg:p-5">
                <div className="grid min-h-[620px] grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] lg:h-[680px]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] sm:px-5">
                    <span>Compilation Process</span>
                    <span className="font-mono">video1.mp4</span>
                  </div>
                  <div className="flex items-center justify-center overflow-hidden p-3 sm:p-4">
                    <video
                      src="/paper-assets/videos/video1.mp4"
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      className="max-h-full w-full max-w-full rounded-md border border-[var(--border)] bg-black object-contain"
                    />
                  </div>
                </div>
              </div>
            </article>

            <article
              id="feature-slide-traceability"
              role="tabpanel"
              className="w-full shrink-0"
              aria-label="Traceability"
            >
              <div className="p-4 lg:p-5">
                <div className="grid min-h-[620px] grid-rows-[auto_minmax(0,1fr)] rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] lg:h-[680px]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase text-[var(--text-muted)] sm:px-5">
                    <span>Traceability</span>
                    <span className="font-mono">video2.mp4</span>
                  </div>
                  <div className="flex items-center justify-center overflow-hidden p-3 sm:p-4">
                    <video
                      src="/paper-assets/videos/video2.mp4"
                      controls
                      muted
                      playsInline
                      preload="metadata"
                      className="max-h-full w-full max-w-full rounded-md border border-[var(--border)] bg-black object-contain"
                    />
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-3" role="tablist" aria-label="Feature pages">
          {featureSlides.map((slide, index) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={activeFeatureSlide === index}
              aria-controls={`feature-slide-${slide.key}`}
              className={`h-2.5 rounded-full transition-all duration-200 ${activeFeatureSlide === index
                  ? "w-9 bg-[var(--text)]"
                  : "w-2.5 bg-[var(--text-muted)] hover:w-6 hover:bg-[var(--text-dim)]"
                }`}
              onMouseEnter={() => setActiveFeatureSlide(index)}
              onFocus={() => setActiveFeatureSlide(index)}
              onClick={() => setActiveFeatureSlide(index)}
            >
              <span className="visually-hidden">{slide.label}</span>
            </button>
          ))}
        </div>
      </section> */}

      {/* <footer className="px-5 pb-8 text-center text-xs text-[var(--text-muted)]" aria-label="ICP filing">
        <a href="https://beian.miit.gov.cn" target="_blank" rel="noreferrer">
          &#33945;ICP&#22791;2026006682&#21495;
        </a>
      </footer> */}
    </div>
  );
}
