param(
  [switch]$ForceSkills
)

$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git is required.' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 18+ is required.' }
if ([int](node -p 'process.versions.node.split(`.`)[0]') -lt 18) { throw 'Node.js 18+ is required.' }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw 'pnpm is required. Install it with: corepack enable' }

$Backend = Join-Path $Root 'api-enhanced'
if (-not (Test-Path -LiteralPath (Join-Path $Backend 'package.json'))) {
  if (Test-Path -LiteralPath (Join-Path $Root '.git')) {
    git submodule update --init --recursive
  }
}
if (-not (Test-Path -LiteralPath (Join-Path $Backend 'package.json'))) {
  if ((Test-Path -LiteralPath $Backend) -and (Get-ChildItem -Force -LiteralPath $Backend | Select-Object -First 1)) {
    throw 'api-enhanced exists but is incomplete/non-empty. Inspect it manually before continuing.'
  }
  git clone --depth 1 https://github.com/neteasecloudmusicapienhanced/api-enhanced.git $Backend
}

$CacheSafetyPatch = Join-Path $Root 'patches\api-enhanced-cache-safety.patch'
& git -C $Backend apply --check --whitespace=nowarn $CacheSafetyPatch
if ($LASTEXITCODE -eq 0) {
  & git -C $Backend apply --whitespace=nowarn $CacheSafetyPatch
  if ($LASTEXITCODE -ne 0) { throw 'Failed to apply the api-enhanced cache-safety patch.' }
  Write-Host 'Applied api-enhanced cache-safety patch.'
} else {
  & git -C $Backend apply --reverse --check --whitespace=nowarn $CacheSafetyPatch
  if ($LASTEXITCODE -ne 0) { throw 'api-enhanced does not match the supported cache-safety patch. Update the submodule or inspect it manually.' }
  Write-Host 'api-enhanced cache-safety patch is already applied.'
}

pnpm install --child-concurrency=1 --network-concurrency=4
pnpm --dir $Backend install --ignore-scripts --child-concurrency=1 --network-concurrency=4
pnpm check

$CodexHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $HOME '.codex' }
$SkillHome = Join-Path $CodexHome 'skills'
New-Item -ItemType Directory -Force -Path $SkillHome | Out-Null
foreach ($Name in @('netease-music-curator', 'netease-music-feedback', 'netease-music-audit')) {
  $Source = Join-Path $Root "skills\$Name"
  $Target = Join-Path $SkillHome $Name
  if ((Test-Path -LiteralPath $Target) -and -not $ForceSkills) {
    Write-Warning "Skill already exists and was preserved: $Target (use -ForceSkills to replace it)"
  } else {
    Copy-Item -LiteralPath $Source -Destination $SkillHome -Recurse -Force
  }
}

if (Get-Command codex -ErrorAction SilentlyContinue) {
  $null = codex mcp get cloudmusic 2>$null
  if ($LASTEXITCODE -eq 0) {
    Write-Warning 'MCP named cloudmusic already exists and was preserved.'
  } else {
    codex mcp add cloudmusic -- node (Join-Path $Root 'src\index.js')
  }
} else {
  Write-Warning 'Codex CLI not found. Register the MCP using .codex/config.toml.example.'
}

Write-Host 'Installation complete. Run login.bat or .\login.ps1, then restart Codex.'
