import { approveAction } from '../pending-actions-store.js';
import { applyAction } from '../action-executor.js';

export async function applyPendingPatchAction(actionId: string) {
  await approveAction(actionId);
  return applyAction(actionId);
}
