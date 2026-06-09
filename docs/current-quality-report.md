# Nexus AI Current Quality Report

Status date: 2026-06-09

## Current Milestone

Nexus AI has reached the local controlled autonomy loop:

`UI -> plan -> approve -> execute controlled step -> rollback -> audit log`

Merged milestones:

- v0.1: controlled local engine
- v0.1.1: coder tools
- v0.2: UI to Python bridge
- v0.3 Step 1: task queue, human approval, audit log, cancellation
- v0.3.2: rollback and command sandbox execution
- v0.3.3: autonomy approval UI

## v0.4 Quality Baseline

The v0.4 benchmark definition is now `benchmarks/coder_smoke_100.json`.

The benchmark is not a training corpus. It is a measurement fixture for controlled local programming tasks.

Current automated quality signals:

| Signal | Current state |
| --- | --- |
| Node typecheck | passing |
| Node build | passing |
| Node tests | passing |
| Python compile | passing |
| Python controlled tests | passing |
| Python coder component tests | passing |
| Python autonomy component tests | passing |
| CI secret scan | passing on latest merged autonomy PRs |
| `auto_applied` invariant | false |

Current measured or disclosed product metrics:

| Metric | Current value | Source / note |
| --- | --- | --- |
| `success_rate` | not_measured_for_coder_smoke_100 | v0.4 fixture created; full run pending |
| `fallback_usage_rate` | 1.0 in v0.1 smoke reports | Existing release disclosure |
| `model_direct_pass_rate` | 0.0 in v0.1 smoke reports | Existing release disclosure |
| `repair_success_rate` | not_measured_for_coder_smoke_100 | Requires runner output |
| `rollback_success_rate` | covered by unit/API/manual validation, not yet benchmark-scored | v0.3.2/v0.3.3 validation |
| `average_task_time` | not_measured_for_coder_smoke_100 | Requires timed run |
| `failed_by_category` | not_measured_for_coder_smoke_100 | Requires timed run |
| `task_category_summary` | defined by fixture categories | See benchmark fixture |

## Endpoint Hardening Baseline

Covered by tests or manual validation:

- `GET /api/nexus/health`
- `POST /api/nexus/run`
- `GET /api/nexus/autonomy/tasks`
- `POST /api/nexus/autonomy/plan`
- `GET /api/nexus/autonomy/status/:taskId`
- `POST /api/nexus/autonomy/approve`
- `POST /api/nexus/autonomy/reject`
- `POST /api/nexus/autonomy/request-changes`
- `POST /api/nexus/autonomy/execute`
- `POST /api/nexus/autonomy/rollback`
- `POST /api/nexus/autonomy/cancel`
- `GET /api/nexus/autonomy/audit/:taskId`
- `POST /repo/autonomy/execute`

Important invariants:

- approval does not execute
- execution requires `approved:true`
- execution requires a previously approved step
- execution accepts exactly one action: `changes`, `command`, or `rollback:true`
- dangerous commands are blocked by the sandbox
- sensitive paths such as `.env`, `.git`, `node_modules`, and `NexusAI/memory` are blocked
- rollback restores modified files and removes created files
- `auto_applied:false` is preserved

## Operational Hygiene

Tracked repository status:

- no tracked `*.zip` artifacts found in git
- package files are unchanged in v0.4
- runtime memory files remain ignored
- local reports, caches, coverage, and temporary zip extraction folders are ignored

Open stale PRs observed during v0.4 hardening:

- PR #6: release/MVP preparation branch
- PR #7: assisted dev loop tools stacked on older release work
- PR #8: active workspace isolation
- PR #9: editor selection AI actions

These PRs were not changed by v0.4. They should be reviewed separately after the quality baseline is merged.

Local ignored artifacts may exist during development, including:

- `node_modules/`
- `dist/`
- `.tmp-tests/`
- `NexusAI/memory/*.json`
- `NexusAI/memory/*.jsonl`
- local zip bundles

These are not release artifacts and should not be committed.

## Desktop Status

The web UI is usable locally through the Node server. Electron scripts still identify desktop packaging as preparation/placeholder work. Nexus AI should not be marketed as a packaged desktop product yet.

## Persistence Status

The current runtime state uses JSON files:

- `task_queue.json`
- `autonomy_plans.json`
- `audit_log.jsonl`

This supports local restart recovery for current controlled autonomy work. It is not a production database. SQLite or another durable store remains future work.

## Next Recommended Work

1. Run and score `coder_smoke_100`.
2. Produce a timed result report with all v0.4 metrics.
3. Expand endpoint tests only where gaps are found by the benchmark.
4. Defer model/training decisions until benchmark data exists.
