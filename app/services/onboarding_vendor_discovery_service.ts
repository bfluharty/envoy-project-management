import { DateTime } from 'luxon'
import AnonymousOnboardingDraft from '#models/anonymous_onboarding_draft'
import VendorListing, { type VendorListingLocation } from '#models/vendor_listing'
import OnboardingDraftService from '#services/onboarding_draft_service'
import ReasoningEngineService from '#services/reasoning_engine_service'
import VendorSearchService from '#services/vendor_search_service'

const MAX_VENDOR_SEARCHES = 4
const MAX_RECOMMENDATIONS = 30

export const NO_EMAIL_READY_VENDORS = 'NO_EMAIL_READY_VENDORS'

export type VendorDiscoverySearch = {
  classification: string
  query: string
  rationale?: string
}

export type VendorCandidate = {
  candidateId: string
  source: 'SEARCH'
  vendorListingUuid: string | null
  fsqPlaceId: string | null
  name: string
  email: string | null
  categories: string[]
  phoneNumber: string | null
  website: string | null
  dateRefreshed: string | null
  location: VendorListingLocation | null
  onboardedToEnvoy: boolean
  sourcePayload: unknown
}

export type PublicVendorCandidate = Omit<VendorCandidate, 'sourcePayload'>

type RankedVendorCandidate = VendorCandidate & {
  relevanceRank: number
}

export class VendorDiscoveryDependencyError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
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

export function normalizeVendorName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+(llc|inc|incorporated|co|company|corp|ltd)$/u, '')
    .trim()
}

function normalizePhone(value: unknown) {
  return firstString(value)
}

function normalizeEmail(value: unknown) {
  return firstString(value)?.toLowerCase() ?? null
}

function normalizeDate(value: unknown) {
  const text = firstString(value)
  if (!text) return null

  const datePrefix = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) {
    return datePrefix
  }

  const parsed = DateTime.fromISO(text, { setZone: true })
  return parsed.isValid ? parsed.toUTC().toISODate() : text.slice(0, 10)
}

function normalizeLocation(value: unknown): VendorListingLocation | null {
  if (!value || typeof value !== 'object') {
    return null
  }

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
    if (text) {
      location[key] = text
    }
  }

  return Object.keys(location).length > 0 ? location : null
}

function normalizeCategories(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const categoryNames = value
    .map((category) => {
      if (!category || typeof category !== 'object') {
        return null
      }

      const record = category as Record<string, unknown>
      return firstString(record.name, record.short_name, record.plural_name)
    })
    .filter((name): name is string => !!name)

  return [...new Set(categoryNames)]
}

function getPlaceId(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  return firstString((value as Record<string, unknown>).fsq_place_id)
}

export function normalizeFoursquarePlace(
  place: unknown,
  relevanceRank: number
): RankedVendorCandidate | null {
  if (!place || typeof place !== 'object') {
    return null
  }

  const record = place as Record<string, unknown>
  const name = firstString(record.name)
  if (!name) {
    return null
  }

  const fsqPlaceId = getPlaceId(place)
  const email = normalizeEmail(record.email)
  const location = normalizeLocation(record.location)
  const fallbackKey = `${normalizeVendorName(name)}:${location?.postcode ?? 'unknown'}`

  return {
    candidateId: fsqPlaceId ? `search:${fsqPlaceId}` : `search:${fallbackKey}`,
    source: 'SEARCH',
    vendorListingUuid: null,
    fsqPlaceId,
    name,
    email,
    categories: normalizeCategories(record.categories),
    phoneNumber: normalizePhone(record.tel),
    website: firstString(record.website),
    dateRefreshed: normalizeDate(record.date_refreshed),
    location,
    onboardedToEnvoy: false,
    sourcePayload: place,
    relevanceRank,
  }
}

