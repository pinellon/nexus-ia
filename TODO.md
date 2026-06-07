# Nexus IA Quality And Safety TODO

## Patch Quality

- Add light JSON repair for AI action payloads before parsing.
- Reject fragile `patch_file` actions when `before` is empty or too short.
- Dedupe proposed actions with a canonical key and content hashes.

## Workspace Safety

- Keep all read/write operations behind project/workspace path resolvers.
- Ensure backup file names cannot escape the backup directory.
- Preserve stale patch checks before applying approved actions.

## Agent Tools

- Keep terminal execution restricted to a whitelist.
- Block shell metacharacters and redirects before command execution.
- Improve file search with size limits, match scoring and lower-noise results.
- Improve error analysis with file/line extraction and suggested next tool.

## Validation

- Add focused tests for planner repair/dedupe and backup path safety.
- Run `npm test`, `npm run typecheck`, and `npm run build`.
