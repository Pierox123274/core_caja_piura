# Despliegue del backend a Render via API
# Uso: $env:RENDER_API_KEY="rnd_..."; $env:DATABASE_URL="postgresql://..."; .\scripts\deploy-render-api.ps1

param(
  [string]$RenderApiKey = $env:RENDER_API_KEY,
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$DniToken = $env:DNI_API_TOKEN
)

if (-not $RenderApiKey) { throw "RENDER_API_KEY requerido" }
if (-not $DatabaseUrl) { throw "DATABASE_URL requerido" }

$headers = @{
  Authorization = "Bearer $RenderApiKey"
  "Content-Type"  = "application/json"
}

$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers $headers
$ownerId = $owners[0].owner.id

$body = @{
  type       = "web_service"
  name       = "caja-piura-api"
  ownerId    = $ownerId
  repo       = "https://github.com/Pierox123274/core_caja_piura"
  branch     = "master"
  autoDeploy = "yes"
  envVars    = @(
    @{ key = "DATABASE_URL"; value = $DatabaseUrl }
    @{ key = "CORS_ORIGINS"; value = "https://core-caja-piura.vercel.app" }
    @{ key = "JWT_SECRET"; value = "caja-piura-jwt-prod-2026" }
    @{ key = "DNI_API_BASE_URL"; value = "https://dniruc.apisperu.com/api/v1/dni" }
    @{ key = "PYTHON_VERSION"; value = "3.12.8" }
  )
  serviceDetails = @{
    runtime          = "python"
    plan             = "free"
    region           = "oregon"
    healthCheckPath  = "/health"
    envSpecificDetails = @{
      buildCommand = "pip install -r backend/requirements.txt"
      startCommand = "uvicorn backend.main:app --host 0.0.0.0 --port `$PORT"
    }
  }
}
if ($DniToken) {
  $body.envVars += @{ key = "DNI_API_TOKEN"; value = $DniToken }
}

try {
  $svc = Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services" -Headers $headers -Body ($body | ConvertTo-Json -Depth 6)
  Write-Host "Servicio creado: $($svc.service.name)"
  Write-Host "URL: $($svc.service.serviceDetails.url)"
} catch {
  if ($_.Exception.Message -match "already exists") {
    Write-Host "Servicio ya existe, redeploy via dashboard Render"
  } else {
    throw
  }
}
