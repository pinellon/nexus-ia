import type { AllowedCommandId } from './command-runner.js';

export type ActionType =
  | 'create_file'
  | 'write_file'
  | 'patch_file'
  | 'delete_file'
  | 'run_command'
  | 'install_package'
  | 'open_file';

export type ActionRiskLevel = 'low' | 'medium' | 'high';
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'failed';

export interface ActionRecordBase {
  id: string;
  sessionId: string;
  type: ActionType;
  reason: string;
  goal?: string;
  riskLevel: ActionRiskLevel;
  requiresConfirmation: true;
  createdAt: string;
  updatedAt: string;
  status: ActionStatus;
  sourceAgent?: string;
  error?: string;
  projectRoot?: string;
}

export interface FileCreateAction extends ActionRecordBase {
  type: 'create_file' | 'write_file';
  path: string;
  content: string;
  expectedHash?: string;
}

export interface PatchFileAction extends ActionRecordBase {
  type: 'patch_file';
  path: string;
  before: string;
  after: string;
}

export interface DeleteFileAction extends ActionRecordBase {
  type: 'delete_file';
  path: string;
}

export interface RunCommandAction extends ActionRecordBase {
  type: 'run_command';
  commandId: AllowedCommandId;
  command: string;
}

export interface InstallPackageAction extends ActionRecordBase {
  type: 'install_package';
  packageManager: 'npm';
  packages: string[];
  dev: boolean;
}

export interface OpenFileAction extends ActionRecordBase {
  type: 'open_file';
  path: string;
}

export type ActionRecord =
  | FileCreateAction
  | PatchFileAction
  | DeleteFileAction
  | RunCommandAction
  | InstallPackageAction
  | OpenFileAction;

export type ActionDraft =
  | Omit<FileCreateAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>
  | Omit<PatchFileAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>
  | Omit<DeleteFileAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>
  | Omit<RunCommandAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>
  | Omit<InstallPackageAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>
  | Omit<OpenFileAction, 'createdAt' | 'updatedAt' | 'status' | 'id'>;
