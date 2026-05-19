export const electronMainPlan = {
  entry: "electron/main.ts",
  backendUrl: "http://localhost:4000",
  browserWindow: {
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    title: "Nexus IDE",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: "electron/preload.ts"
    }
  },
  startupNotes: [
    "Em desktop:dev, iniciar backend local antes da janela.",
    "Carregar a UI do Nexus pelo backend local para manter a API centralizada.",
    "Nao expor fs, child_process ou shell direto ao renderer."
  ]
};
