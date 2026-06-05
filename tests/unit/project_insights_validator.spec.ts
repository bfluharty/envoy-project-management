import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import {
  applyProjectInsightsParamsValidator,
  applyProjectInsightsValidator,
} from '#validators/project_insights_validator'

const VALID_PROJECT_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_INSIGHT_UUID = '22222222-2222-4222-8222-222222222222'

async function assertValidationRejects(callback: () => Promise<unknown>) {
  await assert.rejects(callback)
}

test.group('applyProjectInsightsParamsValidator', () => {
  test('accepts a valid project uuid', async () => {
    const result = await applyProjectInsightsParamsValidator.validate({
      projectUuid: VALID_PROJECT_UUID,
    })

    assert.deepEqual(result, { projectUuid: VALID_PROJECT_UUID })
  })

  test('rejects an invalid project uuid', async () => {
    await assertValidationRejects(() =>
      applyProjectInsightsParamsValidator.validate({ projectUuid: 'not-a-uuid' })
    )
  })

  test('rejects a missing project uuid', async () => {
    await assertValidationRejects(() => applyProjectInsightsParamsValidator.validate({}))
  })
})

test.group('applyProjectInsightsValidator', () => {
  test('accepts an empty body because both arrays are optional', async () => {
    const result = await applyProjectInsightsValidator.validate({})

    assert.deepEqual(result, {})
  })

  test('accepts and trims complete new insight and update payloads', async () => {
    const result = await applyProjectInsightsValidator.validate({
      new_insights: [
        {
          insight_type: ' project_fact ',
          insight_text: ' The project is in Richmond. ',
          importance: 5,
          confidence: 0,
        },
        {
          insight_type: 'risk_or_blocker',
          insight_text: 'Permit approval is pending.',
          confidence: 1,
        },
      ],
      updates: [
        {
          existing_insight_uuid: VALID_INSIGHT_UUID,
          operation: ' SUPERSEDED ',
          replacement_insight: {
            insight_type: ' project_constraint ',
            insight_text: ' Budget is now $40,000. ',
            importance: 1,
            confidence: 0.96,
          },
        },
        {
          existing_insight_uuid: '33333333-3333-4333-8333-333333333333',
          operation: 'CONTRADICTED',
        },
        {
          existing_insight_uuid: '44444444-4444-4444-8444-444444444444',
          operation: 'ARCHIVED',
        },
      ],
    })

    assert.deepEqual(result, {
      new_insights: [
        {
          insight_type: 'project_fact',
          insight_text: 'The project is in Richmond.',
          importance: 5,
          confidence: 0,
        },
        {
          insight_type: 'risk_or_blocker',
          insight_text: 'Permit approval is pending.',
          confidence: 1,
        },
      ],
      updates: [
        {
          existing_insight_uuid: VALID_INSIGHT_UUID,
          operation: 'superseded',
          replacement_insight: {
            insight_type: 'project_constraint',
            insight_text: 'Budget is now $40,000.',
            importance: 1,
            confidence: 0.96,
          },
        },
        {
          existing_insight_uuid: '33333333-3333-4333-8333-333333333333',
          operation: 'contradicted',
        },
        {
          existing_insight_uuid: '44444444-4444-4444-8444-444444444444',
          operation: 'archived',
        },
      ],
    })
  })

  test('rejects non-array new_insights and updates', async () => {
    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        new_insights: {},
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: {},
      })
    )
  })

  test('rejects invalid new insight text fields', async () => {
    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        new_insights: [
          {
            insight_type: '',
            insight_text: 'Valid text.',
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        new_insights: [
          {
            insight_type: 'project_fact',
            insight_text: ' '.repeat(2),
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        new_insights: [
          {
            insight_type: 'project_fact',
            insight_text: 'x'.repeat(501),
          },
        ],
      })
    )
  })

  test('rejects invalid new insight importance values', async () => {
    for (const importance of [0, 6, 1.5]) {
      await assertValidationRejects(() =>
        applyProjectInsightsValidator.validate({
          new_insights: [
            {
              insight_type: 'project_fact',
              insight_text: 'Valid text.',
              importance,
            },
          ],
        })
      )
    }
  })

  test('rejects invalid new insight confidence values', async () => {
    for (const confidence of [-0.1, 1.1]) {
      await assertValidationRejects(() =>
        applyProjectInsightsValidator.validate({
          new_insights: [
            {
              insight_type: 'project_fact',
              insight_text: 'Valid text.',
              confidence,
            },
          ],
        })
      )
    }
  })

  test('rejects invalid update fields', async () => {
    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: 'not-a-uuid',
            operation: 'ARCHIVED',
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: 'ACTIVE',
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: '',
          },
        ],
      })
    )
  })

  test('rejects invalid replacement insight fields', async () => {
    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: 'SUPERSEDED',
            replacement_insight: {
              insight_type: '',
              insight_text: 'Budget changed.',
            },
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: 'SUPERSEDED',
            replacement_insight: {
              insight_type: 'project_constraint',
              insight_text: 'x'.repeat(501),
            },
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: 'SUPERSEDED',
            replacement_insight: {
              insight_type: 'project_constraint',
              insight_text: 'Budget changed.',
              importance: 1.5,
            },
          },
        ],
      })
    )

    await assertValidationRejects(() =>
      applyProjectInsightsValidator.validate({
        updates: [
          {
            existing_insight_uuid: VALID_INSIGHT_UUID,
            operation: 'SUPERSEDED',
            replacement_insight: {
              insight_type: 'project_constraint',
              insight_text: 'Budget changed.',
              confidence: 1.1,
            },
          },
        ],
      })
    )
  })
})
