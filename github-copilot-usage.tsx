/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { fetchQuota, UsageError } from "./usage.ts"

const USAGE_COLOR = "#e5c98b"

export default Plugin.define({
  id: "github-copilot-usage",
  setup(context) {
    const [label, setLabel] = createSignal("Loading...")
    const controller = new AbortController()
    let pending: Promise<void> | undefined

    const refresh = (notify = false): Promise<void> => {
      if (pending) return pending
      setLabel("Loading...")
      pending = (async () => {
        try {
          // V2 stores credentials on the connected server, not in auth.json.
          // Never log or persist the returned credentials.
          const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
          const credentials = await context.client.credential.list({ signal })
          const credential = credentials.find((entry) => entry.integrationID === "github-copilot" && entry.active)
          if (credential?.value.type !== "oauth" || !credential.value.refresh) {
            throw new UsageError("Sign in to GitHub Copilot first")
          }
          const value = await fetchQuota(credential.value.refresh, signal)
          if (controller.signal.aborted) return
          setLabel(value)
          if (notify) context.ui.toast.show({ title: "Copilot Usage", message: value, variant: "success" })
        } catch (cause) {
          if (controller.signal.aborted) return
          // Do not expose SDK/fetch errors: they may contain request headers.
          const message = cause instanceof UsageError ? cause.message : "Refresh failed; check connection and Copilot sign-in"
          setLabel(message)
          if (notify) context.ui.toast.show({ title: "Copilot Usage", message, variant: "error" })
        }
      })().finally(() => {
        pending = undefined
      })
      return pending
    }

    context.ui.slot({
      append: "sidebar.content",
      render: () => (
        <text fg={USAGE_COLOR}><b>Copilot</b> {label()}</text>
      ),
    })

    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "plugin.github-copilot-usage.refresh",
        title: "Refresh Copilot quota",
        group: "Copilot",
        palette: true,
        slash: { name: "copilot-refresh" },
        bind: "ctrl+shift+u",
        run: () => refresh(true),
      }],
      bindings: ["plugin.github-copilot-usage.refresh"],
    }))

    const stop = [
      context.data.on("session.execution.succeeded", () => { void refresh() }),
      context.data.on("session.execution.failed", () => { void refresh() }),
    ]
    void refresh()

    return () => {
      controller.abort()
      stop.forEach((unsubscribe) => unsubscribe())
    }
  },
})
