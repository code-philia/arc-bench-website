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
└── data/          Unified task data sources (ARC-Bench, playground, competitions)
```

## Task data layout

All shipped task sources are under [`data/`](data/README.md): `arc-bench`,
`playground`, and `competition`. Each task has its own `requirements/` and
`tests/` directories. Starter project files live in the `arc-template`
submodule under `templates/<template-id>/files`.

## Quick start

### Prerequisites

| Tool | Version / purpose |
| --- | --- |
| Node.js | 20+ — frontend development |
| Python | 3.11+ — backend development |
| Docker | Builds and runs the submission runner |

### 1. Clone and refresh external source repositories

`arc-template/` and `reference-implementations/arc/` are intentionally
independent Git working copies. They are not Git submodules of ARC-Bench, so
`git submodule update` does not create them. ARC-Bench does not maintain their
history or make commits in either repository.

After cloning ARC-Bench for the first time, fetch the two repositories into
their expected paths. ARC contains its own nested `src/arc-template` submodule,
so clone ARC recursively:

```bash
git clone https://github.com/Weiyu-Kong/arc-template.git arc-template
git clone --recurse-submodules https://github.com/code-philia/agentic-requirement-compiler.git reference-implementations/arc
```

If ARC was cloned previously without its nested template, initialize only that
nested submodule:

```bash
git -C reference-implementations/arc submodule update --init --recursive
```

When the upstream repositories have new commits, fast-forward each working
copy in place:

```bash
git -C arc-template pull --ff-only
git -C reference-implementations/arc pull --ff-only
git -C reference-implementations/arc submodule update --init --recursive
git -C reference-implementations/arc/src/arc-template pull --ff-only
```

On Windows PowerShell, use the same commands. Do not use `git submodule update
--remote` at the ARC-Bench root: these repositories are not root submodules.
Newly downloaded ARC agent archives include the
complete refreshed `reference-implementations/arc/src/arc-template` catalogue;
the root `arc-template` is used by ARC-Bench when preparing task starter
projects.

To confirm all three checkouts are available:

```bash
git -C arc-template status --short
git -C reference-implementations/arc status --short
git -C reference-implementations/arc/src/arc-template status --short
```

### Model provider configuration

Model credentials are configured only on the backend. Copy
[`config.example.yaml`](config.example.yaml) to `config.yaml`, then fill in the provider credentials. The
real configuration file is ignored by Git. Each run receives only the selected
model's `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `MODEL`; the visual provider
settings are shared by all runs, and `ARC_DEBUG` is always `1`. The same YAML
also contains `environment.ARCBENCH_RUNNER_DNS_SERVERS` for Docker runner DNS.
The backend no longer loads `.env`; after migrating these values, it is not
needed for local backend execution.

### 2. Build the runner image

ARC and Octos submissions share one local runner image. Build it once, then run its smoke test:

```bash
docker build -f backend/runner/Dockerfile -t arcbench-runner:latest .
docker run --rm --entrypoint python3 arcbench-runner:latest /opt/arcbench/smoke_test.py
```

For local execution, point the backend at this image:

```bash
# macOS / Linux
export ARCBENCH_RUNNER_IMAGE=arcbench-runner:latest

# Windows PowerShell
$env:ARCBENCH_RUNNER_IMAGE = "arcbench-runner:latest"
```

Production deployments should use a validated immutable image tag or digest. See [backend/runner/README.md](backend/runner/README.md) for runner details.


### 3. Build the frontend

```bash
cd frontend
npm run build
```

this will generate a `frontend/dist` folder with static assets for the backend to serve.

### 4. Start the backend

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

#### Rebuild the local database

ARC-Bench does not run compatibility migrations during application startup.
After creating the Python environment above and before starting the backend,
create a clean local database from the current models (this permanently deletes
every record in `runtime/app.db`):

```powershell
cd ..
backend\.venv\Scripts\python.exe scripts\rebuild_database.py --yes
cd backend
```

Then start the backend server:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## Working with requirement documents

Task requirements are authored in YAML. Generate a sibling Markdown document for task and competition pages with:

```bash
python scripts/render_competition_requirements.py path/to/requirements.yaml
```

The converter supports both legacy documents and enhanced fields, including standalone `images`, node-level `reference` links, `roles`, `permissions`, and scenario or step `actor` values. For relative files such as `./reference/example.png` or `./reference/standard-rule.md`, keep them in the bundle and import the task as a ZIP on the Create Task page. Additional safe directories in that ZIP are preserved for task export and execution.

## Useful commands

| Goal | Command |
| --- | --- |
| Run the frontend locally | `cd frontend && npm run dev` |
| Build the frontend | `cd frontend && npm run build` |
| Rebuild the local database | `backend\.venv\Scripts\python.exe scripts\rebuild_database.py --yes` |
| Generate beta codes | `backend\.venv\Scripts\python.exe scripts\generate_beta_invite_codes.py --count 100` |
| Run the backend | `cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` |
| Validate the runner image | `docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py` |

## First run

After the services are running, open the **Playground** and use **Quick Start** to create a built-in submission. From there, you can inspect the task, upload or create a new submission, start a run, and review its execution details.
