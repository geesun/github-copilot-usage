import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"
import { fetchQuota, formatQuota, UsageError } from "./usage.ts"

test("local directory keeps server and TUI entrypoints separate", () => {
  const entrypoint = new URL("./tui.tsx", import.meta.url)
  assert.ok(existsSync(entrypoint), "The TUI entry must exist")
  assert.match(readFileSync(entrypoint, "utf8"), /export \{ default \} from "\.\/github-copilot-usage\.tsx"/)
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
  assert.equal(pkg.exports, undefined, "Local loading uses conventional index.ts and tui.tsx entries")
  const server = readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  assert.match(server, /from "@opencode\/plugin"/)
  assert.doesNotMatch(server, /@opentui|solid-js|\.tsx/)
  assert.equal(pkg.main, undefined, "No legacy main entry may point at TUI code")
})

test("formats premium usage, unlimited, zero and excess usage", () => {
  const quota = (entitlement: number, remaining: number) => ({ quota_snapshots: { premium_interactions: { entitlement, remaining } } })
  assert.equal(formatQuota(quota(1000, 877)), "12.30% (123/1000)")
  assert.equal(formatQuota(quota(0, 0)), "0.00% (0/0)")
  assert.equal(formatQuota(quota(100, 110)), "0.00% (0/100)")
  assert.equal(formatQuota(quota(100, -5)), "105.00% (105/100)")
  assert.equal(formatQuota({ quota_snapshots: { premium_interactions: { unlimited: true } } }), "∞")
})

test("rejects missing or malformed quota instead of showing a false zero", () => {
  for (const value of [{}, { quota_snapshots: { premium_interactions: {} } },
    { quota_snapshots: { premium_interactions: { entitlement: NaN, remaining: 1 } } }]) {
    assert.throws(() => formatQuota(value), UsageError)
  }
})

test("quota request uses GitHub only, forwards cancellation and surfaces safe errors", async (t) => {
  const signal = new AbortController().signal
  const fetch = t.mock.method(globalThis, "fetch", async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(url, "https://api.github.com/copilot_internal/user")
    assert.equal(options?.signal, signal)
    assert.equal(options?.redirect, "error")
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer test-token")
    return Response.json({ quota_snapshots: { premium_interactions: { entitlement: 100, remaining: 75 } } })
  })
  assert.equal(await fetchQuota("test-token", signal), "25.00% (25/100)")
  for (const status of [401, 403, 429, 500]) {
    fetch.mock.mockImplementation(async () => new Response("secret response", { status }))
    await assert.rejects(fetchQuota("test-token", signal), (error: unknown) => {
      assert.ok(error instanceof UsageError)
      assert.doesNotMatch(error.message, /test-token|secret response/)
      return true
    })
  }
})
