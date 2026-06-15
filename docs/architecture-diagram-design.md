# ARC-Bench System Architecture Diagram — Design Plan

## 1. Overall Layout Strategy

**Canvas**: 1100 × 720 px  
**Layout direction**: Top-down layered architecture  
**Layer count**: 4 main layers + title  
**Color coding**: Each layer has a distinct color family  

## 2. Color Palette

| Layer | Header | Body | Border | Role |
|-------|--------|------|--------|------|
| Client Browser | #1A5276 | #D6EAF8 | #1A5276 | User-facing |
| FastAPI Backend | #1E8449 | #D5F5E3 | #1E8449 | Application logic |
| Data Stores | #7D3C98 | #E8DAEF | #7D3C98 | Persistence |
| Docker Sandbox | #E67E22 | #FDEBD0 | #E67E22 | Execution infra |
| Title & Legend | — | #F8F9FA | #CCCCCC | Meta |

## 3. Layer-by-Layer Layout

### Title Bar (y=5, h=25)
- Centered text: "ARC-Bench Website — System Architecture (系统架构图)"

### Layer 1: Client Browser (y=40, h=90, x=30, w=1040)
- **Container**: Swimlane, header label "Client Browser (客户端浏览器)"
- **4 child boxes** (w=230, h=42, y=38 inside container):
  - B1 (x=15): "React 18 SPA + TypeScript" — Vite + Ant Design
  - B2 (x=260): "React Router (17 routes)" — AppShell layout
  - B3 (x=505): "Auth + Theme" — Cookie session, Dark/Light
  - B4 (x=750): "API Client (fetch)" — credentials: 'include' + 2s polling

### Layer 2: FastAPI Backend (y=145, h=250, x=30, w=1040)
- **Container**: Swimlane, header "FastAPI Backend (后端服务) — uvicorn :8000"
- **Sub-region A — API Routers** (x=15, y=35, w=1010, h=70):
  - 7 small boxes in a row (each w=130, h=42):
    - /auth (Login/Register/Me)
    - /requirements (CRUD + Docs)
    - /competitions (List + Downloads)
    - /submissions (CRUD + Start + Logs)
    - /my-tasks (User task CRUD)
    - CORS Middleware
    - Static Files (prod)
- **Sub-region B — Services Layer** (x=15, y=115, w=660, h=120):
  - **Core Services** row (y=115, 4 boxes, each w=150, h=50):
    - AuthService (PBKDF2 + HMAC)
    - SubmissionService (CRUD + Validate)
    - ExecutionService (ThreadPoolExecutor×2) — **highlighted**
    - RequirementCatalogService
  - **Support Services** row (y=175, 4 boxes, each w=150, h=42):
    - WorkspaceAssembler
    - DockerManager (docker-py SDK)
    - ResultParser
    - UserTaskService
- **Sub-region C — SQLite Database** (x=695, y=115, w=320, h=120):
  - Internal label: "SQLite (runtime/app.db)"
  - 4 cylinder shapes (2×2 grid, each w=145, h=38):
    - users, requirements
    - submissions, user_tasks
  - Below them: "SQLAlchemy ORM" box

### Layer 3: Docker Execution Sandbox (y=410, h=210, x=30, w=1040)
- **Container**: Swimlane, header "Docker Execution Sandbox (Docker 执行沙箱)"
- **Sub-region A — Container Config** (x=15, y=35, w=330, h=80):
  - Image box (w=155): "arcbench-agent-runner:latest\nbased on playwright/python"
  - Limits box (w=155): "CPU=2, Mem=4GB\nTimeout=600s, Ephemeral"
- **Sub-region B — Execution Pipeline** (x=360, y=35, w=660, h=80):
  - 5 step boxes with arrows between them (each w=115, h=55):
    1. "1. pip install\nAgent deps"
    2. "2. python main.py\nRun agent code"
    3. "3. npm build+dev\nApp on :3000"
    4. "4. playwright test\nRun test suite"
    5. "5. Write Results\nresult.json + events"
- **Sub-region C — Visual SDK** (x=15, y=130, w=1010, h=60):
  - Wider box showing: "Visual SDK: arcbench_visual.py / arcbench_visual.js / arcbench_visual.ts"
  - Below: "Agent emits requirement_state events → runner-events.jsonl → Frontend canvas renders node states"

### Layer 4: File System (y=635, h=75, x=30, w=1040)
- **Container**: Swimlane, header "File System (文件系统)"
- 4 document-shaped boxes (each w=235, h=38):
  - FS1: "runtime/user-submissions/\nagent zips, workspaces"
  - FS2: "runtime/user-tasks/\nYAML + Markdown files"
  - FS3: "arc-bench/\nbenchmark tests, templates"
  - FS4: "runtime/app.db\nSQLite database file"

## 4. Connection Strategy (7 edges, minimal crossings)

All edges use `edgeStyle=orthogonalEdgeStyle;rounded=1;`.

| ID | Source | Target | Label | Style | Color |
|----|--------|--------|-------|-------|-------|
| E1 | API Client (B4) | /auth router | "HTTP + cookie" | Solid, ↓ | Blue #1A5276 |
| E2 | /submissions router | SubmissionService | — | Solid, ↓ | Green #1E8449 |
| E3 | ExecutionService | Docker Container | "docker-py SDK" | Solid, ↓ | Orange #E67E22 |
| E4 | Docker Pipeline (step 5) | FS1 (workspace) | "write results" | Solid, ↓→ | Orange #E67E22 |
| E5 | SubmissionService | DB (submissions) | "ORM query" | Solid, → | Green #1E8449 |
| E6 | RequirementCatalogService | FS3 (arc-bench) | "sync from disk" | Dashed, → | Gray #888 |
| E7 | Docker Pipeline (step 5) | ExecutionService | "poll events (1s)" | Dashed, ↑← | Orange #E67E22 |

**Routing rules**:
- E1: Straight down from B4 bottom to API router area top
- E2: Short vertical within backend layer (routers → services)
- E3: Down from ExecutionService to Docker layer top
- E4: Down-right from Docker results to FileSystem
- E5: Horizontal right from SubmissionService to DB area
- E6: Horizontal right from ReqCatalog to arc-bench FS
- E7: Dashed arrow going BACK from Docker to ExecutionService (polling loop)

## 5. Legend (y=693, h=22, x=30, w=1040)
- Bottom bar showing: solid line = direct call, dashed = async/polling, color meanings

## 6. Visual Hierarchy Design Rules

1. **Container headers**: Bold, white text on dark background, font-size=12px
2. **Child boxes**: font-size=10px, rounded corners
3. **Arrow labels**: font-size=9px, positioned on the arrow line
4. **Highlighted component** (ExecutionService): slightly darker fill, bold border
5. **No overlapping edges**: All connections go straight down, then horizontal if needed
6. **Padding**: Minimum 10px gap between adjacent boxes

## 7. Key Design Decisions

1. **Why 4 layers not 5**: Merged DB + FileSystem into adjacent sub-regions within layer 2 (Backend), then gave FileSystem its own small layer at the bottom for the Docker output
2. **Why Docker pipeline is horizontal**: Linear step-by-step flow reads naturally left-to-right
3. **Why 7 edges not more**: Only show architecturally significant data flows; internal routing within layers is implied by grouping
4. **Why ExecutionService is highlighted**: It's the central orchestrator connecting backend ↔ Docker ↔ polling loop
