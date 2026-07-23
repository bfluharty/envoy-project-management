import { test } from '@japa/runner'
import { strict as assert } from 'node:assert'
import { feedbackPageArea, feedbackWidgetMetadata } from '../../inertia/utils/quackback_metadata.js'

test.group('Quackback widget client metadata', () => {
  test('maps routes without exposing full URLs or query strings', () => {
    assert.equal(feedbackPageArea('/dashboard?search=private'), 'dashboard')
    assert.equal(feedbackPageArea('/projects/project-uuid?tab=chat'), 'project')
    assert.equal(feedbackPageArea('/contacts#new-contact'), 'contacts')
    assert.equal(feedbackPageArea('/inbox/settings'), 'inbox')
    assert.equal(feedbackPageArea('/account'), 'account')
    assert.equal(feedbackPageArea('/vendor/pending'), 'other')
  })

  test('constructs only the approved operational metadata fields', () => {
    const metadata = feedbackWidgetMetadata(
      {
        environment: 'prod',
        appVersion: 'abc123def456',
      },
      '/projects/project-uuid?search=must-not-leak'
    )

    assert.deepEqual(metadata, {
      envoy_environment: 'prod',
      page_area: 'project',
      app_version: 'abc123def456',
    })
    assert.deepEqual(Object.keys(metadata).sort(), [
      'app_version',
      'envoy_environment',
      'page_area',
    ])
    assert.equal(JSON.stringify(metadata).includes('search'), false)
    assert.equal(JSON.stringify(metadata).includes('project-uuid'), false)
  })

  test('uses safe development and version fallbacks', () => {
    assert.deepEqual(
      feedbackWidgetMetadata(
        {
          environment: 'dev',
          appVersion: 'unsafe version with spaces',
        },
        '/unexpected'
      ),
      {
        envoy_environment: 'dev',
        page_area: 'other',
        app_version: 'unknown',
      }
    )
  })
})
