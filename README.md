# github-copilot-usage

An OpenCode V2 CLI plugin that displays GitHub Copilot premium request usage in
the session sidebar:

```text
Copilot 12.30% (123/1000)
```

- Shows consumed premium quota, or `∞` for unlimited accounts.
- Refreshes on startup and after session execution succeeds or fails.
- `/copilot-refresh`, the **Refresh Copilot quota** palette command, and
  `Ctrl+Shift+U` refresh manually.
- Displays safe error messages for missing sign-in, denied access, or an
  unsupported GitHub response instead of silently displaying `-`.
- No model multiplier display or model-list requests.

## Requirements

- OpenCode **2.1.3+** and a signed-in GitHub Copilot OAuth account.
- The sidebar must be visible to see the usage. Manual refresh also shows a toast.
- GitHub's internal quota API must be accessible for your account. This is an
  undocumented endpoint and its response can change.

## Install

Place this directory at `~/.config/opencode/plugins/github-copilot-usage`, and add
it to the global `cli.json` (preserve your other settings):

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "plugins": ["./plugins/github-copilot-usage"]
}
```

Or run `./install.sh`. The installer registers the directory in `cli.json`, does
not modify `tui.json` or global dependencies, and refuses to overwrite differing
plugin files. `--no-install` is still accepted but is no longer necessary.
OpenCode supplies the plugin, Solid and OpenTUI runtime; no npm install is needed.

Keep `tui.tsx` in the plugin directory for conventional local entrypoint loading.
This private local package uses conventional filenames without `exports`:
`tui.tsx` for the terminal and a no-op `index.ts` for the server. Do not point
`main` or a `.` export at TUI code, because OpenCode 2.2 also discovers this
directory on the server, where the Solid/OpenTUI runtime is unavailable.
Keep `index.ts` alongside the TUI files.

Changes reload automatically. Use `/reload` if a full reload is needed.

## Credentials and privacy

The plugin reads the active `github-copilot` OAuth credential using the connected
V2 server's client API; it does not read the legacy `auth.json`. The GitHub OAuth
refresh token is sent only to `https://api.github.com/copilot_internal/user`.
Credentials and raw API errors/responses are never logged or persisted. Requests
time out after 15 seconds and are cancelled when the plugin unloads.

With a remote OpenCode server, quota requests still run on the local CLI, using
that server's active Copilot credential. Only enable this plugin on a trusted CLI.

## Tests

With Node 22.18+ (built-in TypeScript support):

```sh
npm test
```

Tests use mocked GitHub responses, not real credentials.

## Code layout

- `tui.tsx`: sidebar, refresh command, and refresh lifecycle.
- `usage.ts`: credential selection, GitHub requests, quota formatting, and safe errors.
- `index.ts`: no-op server entry; never imports TUI code.
- `usage.test.ts`: entrypoint separation, authentication, quota, and error tests.

## Uninstall

Remove the plugin entry from `cli.json`, reload, and optionally
remove this plugin directory. This plugin does not need an entry in `tui.json` or
`opencode.json(c)`.
