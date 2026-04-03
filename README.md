# github-copilot-usage

An [OpenCode](https://opencode.ai) TUI plugin that displays your GitHub Copilot quota usage in the sidebar.

## What it shows

```
Copilot Usage
12.34% (123/1000)
```

- **Bold** title: `Copilot Usage`
- Second line: `<used_pct>% (<used>/<total>)` — percentage of quota consumed
- Refreshes automatically after each session goes idle

## Requirements

- OpenCode 1.3.13+
- `node` or `bun` in PATH (for install script)

## Install



The installer installs globally into `$HOME/.config/opencode` by default.

Run:

```sh
./install.sh
```

If you prefer to merge files but skip network installs, use `--no-install`.

The script will only merge/append into existing `tui.json` and `package.json` files — it will not overwrite them. It will:
1. Copy `github-copilot-usage.tsx` into the target `plugins/` directory
2. Add the plugin path to `tui.json` if missing
3. Merge required dependencies into `package.json` (adding missing entries)
4. Optionally run `bun install` / `npm install` to fetch them (unless `--no-install` is used)

Restart OpenCode after installation.

## Uninstall

1. Remove `github-copilot-usage.tsx` from `<config-dir>/plugins/`
2. Remove the `./plugins/github-copilot-usage.tsx` entry from `<config-dir>/tui.json`
3. Optionally remove unused deps from `<config-dir>/package.json`

## Files

```
plugin/github-copilot-usage/
├── github-copilot-usage.tsx   # TUI plugin source
├── package.json        # dependency declarations
├── install.sh          # install script
└── README.md
```
