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

After updating the submodule, commit the new submodule pointer in this repository:

```bash
git add .gitmodules agentic-requirement-compiler
git commit -m "Update agentic-requirement-compiler submodule"
```

## 1. Compile the Frontend

Open another terminal and run:

```bash
cd frontend
npm install
npm run build
```

(Optional) For development purposes, you can start the frontend development server with:
```bash
npm run dev
```
The frontend will be available at:

```bash
http://127.0.0.1:5173
```

## 2. Start the Backend

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

## 3. Uploaded Agent Contract

ARC Bench executes uploaded Python agents with a fixed CLI contract. Your zip bundle must place these files at the archive root:

- `main.py`
- `requirements.txt`

At runtime, the runner installs dependencies from `requirements.txt`, then launches:

```bash
python3 main.py requirements --output-dir . --app-type web --web-port 3000
```

The runner starts the process from the generated project root. Requirements are available in `requirements/`, and SDK runtime files are written under `.arc/`.

If your agent uses the ArcBench SDK, call `AgentRuntime.from_env()` and write progress through the SDK instead of constructing event payloads manually.
