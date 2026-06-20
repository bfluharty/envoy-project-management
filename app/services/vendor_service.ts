import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import VendorListing, { type VendorListingLocation } from '#models/vendor_listing'
import Vendor from '#models/vendor'
import { VendorRequest } from '../../types/request.js'
import {
  normalizeVendorListingEmail,
  normalizeVendorListingName,
} from '#utils/vendor_listing_utils'

const SEARCH_MODIFIED_BY = 'system:vendor-search'

export type SearchVendorCandidate = {
  fsqPlaceId: string | null
  name: string
  email: string | null
  categories: string[]
  phoneNumber: string | null
  website: string | null
  dateRefreshed: string | null
  location: VendorListingLocation | null
  sourcePayload: unknown
}

export type PublicVendorRecommendation = {
  vendorListingUuid: string
  name: string
  categories: string[]
  location: VendorListingLocation | null
  hasEmail: boolean
  onboardedToEnvoy: boolean
  consumerOwned: boolean
  ownershipWarning: string | null
}

export type AuthenticatedVendorRecommendation = PublicVendorRecommendation & {
  inContacts: boolean
  vendorUuid: string | null
}

export class VendorAuthorizationError extends Error {
  public readonly statusCode = 403

  constructor(message = 'You do not have permission to edit this vendor listing') {
    super(message)
    this.name = 'VendorAuthorizationError'
  }
}

function isUniqueViolation(error: unknown) {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === '23505'
}

function sameWeakIdentity(
  left: { name: string; location: VendorListingLocation | null },
  right: { name: string; location: VendorListingLocation | null }
) {
  return (
    !!left.location?.postcode &&
    !!right.location?.postcode &&
    left.location.postcode === right.location.postcode &&
    normalizeVendorListingName(left.name) === normalizeVendorListingName(right.name)
  )
}

function sameBusiness(candidate: SearchVendorCandidate, listing: VendorListing) {
  if (candidate.fsqPlaceId && listing.fsqPlaceId === candidate.fsqPlaceId) return true

  const candidateEmail = normalizeVendorListingEmail(candidate.email)
  const listingEmail = normalizeVendorListingEmail(listing.email)
  if (candidateEmail && listingEmail === candidateEmail) return true

  if (candidate.phoneNumber && listing.phoneNumber === candidate.phoneNumber) return true

  const candidateHasStableKey = candidate.fsqPlaceId || candidateEmail || candidate.phoneNumber
  const listingHasStableKey = listing.fsqPlaceId || listingEmail || listing.phoneNumber
  return !candidateHasStableKey && !listingHasStableKey && sameWeakIdentity(candidate, listing)
}

export default class VendorService {
  private static readonly DEFAULT_VENDOR_LIMIT = 10
  private static readonly DEFAULT_VENDOR_OFFSET = 0

  public static isOnboardedListing(listing: VendorListing) {
    return listing.claimStatus === 'CLAIMED'
  }

  public static isConsumerOwnedListing(listing: VendorListing) {
    return !this.isOnboardedListing(listing) && !!listing.ownerUserUuid
  }

  public static canEditListing(userUuid: string, listing: VendorListing) {
    if (!listing.isActive || listing.supersededByVendorListingUuid) {
      return false
    }

    if (this.isOnboardedListing(listing)) {
      return listing.claimedByUserUuid === userUuid
    }

    return !!listing.ownerUserUuid && listing.ownerUserUuid === userUuid
  }

  public static toPublicRecommendation(listing: VendorListing): PublicVendorRecommendation {
    const consumerOwned = this.isConsumerOwnedListing(listing)
    return {
      vendorListingUuid: listing.uuid,
      name: listing.name,
      categories: listing.categories ?? [],
      location: listing.location,
      hasEmail: !!normalizeVendorListingEmail(listing.email),
      onboardedToEnvoy: this.isOnboardedListing(listing),
      consumerOwned,
      ownershipWarning: consumerOwned
        ? 'This listing is consumer-owned and has not been verified by the vendor.'
        : null,
    }
  }

