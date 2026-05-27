$ErrorActionPreference = "Stop"

Set-Location (Join-Path (Split-Path -Parent $PSScriptRoot) "contracts")

aptos move compile
