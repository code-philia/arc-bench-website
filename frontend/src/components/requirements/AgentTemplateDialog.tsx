import { DownloadOutlined } from "@ant-design/icons";
import { Modal } from "antd";
import { useState } from "react";

type TemplateKind = "blank" | "arc" | "octos" | "codex" | "claude_code";

const options: Array<{ kind: TemplateKind; title: string; copy: string; available?: boolean }> = [
  { kind: "blank", title: "Blank Template", copy: "A minimal runnable agent starter." },
  { kind: "arc", title: "ARC Template", copy: "A runnable Agentic Requirement Compiler reference agent." },
  { kind: "octos", title: "Octos Template", copy: "Install the Octos reference source to enable this template.", available: false },
  { kind: "codex", title: "Codex Template", copy: "A runnable Codex-based reference agent." },
  { kind: "claude_code", title: "Claude Code Template", copy: "A runnable Claude Code reference agent." },
];

export default function AgentTemplateDialog({ href, runtime }: { href: string; runtime: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<TemplateKind>("blank");
  const supportsPythonReferences = ["python", "py"].includes(runtime.toLowerCase());

  const download = () => {
    const separator = href.includes("?") ? "&" : "?";
    window.location.assign(`${href}${separator}language=${encodeURIComponent(runtime)}&template=${selected}`);
    setOpen(false);
  };

  return <>
    <button type="button" className="btn-outline competition-download-btn submission-download-btn" onClick={() => setOpen(true)}><DownloadOutlined /> Download Agent Template</button>
    <Modal open={open} footer={null} onCancel={() => setOpen(false)} title="Choose an agent template" centered className="agent-template-modal">
      <p className="agent-template-modal-copy">Choose the agent you want to start from. Every download is directly runnable: its <code>main.py</code> is the selected agent entry point.</p>
      <div className="agent-template-options">
        {options.map((option) => {
          const unavailable = option.available === false || (option.kind !== "blank" && !supportsPythonReferences);
          return <button key={option.kind} type="button" disabled={unavailable} onClick={() => setSelected(option.kind)} className={`agent-template-option${selected === option.kind ? " active" : ""}`}>
          <strong>{option.title}</strong><span>{option.copy}</span>
          {unavailable && <span>{option.available === false ? "Template source is not installed." : "Available for Python agents only."}</span>}
        </button>;
        })}
      </div>
      <button type="button" className="btn-primary agent-template-download" onClick={download}><DownloadOutlined /> Download {options.find((option) => option.kind === selected)?.title}</button>
    </Modal>
  </>;
}
