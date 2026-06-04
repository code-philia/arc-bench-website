# Arc Bench Website

This project consists of two parts:

* `frontend`: Vite + React frontend
* `backend`: FastAPI backend

For local development and testing, it is recommended to start both the frontend and backend services.

## Requirements

* Node.js 20+
* Python 3.11+

Available versions on the current machine:

* Node.js `v20.20.2`
* Python `3.13.12`

## 1. Start the Backend

Open a terminal and run:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

After startup, the health check endpoint should be available at:

```bash
http://127.0.0.1:8000/api/health
```

## 2. Start the Frontend

Open another terminal and run:

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at:

```bash
http://127.0.0.1:5173
```

## 3. Frontend–Backend Integration

* Frontend development server port: `5173`
* Backend service port: `8000`
* The frontend is configured to proxy `/api` requests to `http://127.0.0.1:8000`

Under normal circumstances, once both services are running, simply open the frontend URL to access the application.

## 4. Single-Service Deployment (Serving Frontend via FastAPI)

If the frontend has already been built using `npm run build` and the build artifacts are located in `frontend/dist`, FastAPI can serve:

* Frontend pages
* Frontend static assets
* Backend `/api` endpoints

Deployment steps:

```bash
cd frontend
npm install
npm run build

cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

After startup:

* `http://<SERVER_IP>:8000/` — Frontend homepage
* `http://<SERVER_IP>:8000/api/health` — Backend health check

Notes:

* FastAPI will directly serve the built files under `frontend/dist`
* React Router routes will automatically fall back to `index.html` when the page is refreshed
* Requests to `/api/...` will continue to be handled by the backend API
* Do not use the `--reload` option in production environments
