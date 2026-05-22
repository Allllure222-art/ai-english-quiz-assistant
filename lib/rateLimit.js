const dailyUsage = new Map()
/** MVP：进程内 Map；多实例/重启会重置。上线规模化可迁移 Redis（本期不实施）。 */

// In development, use a higher limit to avoid blocking frequent test runs.
const DAILY_LIMIT_GUEST = process.env.NODE_ENV === 'development' ? 30 : 3
const DAILY_LIMIT_USER = 20

function getTodayKey() {
    return new Date().toISOString().slice(0, 10)
}

export function buildUsageKey({ userId, ip, userAgent }) {
    if (userId) return `user:${userId}`
    return `guest:${ip || 'unknown'}:${userAgent || 'unknown'}`
}

export function consumeDailyQuota(usageKey, isLoggedIn) {
    const date = getTodayKey()
    const mapKey = `${usageKey}:${date}`
    const current = dailyUsage.get(mapKey) || 0
    const limit = isLoggedIn ? DAILY_LIMIT_USER : DAILY_LIMIT_GUEST

    if (current >= limit) {
        return { allowed: false, remaining: 0, limit }
    }

    dailyUsage.set(mapKey, current + 1)
    return { allowed: true, remaining: limit - (current + 1), limit }
}