  public static toAuthenticatedRecommendation(
    listing: VendorListing,
    mapping?: Vendor | null
  ): AuthenticatedVendorRecommendation {
    return {
      ...this.toPublicRecommendation(listing),
      inContacts: !!mapping?.isActive,
      vendorUuid: mapping?.isActive ? mapping.uuid : null,
    }
  }

  /** Listings in the user's contact library. A mapping does not imply edit authority. */
  public static async getUserVendors(userUuid: string, limit?: number, offset?: number) {
    return VendorListing.query()
      .whereHas('vendors', (vendorQuery) => {
        vendorQuery.where('user_uuid', userUuid).where('is_active', true)
      })
      .where('is_active', true)
      .orderBy('name', 'asc')
      .limit(limit ?? this.DEFAULT_VENDOR_LIMIT)
      .offset(offset ?? this.DEFAULT_VENDOR_OFFSET)
  }

  public static async getUserVendorByUuid(userUuid: string, vendorListingUuid: string) {
    return VendorListing.query()
      .where('uuid', vendorListingUuid)
      .where('is_active', true)
      .whereHas('vendors', (vendorQuery) => {
        vendorQuery.where('user_uuid', userUuid).where('is_active', true)
      })
      .first()
  }

  public static async getUserVendorMappingsByListingUuids(
    userUuid: string,
    vendorListingUuids: string[]
  ) {
    if (vendorListingUuids.length === 0) return new Map<string, Vendor>()

    const mappings = await Vendor.query()
      .where('user_uuid', userUuid)
      .where('is_active', true)
      .whereIn('vendor_listing_uuid', [...new Set(vendorListingUuids)])

    return new Map(mappings.map((mapping) => [mapping.vendorListingUuid, mapping]))
  }

  public static async getAvailableVendorListings(limit?: number, offset?: number) {
    return VendorListing.query()
      .where('is_active', true)
      .whereNull('superseded_by_vendor_listing_uuid')
      .orderByRaw(`CASE WHEN claim_status = 'CLAIMED' THEN 0 ELSE 1 END`)
      .orderBy('name', 'asc')
      .limit(limit ?? this.DEFAULT_VENDOR_LIMIT)
      .offset(offset ?? this.DEFAULT_VENDOR_OFFSET)
  }

  public static async getAvailableVendorListingByUuid(
    vendorListingUuid: string,
    trx?: TransactionClientContract
  ) {
    const query = VendorListing.query()
      .where('uuid', vendorListingUuid)
      .where('is_active', true)
      .whereNull('superseded_by_vendor_listing_uuid')
    if (trx) query.useTransaction(trx)
    return query.first()
  }

  public static async getListingsByUuidsPreservingOrder(vendorListingUuids: string[]) {
    const listings = await Promise.all(
      vendorListingUuids.map((vendorListingUuid) => this.resolveCanonicalListing(vendorListingUuid))
    )
    const seen = new Set<string>()
    return listings.filter((listing): listing is VendorListing => {
      if (!listing?.isActive || seen.has(listing.uuid)) return false
      seen.add(listing.uuid)
      return true
    })
  }

  public static async findTrustedExistingListings(input: { name?: string; email?: string }) {
    const normalizedName = input.name ? normalizeVendorListingName(input.name) : null
    const normalizedEmail = normalizeVendorListingEmail(input.email)
    if (!normalizedName && !normalizedEmail) return []

    const trustedListings = await VendorListing.query()
      .where('is_active', true)
      .whereNull('superseded_by_vendor_listing_uuid')
      .where((trustedQuery) => {
        trustedQuery.where('originator', 'VENDOR').orWhere('claim_status', 'CLAIMED')
      })

    return trustedListings.filter((listing) => {
      const emailMatches =
        normalizedEmail && normalizeVendorListingEmail(listing.email) === normalizedEmail
      const nameMatches =
        normalizedName && normalizeVendorListingName(listing.name) === normalizedName
      return !!emailMatches || !!nameMatches
    })
  }

  public static async createVendor(userUuid: string, request: VendorRequest) {
    const listing = await VendorListing.create({
      name: request.name!,
      email: normalizeVendorListingEmail(request.email),
      originator: 'CONSUMER',
      ownerUserUuid: userUuid,
      claimStatus: 'UNCLAIMED',
      isActive: true,
      modifiedBy: userUuid,
    })

    await this.ensureUserVendorMapping(userUuid, listing.uuid)
    return listing
  }

