import path from "node:path";

import type { ActionRecord } from "./action-types.js";
import { ensureProjectRoot, getRepositoryRoot, resolveProjectRoot } from "./project-file-store.js";

export interface ActiveProject {
  name: string;
  root: string;
  absoluteRoot: string;
  type: "workspace";
  projectId: string;
}

const DEFAULT_ACTIVE_ROOT = "workspace";
const BLOCKED_PROJECT_SEGMENTS = new Set([".git", "node_modules", "data", "dist", "coverage"]);

let activeProjectRoot = DEFAULT_ACTIVE_ROOT;

function normalizeRootInput(root: unknown) {
  const raw = String(root || DEFAULT_ACTIVE_ROOT).trim().replace(/\\/g, "/").replace(/\/+$/, "");
  const withoutDotPrefix = raw.replace(/^\.\//, "");

  if (!withoutDotPrefix || withoutDotPrefix === ".") {
    throw new Error("O root interno do Nexus nao pode ser selecionado como projeto ativo");
  }

  if (path.isAbsolute(withoutDotPrefix) || withoutDotPrefix.startsWith("/") || withoutDotPrefix.includes("..")) {
    throw new Error("Root de projeto invalido");
  }

  return withoutDotPrefix;
}

function validateWorkspaceRoot(root: string) {
  const segments = root.split("/").filter(Boolean);

  if (segments[0] !== DEFAULT_ACTIVE_ROOT) {
    throw new Error("Somente workspace/ ou subpastas dentro de workspace/ podem ser projeto ativo nesta fase");
  }

  for (const segment of segments) {
    if (BLOCKED_PROJECT_SEGMENTS.has(segment.toLowerCase())) {
      throw new Error(`Projeto ativo nao pode apontar para ${segment}`);
    }
  }
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveAllowedActiveProject(root: unknown = activeProjectRoot): ActiveProject {
  const normalized = normalizeRootInput(root);
  validateWorkspaceRoot(normalized);

  const appRoot = getRepositoryRoot();
  const workspaceRoot = path.join(appRoot, DEFAULT_ACTIVE_ROOT);
  const resolved = resolveProjectRoot(normalized);

  if (!isInside(workspaceRoot, resolved.absoluteRoot)) {
    throw new Error("Projeto ativo precisa ficar dentro de workspace/");
  }

  return {
    name: normalized === DEFAULT_ACTIVE_ROOT ? "workspace" : path.basename(resolved.absoluteRoot),
    root: normalized,
    absoluteRoot: resolved.absoluteRoot,
    type: "workspace",
    projectId: resolved.projectId
  };
}

export async function ensureActiveProject(root: unknown = activeProjectRoot) {
  const project = resolveAllowedActiveProject(root);
  await ensureProjectRoot(project.root);
  return project;
}

export function getActiveProject() {
  return resolveAllowedActiveProject(activeProjectRoot);
}

export async function setActiveProjectRoot(root: unknown) {
  const project = await ensureActiveProject(root);
  activeProjectRoot = project.root;
  return project;
}

export function resolveProjectRootForRequest(projectRoot: unknown) {
  if (typeof projectRoot === "string" && projectRoot.trim()) {
    return resolveAllowedActiveProject(projectRoot).root;
  }

  return getActiveProject().root;
}

export function getAppRoot() {
  return getRepositoryRoot();
}

export function assertPatchActionInsideActiveProject(action: ActionRecord) {
  if (!("path" in action)) {
    return;
  }

  const active = getActiveProject();

  if (!action.projectRoot) {
    throw new Error("Este patch aponta para fora do projeto ativo e foi bloqueado por seguranca.");
  }

  const actionRoot = resolveProjectRoot(action.projectRoot).absoluteRoot;
  if (!isInside(active.absoluteRoot, actionRoot)) {
    throw new Error("Este patch aponta para fora do projeto ativo e foi bloqueado por seguranca.");
  }
}
