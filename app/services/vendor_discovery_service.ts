import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import VendorListing, { type VendorListingLocation } from '#models/vendor_listing'
import ReasoningEngineService from '#services/reasoning_engine_service'
import VendorSearchService from '#services/vendor_search_service'
import VendorService, { type SearchVendorCandidate } from '#services/vendor_service'
import { getPostalCodesWithinRadius, normalizeVendorListingName } from '#utils/vendor_listing_utils'

const MAX_VENDOR_SEARCHES = 6
const MAX_RECOMMENDATIONS_PER_CATEGORY = 8

export const NO_VENDOR_RESULTS = 'NO_VENDOR_RESULTS'

export type VendorDiscoverySearch = {
  classification: string
  query: string
  fsqCategoryIds?: string[]
  rationale?: string
}

export type RankedVendorCandidate = SearchVendorCandidate & {
  relevanceRank: number
}

type PersistedRankedListing = {
  listing: VendorListing
  relevanceRank: number
  isRelevantExistingListing?: boolean
}

export type VendorDiscoveryResult = {
  vendorSearches: VendorDiscoverySearch[]
  listings: VendorListing[]
  emptyStateReason?: string
  liveSearchUnavailable?: boolean
}

export class VendorDiscoveryDependencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VendorDiscoveryDependencyError'
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizeQuery(query: string) {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const normalizeVendorName = normalizeVendorListingName

function normalizeCategoryIds(value: unknown) {
  if (!Array.isArray(value)) return undefined
  const categoryIds = value
    .map((item) => firstString(item))
    .filter((item): item is string => !!item)
  return categoryIds.length > 0 ? [...new Set(categoryIds)] : undefined
}

function normalizeDate(value: unknown) {
  const text = firstString(value)
  if (!text) return null
  const datePrefix = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) return datePrefix
  const parsed = DateTime.fromISO(text, { setZone: true })
  return parsed.isValid ? parsed.toUTC().toISODate() : text.slice(0, 10)
}

function normalizeLocation(value: unknown): VendorListingLocation | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const location: VendorListingLocation = {}
  for (const key of [
    'address',
    'locality',
    'region',
    'postcode',
    'country',
    'formatted_address',
  ] as const) {
    const text = firstString(record[key])
    if (text) location[key] = text
  }

  return Object.keys(location).length > 0 ? location : null
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .map((category) => {
          if (!category || typeof category !== 'object') return null
          const record = category as Record<string, unknown>
          return firstString(record.name, record.short_name, record.plural_name)
        })
        .filter((name): name is string => !!name)
    ),
  ]
}

function normalizeFoursquareCategoryIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value
        .map((category) => {
          if (!category || typeof category !== 'object') return null
          return firstString((category as Record<string, unknown>).fsq_category_id)
        })
        .filter((categoryId): categoryId is string => !!categoryId)
    ),
  ]
}

export function normalizeFoursquarePlace(
  place: unknown,
  relevanceRank: number
): RankedVendorCandidate | null {
  if (!place || typeof place !== 'object') return null

  const record = place as Record<string, unknown>
  const name = firstString(record.name)
  if (!name) return null

  return {
    fsqPlaceId: firstString(record.fsq_place_id),
    name,
    email: firstString(record.email)?.toLowerCase() ?? null,
    categories: normalizeCategories(record.categories),
    fsqCategoryIds: normalizeFoursquareCategoryIds(record.categories),
    phoneNumber: firstString(record.tel),
    website: firstString(record.website),
    dateRefreshed: normalizeDate(record.date_refreshed),
    location: normalizeLocation(record.location),
    sourcePayload: place,
    relevanceRank,
  }
}

