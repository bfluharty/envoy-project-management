import env from '#start/env'
import fsqDevelopersPlacesSdk from '@api/fsq-developers-places'

const fsqDevelopersPlaces = fsqDevelopersPlacesSdk.default

const FOURSQUARE_API_VERSION = '2025-06-17'
const TEL_FORMAT = 'E164'
const SORT = 'RELEVANCE'
const LIMIT = 100

fsqDevelopersPlaces.auth(env.get('FOURSQUARE_PLACES_API_KEY', ''))
fsqDevelopersPlaces
  .placeSearch({
    'query': '',
    'near': '',
    'tel_format': TEL_FORMAT,
    'sort': SORT,
    'limit': LIMIT,
    'X-Places-Api-Version': FOURSQUARE_API_VERSION,
  })
  .then(({ data }) => console.log(data))
  .catch((err: unknown) => console.error(err))
