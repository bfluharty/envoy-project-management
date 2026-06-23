import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
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

type VendorPlaceSearchMetadata = PlaceSearchMetadataParam & {
  fsq_category_ids?: string
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
      logger.debug('Using cached Foursquare Places SDK client')
      return this.client
    }

    logger.debug('Loading Foursquare Places SDK client')
    try {
      const sdkModule = await import('@api/fsq-developers-places')
      const defaultExport = sdkModule.default as
        | FoursquarePlacesClient
        | { default: FoursquarePlacesClient }
      this.client = 'default' in defaultExport ? defaultExport.default : defaultExport
    } catch (error) {
      logger.error({ err: error }, 'Failed to load Foursquare Places SDK client')
      throw error
    }

    logger.debug('Foursquare Places SDK client loaded')
    return this.client
  }

  public static async searchPlaces(
    query: string,
    postalCode: string,
    fsqCategoryIds: string[] = []
  ) {
    const client = await this.getClient()
    const apiKey = env.get('FOURSQUARE_PLACES_API_KEY', '')
    if (!apiKey) {
      logger.warn('Foursquare Places API key is not configured')
    }

    logger.info(
      { query, postalCode, limit: DEFAULT_LIMIT, fsqCategoryIdCount: fsqCategoryIds.length },
      'Searching Foursquare Places for vendor candidates'
    )
    client.auth(apiKey)

    let response
    try {
      const metadata: VendorPlaceSearchMetadata = {
        query,
        'near': postalCode,
        'tel_format': TEL_FORMAT,
        'sort': SORT,
        'limit': DEFAULT_LIMIT,
        'X-Places-Api-Version': FOURSQUARE_API_VERSION,
      }

      if (fsqCategoryIds.length > 0) {
        metadata.fsq_category_ids = fsqCategoryIds.join(',')
      }

      response = await client.placeSearch(metadata)
    } catch (error) {
      logger.error({ err: error, query, postalCode }, 'Foursquare Place Search request failed')
      throw error
    }

    const data = response.data
    if (Array.isArray(data)) {
      logger.info(
        { query, postalCode, resultCount: data.length },
        'Foursquare Place Search returned results'
      )
      return data
    }

    if (
      data &&
      typeof data === 'object' &&
      Array.isArray((data as { results?: unknown[] }).results)
    ) {
      const results = (data as { results: unknown[] }).results
      logger.info(
        { query, postalCode, resultCount: results.length },
        'Foursquare Place Search returned results'
      )
      return results
    }

    logger.warn(
      { query, postalCode, responseDataType: typeof data },
      'Foursquare Place Search returned an unexpected response shape'
    )
    return []
  }
}
