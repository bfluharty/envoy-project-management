import { findByRadius, findCoordinates } from 'zipcodes-us'

export const VENDOR_SEARCH_RADIUS_MILES = 50

export function normalizeUsPostalCode(postalCode: string | null | undefined) {
  const match = postalCode?.trim().match(/^([0-9]{5})(?:-[0-9]{4})?$/)
  return match?.[1] ?? null
}

export function getPostalCodesWithinRadius(
  postalCode: string,
  radiusMiles = VENDOR_SEARCH_RADIUS_MILES
) {
  const normalizedPostalCode = normalizeUsPostalCode(postalCode)
  if (!normalizedPostalCode || radiusMiles <= 0) return []

  const coordinates = findCoordinates(normalizedPostalCode)
  if (!coordinates.isValid) return []

  return [
    ...new Set([
      normalizedPostalCode,
      ...findByRadius(coordinates.latitude, coordinates.longitude, radiusMiles).map(
        (nearby) => nearby.zipCode
      ),
    ]),
  ]
}

export function normalizeVendorListingName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+(llc|inc|incorporated|co|company|corp|ltd)$/u, '')
    .trim()
}

export function normalizeVendorListingEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}
