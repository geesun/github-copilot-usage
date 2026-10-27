/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal } from "solid-js"
import { loadQuota, quotaError } from "./usage.ts"

const USAGE_COLOR = "#e5c98b"

export default Plugin.define({
  id: "github-copilot-usage",
  setup(context) {
    const [label, setLabel] = createSignal("Loading...")
    const controller = new AbortController()
    let pending: Promise<void> | undefined

    async function update(notify: boolean) {
      let message: string
      let variant: "success" | "error" = "success"
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
        message = await loadQuota(context.client.credential, signal)
      } catch (cause) {
        message = quotaError(cause)
        variant = "error"
      }
      if (controller.signal.aborted) return
      setLabel(message)
      if (notify) context.ui.toast.show({ title: "Copilot Usage", message, variant })
    }

    const refresh = (notify = false): Promise<void> => {
      if (pending) return pending
      setLabel("Loading...")
      pending = update(notify).finally(() => {
        pending = undefined
      })
      return pending
    }

    context.ui.slot({
      append: "sidebar.content",
      render: () => <text fg={USAGE_COLOR}><b>Copilot</b> {label()}</text>,
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

    const stop = (["session.execution.succeeded", "session.execution.failed"] as const)
      .map((event) => context.data.on(event, () => { void refresh() }))
    void refresh()

    return () => {
      controller.abort()
      stop.forEach((unsubscribe) => unsubscribe())
    }
  },
})
