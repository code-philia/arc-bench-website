import { InfoCircleOutlined, RightOutlined, StarFilled, TrophyFilled } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../lib/api";
import type { CompetitionSummary } from "../lib/types";

type LeaderboardTrack = "all" | "web" | "mobile" | "kernel";

type PlaceholderLeaderboardRow = {
  username: string;
  model_name: string | null;
  track: LeaderboardTrack;
  avg_pass_rate: number;
  total_token_millions: number | null;
  avg_runtime_seconds: number | null;
  submission_count: number;
  rank: number;
};

const trackItems: Array<{ key: LeaderboardTrack; label: string }> = [
  { key: "all", label: "All" },
  { key: "web", label: "Web" },
  { key: "mobile", label: "Mobile" },
  { key: "kernel", label: "Kernel" },
];

const competitionToneClasses: Record<string, { badge: string; hover: string }> = {
  web: {
    badge: "bg-[var(--accent-glow)] text-[var(--accent)]",
    hover: "hover:border-[var(--accent)]",
  },
  mobile: {
    badge: "bg-[var(--warn-glow)] text-[var(--warn)]",
    hover: "hover:border-[var(--warn)]",
  },
  mixed: {
    badge: "bg-[var(--fail-glow)] text-[var(--fail)]",
    hover: "hover:border-[var(--fail)]",
  },
};

function competitionTypeLabel(type: string) {
  if (type === "web") return "WEB";
  if (type === "mobile" || type === "android") return "MOBILE";
  if (type === "mixed") return "MIXED";
  return type.toUpperCase();
}

function competitionAccent(type: string) {
  if (type === "web") return "web";
  if (type === "mobile" || type === "android") return "mobile";
  if (type === "mixed") return "mixed";
  return "web";
}

function bankMetaLabel(taskCount: number) {
  return `${taskCount} TASK${taskCount === 1 ? "" : "S"}`;
}

function formatRuntime(seconds: number) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(remainder).padStart(2, "0")}s`;
}

function renderRankDisplay(rank: number) {
  if (rank > 3) {
    return <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-semibold text-[var(--text-dim)]">{rank}</span>;
  }

  const rankClass =
    rank === 1
      ? "bg-[var(--warn-glow)] text-[var(--warn)]"
      : rank === 2
        ? "bg-[var(--bg-elevated)] text-[var(--text)]"
        : "bg-[var(--fail-glow)] text-[var(--fail)]";

  return (
    <span className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold ${rankClass}`}>
      <span>{rank}</span>
      {rank === 1 ? <StarFilled /> : <TrophyFilled />}
    </span>
  );
}

