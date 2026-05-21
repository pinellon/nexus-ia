/* Nexus AI side panel */
function initAiPanel() {
  function getChatInput() {
    return $("#dm-input") || $("#devmindChat textarea") || $("#devmindChat input");
  }

  function rememberPreviewUrl(url) {
    if (!url) return;
    state.previewUrl = url;
    const btn = $("#btn-open-preview");
    if (btn) {
      btn.classList.add("has-preview");
      btn.title = "Abrir preview: " + url;
    }
  }

  function findPreviewUrl() {
    if (state.previewUrl) return state.previewUrl;
    const stagedHtml = (state.stagedFiles || []).find((file) => file.run_id && /(?:^|\/)index\.html$/i.test(file.path));
    if (stagedHtml?.run_id) return `/preview/staged/${encodeURIComponent(stagedHtml.run_id)}/index.html`;
    const active = window.NexusIDE?.getActiveFile?.();
    if (active?.path === "public/index.html" || /\/index\.html$/i.test(active?.path || "")) return "/";
    return "/";
  }

  function openPreview() {
    const url = findPreviewUrl();
    rememberPreviewUrl(url);
    window.open(url, "_blank", "noopener,noreferrer");
    setStatus("Preview aberto: " + url);
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

  $("#btn-open-preview")?.addEventListener("click", openPreview);

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
          rememberPreviewUrl(data.preview_url);
          setStatus("Preview pronto. Use o botao Preview no painel Nexus AI.");
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
