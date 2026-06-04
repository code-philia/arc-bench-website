export default function PlaygroundPage() {
  return (
    <div className="page playground-page">
      <div className="playground-wrap">
        <div className="playground-card">
          <div className="playground-visual">
            <div className="ring" />
            <div className="ring" />
            <div className="ring" />
            <div className="core">▶</div>
          </div>
          <h2>Playground</h2>
          <p>
            A freeform environment to experiment with agents, iterate on prompts, and debug
            outputs. No scoring, no leaderboard.
          </p>
          <button className="btn-outline" disabled type="button">
            Coming Soon
          </button>
        </div>
      </div>
    </div>
  );
}
