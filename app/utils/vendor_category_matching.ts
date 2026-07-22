const GENERIC_VENDOR_TERMS = new Set([
  'agency',
  'business',
  'co',
  'commercial',
  'company',
  'contractor',
  'corp',
  'corporation',
  'department',
  'dept',
  'home',
  'house',
  'inc',
  'installation',
  'install',
  'llc',
  'local',
  'office',
  'pro',
  'professional',
  'project',
  'provider',
  'residential',
  'section',
  'service',
  'vendor',
])

const CONTEXT_ONLY_TERMS = new Set([
  'backyard',
  'birthday',
  'coffee',
  'event',
  'guest',
  'guests',
  'party',
  'restaurant',
  'shop',
  'small',
  'wedding',
])

const INSTITUTIONAL_CATEGORY_TERMS = new Set([
  'building',
  'church',
  'government',
  'office',
  'school',
  'store',
  'venue',
])

function normalizeVendorMatchWord(word: string) {
  if (['drain', 'drainage', 'drains'].includes(word)) return 'drain'
  if (['cater', 'caterer', 'catering'].includes(word)) return 'cater'
  if (['electric', 'electrical', 'electrician'].includes(word)) return 'electric'
  if (['ethernet', 'network', 'networking'].includes(word)) return 'network'
  if (['landscape', 'landscaper', 'landscaping'].includes(word)) return 'landscap'
  if (['paint', 'painter', 'painting'].includes(word)) return 'paint'
  if (['plumb', 'plumber', 'plumbing'].includes(word)) return 'plumb'
  if (['shuttle', 'shuttles'].includes(word)) return 'shuttle'
  if (['wire', 'wires', 'wiring'].includes(word)) return 'wire'

  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.length > 4 && word.endsWith('ers')) return word.slice(0, -1)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

export function normalizeVendorCategoryMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/u)
    .filter(Boolean)
    .map(normalizeVendorMatchWord)
    .join(' ')
}

export function getMeaningfulVendorSearchTerms(...values: Array<string | null | undefined>) {
  const terms = new Set<string>()
  for (const value of values) {
    if (!value) continue
    for (const term of normalizeVendorCategoryMatchText(value).split(/\s+/u)) {
      if (term.length >= 3 && !GENERIC_VENDOR_TERMS.has(term) && !CONTEXT_ONLY_TERMS.has(term)) {
        terms.add(term)
      }
    }
  }
  return terms
}

export function textMatchesVendorSearchTerms(value: string, terms: ReadonlySet<string>) {
  if (terms.size === 0) return false
  const words = new Set(normalizeVendorCategoryMatchText(value).split(/\s+/u).filter(Boolean))
  return [...terms].some((term) => words.has(term))
}

export function hasInstitutionalCategory(categories: readonly string[]) {
  return categories.some((category) => {
    const words = normalizeVendorCategoryMatchText(category).split(/\s+/u)
    return words.some((word) => INSTITUTIONAL_CATEGORY_TERMS.has(word))
  })
}
