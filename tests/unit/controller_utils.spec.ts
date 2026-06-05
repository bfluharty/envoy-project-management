import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { isOnlyActivatingRecord } from '#utils/controller_utils'

test.group('isOnlyActivatingRecord', () => {
  test('true when sole defined key is isActive: true', () => {
    assert.equal(isOnlyActivatingRecord({ isActive: true }), true)
  })

  test('true when other keys are undefined', () => {
    assert.equal(
      isOnlyActivatingRecord({ isActive: true, title: undefined, vendors: undefined }),
      true
    )
  })

  test('false when isActive is false', () => {
    assert.equal(isOnlyActivatingRecord({ isActive: false }), false)
  })

  test('false when other defined keys are present', () => {
    assert.equal(isOnlyActivatingRecord({ isActive: true, title: 'x' }), false)
  })

  test('false when isActive missing', () => {
    assert.equal(isOnlyActivatingRecord({ title: 'x' }), false)
  })

  test('false for empty object', () => {
    assert.equal(isOnlyActivatingRecord({}), false)
  })

  test('false for null/non-object input', () => {
    assert.equal(isOnlyActivatingRecord(null as any), false)
    assert.equal(isOnlyActivatingRecord(undefined as any), false)
  })
})
