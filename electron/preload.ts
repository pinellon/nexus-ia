export const electronPreloadPlan = {
  entry: "electron/preload.ts",
  exposeAs: "window.nexusDesktop",
  allowedChannels: [
    "app:getVersion",
    "app:getPlatform",
    "window:minimize",
    "window:maximize",
    "window:close"
  ],
  rules: [
    "Usar contextBridge para API minima e explicita.",
    "Nao expor execucao de comandos arbitrarios ao renderer.",
    "Toda acao privilegiada deve passar por IPC validado no main process."
  ]
};
