#!/usr/bin/env python3
"""
scripts/azuredevops.py
======================
Azure DevOps operations utility.

This script is used by automation agents and CI/CD pipelines to inspect and
manage Azure DevOps pipeline workflows.

Usage:
  python3 scripts/azuredevops.py <command> [options]
  python3 scripts/azuredevops.py --help

Required environment variables:
  AZURE_DEVOPS_ORG      - Org URL: https://dev.azure.com/myorg
  AZURE_DEVOPS_PROJECT  - Project name
  AZURE_DEVOPS_PAT      - Personal Access Token
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ─────────────────────────────────────────────
# ANSI colors for terminal output
# ─────────────────────────────────────────────
class Color:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    BLUE = "\033[94m"
    GRAY = "\033[90m"

    @staticmethod
    def disable():
        """Disable color codes when --no-color or --json is enabled."""
        for attr in (
            "RESET",
            "BOLD",
            "GREEN",
            "YELLOW",
            "RED",
            "CYAN",
            "MAGENTA",
            "BLUE",
            "GRAY",
        ):
            setattr(Color, attr, "")


# ─────────────────────────────────────────────
# Azure DevOps API Client
# ─────────────────────────────────────────────
class AzureDevOpsClient:
    API_VERSION = "7.1"

    def __init__(self, org: str, project: str, pat: str):
        self.org = org.rstrip("/")
        self.project = urllib.parse.quote(project)
        self.raw_project = project
        token = base64.b64encode(f":{pat}".encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _url(self, path: str, collection: bool = False) -> str:
        base = self.org if collection else f"{self.org}/{self.project}"
        return f"{base}/_apis/{path}?api-version={self.API_VERSION}"

    def _request(self, method: str, url: str, body: Optional[Dict] = None) -> Any:
        data = json.dumps(body).encode() if body else None
        req = urllib.request.Request(
            url, data=data, headers=self.headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            try:
                err_json = json.loads(err_body)
                msg = err_json.get("message", err_body)
            except Exception:
                msg = err_body
            raise RuntimeError(f"HTTP {e.code}: {msg}") from e
        except urllib.error.URLError as e:
            raise RuntimeError(f"Connection error: {e.reason}") from e

    def get(self, path: str, **kwargs) -> Any:
        url = self._url(path, **kwargs)
        return self._request("GET", url)

    def post(self, path: str, body: Dict) -> Any:
        url = self._url(path)
        return self._request("POST", url, body)

    def patch(self, path: str, body: Dict) -> Any:
        url = self._url(path)
        return self._request("PATCH", url, body)

    # ── Pipeline / Build API ────────────────────────────────────────────────

    def list_pipelines(self) -> List[Dict]:
        """List all pipeline definitions in the project."""
        result = self.get("pipelines")
        return result.get("value", [])

    def get_pipeline(self, pipeline_id: int) -> Dict:
        """Fetch a specific pipeline definition."""
        result = self.get(f"pipelines/{pipeline_id}")
        return result

    def list_runs(
        self, pipeline_id: Optional[int] = None, count: int = 20
    ) -> List[Dict]:
        """List pipeline runs. If pipeline_id is omitted, list all pipelines."""
        if pipeline_id:
            result = self.get(f"pipelines/{pipeline_id}/runs")
            runs = result.get("value", [])
        else:
            # Use the Build API to fetch runs across all pipelines
            url = (
                f"{self.org}/{self.project}/_apis/build/builds"
                f"?api-version={self.API_VERSION}&$top={count}&queryOrder=queueTimeDescending"
            )
            result = self._request("GET", url)
            runs = result.get("value", [])
        return runs[:count]

    def get_run_details(self, build_id: int) -> Dict:
        """Fetch details for a specific build run."""
        url = (
            f"{self.org}/{self.project}/_apis/build/builds/{build_id}"
            f"?api-version={self.API_VERSION}"
        )
        return self._request("GET", url)

    def get_run_timeline(self, build_id: int) -> Dict:
        """Fetch build timeline steps and their statuses."""
        url = (
            f"{self.org}/{self.project}/_apis/build/builds/{build_id}/timeline"
            f"?api-version={self.API_VERSION}"
        )
        return self._request("GET", url)

    def get_run_logs(self, build_id: int) -> List[Dict]:
        """Build log listesini getir."""
        url = (
            f"{self.org}/{self.project}/_apis/build/builds/{build_id}/logs"
            f"?api-version={self.API_VERSION}"
        )
        result = self._request("GET", url)
        return result.get("value", [])

    def trigger_pipeline(
        self,
        pipeline_id: int,
        branch: str = "main",
        variables: Optional[Dict[str, str]] = None,
    ) -> Dict:
        """Trigger a pipeline run."""
        body: Dict[str, Any] = {
            "resources": {"repositories": {"self": {"refName": f"refs/heads/{branch}"}}}
        }
        if variables:
            body["variables"] = {k: {"value": v} for k, v in variables.items()}
        url = f"{self.org}/{self.project}/_apis/pipelines/{pipeline_id}/runs?api-version={self.API_VERSION}"
        return self._request("POST", url, body)

    def cancel_run(self, build_id: int) -> Dict:
        """Cancel an in-progress build."""
        url = (
            f"{self.org}/{self.project}/_apis/build/builds/{build_id}"
            f"?api-version={self.API_VERSION}"
        )
        return self._request("PATCH", url, {"status": "cancelling"})

    def list_artifacts(self, build_id: int) -> List[Dict]:
        """List build artifacts."""
        url = (
            f"{self.org}/{self.project}/_apis/build/builds/{build_id}/artifacts"
            f"?api-version={self.API_VERSION}"
        )
        result = self._request("GET", url)
        return result.get("value", [])

    def get_test_results(self, build_id: int) -> Dict:
        """Fetch test results."""
        url = (
            f"{self.org}/{self.project}/_apis/test/runs"
            f"?api-version={self.API_VERSION}&buildId={build_id}"
        )
        return self._request("GET", url)

    def get_coverage(self, build_id: int) -> Dict:
        """Code coverage verilerini getir."""
        url = (
            f"{self.org}/{self.project}/_apis/test/codecoverage"
            f"?api-version={self.API_VERSION}&buildId={build_id}"
        )
        return self._request("GET", url)

    def list_variable_groups(self) -> List[Dict]:
        """List variable groups."""
        url = (
            f"{self.org}/{self.project}/_apis/distributedtask/variablegroups"
            f"?api-version={self.API_VERSION}"
        )
        result = self._request("GET", url)
        return result.get("value", [])

    def list_agent_pools(self) -> List[Dict]:
        """List agent pools."""
        url = f"{self.org}/_apis/distributedtask/pools?api-version={self.API_VERSION}"
        result = self._request("GET", url)
        return result.get("value", [])

    def get_project_info(self) -> Dict:
        """Fetch project metadata."""
        url = f"{self.org}/_apis/projects/{self.project}?api-version={self.API_VERSION}"
        return self._request("GET", url)

# ─────────────────────────────────────────────
# Formatter — human-readable output
# ─────────────────────────────────────────────
def fmt_status(status: str, result: Optional[str] = None) -> str:
    """Format build status with colors."""
    if result == "succeeded":
        return f"{Color.GREEN}✓ succeeded{Color.RESET}"
    elif result == "failed":
        return f"{Color.RED}✗ failed{Color.RESET}"
    elif result == "canceled":
        return f"{Color.GRAY}⊘ canceled{Color.RESET}"
    elif status == "inProgress":
        return f"{Color.CYAN}⟳ running{Color.RESET}"
    elif status == "notStarted":
        return f"{Color.YELLOW}⏳ queued{Color.RESET}"
    else:
        return f"{Color.GRAY}{status or 'unknown'}{Color.RESET}"


def fmt_datetime(dt_str: Optional[str]) -> str:
    """Convert an ISO datetime string into local time."""
    if not dt_str:
        return Color.GRAY + "—" + Color.RESET
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        local = dt.astimezone()
        return local.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return dt_str


def fmt_duration(start: Optional[str], finish: Optional[str]) -> str:
    """Calculate the duration between two datetimes."""
    if not start or not finish:
        return "—"
    try:
        s = datetime.fromisoformat(start.replace("Z", "+00:00"))
        f = datetime.fromisoformat(finish.replace("Z", "+00:00"))
        secs = int((f - s).total_seconds())
        if secs < 60:
            return f"{secs}s"
        elif secs < 3600:
            return f"{secs // 60}m {secs % 60}s"
        else:
            return f"{secs // 3600}h {(secs % 3600) // 60}m"
    except Exception:
        return "—"


def print_table(headers: List[str], rows: List[List[str]]) -> None:
    """Print a simple ASCII table."""
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            # Strip ANSI codes when calculating visible width
            clean = cell
            for code in [
                Color.GREEN,
                Color.RED,
                Color.YELLOW,
                Color.CYAN,
                Color.GRAY,
                Color.MAGENTA,
                Color.BLUE,
                Color.BOLD,
                Color.RESET,
            ]:
                clean = clean.replace(code, "")
            col_widths[i] = max(col_widths[i], len(clean))

    sep = "+" + "+".join("-" * (w + 2) for w in col_widths) + "+"
    header_row = (
        "|"
        + "|".join(
            f" {Color.BOLD}{h:<{col_widths[i]}}{Color.RESET} "
            for i, h in enumerate(headers)
        )
        + "|"
    )

    print(sep)
    print(header_row)
    print(sep)
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            clean = cell
            for code in [
                Color.GREEN,
                Color.RED,
                Color.YELLOW,
                Color.CYAN,
                Color.GRAY,
                Color.MAGENTA,
                Color.BLUE,
                Color.BOLD,
                Color.RESET,
            ]:
                clean = clean.replace(code, "")
            pad = col_widths[i] - len(clean)
            cells.append(f" {cell}{' ' * pad} ")
        print("|" + "|".join(cells) + "|")
    print(sep)


# ─────────────────────────────────────────────
# Command handlers
# ─────────────────────────────────────────────
def cmd_health(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Check Azure DevOps connectivity and project health."""
    print(f"\n{Color.BOLD}🔍 Azure DevOps Health Check{Color.RESET}")
    print(f"   Org:     {Color.CYAN}{client.org}{Color.RESET}")
    print(f"   Project: {Color.CYAN}{client.raw_project}{Color.RESET}")

    try:
        project = client.get_project_info()
        print(f"\n{Color.GREEN}✓ Project accessible{Color.RESET}")
        print(f"   ID:    {project.get('id', '?')}")
        print(f"   State: {project.get('state', '?')}")

        pipelines = client.list_pipelines()
        print(
            f"\n{Color.GREEN}✓ Pipelines reachable{Color.RESET} — {len(pipelines)} pipeline(s) found"
        )
        for p in pipelines:
            print(f"   [{p.get('id')}] {p.get('name', '?')}")

        pools = client.list_agent_pools()
        print(f"\n{Color.GREEN}✓ Agent pools{Color.RESET} — {len(pools)} pool(s)")
        for pool in pools[:5]:
            print(f"   {pool.get('name', '?')} (size: {pool.get('size', '?')})")

        result = {
            "status": "healthy",
            "project": project.get("name"),
            "pipeline_count": len(pipelines),
            "pool_count": len(pools),
        }
        print(f"\n{Color.GREEN}✅ All checks passed{Color.RESET}")
        return result

    except RuntimeError as e:
        print(f"\n{Color.RED}✗ Health check failed: {e}{Color.RESET}")
        return {"status": "unhealthy", "error": str(e)}


