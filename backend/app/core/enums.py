from enum import Enum


class RuntimeType(str, Enum):
    PYTHON = "python"
    NODEJS = "nodejs"


class SubmissionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PAUSE_REQUESTED = "PAUSE_REQUESTED"
    PAUSED = "PAUSED"
    RESUME_REQUESTED = "RESUME_REQUESTED"
    PASSED = "PASSED"
    FAILED = "FAILED"
