import { DownloadOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useState } from "react";

type TemplateKind = "blank" | "arc" | "octos" | "codex" | "claude_code";

const options: Array<{ kind: TemplateKind; title: string; copy: string }> = [
  { kind: "blank", title: "Blank Template", copy: "A minimal runnable agent starter." },
  { kind: "arc", title: "ARC Template", copy: "Includes Agentic Requirement Compiler source under template/arc." },
  { kind: "octos", title: "Octos Template", copy: "Includes the Octos reference implementation placeholder under template/octos." },
  { kind: "codex", title: "Codex Template", copy: "Includes the Codex reference implementation placeholder under template/codex." },
  { kind: "claude_code", title: "Claude Code Template", copy: "Includes the Claude Code reference implementation placeholder under template/claude-code." },
];

export default function AgentTemplateDialog({ href, runtime }: { href: string; runtime: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TemplateKind>("blank");

  const download = () => {
    const separator = href.includes("?") ? "&" : "?";
    window.location.assign(`${href}${separator}language=${encodeURIComponent(runtime)}&template=${selected}`);
    setOpen(false);
  };

  return <>
    <button type="button" className="btn-outline competition-download-btn submission-download-btn" onClick={() => setOpen(true)}><DownloadOutlined /> Download Agent Template</button>
    <Modal open={open} footer={null} onCancel={() => setOpen(false)} title="Choose an agent template" centered className="agent-template-modal">
      <p className="agent-template-modal-copy">Choose the starter package to download. Reference implementations are included in the archive's <code>template/</code> folder.</p>
      <div className="agent-template-options">
        {options.map((option) => <button key={option.kind} type="button" onClick={() => setSelected(option.kind)} className={`agent-template-option${selected === option.kind ? " active" : ""}`}>
          <strong>{option.title}</strong><span>{option.copy}</span>
        </button>)}
      </div>
      <button type="button" className="btn-primary agent-template-download" onClick={download}><DownloadOutlined /> Download {options.find((option) => option.kind === selected)?.title}</button>
    </Modal>
  </>;
}
