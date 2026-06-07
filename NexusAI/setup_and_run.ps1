# -------------------------------------------------
# setup_and_run.ps1
# Automatiza todo o fluxo:
#   1. Cria e ativa a virtual-env Python
#   2. Instala dependencias Python
#   3. Instala dependencias Node/React
#   4. Cria a UI Vite+React (se ainda nao existir)
#   5. Inicia a API (uvicorn) e a UI (vite) em janelas separadas
# -------------------------------------------------

# ==== 0. Configuracoes iniciais =============================================
# PSScriptRoot contem o diretorio onde este script esta salvo
$projectRoot = $PSScriptRoot
Set-Location $projectRoot
Write-Host "`n[*] Diretorio de trabalho: $projectRoot`n" -ForegroundColor Cyan

# ==== 1. Cria e ativa a virtual-env Python ================================
$venvPath = Join-Path $projectRoot ".venv"
if (-Not (Test-Path $venvPath)) {
    Write-Host "[SETUP] Criando virtual-env em .venv ..."
    python -m venv .venv
}
else {
    Write-Host "[OK] Virtual-env ja existe."
}

# Ativa a venv (PowerShell)
$activateScript = Join-Path $venvPath "Scripts\Activate.ps1"
Write-Host "[SETUP] Ativando virtual-env ..."
& $activateScript

# ==== 2. Atualiza pip e instala dependencias Python =========================
Write-Host "[SETUP] Atualizando pip ..."
python -m pip install --upgrade pip

Write-Host "[SETUP] Instalando dependencias do Python (requirements.txt) ..."
$reqFile = Join-Path $projectRoot "requirements.txt"
if (Test-Path $reqFile) {
    python -m pip install -r $reqFile
}
else {
    Write-Host "[AVISO] requirements.txt nao encontrado. Pulando instalacao de dependencias Python."
}

# ==== 3. Instala dependencias Node/React ====================================
$pkgFile = Join-Path $projectRoot "package.json"
if (-Not (Test-Path $pkgFile)) {
    Write-Host "[SETUP] Inicializando package.json ..."
    npm init -y
}
else {
    Write-Host "[OK] package.json ja existe."
}

Write-Host "[SETUP] Instalando devDependencies (vite, react, etc.) ..."
npm install react react-dom vite @vitejs/plugin-react --save-dev

# ==== 4. Cria a UI Vite+React (se ainda nao existir) =======================
$webDir = Join-Path $projectRoot "web"
if (-Not (Test-Path $webDir)) {
    Write-Host "[SETUP] Gerando projeto Vite+React em ./web ..."
    npm create vite@latest web -- --template react
}
else {
    Write-Host "[OK] Pasta ./web ja existe."
}

Set-Location $webDir
npm install

# ==== 5. Inicia a API (uvicorn) e a UI (vite) em janelas separadas ========
# Volta ao diretorio raiz para iniciar a API
Set-Location $projectRoot

Write-Host "`n[SETUP] Iniciando a API (uvicorn) ..."
$apiCommand = ". .\.venv\Scripts\Activate.ps1; uvicorn src.api:app --reload"
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", $apiCommand `
    -WindowStyle Normal `
    -WorkingDirectory $projectRoot

Write-Host "[SETUP] Iniciando a UI (Vite) ..."
Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoExit", "-Command", "npm run dev" `
    -WindowStyle Normal `
    -WorkingDirectory $webDir

Write-Host "`n[OK] Tudo esta rodando!`n" -ForegroundColor Green
Write-Host "[INFO] API   -> http://127.0.0.1:8000"
Write-Host "[INFO] UI    -> http://localhost:5173"
Write-Host "`n[INFO] Feche as janelas PowerShell acima para parar os servidores.`n"
