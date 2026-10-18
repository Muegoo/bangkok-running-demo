$ErrorActionPreference = 'Stop'

# Resolve the MCP binary beside the running Studio; fall back to the newest installed copy.
$activeStudio = Get-Process -Name RobloxStudioBeta -ErrorAction SilentlyContinue |
    Where-Object { $_.Path } | Sort-Object StartTime -Descending | Select-Object -First 1
$mcpBinary = $null
if ($activeStudio) {
    $candidate = Join-Path (Split-Path -Parent $activeStudio.Path) 'StudioMCP.exe'
    if (Test-Path -LiteralPath $candidate) { $mcpBinary = $candidate }
}
if (-not $mcpBinary) {
    $versionsRoot = Join-Path $env:LOCALAPPDATA 'Roblox\Versions'
    $installedCopy = Get-ChildItem -LiteralPath $versionsRoot -Filter StudioMCP.exe -Recurse |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($installedCopy) { $mcpBinary = $installedCopy.FullName }
}
if (-not $mcpBinary) { throw 'Roblox Studio MCP is not installed.' }
& $mcpBinary @args
exit $LASTEXITCODE
