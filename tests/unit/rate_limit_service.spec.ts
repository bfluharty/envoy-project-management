import { test } from '@japa/runner'
import type { RateLimitRule } from '#services/rate_limit_service'
import RateLimitService from '#services/rate_limit_service'

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
})
