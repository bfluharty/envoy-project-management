import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { v4 as uuidv4 } from 'uuid'
import RateLimitService, { RateLimitExceededError } from '#services/rate_limit_service'
import type { RateLimitRule } from '#services/rate_limit_service'

test.group('RateLimitService', () => {
  test('does not enforce rules outside prod unless forced', async () => {
    const rule: RateLimitRule = {
      name: 'test_disabled_limit',
      bucketKey: 'test:disabled-limit',
      limit: 1,
      windowSeconds: 3600,
    }

    await RateLimitService.enforce([rule])
    await RateLimitService.enforce([rule])
  })

  test('increments Postgres buckets atomically and reports retry metadata', async () => {
    const now = new Date('2026-06-23T12:34:00.000Z')
    const bucketKey = `test:forced-limit:${uuidv4()}`
    const rule: RateLimitRule = {
      name: 'test_forced_limit',
      bucketKey,
      limit: 2,
      windowSeconds: 3600,
    }

    await RateLimitService.enforce([rule], { now, force: true })
    await RateLimitService.enforce([rule], { now, force: true })

    await assert.rejects(
      () => RateLimitService.enforce([rule], { now, force: true }),
      (error: unknown) => {
        assert.ok(error instanceof RateLimitExceededError)
        assert.equal(error.limitName, 'test_forced_limit')
        assert.equal(error.limit, 2)
        assert.equal(error.count, 3)
        assert.equal(error.retryAfterSeconds, 1560)
        return true
      }
    )
  })
})
