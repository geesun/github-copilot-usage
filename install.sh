#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# install.sh — Install the github-copilot-usage TUI plugin for OpenCode
#
# Usage:
#   ./install.sh            # install into ~/.config/opencode/ (global) (default)
#   ./install.sh --no-install  # skip running bun/npm after merging package.json
# ---------------------------------------------------------------------------

PLUGIN_FILE="github-copilot-usage.tsx"
PLUGIN_NAME="github-copilot-usage"

NO_INSTALL=false

# Parse args (only --no-install is supported; installer defaults to global)
for arg in "$@"; do
  case "$arg" in
    --no-install) NO_INSTALL=true ;;
    *) echo "Unknown arg: $arg" ;;
  esac
done

CONFIG_DIR="$HOME/.config/opencode"
echo "Installing globally into $CONFIG_DIR"

PLUGINS_DIR="$CONFIG_DIR/plugins"
TUI_JSON="$CONFIG_DIR/tui.json"
PKG_JSON="$CONFIG_DIR/package.json"
PLUGIN_DEST="$PLUGINS_DIR/$PLUGIN_FILE"
PLUGIN_REF="./plugins/$PLUGIN_FILE"

# 1. Create directories
mkdir -p "$PLUGINS_DIR"

# 2. Copy plugin file
cp "$(dirname "$0")/$PLUGIN_FILE" "$PLUGIN_DEST"
echo "Copied $PLUGIN_FILE -> $PLUGIN_DEST"

# 3. Patch tui.json — add plugin ref if not already present
if [[ -f "$TUI_JSON" ]]; then
  # Check if already registered
  if grep -qF "$PLUGIN_REF" "$TUI_JSON" 2>/dev/null; then
    echo "tui.json: $PLUGIN_NAME already registered, skipping"
  else
    # Append to existing plugin array using node (available everywhere bun/node is)
    node - "$TUI_JSON" "$PLUGIN_REF" <<'EOF'
const fs = require("fs")
const [,, file, ref] = process.argv
const obj = JSON.parse(fs.readFileSync(file, "utf-8"))
if (!Array.isArray(obj.plugin)) obj.plugin = []
obj.plugin.push(ref)
fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n")
console.log("tui.json: added", ref)
EOF
  fi
else
  # Create fresh tui.json (only create what we need — do not overwrite user files)
  mkdir -p "$(dirname "$TUI_JSON")"
  printf '{\n  "plugin": ["%s"]\n}\n' "$PLUGIN_REF" > "$TUI_JSON"
  echo "tui.json: created with $PLUGIN_NAME"
fi

# 4. Patch package.json — merge in required dependencies
DEPS='{"@opencode-ai/plugin":"1.3.13","@opentui/solid":"0.1.96","solid-js":"1.9.10"}'

if [[ -f "$PKG_JSON" ]]; then
  node - "$PKG_JSON" "$DEPS" <<'EOF'
const fs = require("fs")
const [,, file, depsJson] = process.argv
const obj = JSON.parse(fs.readFileSync(file, "utf-8"))
const extra = JSON.parse(depsJson)
obj.dependencies = Object.assign({}, obj.dependencies, extra)
fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n")
console.log("package.json: dependencies merged")
EOF
else
  # Only create package.json with dependencies; do not add other fields so we don't overwrite user intent
  mkdir -p "$(dirname "$PKG_JSON")"
  printf '{\n  "dependencies": %s\n}\n' "$DEPS" > "$PKG_JSON"
  echo "package.json: created"
fi

# 5. Install dependencies
if $NO_INSTALL; then
  echo "Skipping dependency installation (--no-install)"
else
  echo "Installing dependencies..."
  if command -v bun &>/dev/null; then
    bun install --cwd "$CONFIG_DIR"
  elif command -v npm &>/dev/null; then
    npm install --prefix "$CONFIG_DIR" --legacy-peer-deps
  else
    echo "WARNING: neither bun nor npm found — please run 'npm install' inside $CONFIG_DIR manually"
  fi
fi

echo ""
echo "Done. Restart opencode to activate the github-copilot-usage plugin."
