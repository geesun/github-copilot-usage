/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createSignal } from "solid-js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

const QUOTA_URL = "https://api.github.com/copilot_internal/user"
const MODELS_URL = "https://api.githubcopilot.com/models"

type ModelBilling = {
  id: string
  name: string
  multiplier: number
  is_premium: boolean
}

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

  const resp = await fetch(QUOTA_URL, {
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

async function fetchModels(): Promise<ModelBilling[]> {
  const tok = token()
  if (!tok) return []

  const resp = await fetch(MODELS_URL, {
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: "application/json",
      "X-GitHub-Api-Version": "2025-10-01",
      "Copilot-Integration-Id": "vscode-chat",
      "Editor-Version": "vscode/1.100.0",
      "Editor-Plugin-Version": "copilot-chat/0.43.0",
    },
  })
  if (!resp.ok) return []

  const data = await resp.json()
  if (!Array.isArray(data?.data)) return []

  // Deduplicate by id, keep first occurrence
  const seen = new Set<string>()
  const models: ModelBilling[] = []
  for (const m of data.data) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    models.push({
      id: m.id,
      name: m.name ?? m.id,
      multiplier: m.billing?.multiplier ?? 0,
      is_premium: m.billing?.is_premium ?? false,
    })
  }
  // Sort: premium (high multiplier) first, then by multiplier desc
  models.sort((a, b) => b.multiplier - a.multiplier)
  return models
}

function getCurrentModelID(api: any): string | null {
  // 1. Try to get from current session's latest user message
  const route = api.route.current
  if (route.name === "session") {
    const sid = route.params.sessionID
    const msgs = api.state.session.messages(sid)
    if (msgs && msgs.length > 0) {
      // Find latest user message with model info
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i]
        if (m.role === "user" && m.model?.modelID) {
          return m.model.modelID
        }
      }
    }
  }
  // 2. Fall back to config model
  const configModel = api.state.config?.model
  if (configModel) {
    // Format is "provider/model", extract model part
    const parts = configModel.split("/")
    return parts.length > 1 ? parts.slice(1).join("/") : configModel
  }
  return null
}

const tui: TuiPlugin = async (api) => {
  const [label, setLabel] = createSignal("...")
  const [allModels, setAllModels] = createSignal<ModelBilling[]>([])
  const [expanded, setExpanded] = createSignal(false)

  const loadQuota = () => {
    setLabel("⟳")
    quota().then((x) => setLabel(x || "-")).catch(() => setLabel("-"))
  }

  const loadModels = () => {
    fetchModels()
      .then((models) => {
        setAllModels(models)
      })
      .catch(() => {})
  }

  loadQuota()
  loadModels()

  api.event.on("session.status", (e: any) => {
    if (e.properties.status?.type !== "idle") return
    loadQuota()
  })

  api.slots.register({
    order: 900,
    slots: {
      session_prompt_right() {
        const multiplier = () => {
          const modelID = getCurrentModelID(api)
          const models = allModels()
          if (!modelID || models.length === 0) return "..."
          const found = models.find((m) => m.id === modelID)
          return found ? `×${found.multiplier}` : "×?"
        }
        return (
          <text fg="red" bold>
            {multiplier()}
          </text>
        )
      },
      sidebar_content(ctx: any) {
        const models = allModels()
        const modelID = getCurrentModelID(api)
        return (
          <box flexDirection="column">
            <text fg={ctx.theme.current.text}><b>Copilot Usage</b></text>
            <text fg={ctx.theme.current.textMuted}>{label()}</text>
            {expanded() && models.length > 0 && (
              <box flexDirection="column">
                <text fg={ctx.theme.current.textMuted}> </text>
                <text fg={ctx.theme.current.text} bold>Model Multipliers</text>
                {models.map((m) => {
                  const mul = `×${m.multiplier}`
                  const padded = mul.padEnd(6)
                  return (
                    <text
                      fg={m.id === modelID ? ctx.theme.current.warning : ctx.theme.current.textMuted}
                    >
                      {m.id === modelID ? "→ " : "  "}{padded}{m.name}
                    </text>
                  )
                })}
              </box>
            )}
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
        loadQuota()
        loadModels()
      },
    },
    {
      title: expanded() ? "Collapse model multipliers" : "Expand model multipliers",
      value: "plugin.github-copilot-usage.toggle-models",
      category: "Plugin",
      slash: {
        name: "copilot-models",
      },
      onSelect: () => {
        setExpanded(!expanded())
      },
    },
  ])
}

const plugin: TuiPluginModule & { id: string } = {
  id: "github-copilot-usage",
  tui,
}

export default plugin
