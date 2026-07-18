import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { strict as assert } from 'node:assert'
import { DateTime } from 'luxon'
import { v4 as uuidv4 } from 'uuid'
import User from '#models/user'
import UserConsentPreference from '#models/user_consent_preference'
import UserEntitlement from '#models/user_entitlement'
import UserInboxConnection from '#models/user_inbox_connection'
import Project from '#models/project'
import ProjectVendor from '#models/project_vendor'
import Vendor from '#models/vendor'
import PendingConsentCleanupService from '#services/pending_consent_cleanup_service'
import UserConsentService from '#services/user_consent_service'
import VendorService from '#services/vendor_service'

const USERS_TABLE = 'envoy_schema.users'
const PREFERENCES_TABLE = 'envoy_schema.user_consent_preferences'

async function createUserAt(label: string, createdAt: DateTime) {
  const entitlement = await UserEntitlement.findByOrFail('canonicalName', 'CONSUMER')
  const user = await User.create({
    fullName: `${label} Consumer`,
    email: `cleanup-${label.toLowerCase()}-${uuidv4()}@example.com`,
    password: 'Password123!',
    entitlementId: entitlement.id,
    isActive: true,
  })
  await db.from(USERS_TABLE).where('uuid', user.uuid).update({
    created_timestamp: createdAt.toJSDate(),
    modified_timestamp: createdAt.toJSDate(),
  })
  await user.refresh()
  return user
}

async function addPendingPreferenceAt(user: User, createdAt: DateTime) {
  await UserConsentService.ensurePreference(user.uuid, user.uuid)
  await db.from(PREFERENCES_TABLE).where('user_uuid', user.uuid).update({
    created_timestamp: createdAt.toJSDate(),
    modified_timestamp: createdAt.toJSDate(),
  })
}

test.group('pending consent cleanup', (group) => {
  group.setup(async () => {
    const cleanup = await testUtils.db().truncate()
    const existingUsers = await User.all()
    for (const user of existingUsers) {
      await UserConsentService.ensurePreference(user.uuid)
    }
    await db
      .from(PREFERENCES_TABLE)
      .where('terms_accepted', false)
      .update({ created_by_user_uuid: null, modified_by_user_uuid: null })
    return cleanup
  })

  test('stops provider access and deletes an expired incomplete registration', async () => {
    const createdAt = DateTime.utc(2026, 7, 16, 12)
    const user = await createUserAt('provider', createdAt)
    await addPendingPreferenceAt(user, createdAt)
    const connection = await UserInboxConnection.create({
      userUuid: user.uuid,
      provider: 'gmail',
      email: user.email,
      accessToken: 'plaintext-access-token',
      refreshToken: 'plaintext-refresh-token',
      accessTokenExpiresAt: DateTime.utc().plus({ hours: 1 }),
      scopes: 'openid gmail.readonly gmail.send',
      status: 'active',
      isPrimary: true,
      providerUserId: 'cleanup-provider-user',
      tokenEncryptionVersion: 'plaintext_legacy',
      watchStatus: 'active',
    })
    const otherUser = await createUserAt('dependent-owner', createdAt)
    await UserConsentService.completeOnboarding({
      userUuid: otherUser.uuid,
      termsAccepted: true,
      modelTrainingOptIn: false,
    })
    const otherProject = await Project.create({
      title: 'Other user project',
      userUuid: otherUser.uuid,
      isActive: true,
    })
    const pendingProject = await Project.create({
      title: 'Pending user project',
      userUuid: user.uuid,
      isActive: true,
    })
    const listing = await VendorService.insertOrReuseSearchListing({
      fsqPlaceId: `cleanup-${uuidv4()}`,
      name: `Cleanup Vendor ${uuidv4()}`,
      email: null,
      categories: ['Contractor'],
      phoneNumber: null,
      website: null,
      dateRefreshed: null,
      location: { postcode: '23220' },
      sourcePayload: {},
    })
    const pendingVendor = await VendorService.ensureUserVendorMapping(user.uuid, listing.uuid)
    assert.ok(pendingVendor)
    const crossUserMapping = await ProjectVendor.create({
      projectUuid: otherProject.uuid,
      vendorUuid: pendingVendor.uuid,
      isActive: true,
    })

    const stopped: string[] = []
    const revoked: string[] = []
    const result = await PendingConsentCleanupService.cleanup(
      DateTime.utc(2026, 9, 1, 12) as DateTime<true>,
      30,
      {
        stopWatch: async (candidate) => {
          stopped.push(candidate.uuid)
          return { success: true, connection: candidate }
        },
        revokeAuthorization: async (candidate) => {
          revoked.push(candidate.uuid)
        },
      }
    )

    assert.deepEqual(result, { checked: 1, deleted: 1, failed: 0, lockAcquired: true })
    assert.deepEqual(stopped, [connection.uuid])
    assert.deepEqual(revoked, [connection.uuid])
    assert.equal(await User.findBy('uuid', user.uuid), null)
    assert.equal(await UserInboxConnection.findBy('uuid', connection.uuid), null)
    assert.equal(await UserConsentPreference.findBy('userUuid', user.uuid), null)
    assert.equal(await Project.findBy('uuid', pendingProject.uuid), null)
    assert.equal(await Vendor.findBy('uuid', pendingVendor.uuid), null)
    assert.equal(await ProjectVendor.findBy('uuid', crossUserMapping.uuid), null)
    assert.ok(await User.findBy('uuid', otherUser.uuid))
    assert.ok(await Project.findBy('uuid', otherProject.uuid))
  })

  test('cleans post-rollout missing rows but preserves legacy and accepted accounts', async () => {
    const now = DateTime.utc(2026, 9, 1, 12) as DateTime<true>
    const postRolloutMissing = await createUserAt(
      'post-rollout-missing',
      DateTime.utc(2026, 7, 16, 12)
    )
    const legacyMissing = await createUserAt('legacy-missing', DateTime.utc(2026, 7, 1, 12))
    const accepted = await createUserAt('accepted', DateTime.utc(2026, 7, 16, 12))
    await UserConsentService.completeOnboarding({
      userUuid: accepted.uuid,
      termsAccepted: true,
      modelTrainingOptIn: false,
    })
    await db
      .from(PREFERENCES_TABLE)
      .where('user_uuid', accepted.uuid)
      .update({
        created_timestamp: DateTime.utc(2026, 7, 16, 12).toJSDate(),
      })

    const result = await PendingConsentCleanupService.cleanup(now, 30, {
      stopWatch: async (candidate) => ({ success: true, connection: candidate }),
      revokeAuthorization: async () => {},
    })

    assert.equal(result.deleted, 1)
    assert.equal(await User.findBy('uuid', postRolloutMissing.uuid), null)
    assert.ok(await User.findBy('uuid', legacyMissing.uuid))
    assert.ok(await User.findBy('uuid', accepted.uuid))
  })

  test('uses account age even when the pending preference row was created later', async () => {
    const now = DateTime.utc(2026, 9, 1, 12) as DateTime<true>
    const user = await createUserAt('late-preference', DateTime.utc(2026, 7, 16, 12))
    await addPendingPreferenceAt(user, DateTime.utc(2026, 8, 25, 12))

    const result = await PendingConsentCleanupService.cleanup(now, 30, {
      stopWatch: async (candidate) => ({ success: true, connection: candidate }),
      revokeAuthorization: async () => {},
    })

    assert.equal(result.deleted, 1)
    assert.equal(await User.findBy('uuid', user.uuid), null)
  })
})
