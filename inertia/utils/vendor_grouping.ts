export type VendorWithCategories = {
  categories?: readonly string[] | null
}

export type VendorClassificationGroup<T> = {
  classification: string
  vendors: T[]
}

const FALLBACK_CLASSIFICATION = 'Other vendors'

/**
 * Groups an already-ranked vendor list without re-sorting it.
 *
 * Foursquare returns the primary classification first. The first vendor seen for a
 * classification establishes that group's position, and vendors retain their input
 * order inside the group.
 */
export function groupVendorsByPrimaryClassification<T extends VendorWithCategories>(
  vendors: readonly T[]
): VendorClassificationGroup<T>[] {
  const groups = new Map<string, VendorClassificationGroup<T>>()

  for (const vendor of vendors) {
    const classification =
      vendor.categories?.find((category) => category.trim().length > 0)?.trim() ??
      FALLBACK_CLASSIFICATION
    const key = classification.toLocaleLowerCase()
    const existing = groups.get(key)

    if (existing) {
      existing.vendors.push(vendor)
    } else {
      groups.set(key, { classification, vendors: [vendor] })
    }
  }

  return [...groups.values()]
}
