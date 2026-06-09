import { ReadOutlined } from "@ant-design/icons";

export default function ResearchPage() {
  return (
    <div className="page playground-page">
      <div className="playground-wrap">
        <div className="playground-card">
          <div className="playground-visual research-visual">
            <div className="ring" />
            <div className="ring" />
            <div className="ring" />
            <div className="core">
              <ReadOutlined />
            </div>
          </div>
          <h2>Research</h2>
          <p>
            A dedicated surface for rankings, benchmark findings, linked papers, repos, and evaluation evidence.
            This page is front-end scaffolding for now.
          </p>
          <button className="btn-outline" disabled type="button">
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );
}
