import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import VendorSearchService from '#services/vendor_search_service'

test.group('VendorSearchService', (group) => {
  group.each.teardown(() => {
    VendorSearchService.resetClientForTesting()
  })

  test('calls Foursquare place search with required vendor discovery options', async () => {
    const calls: unknown[] = []

    VendorSearchService.setClientForTesting({
      auth() {
        return this
      },
      async placeSearch(metadata) {
        calls.push(metadata)
        return { data: { results: [] } }
      },
    })

    const results = await VendorSearchService.searchPlaces('commercial electrician', '23220')

    assert.deepEqual(results, [])
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      'query': 'commercial electrician',
      'near': '23220',
      'tel_format': 'E164',
      'sort': 'RELEVANCE',
      'limit': 50,
      'X-Places-Api-Version': '2025-06-17',
    })
  })

  test('adds comma-separated Foursquare category IDs when provided', async () => {
    const calls: unknown[] = []

    VendorSearchService.setClientForTesting({
      auth() {
        return this
      },
      async placeSearch(metadata) {
        calls.push(metadata)
        return { data: { results: [] } }
      },
    })

    await VendorSearchService.searchPlaces('commercial electrician', '23220', [
      'electrician-category-id',
      'lighting-category-id',
    ])

    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], {
      'query': 'commercial electrician',
      'near': '23220',
      'tel_format': 'E164',
      'sort': 'RELEVANCE',
      'limit': 50,
      'X-Places-Api-Version': '2025-06-17',
      'fsq_category_ids': 'electrician-category-id,lighting-category-id',
    })
  })
})
