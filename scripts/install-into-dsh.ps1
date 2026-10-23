# Pack both plugins. See INSTALL.md. Arguments are passed through.
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js is required. Install Node.js 22 or later, then run this script again.' }
& node (Join-Path $PSScriptRoot 'install-into-dsh.mjs') @args
exit $LASTEXITCODE
