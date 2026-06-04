from enum import Enum


class RuntimeType(str, Enum):
    PYTHON = "python"
    NODEJS = "nodejs"


class SubmissionStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    PASSED = "PASSED"
    FAILED = "FAILED"