export function validateVendorSearches(reasoningOutput: unknown): VendorDiscoverySearch[] {
  const parsed =
    typeof reasoningOutput === 'string' ? JSON.parse(reasoningOutput) : (reasoningOutput ?? {})
  const vendorSearches = (parsed as { vendorSearches?: unknown }).vendorSearches
  if (!Array.isArray(vendorSearches)) {
    throw new VendorDiscoveryDependencyError('Reasoning response did not include searches')
  }

  const seenQueries = new Set<string>()
  const searches: VendorDiscoverySearch[] = []

  for (const item of vendorSearches) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const classification = firstString(record.classification)
    const query = firstString(record.query)
    if (!classification || !query) continue

    const normalizedQuery = normalizeQuery(query)
    if (!normalizedQuery || seenQueries.has(normalizedQuery)) continue

    seenQueries.add(normalizedQuery)
    const fsqCategoryIds = normalizeCategoryIds(record.fsqCategoryIds)
    searches.push({
      classification,
      query,
      ...(fsqCategoryIds ? { fsqCategoryIds } : {}),
      rationale: firstString(record.rationale) ?? undefined,
    })
    if (searches.length >= MAX_VENDOR_SEARCHES) break
  }

  if (vendorSearches.length > 0 && searches.length === 0) {
    throw new VendorDiscoveryDependencyError('Reasoning response contained no usable searches')
  }
  return searches
}

function candidateContactRichness(candidate: SearchVendorCandidate) {
  return [
    candidate.email,
    candidate.phoneNumber,
    candidate.website,
    candidate.location?.formatted_address,
  ].filter(Boolean).length
}

function candidateDateMillis(candidate: SearchVendorCandidate) {
  if (!candidate.dateRefreshed) return 0
  const parsed = DateTime.fromISO(candidate.dateRefreshed)
  return parsed.isValid ? parsed.toMillis() : 0
}

function sameCandidate(left: SearchVendorCandidate, right: SearchVendorCandidate) {
  if (left.fsqPlaceId && right.fsqPlaceId && left.fsqPlaceId === right.fsqPlaceId) return true
  if (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase()) {
    return true
  }
  if (left.phoneNumber && right.phoneNumber && left.phoneNumber === right.phoneNumber) return true

  const leftHasStableKey = left.fsqPlaceId || left.email || left.phoneNumber
  const rightHasStableKey = right.fsqPlaceId || right.email || right.phoneNumber
  if (leftHasStableKey || rightHasStableKey) return false

  return (
    !!left.location?.postcode &&
    !!right.location?.postcode &&
    left.location.postcode === right.location.postcode &&
    normalizeVendorListingName(left.name) === normalizeVendorListingName(right.name)
  )
}

function preferCandidate(left: RankedVendorCandidate, right: RankedVendorCandidate) {
  const dateDelta = candidateDateMillis(left) - candidateDateMillis(right)
  if (dateDelta !== 0) return dateDelta > 0 ? left : right

  const richnessDelta = candidateContactRichness(left) - candidateContactRichness(right)
  if (richnessDelta !== 0) return richnessDelta > 0 ? left : right

  return left.relevanceRank <= right.relevanceRank ? left : right
}

export function dedupeCandidates(candidates: RankedVendorCandidate[]) {
  const deduped: RankedVendorCandidate[] = []
  for (const candidate of candidates) {
    const existingIndex = deduped.findIndex((existing) => sameCandidate(existing, candidate))
    if (existingIndex === -1) deduped.push(candidate)
    else {
      const existing = deduped[existingIndex]
      const preferred = preferCandidate(existing, candidate)
      deduped[existingIndex] = {
        ...preferred,
        fsqCategoryIds: [
          ...new Set([...(existing.fsqCategoryIds ?? []), ...(candidate.fsqCategoryIds ?? [])]),
        ],
      }
    }
  }
  return deduped
}

export function rankPersistedListings(candidates: PersistedRankedListing[]) {
  const byUuid = new Map<string, PersistedRankedListing>()
  for (const candidate of candidates) {
    const existing = byUuid.get(candidate.listing.uuid)
    if (
      !existing ||
      (candidate.isRelevantExistingListing && !existing.isRelevantExistingListing) ||
      (candidate.isRelevantExistingListing === existing.isRelevantExistingListing &&
        candidate.relevanceRank < existing.relevanceRank)
    ) {
      byUuid.set(candidate.listing.uuid, candidate)
    }
  }

  return [...byUuid.values()].sort((left, right) => {
    const relevantExistingDelta =
      Number(!!right.isRelevantExistingListing) - Number(!!left.isRelevantExistingListing)
    if (relevantExistingDelta !== 0) return relevantExistingDelta

    const emailDelta = Number(!!right.listing.email) - Number(!!left.listing.email)
    if (emailDelta !== 0) return emailDelta

    const dateDelta =
      (right.listing.dateRefreshed?.toMillis() ?? 0) - (left.listing.dateRefreshed?.toMillis() ?? 0)
    if (dateDelta !== 0) return dateDelta

    if (left.relevanceRank !== right.relevanceRank) {
      return left.relevanceRank - right.relevanceRank
    }

    return left.listing.name.localeCompare(right.listing.name)
  })
}

