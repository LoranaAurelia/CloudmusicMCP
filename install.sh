#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
command -v git >/dev/null || { echo "Git is required" >&2; exit 1; }
command -v node >/dev/null || { echo "Node.js 18+ is required" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "pnpm is required (try: corepack enable)" >&2; exit 1; }

if [[ ! -f api-enhanced/package.json && -d .git ]]; then
  git submodule update --init --recursive
fi
if [[ ! -f api-enhanced/package.json ]]; then
  if [[ -d api-enhanced && -n "$(find api-enhanced -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
    echo "api-enhanced exists but is incomplete/non-empty; inspect it manually" >&2
    exit 1
  fi
  git clone --depth 1 https://github.com/neteasecloudmusicapienhanced/api-enhanced.git api-enhanced
fi

pnpm install --child-concurrency=1 --network-concurrency=4
pnpm --dir api-enhanced install --ignore-scripts --child-concurrency=1 --network-concurrency=4
pnpm check

CODEX_DIR="${CODEX_HOME:-$HOME/.codex}"
mkdir -p "$CODEX_DIR/skills"
for name in netease-music-curator netease-music-feedback netease-music-audit; do
  if [[ -e "$CODEX_DIR/skills/$name" ]]; then
    echo "Preserving existing skill: $name" >&2
  else
    cp -R "skills/$name" "$CODEX_DIR/skills/$name"
  fi
done

if command -v codex >/dev/null; then
  if codex mcp get cloudmusic >/dev/null 2>&1; then
    echo "Preserving existing MCP named cloudmusic" >&2
  else
    codex mcp add cloudmusic -- node "$ROOT/src/index.js"
  fi
fi

echo "Installation complete. Run 'pnpm login', then restart Codex."
