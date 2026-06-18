import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'

const recommendedVendors = [
  {
    candidateId: 'search:seed-build-co',
    source: 'SEARCH',
    vendorListingUuid: null,
    fsqPlaceId: 'seed-build-co',
    name: 'Seed Build Co.',
    email: 'hello@seedbuild.example',
    categories: ['Commercial Contractor', 'Construction'],
    phoneNumber: '+18045550199',
    website: 'https://seedbuild.example',
    dateRefreshed: '2026-06-01',
    location: {
      address: '456 Broad St',
      locality: 'Richmond',
      region: 'VA',
      postcode: '23220',
      country: 'US',
      formatted_address: '456 Broad St, Richmond, VA 23220',
    },
    onboardedToEnvoy: false,
  },
]

export default class extends BaseSeeder {
  async run() {
    await AnonymousOnboardingDraft.updateOrCreateMany('uuid', [
      {
        uuid: '9b200000-0000-4000-8000-000000000001',
        tokenUuid: '9b200000-0000-4000-8001-000000000001',
        projectDescription: 'I need help renovating a small restaurant space before opening.',
        postalCode: '23220',
        vendorSearches: [
          {
            classification: 'commercial general contractor',
            query: 'commercial general contractor restaurant renovation',
            rationale: 'The project requires buildout coordination and construction execution.',
          },
        ],
        recommendedVendors,
        selectedVendors: recommendedVendors,
        status: 'ACTIVE',
        anonymousSessionUuid: '9b200000-0000-4000-8002-000000000001',
        registeredUserUuid: null,
        consumedByUserUuid: null,
        consumedProjectUuid: null,
        expiresAt: DateTime.fromISO('2026-12-31T23:59:59.000Z'),
      },
      {
        uuid: '9b200000-0000-4000-8000-000000000002',
        tokenUuid: '9b200000-0000-4000-8001-000000000002',
        projectDescription: 'I am planning an office headquarters fit-out and need vendor help.',
        postalCode: '80202',
        vendorSearches: [
          {
            classification: 'office interior contractor',
            query: 'office interior contractor headquarters fit out',
            rationale: 'The project needs workspace buildout and finish coordination.',
          },
        ],
        recommendedVendors,
        selectedVendors: recommendedVendors,
        status: 'CONSUMED',
        anonymousSessionUuid: '9b200000-0000-4000-8002-000000000002',
        registeredUserUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
        consumedByUserUuid: 'c8f2b3c4-2d4e-5f6a-7b8c-9d0e1f2a3b41',
        consumedProjectUuid: 'd3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a',
        expiresAt: DateTime.fromISO('2026-12-31T23:59:59.000Z'),
      },
    ])
  }
}
