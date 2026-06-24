import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { parseDate, parseDateFields } from '#utils/date_helper'

test.group('parseDate', () => {
  test('returns undefined for undefined input', () => {
    assert.equal(parseDate(undefined), undefined)
  })

  test('returns undefined for empty string', () => {
    assert.equal(parseDate(''), undefined)
  })

  test('strips time component from ISO datetime', () => {
    assert.equal(parseDate('2026-06-04T12:34:56.000Z'), '2026-06-04')
  })

  test('passes through bare date string', () => {
    assert.equal(parseDate('2026-06-04'), '2026-06-04')
  })

  test('does not validate format — returns first T-separated chunk', () => {
    assert.equal(parseDate('not-a-date'), 'not-a-date')
  })
})

test.group('parseDateFields', () => {
  function buildRequest(body: Record<string, any>) {
    return { all: () => body } as any
  }

  test('extracts date portions of startDate, endDate, deadline', () => {
    const result = parseDateFields(
      buildRequest({
        title: 'Test',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-06-01T12:00:00.000Z',
        deadline: '2026-05-01',
      })
    )

    assert.equal(result.title, 'Test')
    assert.equal(result.startDate, '2026-01-01')
    assert.equal(result.endDate, '2026-06-01')
    assert.equal(result.deadline, '2026-05-01')
  })

  test('leaves dates undefined when absent', () => {
    const result = parseDateFields(buildRequest({ title: 'Test' }))
    assert.equal(result.title, 'Test')
    assert.equal(result.startDate, undefined)
    assert.equal(result.endDate, undefined)
    assert.equal(result.deadline, undefined)
  })

  test('preserves other fields from body', () => {
    const result = parseDateFields(
      buildRequest({
        title: 'Test',
        budgetAmount: 100,
        vendors: ['v1', 'v2'],
      })
    )
    assert.equal(result.budgetAmount, 100)
    assert.deepEqual(result.vendors, ['v1', 'v2'])
  })
})