export function validateVendorSearches(reasoningOutput: unknown): VendorDiscoverySearch[] {
  const parsed =
    typeof reasoningOutput === 'string' ? JSON.parse(reasoningOutput) : (reasoningOutput ?? {})
  const vendorSearches = (parsed as { vendorSearches?: unknown }).vendorSearches

  if (!Array.isArray(vendorSearches)) {
    throw new VendorDiscoveryDependencyError('Reasoning response did not include vendor searches')
  }

  const seenQueries = new Set<string>()
  const searches: VendorDiscoverySearch[] = []

  for (const item of vendorSearches) {
    if (!item || typeof item !== 'object') {
      continue
    }

    const record = item as Record<string, unknown>
    const classification = firstString(record.classification)
    const query = firstString(record.query)
    if (!classification || !query) {
      continue
    }

    const normalizedQuery = normalizeQuery(query)
    if (!normalizedQuery || seenQueries.has(normalizedQuery)) {
      continue
    }

    seenQueries.add(normalizedQuery)
    searches.push({
      classification,
      query,
      rationale: firstString(record.rationale) ?? undefined,
    })

    if (searches.length >= MAX_VENDOR_SEARCHES) {
      break
    }
  }

  if (searches.length === 0) {
    throw new VendorDiscoveryDependencyError('Reasoning response contained no usable searches')
  }

  return searches
}

function contactRichness(candidate: VendorCandidate) {
  return [
    candidate.email,
    candidate.phoneNumber,
    candidate.website,
    candidate.location?.formatted_address,
  ].filter(Boolean).length
}

function dateMillis(candidate: VendorCandidate) {
  if (!candidate.dateRefreshed) {
    return 0
  }

  const parsed = DateTime.fromISO(candidate.dateRefreshed)
  return parsed.isValid ? parsed.toMillis() : 0
}

function sameCandidate(left: VendorCandidate, right: VendorCandidate) {
  if (left.fsqPlaceId && right.fsqPlaceId && left.fsqPlaceId === right.fsqPlaceId) return true
  if (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase())
    return true
  if (left.phoneNumber && right.phoneNumber && left.phoneNumber === right.phoneNumber) return true

  const leftHasStableKey = left.fsqPlaceId || left.email || left.phoneNumber
  const rightHasStableKey = right.fsqPlaceId || right.email || right.phoneNumber
  if (leftHasStableKey || rightHasStableKey) return false

  return (
    !!left.location?.postcode &&
    !!right.location?.postcode &&
    left.location.postcode === right.location.postcode &&
    normalizeVendorName(left.name) === normalizeVendorName(right.name)
  )
}

function preferCandidate(left: RankedVendorCandidate, right: RankedVendorCandidate) {
  const leftDate = dateMillis(left)
  const rightDate = dateMillis(right)
  if (leftDate !== rightDate) return leftDate > rightDate ? left : right

  const leftRichness = contactRichness(left)
  const rightRichness = contactRichness(right)
  if (leftRichness !== rightRichness) return leftRichness > rightRichness ? left : right

  if (left.vendorListingUuid !== right.vendorListingUuid) {
    return left.vendorListingUuid ? left : right
  }

  return left.relevanceRank <= right.relevanceRank ? left : right
}

function stripRank(candidate: RankedVendorCandidate): VendorCandidate {
  const { relevanceRank: ignoredRelevanceRank, ...vendorCandidate } = candidate
  void ignoredRelevanceRank
  return vendorCandidate
}

export function stripVendorSourcePayload(candidate: VendorCandidate): PublicVendorCandidate
export function stripVendorSourcePayload(candidate: unknown): unknown
export function stripVendorSourcePayload(candidate: unknown): unknown {
  if (!candidate || typeof candidate !== 'object') {
    return candidate
  }

  const { sourcePayload: ignoredSourcePayload, ...publicCandidate } = candidate as Record<
    string,
    unknown
  >
  void ignoredSourcePayload
  return publicCandidate
}

export function stripVendorSourcePayloads(candidates: VendorCandidate[]): PublicVendorCandidate[]
export function stripVendorSourcePayloads(candidates: unknown[]): unknown[]
export function stripVendorSourcePayloads(candidates: unknown[]) {
  return candidates.map((candidate) => stripVendorSourcePayload(candidate))
}