  public static async createVendorOwnedListing(userUuid: string, request: VendorRequest) {
    const listing = await VendorListing.create({
      name: request.name!,
      email: normalizeVendorListingEmail(request.email),
      originator: 'VENDOR',
      ownerUserUuid: null,
      claimedByUserUuid: userUuid,
      claimedAt: DateTime.utc(),
      claimStatus: 'CLAIMED',
      isActive: true,
      modifiedBy: userUuid,
    })

    await this.ensureUserVendorMapping(userUuid, listing.uuid)
    return listing
  }

  public static async updateVendor(
    userUuid: string,
    vendorListingUuid: string,
    request: Partial<VendorRequest>,
    isOnlyActivatingRecord: boolean
  ) {
    let vendorQuery = Vendor.query()
      .where('user_uuid', userUuid)
      .whereHas('vendorListing', (query) => query.where('uuid', vendorListingUuid))

    if (!isOnlyActivatingRecord) {
      vendorQuery = vendorQuery.where('is_active', true)
    }

    const vendorMapping = await vendorQuery.preload('vendorListing').first()
    if (!vendorMapping) return null

    if (request.isActive === false) {
      vendorMapping.isActive = false
      vendorMapping.modifiedBy = userUuid
      await vendorMapping.save()
    } else if (isOnlyActivatingRecord && request.isActive === true) {
      vendorMapping.isActive = true
      vendorMapping.modifiedBy = userUuid
      await vendorMapping.save()
    }

    const updatesListing = request.name !== undefined || request.email !== undefined
    if (!updatesListing) return vendorMapping.vendorListing

    const listing = vendorMapping.vendorListing
    if (!this.canEditListing(userUuid, listing)) {
      throw new VendorAuthorizationError()
    }

    if (request.name !== undefined) listing.name = request.name
    if (request.email !== undefined) listing.email = normalizeVendorListingEmail(request.email)
    listing.modifiedBy = userUuid
    await listing.save()
    return listing
  }

  public static async ensureUserVendorMapping(
    userUuid: string,
    vendorListingUuid: string,
    trx?: TransactionClientContract
  ) {
    const listing = await this.getAvailableVendorListingByUuid(vendorListingUuid, trx)
    if (!listing) return null

    const existingQuery = Vendor.query()
      .where('user_uuid', userUuid)
      .where('vendor_listing_uuid', vendorListingUuid)
    if (trx) existingQuery.useTransaction(trx)
    const existing = await existingQuery.first()

    if (existing) {
      if (!existing.isActive) {
        if (trx) existing.useTransaction(trx)
        existing.isActive = true
        existing.modifiedBy = userUuid
        await existing.save()
      }
      return existing
    }

    return Vendor.create(
      {
        userUuid,
        vendorListingUuid,
        isActive: true,
        modifiedBy: userUuid,
      },
      trx ? { client: trx } : undefined
    )
  }

  public static async insertOrReuseSearchListing(candidate: SearchVendorCandidate) {
    const existing = await this.findExistingSearchListing(candidate)
    if (existing) return existing

    try {
      return await VendorListing.create({
        name: candidate.name,
        email: normalizeVendorListingEmail(candidate.email),
        originator: 'SEARCH',
        fsqPlaceId: candidate.fsqPlaceId,
        categories: candidate.categories,
        phoneNumber: candidate.phoneNumber,
        website: candidate.website,
        dateRefreshed: candidate.dateRefreshed ? DateTime.fromISO(candidate.dateRefreshed) : null,
        location: candidate.location,
        sourcePayload: candidate.sourcePayload,
        ownerUserUuid: null,
        claimedByUserUuid: null,
        claimedAt: null,
        claimStatus: 'UNCLAIMED',
        isActive: true,
        modifiedBy: SEARCH_MODIFIED_BY,
      })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const racedListing = await this.findExistingSearchListing(candidate)
      if (racedListing) return racedListing
      throw error
    }
  }

