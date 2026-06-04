import json
from pathlib import Path


class ResultParser:
    def parse(self, result_path: str | Path) -> dict:
        path = Path(result_path)
        if not path.exists():
            return {"passed": 0, "failed": 0, "score": 0.0, "tests": []}
        data = json.loads(path.read_text(encoding="utf-8"))
        passed = int(data.get("passed", 0))
        failed = int(data.get("failed", 0))
        total = passed + failed
        score = round((passed / total) * 100, 1) if total else 0.0
        data["score"] = score
        data.setdefault("tests", [])
        return data
