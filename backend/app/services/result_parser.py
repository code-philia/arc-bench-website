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

    def parse_playwright_report(self, report_path: str | Path) -> dict:
        path = Path(report_path)
        if not path.exists():
            return {
                "passed": 0,
                "failed": 0,
                "score": 0.0,
                "test_pass_rate": 0.0,
                "feature_implemented_count": 0,
                "feature_total_count": 0,
                "feature_implementation_rate": 0.0,
                "tests": [],
            }
        report = json.loads(path.read_text(encoding="utf-8"))
        tests: list[dict] = []
        passed = 0
        failed = 0

        def summarize(test: dict) -> tuple[str, str | None]:
            results = test.get("results", [])
            statuses = [str(result.get("status", "")).strip() for result in results]
            if any(status == "failed" for status in statuses):
                return "failed", "failed"
            if any(status == "timedOut" for status in statuses):
                return "timedOut", "failed"
            if any(status == "interrupted" for status in statuses):
                return "interrupted", "failed"
            if any(status == "passed" for status in statuses):
                return str(test.get("expectedStatus", "passed")).strip() or "passed", "passed"
            if any(status == "skipped" for status in statuses):
                return "skipped", "failed"
            aggregate_status = str(test.get("status", "unknown")).strip() or "unknown"
            if aggregate_status == "expected":
                return str(test.get("expectedStatus", "passed")).strip() or "passed", "passed"
            return aggregate_status, "failed"

        def walk_suite(suite: dict, inherited_file: str | None = None) -> None:
            nonlocal passed, failed
            suite_file = str(suite.get("file", "")).strip() or inherited_file
            for spec in suite.get("specs", []):
                title = spec.get("title", "Unnamed spec")
                for test in spec.get("tests", []):
                    status, outcome = summarize(test)
                    duration = sum(result.get("duration", 0) for result in test.get("results", []))
                    error_text = None
                    for result in test.get("results", []):
                        errors = result.get("errors", [])
                        if errors:
                            error_text = errors[0].get("message")
                            break
                    if outcome == "passed":
                        passed += 1
                    else:
                        failed += 1
                    tests.append(
                        {
                            "name": title,
                            "status": status,
                            "passed": outcome == "passed",
                            "duration_ms": duration,
                            "error": error_text,
                            "file": suite_file,
                        }
                    )
            for child in suite.get("suites", []):
                walk_suite(child, suite_file)

        for suite in report.get("suites", []):
            walk_suite(suite)

        total = passed + failed
        score = round((passed / total) * 100, 1) if total else 0.0

        # A Playwright test file represents one product feature.  A feature is
        # implemented only when every test case from that file passes.
        feature_outcomes: dict[str, bool] = {}
        for index, test in enumerate(tests):
            file_path = str(test.get("file") or "").strip() or f"__unknown_feature_{index}"
            passed_feature_case = bool(test.get("passed"))
            feature_outcomes[file_path] = feature_outcomes.get(file_path, True) and passed_feature_case
        feature_total = len(feature_outcomes)
        feature_implemented = sum(1 for implemented in feature_outcomes.values() if implemented)
        feature_rate = round((feature_implemented / feature_total) * 100, 1) if feature_total else 0.0
        return {
            "passed": passed,
            "failed": failed,
            "score": score,
            "test_pass_rate": score,
            "feature_implemented_count": feature_implemented,
            "feature_total_count": feature_total,
            "feature_implementation_rate": feature_rate,
            "tests": tests,
        }
