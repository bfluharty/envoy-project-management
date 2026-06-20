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
