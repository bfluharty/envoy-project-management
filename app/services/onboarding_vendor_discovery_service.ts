import logger from '@adonisjs/core/services/logger'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import OnboardingDraftService from '#services/onboarding_draft_service'
import VendorDiscoveryService, {
  NO_VENDOR_RESULTS,
  VendorDiscoveryDependencyError,
  dedupeCandidates,
  normalizeFoursquarePlace,
  normalizeVendorName,
  rankPersistedListings,
  validateVendorSearches,
  type RankedVendorCandidate,
  type VendorDiscoverySearch,
} from '#services/vendor_discovery_service'
import VendorService, { type PublicVendorRecommendation } from '#services/vendor_service'

export {
  NO_VENDOR_RESULTS,
  VendorDiscoveryDependencyError,
  dedupeCandidates,
  normalizeFoursquarePlace,
  normalizeVendorName,
  rankPersistedListings,
  validateVendorSearches,
}
export type { RankedVendorCandidate, VendorDiscoverySearch }

export default class OnboardingVendorDiscoveryService {
  public static async search(input: {
    projectDescription: string
    postalCode: string
    anonymousSessionUuid: string
  }): Promise<{
    onboardingToken: string
    draftUuid: string
    vendorSearches: VendorDiscoverySearch[]
    vendors: PublicVendorRecommendation[]
    expiresAt: string | null
    emptyStateReason?: string
  }> {
    logger.info(
      {
        postalCode: input.postalCode,
        projectDescriptionLength: input.projectDescription.length,
      },
      'Starting onboarding vendor discovery'
    )

    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: input.projectDescription,
      postalCode: input.postalCode,
      anonymousSessionUuid: input.anonymousSessionUuid,
    })

    const discovery = await VendorDiscoveryService.discover(
      {
        projectDescription: input.projectDescription,
        postalCode: input.postalCode,
      },
      { draftUuid: draft.uuid, discoveryContext: 'anonymous-onboarding' }
    )

    await OnboardingDraftService.updateRecommendations(tokenUuid, {
      vendorSearches: discovery.vendorSearches,
      recommendedVendorListingUuids: discovery.listings.map((listing) => listing.uuid),
    })

    const freshDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)
    const vendors = discovery.listings.map((listing) =>
      VendorService.toPublicRecommendation(listing)
    )

    return {
      onboardingToken: tokenUuid,
      draftUuid: freshDraft.uuid,
      vendorSearches: discovery.vendorSearches,
      vendors,
      expiresAt: freshDraft.expiresAt.toISO(),
      emptyStateReason: discovery.emptyStateReason,
    }
  }
}
