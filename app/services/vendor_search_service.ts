import env from '#start/env'
import type { PlaceSearchMetadataParam, PlaceSearchResponse200 } from '@api/fsq-developers-places'

const FOURSQUARE_API_VERSION = '2025-06-17'
const TEL_FORMAT = 'E164'
const SORT = 'RELEVANCE'
const DEFAULT_LIMIT = 50

type FoursquarePlacesClient = {
  auth(...values: Array<string | number>): unknown
  placeSearch(
    metadata: PlaceSearchMetadataParam
  ): Promise<{ data: PlaceSearchResponse200 | { results?: unknown[] } | unknown[] }>
}

export default class VendorSearchService {
  private static client: FoursquarePlacesClient | null = null

  public static setClientForTesting(client: FoursquarePlacesClient) {
    this.client = client
  }

  public static resetClientForTesting() {
    this.client = null
  }

  private static async getClient() {
    if (this.client) {
      return this.client
    }

    const sdkModule = await import('@api/fsq-developers-places')
    const defaultExport = sdkModule.default as
      | FoursquarePlacesClient
      | { default: FoursquarePlacesClient }
    this.client = 'default' in defaultExport ? defaultExport.default : defaultExport

    return this.client
  }

  public static async searchPlaces(query: string, postalCode: string) {
    const client = await this.getClient()
    client.auth(env.get('FOURSQUARE_PLACES_API_KEY', ''))
    const response = await client.placeSearch({
      query,
      'near': postalCode,
      'tel_format': TEL_FORMAT,
      'sort': SORT,
      'limit': DEFAULT_LIMIT,
      'X-Places-Api-Version': FOURSQUARE_API_VERSION,
    })

    const data = response.data
    if (Array.isArray(data)) {
      return data
    }

    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { results?: unknown[] }).results)
    ) {
      return (data as { results: unknown[] }).results
    }

    return []
  }
}
