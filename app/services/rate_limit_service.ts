import db from '@adonisjs/lucid/services/db'
import env from '#start/env'

export type RateLimitRule = {
  bucketKey: string
  limit: number
  windowSeconds: number
  name: string
}

type IncrementResult = {
  request_count: string | number
}

type EnforceOptions = {
  now?: Date
  force?: boolean
}

export class RateLimitExceededError extends Error {
  public readonly limitName: string
  public readonly limit: number
  public readonly count: number
  public readonly retryAfterSeconds: number
  public readonly resetAt: Date

  constructor(input: {
    limitName: string
    limit: number
    count: number
    retryAfterSeconds: number
    resetAt: Date
  }) {
    super('Too many requests')
    this.name = 'RateLimitExceededError'
    this.limitName = input.limitName
    this.limit = input.limit
    this.count = input.count
    this.retryAfterSeconds = input.retryAfterSeconds
    this.resetAt = input.resetAt
  }
}

export default class RateLimitService {
  public static isEnabled() {
    return env.get('APP_ENV') === 'prod'
  }

  public static async enforce(rules: RateLimitRule[], options: EnforceOptions = {}) {
    if (!options.force && !this.isEnabled()) {
      return
    }

    const now = options.now ?? new Date()
    for (const rule of rules) {
      await this.enforceRule(rule, now)
    }
  }

  private static async enforceRule(rule: RateLimitRule, now: Date) {
    const windowMs = rule.windowSeconds * 1000
    const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs)
    const resetAt = new Date(windowStart.getTime() + windowMs)

    const result = await db.rawQuery(
      `
        INSERT INTO envoy_schema.rate_limit_buckets
          (bucket_key, window_start, window_seconds, request_count, created_timestamp, updated_timestamp)
        VALUES
          (?, ?::timestamptz, ?, 1, NOW(), NOW())
        ON CONFLICT (bucket_key, window_start, window_seconds)
        DO UPDATE SET
          request_count = envoy_schema.rate_limit_buckets.request_count + 1,
          updated_timestamp = NOW()
        RETURNING request_count
      `,
      [rule.bucketKey, windowStart.toISOString(), rule.windowSeconds]
    )

    const row = (result.rows?.[0] ?? {}) as IncrementResult
    const count = Number(row.request_count ?? 0)
    if (count <= rule.limit) {
      return
    }

    throw new RateLimitExceededError({
      limitName: rule.name,
      limit: rule.limit,
      count,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
      resetAt,
    })
  }
}
