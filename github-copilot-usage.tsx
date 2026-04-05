/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const URL = "https://api.github.com/copilot_internal/user"

function token(): string | null {
  try {
    const file = path.join(os.homedir(), ".local", "share", "opencode", "auth.json")
    const auth = JSON.parse(fs.readFileSync(file, "utf-8"))
    return auth?.["github-copilot"]?.refresh ?? null
  } catch {
    return null
  }
}

async function quota(): Promise<string> {
  const tok = token()
  if (!tok) return ""

  const resp = await fetch(URL, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${tok}`,
      "X-GitHub-Api-Version": "2026-03-10",
    },
  })
  if (!resp.ok) return ""

  const data = await resp.json()
  const q = data?.quota_snapshots?.premium_interactions
  if (!q) return ""
  if (q.unlimited) return "∞"

  const total: number = q.entitlement ?? 0
  const left: number = q.remaining ?? 0
  const used = Math.max(0, total - left)
  const pct = total ? ((used / total) * 100).toFixed(2) : "0.00"
  return `${pct}% (${used}/${total})`
}

const tui: TuiPlugin = async (api) => {
  const [label, setLabel] = createSignal("...")

  const load = () => {
    setLabel("⟳")
    quota().then((x) => setLabel(x || "-")).catch(() => setLabel("-"))
  }

  load()

  api.event.on("session.status", (e) => {
    if (e.properties.status?.type !== "idle") return
    load()
  })

  api.slots.register({
    order: 900,
    slots: {
      sidebar_content(ctx) {
        return (
          <box flexDirection="column">
            <text fg={ctx.theme.current.text}><b>Copilot Usage</b></text>
            <text fg={ctx.theme.current.textMuted}>{label()}</text>
          </box>
        )
      },
    },
  })

  // Register command and keybind to refresh quota
  const keybind = api.keybind.create({
    refresh: "ctrl+shift+u",
  })

  api.command.register(() => [
    {
      title: "Refresh Copilot quota",
      value: "plugin.github-copilot-usage.refresh",
      keybind: keybind.get("refresh"),
      category: "Plugin",
      slash: {
        name: "copilot-refresh",
      },
      onSelect: () => {
        load()
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "github-copilot-usage",
  tui,
}

export default plugin