async function persistCandidates(candidates: RankedVendorCandidate[]) {
  const persisted: PersistedRankedListing[] = []
  for (const candidate of dedupeCandidates(candidates)) {
    const listing = await VendorService.insertOrReuseSearchListing(candidate)
    persisted.push({ listing, relevanceRank: candidate.relevanceRank })
  }
  return persisted
}

export default class VendorDiscoveryService {
  public static async discover(
    input: { projectDescription: string; postalCode: string },
    logContext: Record<string, unknown> = {}
  ): Promise<VendorDiscoveryResult> {
    let vendorSearches: VendorDiscoverySearch[]
    try {
      vendorSearches = validateVendorSearches(
        await ReasoningEngineService.requestVendorDiscovery({
          projectDescription: input.projectDescription,
        })
      )
    } catch (error) {
      if (error instanceof VendorDiscoveryDependencyError) throw error
      logger.error({ err: error, ...logContext }, 'Reasoning contact discovery failed')
      throw new VendorDiscoveryDependencyError('Reasoning engine contact discovery failed')
    }

    const nearbyPostalCodes = getPostalCodesWithinRadius(input.postalCode)
    let relevanceRank = 0
    const recommendationCandidates: PersistedRankedListing[] = []
    let rawPlaceCount = 0
    let invalidPlaceCount = 0
    let noEmailPlaceCount = 0
    let internalListingCount = 0
    let foursquareSearchCount = 0
    let foursquareFailureCount = 0
    let persistedListingCount = 0

    for (const vendorSearch of vendorSearches) {
      const internalListings = await VendorService.getRelevantVendorListings(
        nearbyPostalCodes,
        vendorSearch.fsqCategoryIds ?? [],
        MAX_RECOMMENDATIONS_PER_CATEGORY
      )
      internalListingCount += internalListings.length
      const internalCandidates = internalListings.map((listing, index) => ({
        listing,
        relevanceRank: index,
        isRelevantExistingListing: true,
      }))

      foursquareSearchCount += 1
      let places: unknown[]
      try {
        places = await VendorSearchService.searchPlaces(
          vendorSearch.query,
          input.postalCode,
          vendorSearch.fsqCategoryIds
        )
      } catch (error) {
        logger.error({ err: error, rawPlaceCount, ...logContext }, 'Foursquare discovery failed')
        foursquareFailureCount += 1
        recommendationCandidates.push(...internalCandidates)
        continue
      }

      rawPlaceCount += places.length
      const normalizedCandidates: RankedVendorCandidate[] = []

      for (const place of places) {
        const candidate = normalizeFoursquarePlace(place, relevanceRank++)
        if (!candidate) {
          invalidPlaceCount += 1
          continue
        }
        if (!candidate.email) noEmailPlaceCount += 1
        normalizedCandidates.push(candidate)
      }

      const persistedCandidates = await persistCandidates(normalizedCandidates)
      persistedListingCount += persistedCandidates.length
      recommendationCandidates.push(...internalCandidates, ...persistedCandidates)
    }

    const recommendations = rankPersistedListings(recommendationCandidates).slice(
      0,
      MAX_RECOMMENDATIONS_PER_CATEGORY
    )
    const listings = recommendations.map(({ listing }) => listing)

    if (listings.length === 0 && foursquareFailureCount > 0) {
      throw new VendorDiscoveryDependencyError('Foursquare search failed')
    }

    logger.info(
      {
        postalCode: input.postalCode,
        projectDescriptionLength: input.projectDescription.length,
        vendorSearchCount: vendorSearches.length,
        rawPlaceCount,
        invalidPlaceCount,
        noEmailPlaceCount,
        internalListingCount,
        foursquareSearchCount,
        foursquareFailureCount,
        persistedListingCount,
        recommendationCount: listings.length,
        ...logContext,
      },
      'Completed vendor discovery'
    )

    return {
      vendorSearches,
      listings,
      emptyStateReason:
        vendorSearches.length > 0 && listings.length === 0 ? NO_VENDOR_RESULTS : undefined,
      liveSearchUnavailable: foursquareFailureCount > 0 || undefined,
    }
  }
}
