#!/usr/bin/env bash
set -euo pipefail

# OpenCode V2 supplies the plugin/Solid/OpenTUI runtime. No npm install needed.
# --no-install remains accepted for compatibility with old instructions.
for arg in "$@"; do
  case "$arg" in
    --no-install) ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

SOURCE_DIR="$(cd "$(dirname "$0")" && pwd -P)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
DEST_DIR="$CONFIG_DIR/plugins/github-copilot-usage"
mkdir -p "$DEST_DIR"
DEST_REAL="$(cd "$DEST_DIR" && pwd -P)"

if [[ "$SOURCE_DIR" != "$DEST_REAL" ]]; then
  for file in index.ts tui.tsx github-copilot-usage.tsx usage.ts package.json; do
    # Do not overwrite an existing local plugin with unrelated edits.
    if [[ -e "$DEST_DIR/$file" ]] && ! cmp -s "$SOURCE_DIR/$file" "$DEST_DIR/$file"; then
      echo "Refusing to overwrite $DEST_DIR/$file; back it up or update it manually." >&2
      exit 1
    fi
  done
  for file in index.ts tui.tsx github-copilot-usage.tsx usage.ts package.json; do
    cp "$SOURCE_DIR/$file" "$DEST_DIR/$file"
  done
fi

node --input-type=commonjs - "$CONFIG_DIR/cli.json" <<'NODE'
const fs = require("node:fs")
const file = process.argv[2]
const ref = "./plugins/github-copilot-usage"
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {
  $schema: "https://opencode.ai/v2/cli.json",
}
if (config.plugins !== undefined && !Array.isArray(config.plugins)) {
  throw new Error("cli.json plugins must be an array; no changes written")
}
config.plugins ??= []
if (!config.plugins.some((entry) => entry === ref || entry?.package === ref)) {
  config.plugins.push(ref)
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n")
}
console.log("Configured Copilot Usage in", file)
NODE

echo "Reopen the OpenCode terminal UI to load the plugin."
