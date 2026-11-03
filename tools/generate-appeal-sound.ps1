param([switch]$Execute)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$python = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$helper = Join-Path $PSScriptRoot 'elevenlabs-diagnostics.py'
$generationArgs = @($helper, 'sound', '--repo', $repo, '--request', (Join-Path $PSScriptRoot 'appeal-sound.request.json'), '--output', 'assets/generated/appeal-chime/appeal.mp3')
if ($Execute) { $generationArgs += '--execute' }
& $python @generationArgs
if ($LASTEXITCODE -ne 0) { throw 'Sound generation failed. No automatic retry was attempted.' }
