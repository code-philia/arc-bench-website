# Arc Bench Website

## Requirements

* Node.js 20+: For the frontend.
* Python 3.11+: For the backend.
* Docker: For running the application in a containerized environment.

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
