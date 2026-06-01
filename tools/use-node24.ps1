$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$runtime = Get-ChildItem -LiteralPath (Join-Path $root ".local-node") -Directory -Filter "node-v24.*-win-x64" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1

if (-not $runtime) {
  throw "Geen project-lokale Node 24 runtime gevonden in .local-node. Installeer Node v24.x eerst."
}

$env:Path = "$($runtime.FullName);$env:Path"

$command = @($args)

if ($command.Count -gt 0) {
  $commandLine = $command -join " "
  & cmd.exe /d /s /c $commandLine
  exit $LASTEXITCODE
}

Write-Host "Node runtime actief: $($runtime.FullName)"
node -v
npm -v
