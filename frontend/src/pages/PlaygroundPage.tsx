export default function PlaygroundPage() {
  return (
    <div className="page playground-page">
      <div className="playground-card">
        <div className="playground-visual">
          <div className="ring" />
          <div className="ring" />
          <div className="ring" />
          <div className="core">▶</div>
        </div>
        <h2>Playground</h2>
        <p>
          Freeform experimentation stays out of the scoring pipeline. This route is intentionally
          preserved from the prototype and left as a follow-up feature.
        </p>
        <button className="btn-outline" disabled>
          Coming Soon
        </button>
      </div>
    </div>
  );
}
