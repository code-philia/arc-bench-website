# ARC Bench

## Requirements

* Node.js 20+: For the frontend.
* Python 3.11+: For the backend.
* Docker: For running the application in a containerized environment.

## Submodule

This repository includes `agentic-requirement-compiler` as a git submodule.

If you clone this repository from scratch, initialize the submodule with:

```bash
git submodule update --init --recursive
```

To update `agentic-requirement-compiler` to the latest `main` from its remote repository:

```bash
git submodule update --remote agentic-requirement-compiler
```

## Demo Agent Template Bundle

`runtime/demo-agent/template` is stored as `runtime/demo-agent/template.git.bundle` because the template itself is a git repository. Git cannot commit the nested `template/.git` directory as normal files.

After cloning or pulling updates, restore the demo-agent template repository with:

```bash
cd runtime/demo-agent
git clone template.git.bundle template
```

On Windows PowerShell:

```powershell
Set-Location runtime\demo-agent
git clone template.git.bundle template
```

If you update `runtime/demo-agent/template`, regenerate and commit the bundle:

```bash
git -C runtime/demo-agent/template bundle create ../template.git.bundle --all
git add runtime/demo-agent/template.git.bundle
git commit -m "Update demo-agent template bundle"
```

## 1. Build the Unified Runner Image

Build the single local Docker image used by both ARC and Octos submissions. It includes Python, Node.js, Git, Playwright/Chromium, and the Octos CLI:

```bash
docker build -f backend/runner/Dockerfile -t arcbench-runner:local .
docker run --rm --entrypoint python3 arcbench-runner:local /opt/arcbench/smoke_test.py
```

Set `ARCBENCH_RUNNER_IMAGE=arcbench-runner:local` for local execution. Production should use a validated immutable image tag or digest.

## 2. Compile the Frontend

Open another terminal and run:

```bash
cd frontend
npm install
npm run build
```

## 3. Start the Backend

### Prepare the Python Environment

If you use conda, you can create a virtual environment with:

```bash
conda create -n arcbench python=3.11 -y
conda activate arcbench

cd backend
pip install -r requirements.txt
```

If you use venv, you can create a virtual environment with:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If you use uv, you can create a virtual environment with:

```bash
cd backend
uv venv .venv
uv pip install -r requirements.txt
```

### Start the Backend

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
The website will be available at:

```bash
http://127.0.0.1:8000
```

## 4. Quick Start

Use the **Quick Start** guide on the Playground page to quickly create a built-in submission.
