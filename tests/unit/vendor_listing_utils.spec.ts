import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { getPostalCodesWithinRadius, normalizeUsPostalCode } from '#utils/vendor_listing_utils'

test.group('vendor listing location utilities', () => {
  test('normalizes five-digit and ZIP+4 postal codes', () => {
    assert.equal(normalizeUsPostalCode(' 23220 '), '23220')
    assert.equal(normalizeUsPostalCode('23220-1234'), '23220')
    assert.equal(normalizeUsPostalCode('not-a-zip'), null)
  })

  test('finds ZIP codes within 50 miles of the requested ZIP', () => {
    const nearbyPostalCodes = getPostalCodesWithinRadius('23220')

    assert.equal(nearbyPostalCodes[0], '23220')
    assert.equal(nearbyPostalCodes.includes('23173'), true)
    assert.equal(nearbyPostalCodes.includes('90210'), false)
  })

  test('returns no ZIP codes for invalid input', () => {
    assert.deepEqual(getPostalCodesWithinRadius('invalid'), [])
  })
})
