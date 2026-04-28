param(
  [string]$IngressNamespace = "ingress-nginx",
  [string]$IngressReleaseName = "ingress-nginx",
  [string]$IngressChartVersion = "4.13.3",
  [switch]$SkipRepoUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
  param([Parameter(Mandatory = $true)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name is required but was not found in PATH."
  }
}

function Write-Step {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Assert-FileExists {
  param([Parameter(Mandatory = $true)][string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required file not found: $Path"
  }
}

function Add-Or-UpdateHelmRepo {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Url,
    [switch]$SkipUpdate
  )

  $existingRepo = helm repo list --output json | ConvertFrom-Json |
    Where-Object { $_.name -eq $Name }

  if (-not $existingRepo) {
    Write-Step "Adding Helm repo '$Name'"
    helm repo add $Name $Url | Out-Host
  }

  if (-not $SkipUpdate) {
    Write-Step "Updating Helm repositories"
    helm repo update | Out-Host
  }
}

function Install-Or-UpgradeIngressController {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseName,
    [Parameter(Mandatory = $true)][string]$Namespace,
    [Parameter(Mandatory = $true)][string]$ChartVersion,
    [Parameter(Mandatory = $true)][string]$ValuesFile
  )

  Write-Step "Installing ingress-nginx chart"
  helm upgrade --install $ReleaseName "ingress-nginx/ingress-nginx" `
    --namespace $Namespace `
    --create-namespace `
    --version $ChartVersion `
    --values $ValuesFile `
    --wait `
    --timeout 5m | Out-Host
}

function Apply-Manifests {
  param([Parameter(Mandatory = $true)][string[]]$ManifestPaths)

  Write-Step "Applying platform manifests"
  foreach ($manifestPath in $ManifestPaths) {
    kubectl apply -f $manifestPath | Out-Host
  }
}

function Wait-ForDeployment {
  param(
    [Parameter(Mandatory = $true)][string]$Namespace,
    [Parameter(Mandatory = $true)][string]$Name
  )

  kubectl rollout status "deployment/$Name" -n $Namespace --timeout=5m | Out-Host
}

Require-Command kubectl
Require-Command helm

$repoName = "ingress-nginx"
$repoUrl = "https://kubernetes.github.io/ingress-nginx"
$valuesFile = Join-Path $PSScriptRoot "ingress-nginx-values.yaml"
$manifestNames = @(
  "namespace.yaml",
  "rbac.yaml",
  "backend-secret.yaml",
  "repl-runtime-secret.yaml",
  "redis.yaml",
  "backend-deployment.yaml",
  "backend-service.yaml",
  "frontend-deployment.yaml",
  "frontend-service.yaml",
  "ingress.yaml"
)
$manifestPaths = $manifestNames | ForEach-Object { Join-Path $PSScriptRoot $_ }

Assert-FileExists -Path $valuesFile
$manifestPaths | ForEach-Object { Assert-FileExists -Path $_ }

Add-Or-UpdateHelmRepo -Name $repoName -Url $repoUrl -SkipUpdate:$SkipRepoUpdate

Install-Or-UpgradeIngressController `
  -ReleaseName $IngressReleaseName `
  -Namespace $IngressNamespace `
  -ChartVersion $IngressChartVersion `
  -ValuesFile $valuesFile

Apply-Manifests -ManifestPaths $manifestPaths

Write-Step "Waiting for ingress controller rollout"
Wait-ForDeployment -Namespace $IngressNamespace -Name "ingress-nginx-controller"

Write-Step "Waiting for platform rollouts"
Wait-ForDeployment -Namespace "repls" -Name "backend"
Wait-ForDeployment -Namespace "repls" -Name "frontend"
Wait-ForDeployment -Namespace "repls" -Name "redis"

Write-Host ""
Write-Host "Environment ready."
Write-Host "Frontend: http://app.127.0.0.1.nip.io"
Write-Host "Backend:  http://api.127.0.0.1.nip.io"
Write-Host "Repls:    http://repl-<id>.127.0.0.1.nip.io"
