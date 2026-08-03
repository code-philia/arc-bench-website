# ARC Bench

> A workspace for designing agent tasks, submitting solutions, running evaluations, and following competition results.

ARC Bench brings the Playground, competitions, requirement documents, and execution history into one local development environment.

| Area | What it provides |
| --- | --- |
| **Playground** | Create tasks, prepare submissions, and inspect runs. |
| **Competitions** | Browse tasks, submit one solution for a competition, and review results. |
| **Requirement documents** | YAML-first task definitions with generated Markdown for readable task pages. |
| **Runner** | A shared Docker image for ARC and Octos submission execution. |

## Project map

```text
arc-bench-website/
├── backend/       FastAPI application, persistence, and runner integration
├── frontend/      React + Vite web application
├── packages/      Agent runtime packages for Python, JavaScript, and shared code
├── scripts/       Development and document-generation utilities
└── competition/   Competition tasks and test assets
```

## Quick start

### Prerequisites

| Tool | Version / purpose |
| --- | --- |
| Node.js | 20+ — frontend development |
| Python | 3.11+ — backend development |
| Docker | Builds and runs the submission runner |

### 1. Initialize the submodule

The repository includes `agentic-requirement-compiler` as a Git submodule.

```bash
git submodule update --init --recursive
```

To update it to the latest remote `main` branch:

```bash
git submodule update --remote agentic-requirement-compiler
```

### 2. Build the runner image

ARC and Octos submissions share one local runner image. Build it once, then run its smoke test:

```bash
docker build -f backend/runner/Dockerfile -t arcbench-runner:local .
docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py
```

For local execution, point the backend at this image:

```bash
# macOS / Linux
export ARCBENCH_RUNNER_IMAGE=arcbench-runner:local

# Windows PowerShell
$env:ARCBENCH_RUNNER_IMAGE = "arcbench-runner:local"
```

Production deployments should use a validated immutable image tag or digest. See [backend/runner/README.md](backend/runner/README.md) for runner details.

### 3. Start the backend

Choose one Python environment workflow, install dependencies, and launch the API.

<details>
<summary><strong>venv</strong></summary>

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell, activate with:

```powershell
.\.venv\Scripts\Activate.ps1
```
</details>

<details>
<summary><strong>uv</strong></summary>

```bash
cd backend
uv venv .venv
uv pip install -r requirements.txt
```
</details>

<details>
<summary><strong>conda</strong></summary>

```bash
conda create -n arcbench python=3.11 -y
conda activate arcbench
cd backend
pip install -r requirements.txt
```
</details>

Then start the backend server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 4. Start the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173** in your browser. The Vite development server proxies API requests to the backend at port `8000`.

To validate a production build instead:

```bash
cd frontend
npm run build
```

## Working with requirement documents

Task requirements are authored in YAML. Generate a sibling Markdown document for task and competition pages with:

```bash
python scripts/render_competition_requirements.py path/to/requirements.yaml
```

The converter supports both legacy documents and enhanced fields, including standalone `images`, `roles`, `permissions`, and scenario or step `actor` values. For relative images such as `./reference/example.png`, keep the image in the corresponding `reference/` directory and import the task as a ZIP bundle when using the Create Task page.

## Useful commands

| Goal | Command |
| --- | --- |
| Run the frontend locally | `cd frontend && npm run dev` |
| Build the frontend | `cd frontend && npm run build` |
| Run the backend | `cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` |
| Validate the runner image | `docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py` |

## First run

After the services are running, open the **Playground** and use **Quick Start** to create a built-in submission. From there, you can inspect the task, upload or create a new submission, start a run, and review its execution details.
