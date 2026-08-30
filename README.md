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

## Current deployment architecture

The current production path uses PostgreSQL, Redis, Celery, and the local
Docker runner on one host:

```text
Browser -> FastAPI API -> PostgreSQL
                    \-> task_outbox -> Dispatcher -> Redis -> Celery Worker -> Docker runner
```

- **PostgreSQL** is the source of truth for users, submissions, runs, and task
  state. SQLite is disabled at runtime.
- **Redis** is the Celery broker and result backend. It is not the source of
  truth for business data.
- **Celery Worker** executes the long-running evaluation task outside the API
  request process.
- **Dispatcher/Outbox** makes queue delivery durable: a Run state change and
  its pending task message are committed in one PostgreSQL transaction.
- **Docker runner** executes untrusted agent code with the configured resource
  limits. In the current phase it runs on the same host as the API and Worker.
- **Concurrency quotas** allow at most 4 active runs platform-wide and at most
  2 active runs per user without a team, or 2 shared active runs per team.

Runner Host separation and shared storage/object storage are documented as the
next deployment phase in
[`docs/deploy/Celery_Redis_Runner_Host.md`](docs/deploy/Celery_Redis_Runner_Host.md).

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
| PostgreSQL | Required application database |
| Redis | Celery broker and result backend |

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

### 2. Configure secrets and services

Model credentials are configured only on the backend. Copy
[`config.example.yaml`](config.example.yaml) to `config.yaml`, then fill in the provider credentials. The
real configuration file is ignored by Git. Each run receives only the selected
model's `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `MODEL`; the visual provider
settings are shared by all runs, and `ARC_DEBUG` is always `1`. The same YAML
also contains `environment.ARCBENCH_RUNNER_DNS_SERVERS` for Docker runner DNS.

Copy [`source.example.sh`](source.example.sh) to `source.sh` (the real file is
ignored by Git), fill in the PostgreSQL URL, Redis URL, session secret, and
provider values, then load it in every shell that starts a service:

```bash
cp config.example.yaml config.yaml
cp source.example.sh source.sh
chmod 600 config.yaml source.sh
${EDITOR:-vi} source.sh
source ./source.sh
```

Install and start PostgreSQL and Redis according to
[`docs/deploy/PostgreSQL.md`](docs/deploy/PostgreSQL.md) and
[`docs/deploy/Celery_Redis_Runner_Host.md`](docs/deploy/Celery_Redis_Runner_Host.md).
Verify them before starting the application:

```bash
backend/.venv/bin/python scripts/check_postgresql.py
backend/.venv/bin/python scripts/check_redis.py
```

Initialize the Celery lease and Outbox schema once after backing up PostgreSQL:

```bash
backend/.venv/bin/python scripts/migrate_celery_outbox.py
```

For versioned schema management, use Alembic after installing the updated
requirements:

```bash
backend/.venv/bin/alembic -c alembic.ini upgrade head
```

### 3. Build the runner image

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


### 4. Build the frontend

```bash
cd frontend
npm run build
```

this will generate a `frontend/dist` folder with static assets for the backend to serve.

### 5. Install backend dependencies

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

### 6. Start the services (same-host deployment)

For local development, start the API in one terminal:

```bash
source ./source.sh
cd backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

For production, do not use `--reload`. Run multiple API workers behind Nginx:

```bash
source ./source.sh
backend/.venv/bin/gunicorn app.main:app \
  -k uvicorn.workers.UvicornWorker \
  --workers 2 \
  --bind 127.0.0.1:8000 \
  --timeout 120 \
  --keep-alive 5 \
  --access-logfile -

