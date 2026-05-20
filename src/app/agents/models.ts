export type AgentRiskLevel = "low" | "medium" | "high";
export type AgentRunStatus =
  | "started"
  | "planning"
  | "running"
  | "needs_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type AgentEventType =
  | "started"
  | "planning"
  | "running"
  | "reading_project"
  | "tool_call"
  | "tool_result"
  | "artifact_created"
  | "patch_created"
  | "file_created"
  | "preview_ready"
  | "needs_approval"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted";

export type AgentArtifactType =
  | "plan"
  | "diff"
  | "patch"
  | "terminal_output"
  | "test_result"
  | "file_summary"
  | "security_report"
  | "docs_update";

export type ToolName =
  | "read_project_tree"
  | "read_file"
  | "search_files"
  | "propose_patch"
  | "run_terminal_command"
  | "git_status"
  | "git_diff"
  | "run_tests"
  | "run_build"
  | "generate_readme"
  | "analyze_error";

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: ToolName[];
  riskLevel: AgentRiskLevel;
}

export interface ToolCall {
  id: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  status: "started" | "completed" | "failed" | "needs_approval";
  summary?: string;
}

export interface ToolResult {
  ok: boolean;
  toolName: ToolName;
  summary: string;
  data?: Record<string, unknown>;
  error?: string;
  requiresApproval?: boolean;
  artifactIds?: string[];
  actionIds?: string[];
}

export interface AgentStep {
  id: string;
  title: string;
  kind: "plan" | "tool" | "artifact" | "analysis";
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  detail?: string;
  toolCallId?: string;
  artifactId?: string;
}

export interface AgentEvent {
  id: string;
  runId: string;
  type: AgentEventType;
  createdAt: string;
  message: string;
  level: "info" | "warning" | "error";
  payload?: Record<string, unknown>;
}

export interface AgentArtifact {
  id: string;
  runId: string;
  projectId: string;
  type: AgentArtifactType;
  title: string;
  path: string;
  createdAt: string;
  summary: string;
  metadata?: Record<string, unknown>;
  actionId?: string;
  contentPreview?: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  userGoal: string;
  projectRoot: string;
  projectId: string;
  status: AgentRunStatus;
  createdAt: string;
  updatedAt: string;
  currentMessage?: string;
  cancelRequested: boolean;
  steps: AgentStep[];
}
