const QUOTA_URL = "https://api.github.com/copilot_internal/user"

export class UsageError extends Error {}

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
  const total = quota.entitlement
  const remaining = quota.remaining
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
