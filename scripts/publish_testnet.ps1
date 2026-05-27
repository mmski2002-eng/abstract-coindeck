param(
  [string]$Profile = "moveinvestor"
)

$ErrorActionPreference = "Stop"

Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "contracts")

aptos move publish `
  --profile $Profile `
  --assume-yes `
  --skip-fetch-latest-git-deps `
  --language-version 2.1 `
  --bytecode-version 7