async function matchExistingListings(candidates: RankedVendorCandidate[]) {
  if (candidates.length === 0) {
    return candidates
  }

  const listings = await VendorListing.query().where('is_active', true)

  return candidates.map((candidate) => {
    const match =
      listings.find(
        (listing) => candidate.fsqPlaceId && listing.fsqPlaceId === candidate.fsqPlaceId
      ) ??
      listings.find(
        (listing) =>
          candidate.email && listing.email.toLowerCase() === candidate.email.toLowerCase()
      ) ??
      listings.find(
        (listing) => candidate.phoneNumber && listing.phoneNumber === candidate.phoneNumber
      ) ??
      listings.find((listing) => {
        if (candidate.fsqPlaceId || candidate.email || candidate.phoneNumber) return false
        if (!candidate.location?.postcode || !listing.location?.postcode) return false
        return (
          candidate.location.postcode === listing.location.postcode &&
          normalizeVendorName(candidate.name) === normalizeVendorName(listing.name)
        )
      })

    if (!match) {
      return candidate
    }

    return {
      ...candidate,
      vendorListingUuid: match.uuid,
      onboardedToEnvoy: true,
    }
  })
}

export function dedupeAndRankCandidates(candidates: RankedVendorCandidate[]) {
  const deduped: RankedVendorCandidate[] = []

  for (const candidate of candidates) {
    const existingIndex = deduped.findIndex((existingCandidate) =>
      sameCandidate(existingCandidate, candidate)
    )

    if (existingIndex === -1) {
      deduped.push(candidate)
      continue
    }

    deduped[existingIndex] = preferCandidate(deduped[existingIndex], candidate)
  }

  return deduped
    .sort((left, right) => {
      const dateDelta = dateMillis(right) - dateMillis(left)
      if (dateDelta !== 0) return dateDelta

      if (left.relevanceRank !== right.relevanceRank) {
        return left.relevanceRank - right.relevanceRank
      }

      return left.name.localeCompare(right.name)
    })
    .slice(0, MAX_RECOMMENDATIONS)
    .map(stripRank)
}

export default class OnboardingVendorDiscoveryService {
  public static async search(input: {
    projectDescription: string
    postalCode: string
    anonymousSessionUuid: string
  }) {
    const { draft, tokenUuid } = await OnboardingDraftService.createDraft({
      projectDescription: input.projectDescription,
      postalCode: input.postalCode,
      anonymousSessionUuid: input.anonymousSessionUuid,
    })

    let vendorSearches: VendorDiscoverySearch[]
    try {
      vendorSearches = validateVendorSearches(
        await ReasoningEngineService.requestVendorDiscovery({
          projectDescription: input.projectDescription,
        })
      )
    } catch (error) {
      if (error instanceof VendorDiscoveryDependencyError) {
        throw error
      }

      throw new VendorDiscoveryDependencyError('Reasoning engine vendor discovery failed')
    }

    let relevanceRank = 0
    const normalizedCandidates: RankedVendorCandidate[] = []

    try {
      for (const vendorSearch of vendorSearches.slice(0, MAX_VENDOR_SEARCHES)) {
        const places = await VendorSearchService.searchPlaces(vendorSearch.query, input.postalCode)

        for (const place of places) {
          const candidate = normalizeFoursquarePlace(place, relevanceRank++)
          if (candidate?.email) {
            normalizedCandidates.push(candidate)
          }
        }
      }
    } catch {
      throw new VendorDiscoveryDependencyError('Foursquare vendor search failed')
    }

    const matchedCandidates = await matchExistingListings(normalizedCandidates)
    const vendors = dedupeAndRankCandidates(matchedCandidates)

    await OnboardingDraftService.updateRecommendations(tokenUuid, {
      vendorSearches,
      recommendedVendors: vendors,
    })

    const freshDraft = await AnonymousOnboardingDraft.findOrFail(draft.id)

    return {
      onboardingToken: tokenUuid,
      draftUuid: freshDraft.uuid,
      vendorSearches,
      vendors: stripVendorSourcePayloads(vendors),
      expiresAt: freshDraft.expiresAt.toISO(),
      emptyStateReason: vendors.length === 0 ? NO_EMAIL_READY_VENDORS : undefined,
    }
  }
}
