from enum import Enum


class RuntimeType(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    NODEJS = "nodejs"


class AgentSourceType(str, Enum):
    UPLOAD = "upload"
    BUILTIN_ARC_AGENT = "builtin_arc_agent"
    BUILTIN_OCTOS_AGENT = "builtin_octos_agent"


class SubmissionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSE_REQUESTED = "PAUSE_REQUESTED"
    PAUSED = "PAUSED"
    RESUME_REQUESTED = "RESUME_REQUESTED"
    PASSED = "PASSED"
    FAILED = "FAILED"