# close
pgrep -af 'gunicorn app.main:app'
pkill -TERM -f 'gunicorn app.main:app'
```

Start with 2 API workers and increase only after load testing. Each worker
opens its own PostgreSQL connections and serves its own SSE connections.

### Resource controls for concurrent users

These limits are controllable, but they protect different resources:

**PostgreSQL connections.** PostgreSQL controls the hard server ceiling:

```sql
SHOW max_connections;
```

Set it in `postgresql.conf` and restart PostgreSQL only after reserving room
for administration and workers. The application pool is configured in
`source.sh`:

```bash
ARCBENCH_DB_POOL_SIZE=10
ARCBENCH_DB_MAX_OVERFLOW=10
ARCBENCH_DB_POOL_TIMEOUT_SECONDS=30
ARCBENCH_DB_POOL_RECYCLE_SECONDS=1800
```

The approximate upper bound is `API workers * (pool size + overflow)` plus
Celery, Dispatcher, Recovery, and admin connections. Keep that total below
PostgreSQL `max_connections`.

**Synchronous interface thread pool.** FastAPI/Starlette runs synchronous
endpoints in an AnyIO thread pool, whose default limiter is about 40 tokens per
process. This is not the Docker task concurrency limit. Do not raise it blindly:
file and Docker operations can consume all threads. Prefer keeping evaluation
in Celery and use async I/O or bounded executors for new expensive endpoints.

**File reads and uploads.** File reads are bounded by OS page cache and disk
I/O, not by Celery. Put Nginx in front of Gunicorn and set an upload limit and
request timeout, for example:

```nginx
client_max_body_size 100m;
proxy_read_timeout 120s;
proxy_send_timeout 120s;
proxy_buffering off;
```

Do not load unbounded logs into memory; paginate or stream large artifacts and
move shared files to object storage before adding more API workers.

**SSE long connections.** Each browser SSE connection is a long-lived HTTP
connection. The current implementation uses Redis Streams, sends a heartbeat
every 15 seconds, and supports `Last-Event-ID` replay. Nginx must disable
buffering for the events location:

```nginx
location /api/runs/ {
  proxy_pass http://127.0.0.1:8000;
  proxy_buffering off;
  proxy_read_timeout 1h;
}
```

Limit SSE connections per user at the reverse proxy/application layer before
accepting hundreds of tabs. Monitor Redis connections and API worker memory;
200 SSE clients are feasible only after a real load test.

Start the Outbox Dispatcher in a second terminal:

```bash
source ./source.sh
backend/.venv/bin/python -m app.worker.dispatcher
```

Start the Celery Worker in a third terminal:

```bash
source ./source.sh
cd backend
.venv/bin/celery -A app.worker.celery_app worker \
  --loglevel=INFO --concurrency=4 \
  -Q evaluation.default,evaluation.retry
```

Start the lease recovery process in a fourth terminal:

```bash
source ./source.sh
backend/.venv/bin/python -m app.worker.recovery
```

For production, run API, Dispatcher, and Worker as separate systemd services;
the Worker must run as the restricted `arcbench` user with Docker access, while
the public API process must not expose the Docker socket. See the deployment
guide for unit files and firewall rules.

After startup, check:

```bash
curl -fsS http://127.0.0.1:8000/api/health
backend/.venv/bin/celery -A app.worker.celery_app inspect ping
backend/.venv/bin/celery -A app.worker.celery_app inspect registered
```

The expected request behavior is: starting a run returns quickly with
`QUEUED`; the Dispatcher marks its Outbox row as sent; the Worker claims it as
`STARTING`, executes the Docker evaluation, and PostgreSQL stores the terminal
result.

## Useful commands

| Goal | Command |
| --- | --- |
| Run the frontend locally | `cd frontend && npm run dev` |
| Build the frontend | `cd frontend && npm run build` |
| Check PostgreSQL | `backend/.venv/bin/python scripts/check_postgresql.py` |
| Check Redis | `backend/.venv/bin/python scripts/check_redis.py` |
| Initialize Celery Outbox schema | `backend/.venv/bin/python scripts/migrate_celery_outbox.py` |
| Apply versioned database migrations | `backend/.venv/bin/alembic -c alembic.ini upgrade head` |
| Start Outbox Dispatcher | `backend/.venv/bin/python -m app.worker.dispatcher` |
| Start Celery Worker | `cd backend && .venv/bin/celery -A app.worker.celery_app worker --loglevel=INFO --concurrency=4 -Q evaluation.default,evaluation.retry` |
| Start lease recovery | `backend/.venv/bin/python -m app.worker.recovery` |
| Generate beta codes | `backend\.venv\Scripts\python.exe scripts\generate_beta_invite_codes.py --count 100` |
| Run the backend | `cd backend && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` |
| Validate the runner image | `docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py` |

## First run

After the services are running, open the **Playground** and use **Quick Start** to create a built-in submission. From there, you can inspect the task, upload or create a new submission, start a run, and review its execution details.
