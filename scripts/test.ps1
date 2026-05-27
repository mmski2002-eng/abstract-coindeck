$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

aptos move test