  public static async adoptOwnerlessNoEmailSearchListing(
    userUuid: string,
    vendorListingUuid: string,
    trx?: TransactionClientContract
  ) {
    const updateQuery = VendorListing.query()
      .where('uuid', vendorListingUuid)
      .where('originator', 'SEARCH')
      .where('is_active', true)
      .whereNull('email')
      .whereNull('owner_user_uuid')
      .whereNull('superseded_by_vendor_listing_uuid')
      .whereNot('claim_status', 'CLAIMED')
    if (trx) updateQuery.useTransaction(trx)
    await updateQuery.update({ ownerUserUuid: userUuid, modifiedBy: userUuid })

    return this.resolveCanonicalListing(vendorListingUuid, trx)
  }

  public static async resolveCanonicalListing(
    vendorListingUuid: string,
    trx?: TransactionClientContract,
    lockForUpdate = false
  ) {
    let currentUuid: string | null = vendorListingUuid
    const visited = new Set<string>()

    while (currentUuid && !visited.has(currentUuid)) {
      visited.add(currentUuid)
      const query: ReturnType<typeof VendorListing.query> = VendorListing.query().where(
        'uuid',
        currentUuid
      )
      if (trx) query.useTransaction(trx)
      if (lockForUpdate) query.forUpdate()
      const listing = (await query.first()) as VendorListing | null
      if (!listing) return null
      if (!listing.supersededByVendorListingUuid) return listing
      currentUuid = listing.supersededByVendorListingUuid
    }

    return null
  }

  public static async supersedeConsumerDuplicatesForClaim(canonicalListingUuid: string) {
    const canonical = await VendorListing.findBy('uuid', canonicalListingUuid)
    if (!canonical || canonical.claimStatus !== 'CLAIMED') {
      throw new Error('Canonical vendor listing must be claimed')
    }

    const candidates = await VendorListing.query()
      .where('originator', 'CONSUMER')
      .where('is_active', true)
      .whereNull('superseded_by_vendor_listing_uuid')
      .whereNot('uuid', canonical.uuid)

    const duplicates = candidates.filter((candidate) =>
      sameBusiness(
        {
          fsqPlaceId: canonical.fsqPlaceId,
          name: canonical.name,
          email: canonical.email,
          categories: canonical.categories,
          phoneNumber: canonical.phoneNumber,
          website: canonical.website,
          dateRefreshed: canonical.dateRefreshed?.toISODate() ?? null,
          location: canonical.location,
          sourcePayload: canonical.sourcePayload,
        },
        candidate
      )
    )

    if (duplicates.length === 0) return 0

    await VendorListing.query()
      .whereIn(
        'uuid',
        duplicates.map((listing) => listing.uuid)
      )
      .update({ supersededByVendorListingUuid: canonical.uuid })

    return duplicates.length
  }

  private static async findExistingSearchListing(candidate: SearchVendorCandidate) {
    let listing: VendorListing | null = null

    if (candidate.fsqPlaceId) {
      listing = await VendorListing.query()
        .where('is_active', true)
        .where('fsq_place_id', candidate.fsqPlaceId)
        .first()
    }

    const normalizedEmail = normalizeVendorListingEmail(candidate.email)
    if (!listing && normalizedEmail) {
      listing = await VendorListing.query()
        .where('is_active', true)
        .whereRaw('LOWER(email) = ?', [normalizedEmail])
        .first()
    }

    if (!listing && candidate.phoneNumber) {
      listing = await VendorListing.query()
        .where('is_active', true)
        .where('phone_number', candidate.phoneNumber)
        .first()
    }

    const candidateHasStableKey = candidate.fsqPlaceId || normalizedEmail || candidate.phoneNumber
    if (!listing && !candidateHasStableKey && candidate.location?.postcode) {
      const possibleListings = await VendorListing.query()
        .where('is_active', true)
        .whereNull('fsq_place_id')
        .whereNull('email')
        .whereNull('phone_number')
        .whereRaw(`location->>'postcode' = ?`, [candidate.location.postcode])
      listing = possibleListings.find((possible) => sameBusiness(candidate, possible)) ?? null
    }

    return listing ? this.resolveCanonicalListing(listing.uuid) : null
  }
}