def cmd_status(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Show active and recent pipeline runs."""
    print(f"\n{Color.BOLD}📊 Pipeline Status{Color.RESET}")

    runs = client.list_runs(count=args.count)
    if not runs:
        print(f"  {Color.GRAY}No recent pipeline runs found.{Color.RESET}")
        return {"runs": []}

    rows = []
    for r in runs:
        build_id = str(r.get("id", "?"))
        name = r.get("definition", {}).get(
            "name", r.get("pipeline", {}).get("name", "?")
        )
        status = r.get("status", "")
        result = r.get("result", "")
        branch = r.get("sourceBranch", r.get("branch", "")).replace("refs/heads/", "")
        start = fmt_datetime(r.get("startTime", r.get("queueTime", "")))
        duration = fmt_duration(r.get("startTime"), r.get("finishTime"))
        rows.append(
            [build_id, name, fmt_status(status, result), branch, start, duration]
        )

    print_table(["ID", "Pipeline", "Status", "Branch", "Started", "Duration"], rows)
    return {
        "runs": [
            {"id": r.get("id"), "status": r.get("status"), "result": r.get("result")}
            for r in runs
        ]
    }


def cmd_runs(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """List the latest N pipeline runs."""
    print(f"\n{Color.BOLD}📚 Pipeline Runs{Color.RESET}")
    runs = client.list_runs(pipeline_id=args.pipeline_id, count=args.count)
    if not runs:
        print(f"  {Color.GRAY}No pipeline runs found.{Color.RESET}")
        return {"runs": []}

    rows = []
    for r in runs:
        build_id = str(r.get("id", "?"))
        name = r.get("definition", {}).get(
            "name", r.get("pipeline", {}).get("name", "?")
        )
        status = r.get("status", "")
        result = r.get("result", "")
        branch = r.get("sourceBranch", r.get("branch", "")).replace("refs/heads/", "")
        start = fmt_datetime(r.get("startTime", r.get("queueTime", "")))
        duration = fmt_duration(r.get("startTime"), r.get("finishTime"))
        rows.append(
            [build_id, name, fmt_status(status, result), branch, start, duration]
        )

    print_table(["ID", "Pipeline", "Status", "Branch", "Started", "Duration"], rows)
    return {
        "runs": [
            {"id": r.get("id"), "status": r.get("status"), "result": r.get("result")}
            for r in runs
        ]
    }


def cmd_run_details(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Show detailed information for a specific run."""
    run = client.get_run_details(args.run_id)
    timeline = client.get_run_timeline(args.run_id)

    print(f"\n{Color.BOLD}🔎 Build #{args.run_id} Details{Color.RESET}")
    print(f"   Pipeline: {run.get('definition', {}).get('name', '?')}")
    print(f"   Branch:   {run.get('sourceBranch', '?').replace('refs/heads/', '')}")
    print(f"   Commit:   {Color.CYAN}{run.get('sourceVersion', '?')[:8]}{Color.RESET}")
    print(f"   Status:   {fmt_status(run.get('status', ''), run.get('result', ''))}")
    print(f"   Started:  {fmt_datetime(run.get('startTime'))}")
    print(f"   Finished: {fmt_datetime(run.get('finishTime'))}")
    print(f"   Duration: {fmt_duration(run.get('startTime'), run.get('finishTime'))}")
    print(
        f"   URL:      {Color.BLUE}{run.get('url', '').replace('_apis/build/builds', '_build/results?buildId')}{Color.RESET}"
    )

    # Timeline steps
    records = timeline.get("records", []) if timeline else []
    stage_records = [r for r in records if r.get("type") in ("Stage", "Job", "Task")]

    if stage_records:
        print(f"\n  {Color.BOLD}Steps:{Color.RESET}")
        rows = []
        for rec in stage_records:
            indent = "  " * (
                {"Stage": 0, "Job": 1, "Task": 2}.get(rec.get("type", "Task"), 2)
            )
            rows.append(
                [
                    indent + rec.get("name", "?"),
                    rec.get("type", "?"),
                    fmt_status(rec.get("state", ""), rec.get("result", "")),
                    fmt_duration(rec.get("startTime"), rec.get("finishTime")),
                ]
            )
        print_table(["Step", "Type", "Status", "Duration"], rows)

    return {"build": run, "timeline": records}


def cmd_trigger(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Trigger a pipeline."""
    print(
        f"\n{Color.BOLD}🚀 Triggering pipeline {args.pipeline_id} on {args.branch}{Color.RESET}"
    )

    variables = {}
    if args.variables:
        for var in args.variables:
            if "=" in var:
                k, v = var.split("=", 1)
                variables[k] = v

    run = client.trigger_pipeline(args.pipeline_id, args.branch, variables or None)
    run_id = run.get("id", "?")
    print(f"  {Color.GREEN}✓ Pipeline triggered — Run ID: {run_id}{Color.RESET}")
    print(f"  Status: {fmt_status(run.get('state', ''), run.get('result', ''))}")
    return {"run_id": run_id, "status": run.get("state")}


def cmd_cancel(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Cancel a pipeline run."""
    print(f"\n{Color.BOLD}⊘ Canceling run {args.run_id}{Color.RESET}")
    result = client.cancel_run(args.run_id)
    print(f"  {Color.YELLOW}Run {args.run_id} cancellation requested.{Color.RESET}")
    return {"run_id": args.run_id, "status": "cancelling"}


def cmd_artifacts(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """List build artifacts."""
    print(f"\n{Color.BOLD}📦 Artifacts for build #{args.run_id}{Color.RESET}")
    artifacts = client.list_artifacts(args.run_id)

    if not artifacts:
        print(f"  {Color.GRAY}No artifacts found.{Color.RESET}")
        return {"artifacts": []}

    rows = []
    for a in artifacts:
        rows.append(
            [
                a.get("name", "?"),
                str(
                    a.get("resource", {}).get("properties", {}).get("artifactsize", "?")
                ),
                a.get("resource", {}).get("type", "?"),
            ]
        )
    print_table(["Name", "Size (bytes)", "Type"], rows)
    return {"artifacts": artifacts}


def cmd_test_results(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Show test results."""
    print(f"\n{Color.BOLD}🧪 Test Results for build #{args.run_id}{Color.RESET}")
    results = client.get_test_results(args.run_id)
    runs = results.get("value", [])

    if not runs:
        print(f"  {Color.GRAY}No test results found.{Color.RESET}")
        return {"test_runs": []}

    total_passed = sum(r.get("passedTests", 0) for r in runs)
    total_failed = sum(
        r.get("failedTests", 0)
        + r.get("unanalyzedTests", 0)
        + r.get("notApplicableTests", 0)
        for r in runs
    )
    total = sum(r.get("totalTests", 0) for r in runs)

    print(f"  Total:  {total}")
    print(f"  Passed: {Color.GREEN}{total_passed}{Color.RESET}")
    print(
        f"  Failed: {Color.RED if total_failed > 0 else Color.GRAY}{total_failed}{Color.RESET}"
    )

    rows = []
    for r in runs:
        rows.append(
            [
                r.get("name", "?"),
                str(r.get("totalTests", 0)),
                f"{Color.GREEN}{r.get('passedTests', 0)}{Color.RESET}",
                f"{Color.RED}{r.get('failedTests', 0) + r.get('unanalyzedTests', 0)}{Color.RESET}",
                fmt_duration(r.get("startedDate"), r.get("completedDate")),
            ]
        )
    print_table(["Run Name", "Total", "Passed", "Failed", "Duration"], rows)
    return {
        "test_runs": runs,
        "summary": {"total": total, "passed": total_passed, "failed": total_failed},
    }


def cmd_coverage(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Show code coverage data."""
    print(f"\n{Color.BOLD}📈 Code Coverage for build #{args.run_id}{Color.RESET}")
    coverage = client.get_coverage(args.run_id)
    modules = coverage.get("coverageData", [])

    if not modules:
        print(f"  {Color.GRAY}No coverage data available.{Color.RESET}")
        return {"coverage": []}

    rows = []
    for mod in modules:
        stats = {s["label"]: s for s in mod.get("coverageStats", [])}
        line_stat = stats.get("Line", stats.get("line", {}))
        covered = line_stat.get("covered", 0)
        total = line_stat.get("total", 0)
        pct = (covered / total * 100) if total > 0 else 0.0
        color = Color.GREEN if pct >= 80 else (Color.YELLOW if pct >= 60 else Color.RED)
        rows.append(
            [
                mod.get("configuration", {}).get("coverageType", "?"),
                str(covered),
                str(total),
                f"{color}{pct:.1f}%{Color.RESET}",
            ]
        )
    print_table(["Module", "Covered Lines", "Total Lines", "Coverage %"], rows)
    return {"coverage": modules}


def cmd_env_vars(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """List variable groups."""
    print(f"\n{Color.BOLD}🔐 Variable Groups{Color.RESET}")
    groups = client.list_variable_groups()

    if not groups:
        print(f"  {Color.GRAY}No variable groups found.{Color.RESET}")
        return {"groups": []}

    for group in groups:
        print(
            f"\n  [{group.get('id')}] {Color.CYAN}{group.get('name', '?')}{Color.RESET}"
        )
        print(f"       Type: {group.get('type', '?')}")
        vars_ = group.get("variables", {})
        for var_name, var_info in vars_.items():
            is_secret = var_info.get("isSecret", False)
            value = "***" if is_secret else var_info.get("value", "")
            icon = "🔒" if is_secret else "📄"
            print(f"       {icon} {var_name} = {Color.GRAY}{value}{Color.RESET}")

    return {
        "groups": [
            {
                "id": g.get("id"),
                "name": g.get("name"),
                "variable_count": len(g.get("variables", {})),
            }
            for g in groups
        ]
    }


def cmd_queues(client: AzureDevOpsClient, args: argparse.Namespace) -> Dict:
    """Show agent pool status."""
    print(f"\n{Color.BOLD}🖥️  Agent Pools{Color.RESET}")
    pools = client.list_agent_pools()

    if not pools:
        print(f"  {Color.GRAY}No agent pools found.{Color.RESET}")
        return {"pools": []}

    rows = []
    for pool in pools:
        rows.append(
            [
                str(pool.get("id", "?")),
                pool.get("name", "?"),
                pool.get("poolType", "?"),
                str(pool.get("size", "?")),
                f"{Color.GREEN if pool.get('isHosted') else Color.YELLOW}"
                f"{'Microsoft-hosted' if pool.get('isHosted') else 'self-hosted'}{Color.RESET}",
            ]
        )
    print_table(["ID", "Name", "Type", "Size", "Hosted"], rows)
    return {"pools": pools}
# ─────────────────────────────────────────────
# CLI argument parser
# ─────────────────────────────────────────────
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="azuredevops.py",
        description=(
            "Azure DevOps operations utility.\n"
            "Used by automation agents and CI pipelines."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/azuredevops.py health
  python3 scripts/azuredevops.py status --count 10
  python3 scripts/azuredevops.py run-details --run-id 42
  python3 scripts/azuredevops.py trigger --pipeline-id 1 --branch main
  python3 scripts/azuredevops.py test-results --run-id 42
  python3 scripts/azuredevops.py status --json

Environment Variables:
  AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT
        """,
    )

    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument(
        "--no-color", action="store_true", help="Disable colored output"
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    # health
    subparsers.add_parser("health", help="Check Azure DevOps connectivity and health")

    # status
    p_status = subparsers.add_parser("status", help="Show recent pipeline runs")
    p_status.add_argument(
        "--count", type=int, default=15, help="Number of runs to display"
    )

    # runs
    p_runs = subparsers.add_parser("runs", help="List pipeline runs")
    p_runs.add_argument("--count", type=int, default=20, help="Number of runs")
    p_runs.add_argument("--pipeline-id", type=int, help="Specific pipeline ID")

    # run-details
    p_details = subparsers.add_parser(
        "run-details", help="Show details for a specific run"
    )
    p_details.add_argument("--run-id", type=int, required=True, help="Build/run ID")

    # trigger
    p_trigger = subparsers.add_parser("trigger", help="Trigger a pipeline")
    p_trigger.add_argument("--pipeline-id", type=int, required=True)
    p_trigger.add_argument("--branch", default="main")
    p_trigger.add_argument(
        "--variables",
        nargs="*",
        metavar="KEY=VALUE",
        help="Pipeline variables (for example: MY_VAR=value)",
    )

    # cancel
    p_cancel = subparsers.add_parser("cancel", help="Cancel a running pipeline")
    p_cancel.add_argument("--run-id", type=int, required=True)

    # artifacts
    p_art = subparsers.add_parser("artifacts", help="List build artifacts")
    p_art.add_argument("--run-id", type=int, required=True)

    # test-results
    p_test = subparsers.add_parser("test-results", help="Show test results")
    p_test.add_argument("--run-id", type=int, required=True)

    # coverage
    p_cov = subparsers.add_parser("coverage", help="Show code coverage data")
    p_cov.add_argument("--run-id", type=int, required=True)

    # env-vars
    subparsers.add_parser("env-vars", help="List variable groups")

    # queues
    subparsers.add_parser("queues", help="Show agent pool and queue status")

    return parser


# ─────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────
def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.no_color or args.json:
        Color.disable()

    # Validate Azure DevOps credentials
    org = os.environ.get("AZURE_DEVOPS_ORG", "")
    project = os.environ.get("AZURE_DEVOPS_PROJECT", "")
    pat = os.environ.get("AZURE_DEVOPS_PAT", "")

    if not all([org, project, pat]):
        print(
            f"{Color.RED}Error: AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT and "
            f"AZURE_DEVOPS_PAT environment variables are required.{Color.RESET}",
            file=sys.stderr,
        )
        print("\nUsage:", file=sys.stderr)
        print("  export AZURE_DEVOPS_ORG=https://dev.azure.com/myorg", file=sys.stderr)
        print("  export AZURE_DEVOPS_PROJECT=my-project", file=sys.stderr)
        print("  export AZURE_DEVOPS_PAT=your-personal-access-token", file=sys.stderr)
        return 1

    client = AzureDevOpsClient(org, project, pat)

    COMMANDS = {
        "health": lambda: cmd_health(client, args),
        "status": lambda: cmd_status(client, args),
        "runs": lambda: cmd_runs(client, args),
        "run-details": lambda: cmd_run_details(client, args),
        "trigger": lambda: cmd_trigger(client, args),
        "cancel": lambda: cmd_cancel(client, args),
        "artifacts": lambda: cmd_artifacts(client, args),
        "test-results": lambda: cmd_test_results(client, args),
        "coverage": lambda: cmd_coverage(client, args),
        "env-vars": lambda: cmd_env_vars(client, args),
        "queues": lambda: cmd_queues(client, args),
    }

    handler = COMMANDS.get(args.command)
    if not handler:
        print(
            f"{Color.RED}Unknown command: {args.command}{Color.RESET}", file=sys.stderr
        )
        return 1

    try:
        result = handler()
        if args.json:
            print(json.dumps(result, indent=2, default=str))
        return 0
    except RuntimeError as e:
        print(f"\n{Color.RED}Error: {e}{Color.RESET}", file=sys.stderr)
        if args.json:
            print(json.dumps({"error": str(e)}, indent=2))
        return 1
    except KeyboardInterrupt:
        print(f"\n{Color.YELLOW}Interrupted.{Color.RESET}")
        return 130


if __name__ == "__main__":
    sys.exit(main())
