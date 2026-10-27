import { Plugin } from "@opencode/plugin"

// Global discovery also loads the server part; keep TUI dependencies out of it.
export default Plugin.define({
  id: "github-copilot-usage",
  setup() {},
})
