const QUOTA_URL = "https://api.github.com/copilot_internal/user"

export class UsageError extends Error {}

type Credentials = {
  list(options: { signal: AbortSignal }): Promise<readonly {
    integrationID: string
    active: boolean
    value: { type: string; refresh?: string }
  }[]>
}

export async function loadQuota(credentials: Credentials, signal: AbortSignal): Promise<string> {
  const entries = await credentials.list({ signal })
  const value = entries.find((entry) => entry.integrationID === "github-copilot" && entry.active)?.value
  if (value?.type !== "oauth" || !value.refresh) throw new UsageError("Sign in to GitHub Copilot first")
  return fetchQuota(value.refresh, signal)
}

export function quotaError(cause: unknown): string {
  // SDK/fetch errors may contain credentials; only expose our own messages.
  return cause instanceof UsageError ? cause.message : "Refresh failed; check connection and Copilot sign-in"
}

type QuotaResponse = {
  quota_snapshots?: {
    premium_interactions?: {
      unlimited?: boolean
      entitlement?: number
      remaining?: number
    }
  }
}

export function formatQuota(data: QuotaResponse): string {
  const quota = data?.quota_snapshots?.premium_interactions
  if (!quota) throw new UsageError("Premium quota unavailable for this account")
  if (quota.unlimited) return "∞"
  const { entitlement: total, remaining } = quota
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0 ||
      typeof remaining !== "number" || !Number.isFinite(remaining)) {
    throw new UsageError("GitHub returned an unsupported quota format")
  }
  const used = Math.max(0, total - remaining)
  const percent = total ? ((used / total) * 100).toFixed(2) : "0.00"
  return `${percent}% (${used}/${total})`
}

export async function fetchQuota(token: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(QUOTA_URL, {
    signal,
    redirect: "error",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (response.status === 401) throw new UsageError("GitHub sign-in expired; reconnect Copilot")
  if (response.status === 403) throw new UsageError("GitHub denied quota access (403)")
  if (!response.ok) throw new UsageError(`GitHub quota request failed (HTTP ${response.status})`)
  return formatQuota(await response.json() as QuotaResponse)
}
