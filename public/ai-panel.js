/* Nexus AI side panel */
function initAiPanel() {
  function getChatInput() {
    return $("#dm-input") || $("#devmindChat textarea") || $("#devmindChat input");
  }

  function attachContextToChat(label) {
    const input = getChatInput();
    if (!input) return;
    const ctx = buildIDEContext();
    const active = state.activePath || "nenhum";
    input.value = `Usando ${label} de ${active}. `;
    input.dataset.pendingContext = ctx;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    setStatus("Contexto do arquivo anexado a proxima mensagem");
    input.focus();
  }

  $("#btn-use-file-context")?.addEventListener("click", () => {
    attachContextToChat("contexto do arquivo");
  });

  $("#btn-use-selection-context")?.addEventListener("click", () => {
    attachContextToChat("selecao atual");
  });

  if (window.DevMind) {
    const originalGetContext = buildIDEContext;
    window.DevMind.init({
      apiBase: "",
      containerId: "devmindChat",
      getContext: () => {
        const input = getChatInput();
        const extra = input?.dataset.pendingContext;
        if (extra) {
          delete input.dataset.pendingContext;
          return extra;
        }
        return originalGetContext();
      },
      onSuccess: (data) => {
        if (data.run_id && typeof startAgentProgress === "function") {
          startAgentProgress(data.run_id);
        }
        if (state.project) loadFiles(state.project.projectPath);
        if (data.patch_ids?.length) {
          if (state.agentProgress) mergeAgentPatchIds(data.patch_ids);
          if (typeof openPatchesPanel === "function") {
            openPatchesPanel({ patchId: data.patch_ids[0], viewDiff: true });
          } else if (typeof loadPatches === "function") {
            loadPatches();
            showBottomPanel("patch");
          }
        }
        if (data.preview_url) {
          setStatus("Preview pronto. Use o botao Abrir preview no chat.");
        }
        setTimeout(() => {
          if (state.stagedFiles?.length) {
            $(".activity-btn[data-target='explorer']")?.click();
            openFile(state.stagedFiles[0].path, state.stagedFiles[0]);
          }
        }, 500);
      }
    });
  }

}
