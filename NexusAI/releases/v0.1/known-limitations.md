# Known Limitations

## Direct Model Quality

The official smoke reports show `model_direct_pass_rate: 0.0`. Nexus AI v0.1 should not be presented as a reliable autonomous coding model.

## Fallback Dependency

The official smoke reports show `fallback_usage_rate: 1.0`. The controlled beta is useful because routing, validation, repair, and deterministic fallback produce acceptable final results.

## Rollback Smoke Coverage

`rollback_functioning` is `False` in the official smoke criteria because the latest smoke reports did not include a resolved `patch_rollback` task.

Rollback implementation and unit/API coverage exist:

- `NexusAI/patch_manager.py`
- `NexusAI/app.py` `/repo/rollback`
- `NexusAI/test_controlled_components.py`

Future work should add explicit smoke coverage before marking rollback as a fully passed release gate.

## Desktop Packaging

Desktop packaging is not ready for v0.1. The `desktop:build` script is still a placeholder.

## CI Scope

Required CI should stay light for v0.1. Heavy smoke suites should be manual or scheduled until runtime cost is reduced.