export default function RequirementsPage() {
  const [competitions, setCompetitions] = useState<CompetitionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTrack, setActiveTrack] = useState<LeaderboardTrack>("all");

  useEffect(() => {
    api
      .listCompetitions()
      .then(setCompetitions)
      .catch(() => setCompetitions([]))
      .finally(() => setLoading(false));
  }, []);

  const displayRows = useMemo(() => {
    const rows: PlaceholderLeaderboardRow[] = [
      {
        username: "-",
        model_name: null,
        track: activeTrack,
        avg_pass_rate: NaN,
        total_token_millions: null,
        avg_runtime_seconds: null,
        submission_count: 0,
        rank: 1,
      },
    ];
    const targetRowCount = 5;
    const nextRankStart = rows.length + 1;
    for (let rank = nextRankStart; rank <= targetRowCount; rank += 1) {
      rows.push({
        username: "-",
        model_name: null,
        track: activeTrack,
        avg_pass_rate: NaN,
        total_token_millions: null,
        avg_runtime_seconds: null,
        submission_count: 0,
        rank,
      });
    }
    return rows;
  }, [activeTrack]);
  const competitionsViewAllHref = competitions[0] ? `/competitions/${competitions[0].id}` : "/competitions/web";

  return (
    <div className="page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Competition</span>
          <span className="text-[var(--border-light)]">/</span>
          <span className="font-medium text-[var(--text)]">Home</span>
        </div>

        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--warn-glow)] px-3 py-1 text-xs font-semibold text-[var(--warn)]">
                <TrophyFilled /> Competition workspace
              </div>
              <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">Competition Hub</h1>
              <p className="mt-3 max-w-[720px] text-sm leading-6 text-[var(--text-dim)]">
                Track benchmark packs, compare leaderboard runs, and move from public task banks into reproducible agent submissions.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <div className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase text-[var(--text-muted)]">
                <TrophyFilled className="text-[var(--warn)]" /> Hero Board
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex w-fit rounded-full bg-[var(--bg-elevated)] p-1" role="tablist" aria-label="Leaderboard track filter">
                  {trackItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`h-8 rounded-full px-4 text-sm font-medium transition ${
                        activeTrack === item.key
                          ? "bg-[var(--bg)] text-[var(--text)] shadow-sm"
                          : "text-[var(--text-dim)] hover:text-[var(--text)]"
                      }`}
                      onClick={() => setActiveTrack(item.key)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-elevated)] px-4 py-3 text-sm">
                  <span className="text-[var(--text-dim)]">Current leader</span>
                  <strong className="text-[var(--text)]">-</strong>
                  <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
                    No data yet <RightOutlined />
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--bg-elevated)] text-xs font-semibold uppercase text-[var(--text-muted)]">
                    <th className="px-5 py-3" style={{ width: "96px" }}>Rank</th>
                    <th className="px-5 py-3" style={{ width: "168px" }}>User</th>
                    <th className="px-5 py-3" style={{ width: "240px" }}>Model</th>
                    <th className="px-5 py-3" style={{ width: "156px" }}>
                      <span className="inline-flex items-center gap-1">
                        Avg. Pass Rate <InfoCircleOutlined />
                      </span>
                    </th>
                    <th className="px-5 py-3" style={{ width: "168px" }}>Total Token</th>
                    <th className="px-5 py-3" style={{ width: "176px" }}>Runtime</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row) => (
                    <tr
                      key={`${row.rank}-${row.username}-${row.model_name ?? "none"}`}
                      className="border-b border-[var(--td-border)] text-sm text-[var(--text-dim)] transition hover:bg-[var(--bg-elevated)]"
                    >
                      <td className="px-5 py-3">{renderRankDisplay(row.rank)}</td>
                      <td className="px-5 py-3">
                        <div>
                          <strong className="font-semibold text-[var(--text)]">{row.username}</strong>
                        </div>
                      </td>
                      <td className="px-5 py-3">{row.model_name ?? "-"}</td>
                      <td className="px-5 py-3">{Number.isFinite(row.avg_pass_rate) ? `${row.avg_pass_rate.toFixed(1)}%` : "-"}</td>
                      <td className="px-5 py-3">{row.total_token_millions == null ? "-" : `${row.total_token_millions.toFixed(1)}M`}</td>
                      <td className="px-5 py-3">{row.avg_runtime_seconds == null ? "-" : formatRuntime(row.avg_runtime_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-base font-semibold text-[var(--text)]">Competition Bank</div>
              <Link className="inline-flex items-center gap-1 text-sm font-medium text-[var(--text-dim)] hover:text-[var(--accent)]" to={competitionsViewAllHref}>
                View all <RightOutlined />
              </Link>
            </div>

            {loading ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-dim)]">
                Loading competitions...
              </div>
            ) : competitions.length === 0 ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--text-dim)]">
                No competitions available.
              </div>
            ) : (
              <div className="space-y-2">
                {competitions.map((competition) => {
                  const accent = competitionAccent(competition.type);
                  const tone = competitionToneClasses[accent] ?? competitionToneClasses.web;

                  return (
                    <Link
                      key={competition.id}
                      to={`/competitions/${competition.id}`}
                      className={`group block rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--bg-hover)] ${tone.hover}`}
                    >
                      <div className={`mb-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        {competitionTypeLabel(competition.type)}
                      </div>
                      <h2 className="text-sm font-semibold text-[var(--text)]">{competition.title}</h2>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-dim)]">{competition.summary}</p>
                      <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text)]">
                        <span>{bankMetaLabel(competition.task_count)}</span>
                        <RightOutlined className="transition group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
