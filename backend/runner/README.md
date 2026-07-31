# Unified runner image

`backend/runner/Dockerfile` is the only runner environment. It contains the ARC runner, Octos CLI, Python, Node.js, Git, Playwright, Chromium, and the benchmark test package.

The backend selects the runner mode with the container command, not with a different image:

- ARC: `python3 /opt/arcbench/run_submission.py`
- Octos: `python3 /opt/arcbench/run_octos_submission.py`

Build and validate a release image before enabling evaluation:

```powershell
docker build -f backend/runner/Dockerfile -t arcbench-runner:local .
docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py
```

The Dockerfile pins Python and Node Playwright to `1.54.0`. Override the pip mirror only when necessary:

```powershell
docker build --build-arg ARCBENCH_PIP_INDEX_URL=https://pypi.org/simple -f backend/runner/Dockerfile -t arcbench-runner:local .
```

Publish the validated immutable tag or digest through `ARCBENCH_RUNNER_IMAGE`. `ARCBENCH_RUNNER_BUILD_ON_DEMAND=true` is only for local development.
