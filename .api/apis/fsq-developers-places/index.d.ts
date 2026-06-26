import type * as types from './types'

declare class SDK {
  config(config: { timeout?: number }): void
  auth(...values: Array<string | number>): this
  server(url: string, variables?: Record<string, unknown>): void
  placeSearch(
    metadata: types.PlaceSearchMetadataParam
  ): Promise<{ data: types.PlaceSearchResponse200 }>
}

declare const createSDK: SDK
export default createSDK

export type { PlaceSearchMetadataParam, PlaceSearchResponse200 } from './types'
