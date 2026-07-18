import {
  BookOutlined,
  ExperimentOutlined,
  GithubOutlined,
  GlobalOutlined,
  LinkOutlined,
  ReadOutlined,
} from "@ant-design/icons";

type ResearchLink = {
  label: string;
  href: string;
};

type AgentEntry = {
  name: string;
  organization: string;
  summary: string;
  paper: ResearchLink;
  repo?: ResearchLink;
};

type BenchmarkEntry = {
  name: string;
  organization: string;
  summary: string;
  paper: ResearchLink;
  repo?: ResearchLink;
};

const agentEntries: AgentEntry[] = [
  {
    name: "ARC",
    organization: "Shanghai Jiao Tong University, National University of Singapore",
    summary:
      "A requirement-compilation framework that turns large multimodal DSL specifications into runnable web systems with modular designs, test-driven implementation, and end-to-end traceability.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2602.13723",
    },
    repo: {
      label: "Code",
      href: "https://github.com/code-philia/agentic-requirement-compiler.git",
    },
  },
  {
    name: "WebArena Agent",
    organization: "Carnegie Mellon University, ETH Zurich, Princeton University",
    summary:
      "A web task-oriented agent line centered on realistic browser interaction, long-horizon planning, and evaluation over live websites.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2307.13854",
    },
    repo: {
      label: "Code",
      href: "https://github.com/web-arena-x/webarena",
    },
  },
  {
    name: "Agent S",
    organization: "OpenHands / OSU Natural Language Processing Group",
    summary:
      "A computer-use agent designed for stronger end-to-end execution on digital tasks, with emphasis on real interfaces and practical action traces.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2410.08123",
    },
    repo: {
      label: "Code",
      href: "https://github.com/simular-ai/Agent-S",
    },
  },
  {
    name: "OSWorld Agent Baselines",
    organization: "OSWorld Research Team",
    summary:
      "Baseline desktop agents for open-ended operating system tasks, useful as a reference point for multimodal interface manipulation and tool use.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2404.07972",
    },
    repo: {
      label: "Code",
      href: "https://github.com/xlang-ai/OSWorld",
    },
  },
  {
    name: "AppWorld Agent Baselines",
    organization: "AppWorld Authors",
    summary:
      "Benchmark-facing agent baselines for executing compositional, multi-app workflows with structured task setup and measurable outcomes.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2407.18901",
    },
  },
];

const benchmarkEntries: BenchmarkEntry[] = [
  {
    name: "WebArena",
    organization: "CMU, ETH Zurich, Princeton",
    summary:
      "A realistic web benchmark covering shopping, content management, forums, and map workflows for browser-based autonomous agents.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2307.13854",
    },
    repo: {
      label: "Code",
      href: "https://github.com/web-arena-x/webarena",
    },
  },
  {
    name: "VisualWebArena",
    organization: "WebArena Research Team",
    summary:
      "An extension of WebArena that adds visually grounded websites and richer interaction complexity for multimodal browser agents.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2401.13649",
    },
    repo: {
      label: "Code",
      href: "https://github.com/web-arena-x/visualwebarena",
    },
  },
  {
    name: "OSWorld",
    organization: "xLang Lab and collaborators",
    summary:
      "A desktop benchmark for open-ended computer use across common applications, emphasizing realistic GUI actions, state changes, and recovery.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2404.07972",
    },
    repo: {
      label: "Code",
      href: "https://github.com/xlang-ai/OSWorld",
    },
  },
  {
    name: "AppWorld",
    organization: "AppWorld Authors",
    summary:
      "A benchmark for evaluating agents on multi-application tasks with explicit constraints, observable outcomes, and compositional action planning.",
    paper: {
      label: "Paper",
      href: "https://arxiv.org/abs/2407.18901",
    },
    repo: {
      label: "Code",
      href: "https://github.com/StonyBrookNLP/appworld",
    },
  },
];

function ExternalLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-semibold text-[var(--text-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
    >
      <span className="text-sm" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </a>
  );
}

function ResearchEntryCard({ entry, type }: { entry: AgentEntry | BenchmarkEntry; type: "Agent" | "Benchmark" }) {
  const isBenchmark = type === "Benchmark";

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--border-light)] hover:bg-[var(--bg-hover)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--text)]">{entry.name}</h3>
          <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
            <GlobalOutlined className="mt-0.5 shrink-0" />
            <span>{entry.organization}</span>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            isBenchmark ? "bg-[var(--warn-glow)] text-[var(--warn)]" : "bg-[var(--accent-glow)] text-[var(--accent)]"
          }`}
        >
          {type}
        </span>
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--text-dim)]">{entry.summary}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <ExternalLink href={entry.paper.href} icon={<BookOutlined />}>
          {entry.paper.label}
        </ExternalLink>
        {entry.repo ? (
          <ExternalLink href={entry.repo.href} icon={<GithubOutlined />}>
            {entry.repo.label}
          </ExternalLink>
        ) : null}
      </div>
    </article>
  );
}

export default function ResearchPage() {
  return (
    <div className="page bg-[var(--bg-deep)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-[1180px] px-5 py-6 lg:px-8">
        <div className="mb-5 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <span>Research</span>
          <span className="text-[var(--border-light)]">/</span>
          <span className="font-medium text-[var(--text)]">Overview</span>
        </div>

        <section className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)]" aria-label="Research overview">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-glow)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
            <ReadOutlined /> Research index
          </div>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-[var(--text)] sm:text-4xl">Research Map</h1>
          <p className="mt-3 max-w-[780px] text-sm leading-6 text-[var(--text-dim)]">
            A curated reference map for related computer-use agents, browser environments, and evaluation suites that inform this benchmark.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-4 border-b border-[var(--border)] pb-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-[var(--accent)]">
                <ExperimentOutlined /> Related Agents
              </div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Agent work</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">
                Representative agent systems, research groups, and primary references.
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {agentEntries.map((entry) => (
                <ResearchEntryCard key={entry.name} entry={entry} type="Agent" />
              ))}
            </div>
          </section>

          <aside className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]">
            <div className="mb-4 border-b border-[var(--border)] pb-4">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-[var(--warn)]">
                <LinkOutlined /> Related Benchmarks
              </div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text)]">Benchmark sets</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--text-dim)]">
                Evaluation suites that shape the current agent-computer-use research landscape.
              </p>
            </div>

            <div className="space-y-3">
              {benchmarkEntries.map((entry) => (
                <ResearchEntryCard key={entry.name} entry={entry} type="Benchmark" />
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
