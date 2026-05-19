/* Nexus AI side panel */
function initAiPanel() {
  $("#btn-use-file-context")?.addEventListener("click", () => {
    const input = $("#devmindChat input");
    const form = $("#devmindChat form button");
    if (!input) return;
    const ctx = buildIDEContext();
    const active = state.activePath || "nenhum";
    input.value = `Usando contexto do arquivo ${active}. `;
    input.dataset.pendingContext = ctx;
    setStatus("Contexto do arquivo anexado à próxima mensagem");
    input.focus();
  });

  if (window.DevMind) {
    const originalGetContext = buildIDEContext;
    window.DevMind.init({
      apiBase: "",
      containerId: "devmindChat",
      getContext: () => {
        const input = $("#devmindChat input");
        const extra = input?.dataset.pendingContext;
        if (extra) {
          delete input.dataset.pendingContext;
          return extra;
        }
        return originalGetContext();
      },
      onSuccess: (data) => {
        if (state.project) loadFiles(state.project.projectPath);
        if (data.patch_ids?.length && typeof loadPatches === "function") {
          loadPatches();
          showBottomPanel("patch");
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

  document.addEventListener("devmind:action", (event) => {
    const detail = event.detail || {};
    if (detail.value === "patches" || detail.id === "open_patches") {
      showBottomPanel("patch");
      if (typeof loadPatches === "function") loadPatches();
    }
  });
}
