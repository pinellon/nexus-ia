# Nexus AI v0.1

Nexus AI v0.1 is a controlled local assistant for development workflows. It is not yet an autonomous coding model.

Release type: beta/local controlled.

## Included Summaries

- `release-summary.json`
- `smoke_25-summary.json`
- `smoke_50-summary.json`
- `known-limitations.md`

## Decision

v0.1 is acceptable as a local controlled beta because the product layer passes controlled smoke criteria with zero failed tasks in the latest smoke_25 and smoke_50 reports.

The release is not proof of autonomous model quality. Direct model success remains limited and deterministic fallback is the main reliability path.

## Source Reports

- `NexusAI/logs/real_tasks_smoke_25_1780941386.md`
- `NexusAI/logs/real_tasks_smoke_50_1780941589.md`

The source reports are not copied into this release folder to avoid storing heavy generated artifacts.
