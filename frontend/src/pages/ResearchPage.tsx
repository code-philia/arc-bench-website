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
    <a href={href} target="_blank" rel="noreferrer" className="research-link-pill">
      <span className="research-link-pill-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </a>
  );
}

export default function ResearchPage() {
  return (
    <div className="page library-page research-page">
      <div className="competition-shell research-shell">
        <div className="breadcrumb research-breadcrumb">
          <span>Research</span>
          <span className="sep">/</span>
          <span className="current">Overview</span>
        </div>
        
        <div className="research-grid">
          <section className="research-column-panel leaderboard-card leaderboard-card-clean">
            <div className="research-panel-header">
              <div>
                <div className="competition-panel-kicker research-kicker-agents">
                  <ExperimentOutlined /> Related Agents
                </div>
                <h2>Agent work</h2>
                <p>Representative agent systems, research groups, and primary references.</p>
              </div>
            </div>

            <div className="research-card-list">
              {agentEntries.map((entry) => (
                <article key={entry.name} className="research-entry-card research-entry-agent">
                  <div className="research-entry-topline">
                    <div>
                      <h3>{entry.name}</h3>
                      <div className="research-org-line">
                        <GlobalOutlined />
                        <span>{entry.organization}</span>
                      </div>
                    </div>
                    <span className="research-type-chip">Agent</span>
                  </div>

                  <p>{entry.summary}</p>

                  <div className="research-link-row">
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
              ))}
            </div>
          </section>

          <aside className="research-column-panel research-column-panel-benchmarks">
            <div className="competition-bank-shell research-bank-shell">
              <div className="research-panel-header research-panel-header-side">
                <div>
                  <div className="competition-panel-kicker research-kicker-benchmarks">
                    <LinkOutlined /> Related Benchmarks
                  </div>
                  <h2>Benchmark sets</h2>
                  <p>Evaluation suites that shape the current agent-computer-use research landscape.</p>
                </div>
              </div>

              <div className="research-card-list research-card-list-tight">
                {benchmarkEntries.map((entry) => (
                  <article key={entry.name} className="research-entry-card research-entry-benchmark">
                    <div className="research-entry-topline">
                      <div>
                        <h3>{entry.name}</h3>
                        <div className="research-org-line">
                          <GlobalOutlined />
                          <span>{entry.organization}</span>
                        </div>
                      </div>
                      <span className="research-type-chip benchmark">Benchmark</span>
                    </div>

                    <p>{entry.summary}</p>

                    <div className="research-link-row">
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
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
