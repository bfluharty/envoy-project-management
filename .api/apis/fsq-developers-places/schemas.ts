const Ask = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A natural language search query. Ask needs a search area from one of: a place mentioned in `query`, `ll`, or `location`. If the query does not mention a place, provide either `ll` or `location`. (e.g. "show me all cheap cafes in Williamsburg")',
          },
          ll: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude around which to retrieve place information. Use this when the query does not already contain a place and no location is provided. This must be specified as latitude,longitude (e.g., ll=41.8781,-87.6298).',
          },
          context: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Context for the query. (e.g. "Traveling with kids, stroller friendly, need outdoor seating.")',
          },
          location: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A string naming a locality in the world (e.g., "Chicago, IL"). Use this when the query does not already contain a place and no ll is provided. If the value is not geocodable, returns an error. Global search results will be omitted.',
          },
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. If no fields are specified, all <a href="response-fields#places-pro" target="_blank">Pro Fields</a> are returned by default. \n\nFor a complete list of returnable fields, refer to the <a href="response-fields" target="_blank">Places Response Fields</a> page.',
          },
        },
        required: ['query'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              justifications: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              place: {
                type: 'object',
                properties: {
                  fsq_place_id: { type: 'string' },
                  latitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  longitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  categories: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_category_id: { type: 'string' },
                        name: { type: 'string' },
                        short_name: { type: 'string' },
                        plural_name: { type: 'string' },
                        icon: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  chains: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_chain_id: { type: 'string' },
                        name: { type: 'string' },
                        logo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        parent_id: { type: 'string' },
                      },
                    },
                  },
                  date_closed: { type: 'string', format: 'date' },
                  date_created: { type: 'string' },
                  date_refreshed: { type: 'string' },
                  description: { type: 'string' },
                  distance: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  email: { type: 'string' },
                  extended_location: {
                    type: 'object',
                    properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
                  },
                  attributes: {
                    type: 'object',
                    properties: {
                      restroom: { type: 'boolean' },
                      outdoor_seating: { type: 'boolean' },
                      atm: { type: 'boolean' },
                      has_parking: { type: 'boolean' },
                      wifi: { type: 'string' },
                      delivery: { type: 'boolean' },
                      reservations: { type: 'boolean' },
                      takes_credit_card: { type: 'boolean' },
                    },
                  },
                  hours: {
                    type: 'object',
                    properties: {
                      display: { type: 'string' },
                      is_local_holiday: { type: 'boolean' },
                      open_now: { type: 'boolean' },
                      regular: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            close: { type: 'string' },
                            day: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            open: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  hours_popular: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        close: { type: 'string' },
                        day: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        open: { type: 'string' },
                      },
                    },
                  },
                  link: { type: 'string' },
                  location: {
                    type: 'object',
                    properties: {
                      address: { type: 'string' },
                      locality: { type: 'string' },
                      region: { type: 'string' },
                      postcode: { type: 'string' },
                      admin_region: { type: 'string' },
                      post_town: { type: 'string' },
                      po_box: { type: 'string' },
                      country: { type: 'string' },
                      formatted_address: { type: 'string' },
                    },
                  },
                  menu: { type: 'string' },
                  name: { type: 'string' },
                  photos: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_photo_id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            fsq_tip_id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                  },
                  place_actions: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string' },
                        url: { type: 'string' },
                        provider_id: { type: 'string' },
                      },
                    },
                  },
                  popularity: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  placemaker_url: { type: 'string' },
                  price: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  rating: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  related_places: {
                    type: 'object',
                    properties: {
                      parent: {
                        type: 'object',
                        properties: {
                          fsq_place_id: { type: 'string' },
                          latitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          longitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          categories: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                fsq_category_id: { type: 'string' },
                                name: { type: 'string' },
                                short_name: { type: 'string' },
                                plural_name: { type: 'string' },
                                icon: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    prefix: { type: 'string' },
                                    suffix: { type: 'string' },
                                    width: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    height: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    classifications: {
                                      type: 'array',
                                      properties: { traversable_again: { type: 'boolean' } },
                                      items: { type: 'string' },
                                    },
                                    tip: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        text: { type: 'string' },
                                        url: { type: 'string' },
                                        photo: {},
                                        lang: { type: 'string' },
                                        agree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                        disagree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          chains: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                fsq_chain_id: { type: 'string' },
                                name: { type: 'string' },
                                logo: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    prefix: { type: 'string' },
                                    suffix: { type: 'string' },
                                    width: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    height: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    classifications: {
                                      type: 'array',
                                      properties: { traversable_again: { type: 'boolean' } },
                                      items: { type: 'string' },
                                    },
                                    tip: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        text: { type: 'string' },
                                        url: { type: 'string' },
                                        photo: {},
                                        lang: { type: 'string' },
                                        agree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                        disagree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                      },
                                    },
                                  },
                                },
                                parent_id: { type: 'string' },
                              },
                            },
                          },
                          date_closed: { type: 'string', format: 'date' },
                          date_created: { type: 'string' },
                          date_refreshed: { type: 'string' },
                          description: { type: 'string' },
                          distance: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          email: { type: 'string' },
                          extended_location: {
                            type: 'object',
                            properties: {
                              dma: { type: 'string' },
                              census_block_id: { type: 'string' },
                            },
                          },
                          attributes: {
                            type: 'object',
                            properties: {
                              restroom: { type: 'boolean' },
                              outdoor_seating: { type: 'boolean' },
                              atm: { type: 'boolean' },
                              has_parking: { type: 'boolean' },
                              wifi: { type: 'string' },
                              delivery: { type: 'boolean' },
                              reservations: { type: 'boolean' },
                              takes_credit_card: { type: 'boolean' },
                            },
                          },
                          hours: {
                            type: 'object',
                            properties: {
                              display: { type: 'string' },
                              is_local_holiday: { type: 'boolean' },
                              open_now: { type: 'boolean' },
                              regular: {
                                type: 'array',
                                properties: { traversable_again: { type: 'boolean' } },
                                items: {
                                  type: 'object',
                                  properties: {
                                    close: { type: 'string' },
                                    day: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    open: { type: 'string' },
                                  },
                                },
                              },
                            },
                          },
                          hours_popular: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                close: { type: 'string' },
                                day: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                open: { type: 'string' },
                              },
                            },
                          },
                          link: { type: 'string' },
                          location: {
                            type: 'object',
                            properties: {
                              address: { type: 'string' },
                              locality: { type: 'string' },
                              region: { type: 'string' },
                              postcode: { type: 'string' },
                              admin_region: { type: 'string' },
                              post_town: { type: 'string' },
                              po_box: { type: 'string' },
                              country: { type: 'string' },
                              formatted_address: { type: 'string' },
                            },
                          },
                          menu: { type: 'string' },
                          name: { type: 'string' },
                          photos: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                          },
                          place_actions: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                action: { type: 'string' },
                                url: { type: 'string' },
                                provider_id: { type: 'string' },
                              },
                            },
                          },
                          popularity: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          placemaker_url: { type: 'string' },
                          price: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          rating: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          social_media: {
                            type: 'object',
                            properties: {
                              facebook_id: { type: 'string' },
                              instagram: { type: 'string' },
                              twitter: { type: 'string' },
                            },
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              total_photos: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              total_ratings: {
                                type: 'integer',
                                format: 'int64',
                                minimum: -9223372036854776000,
                                maximum: 9223372036854776000,
                              },
                              total_tips: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                          store_id: { type: 'string' },
                          tastes: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tel: { type: 'string' },
                          tips: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                          website: { type: 'string' },
                        },
                      },
                      children: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_place_id: { type: 'string' },
                            latitude: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            longitude: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            categories: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  fsq_category_id: { type: 'string' },
                                  name: { type: 'string' },
                                  short_name: { type: 'string' },
                                  plural_name: { type: 'string' },
                                  icon: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      prefix: { type: 'string' },
                                      suffix: { type: 'string' },
                                      width: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      height: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      classifications: {
                                        type: 'array',
                                        properties: { traversable_again: { type: 'boolean' } },
                                        items: { type: 'string' },
                                      },
                                      tip: {
                                        type: 'object',
                                        properties: {
                                          id: { type: 'string' },
                                          created_at: { type: 'string', format: 'date-time' },
                                          text: { type: 'string' },
                                          url: { type: 'string' },
                                          photo: {},
                                          lang: { type: 'string' },
                                          agree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                          disagree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            chains: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  fsq_chain_id: { type: 'string' },
                                  name: { type: 'string' },
                                  logo: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      prefix: { type: 'string' },
                                      suffix: { type: 'string' },
                                      width: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      height: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      classifications: {
                                        type: 'array',
                                        properties: { traversable_again: { type: 'boolean' } },
                                        items: { type: 'string' },
                                      },
                                      tip: {
                                        type: 'object',
                                        properties: {
                                          id: { type: 'string' },
                                          created_at: { type: 'string', format: 'date-time' },
                                          text: { type: 'string' },
                                          url: { type: 'string' },
                                          photo: {},
                                          lang: { type: 'string' },
                                          agree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                          disagree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                        },
                                      },
                                    },
                                  },
                                  parent_id: { type: 'string' },
                                },
                              },
                            },
                            date_closed: { type: 'string', format: 'date' },
                            date_created: { type: 'string' },
                            date_refreshed: { type: 'string' },
                            description: { type: 'string' },
                            distance: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            email: { type: 'string' },
                            extended_location: {
                              type: 'object',
                              properties: {
                                dma: { type: 'string' },
                                census_block_id: { type: 'string' },
                              },
                            },
                            attributes: {
                              type: 'object',
                              properties: {
                                restroom: { type: 'boolean' },
                                outdoor_seating: { type: 'boolean' },
                                atm: { type: 'boolean' },
                                has_parking: { type: 'boolean' },
                                wifi: { type: 'string' },
                                delivery: { type: 'boolean' },
                                reservations: { type: 'boolean' },
                                takes_credit_card: { type: 'boolean' },
                              },
                            },
                            hours: {
                              type: 'object',
                              properties: {
                                display: { type: 'string' },
                                is_local_holiday: { type: 'boolean' },
                                open_now: { type: 'boolean' },
                                regular: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: {
                                    type: 'object',
                                    properties: {
                                      close: { type: 'string' },
                                      day: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      open: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                            hours_popular: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  close: { type: 'string' },
                                  day: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  open: { type: 'string' },
                                },
                              },
                            },
                            link: { type: 'string' },
                            location: {
                              type: 'object',
                              properties: {
                                address: { type: 'string' },
                                locality: { type: 'string' },
                                region: { type: 'string' },
                                postcode: { type: 'string' },
                                admin_region: { type: 'string' },
                                post_town: { type: 'string' },
                                po_box: { type: 'string' },
                                country: { type: 'string' },
                                formatted_address: { type: 'string' },
                              },
                            },
                            menu: { type: 'string' },
                            name: { type: 'string' },
                            photos: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  prefix: { type: 'string' },
                                  suffix: { type: 'string' },
                                  width: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  height: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  tip: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      text: { type: 'string' },
                                      url: { type: 'string' },
                                      photo: {},
                                      lang: { type: 'string' },
                                      agree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      disagree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            place_actions: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  action: { type: 'string' },
                                  url: { type: 'string' },
                                  provider_id: { type: 'string' },
                                },
                              },
                            },
                            popularity: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            placemaker_url: { type: 'string' },
                            price: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            rating: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            social_media: {
                              type: 'object',
                              properties: {
                                facebook_id: { type: 'string' },
                                instagram: { type: 'string' },
                                twitter: { type: 'string' },
                              },
                            },
                            stats: {
                              type: 'object',
                              properties: {
                                total_photos: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                total_ratings: {
                                  type: 'integer',
                                  format: 'int64',
                                  minimum: -9223372036854776000,
                                  maximum: 9223372036854776000,
                                },
                                total_tips: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                            store_id: { type: 'string' },
                            tastes: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tel: { type: 'string' },
                            tips: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  text: { type: 'string' },
                                  url: { type: 'string' },
                                  photo: {},
                                  lang: { type: 'string' },
                                  agree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  disagree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                },
                              },
                            },
                            website: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  social_media: {
                    type: 'object',
                    properties: {
                      facebook_id: { type: 'string' },
                      instagram: { type: 'string' },
                      twitter: { type: 'string' },
                    },
                  },
                  stats: {
                    type: 'object',
                    properties: {
                      total_photos: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      total_ratings: {
                        type: 'integer',
                        format: 'int64',
                        minimum: -9223372036854776000,
                        maximum: 9223372036854776000,
                      },
                      total_tips: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                  store_id: { type: 'string' },
                  tastes: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tel: { type: 'string' },
                  tips: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_tip_id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        text: { type: 'string' },
                        url: { type: 'string' },
                        photo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        lang: { type: 'string' },
                        agree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        disagree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                  unresolved_flags: {
                    uniqueItems: true,
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  veracity_rating: { type: 'object', additionalProperties: true },
                  website: { type: 'string' },
                  plugins: {
                    type: 'object',
                    properties: { traversable_again: { type: 'boolean' } },
                    additionalProperties: { type: 'object', additionalProperties: true },
                  },
                },
              },
            },
          },
        },
        result_summary: {
          type: 'object',
          properties: {
            count: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const Autocomplete = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A search term to be applied against titles. Must be at least 3 characters long.',
          },
          ll: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude around which you wish to retrieve place information. Specified as latitude,longitude (e.g., ll=41.8781,-87.6298). If you do not specify ll, the server will attempt to retrieve the IP address from the request, and geolocate that IP address.',
          },
          radius: {
            type: 'integer',
            format: 'int32',
            minimum: -2147483648,
            maximum: 2147483647,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Defines the distance (in meters) within which to return place results. Setting a radius biases the results to the indicated area, but may not fully restrict results to that specified area. If not provided, default radius is set to 5000 meters.',
          },
          types: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The types of results to return; any combination of place, search, and/or geo.If no types are specified, all types will be returned.',
          },
          bias: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Bias the autocomplete results by a specific type; one of place, search, or geo.',
          },
          session_token: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A user-generated token to to group the user's query and the user's selected result into a discrete session for billing purposes. Learn more about [session tokens](https://docs.foursquare.com/reference/session-tokens).\n\n*If the session_token parameter is omitted, the session is charged per keystroke/request.*",
          },
          limit: {
            maximum: 50,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The number of results to return, up to 50. Defaults to 10.',
          },
        },
        required: ['query'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              text: {
                type: 'object',
                properties: {
                  primary: { type: 'string' },
                  secondary: { type: 'string' },
                  highlight: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        start: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        length: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                },
              },
              icon: {
                type: 'object',
                properties: {
                  fsq_photo_id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  width: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  height: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  classifications: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tip: {
                    type: 'object',
                    properties: {
                      fsq_tip_id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
              },
              link: { type: 'string' },
              place: {
                type: 'object',
                properties: {
                  fsq_place_id: { type: 'string' },
                  latitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  longitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  categories: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_category_id: { type: 'string' },
                        name: { type: 'string' },
                        short_name: { type: 'string' },
                        plural_name: { type: 'string' },
                        icon: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  chains: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_chain_id: { type: 'string' },
                        name: { type: 'string' },
                        logo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        parent_id: { type: 'string' },
                      },
                    },
                  },
                  date_closed: { type: 'string', format: 'date' },
                  date_created: { type: 'string' },
                  date_refreshed: { type: 'string' },
                  description: { type: 'string' },
                  distance: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  email: { type: 'string' },
                  extended_location: {
                    type: 'object',
                    properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
                  },
                  attributes: {
                    type: 'object',
                    properties: {
                      restroom: { type: 'boolean' },
                      outdoor_seating: { type: 'boolean' },
                      atm: { type: 'boolean' },
                      has_parking: { type: 'boolean' },
                      wifi: { type: 'string' },
                      delivery: { type: 'boolean' },
                      reservations: { type: 'boolean' },
                      takes_credit_card: { type: 'boolean' },
                    },
                  },
                  hours: {
                    type: 'object',
                    properties: {
                      display: { type: 'string' },
                      is_local_holiday: { type: 'boolean' },
                      open_now: { type: 'boolean' },
                      regular: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            close: { type: 'string' },
                            day: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            open: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  hours_popular: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        close: { type: 'string' },
                        day: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        open: { type: 'string' },
                      },
                    },
                  },
                  link: { type: 'string' },
                  location: {
                    type: 'object',
                    properties: {
                      address: { type: 'string' },
                      locality: { type: 'string' },
                      region: { type: 'string' },
                      postcode: { type: 'string' },
                      admin_region: { type: 'string' },
                      post_town: { type: 'string' },
                      po_box: { type: 'string' },
                      country: { type: 'string' },
                      formatted_address: { type: 'string' },
                    },
                  },
                  menu: { type: 'string' },
                  name: { type: 'string' },
                  photos: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_photo_id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            fsq_tip_id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                  },
                  place_actions: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string' },
                        url: { type: 'string' },
                        provider_id: { type: 'string' },
                      },
                    },
                  },
                  popularity: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  placemaker_url: { type: 'string' },
                  price: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  rating: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  related_places: {
                    type: 'object',
                    properties: {
                      parent: {
                        type: 'object',
                        properties: {
                          fsq_place_id: { type: 'string' },
                          latitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          longitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          categories: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                fsq_category_id: { type: 'string' },
                                name: { type: 'string' },
                                short_name: { type: 'string' },
                                plural_name: { type: 'string' },
                                icon: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    prefix: { type: 'string' },
                                    suffix: { type: 'string' },
                                    width: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    height: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    classifications: {
                                      type: 'array',
                                      properties: { traversable_again: { type: 'boolean' } },
                                      items: { type: 'string' },
                                    },
                                    tip: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        text: { type: 'string' },
                                        url: { type: 'string' },
                                        photo: {},
                                        lang: { type: 'string' },
                                        agree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                        disagree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          chains: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                fsq_chain_id: { type: 'string' },
                                name: { type: 'string' },
                                logo: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    prefix: { type: 'string' },
                                    suffix: { type: 'string' },
                                    width: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    height: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    classifications: {
                                      type: 'array',
                                      properties: { traversable_again: { type: 'boolean' } },
                                      items: { type: 'string' },
                                    },
                                    tip: {
                                      type: 'object',
                                      properties: {
                                        id: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        text: { type: 'string' },
                                        url: { type: 'string' },
                                        photo: {},
                                        lang: { type: 'string' },
                                        agree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                        disagree_count: {
                                          type: 'integer',
                                          format: 'int32',
                                          minimum: -2147483648,
                                          maximum: 2147483647,
                                        },
                                      },
                                    },
                                  },
                                },
                                parent_id: { type: 'string' },
                              },
                            },
                          },
                          date_closed: { type: 'string', format: 'date' },
                          date_created: { type: 'string' },
                          date_refreshed: { type: 'string' },
                          description: { type: 'string' },
                          distance: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          email: { type: 'string' },
                          extended_location: {
                            type: 'object',
                            properties: {
                              dma: { type: 'string' },
                              census_block_id: { type: 'string' },
                            },
                          },
                          attributes: {
                            type: 'object',
                            properties: {
                              restroom: { type: 'boolean' },
                              outdoor_seating: { type: 'boolean' },
                              atm: { type: 'boolean' },
                              has_parking: { type: 'boolean' },
                              wifi: { type: 'string' },
                              delivery: { type: 'boolean' },
                              reservations: { type: 'boolean' },
                              takes_credit_card: { type: 'boolean' },
                            },
                          },
                          hours: {
                            type: 'object',
                            properties: {
                              display: { type: 'string' },
                              is_local_holiday: { type: 'boolean' },
                              open_now: { type: 'boolean' },
                              regular: {
                                type: 'array',
                                properties: { traversable_again: { type: 'boolean' } },
                                items: {
                                  type: 'object',
                                  properties: {
                                    close: { type: 'string' },
                                    day: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    open: { type: 'string' },
                                  },
                                },
                              },
                            },
                          },
                          hours_popular: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                close: { type: 'string' },
                                day: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                open: { type: 'string' },
                              },
                            },
                          },
                          link: { type: 'string' },
                          location: {
                            type: 'object',
                            properties: {
                              address: { type: 'string' },
                              locality: { type: 'string' },
                              region: { type: 'string' },
                              postcode: { type: 'string' },
                              admin_region: { type: 'string' },
                              post_town: { type: 'string' },
                              po_box: { type: 'string' },
                              country: { type: 'string' },
                              formatted_address: { type: 'string' },
                            },
                          },
                          menu: { type: 'string' },
                          name: { type: 'string' },
                          photos: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                          },
                          place_actions: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                action: { type: 'string' },
                                url: { type: 'string' },
                                provider_id: { type: 'string' },
                              },
                            },
                          },
                          popularity: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          placemaker_url: { type: 'string' },
                          price: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          rating: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          social_media: {
                            type: 'object',
                            properties: {
                              facebook_id: { type: 'string' },
                              instagram: { type: 'string' },
                              twitter: { type: 'string' },
                            },
                          },
                          stats: {
                            type: 'object',
                            properties: {
                              total_photos: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              total_ratings: {
                                type: 'integer',
                                format: 'int64',
                                minimum: -9223372036854776000,
                                maximum: 9223372036854776000,
                              },
                              total_tips: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                          store_id: { type: 'string' },
                          tastes: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tel: { type: 'string' },
                          tips: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                          website: { type: 'string' },
                        },
                      },
                      children: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_place_id: { type: 'string' },
                            latitude: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            longitude: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            categories: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  fsq_category_id: { type: 'string' },
                                  name: { type: 'string' },
                                  short_name: { type: 'string' },
                                  plural_name: { type: 'string' },
                                  icon: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      prefix: { type: 'string' },
                                      suffix: { type: 'string' },
                                      width: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      height: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      classifications: {
                                        type: 'array',
                                        properties: { traversable_again: { type: 'boolean' } },
                                        items: { type: 'string' },
                                      },
                                      tip: {
                                        type: 'object',
                                        properties: {
                                          id: { type: 'string' },
                                          created_at: { type: 'string', format: 'date-time' },
                                          text: { type: 'string' },
                                          url: { type: 'string' },
                                          photo: {},
                                          lang: { type: 'string' },
                                          agree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                          disagree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            chains: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  fsq_chain_id: { type: 'string' },
                                  name: { type: 'string' },
                                  logo: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      prefix: { type: 'string' },
                                      suffix: { type: 'string' },
                                      width: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      height: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      classifications: {
                                        type: 'array',
                                        properties: { traversable_again: { type: 'boolean' } },
                                        items: { type: 'string' },
                                      },
                                      tip: {
                                        type: 'object',
                                        properties: {
                                          id: { type: 'string' },
                                          created_at: { type: 'string', format: 'date-time' },
                                          text: { type: 'string' },
                                          url: { type: 'string' },
                                          photo: {},
                                          lang: { type: 'string' },
                                          agree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                          disagree_count: {
                                            type: 'integer',
                                            format: 'int32',
                                            minimum: -2147483648,
                                            maximum: 2147483647,
                                          },
                                        },
                                      },
                                    },
                                  },
                                  parent_id: { type: 'string' },
                                },
                              },
                            },
                            date_closed: { type: 'string', format: 'date' },
                            date_created: { type: 'string' },
                            date_refreshed: { type: 'string' },
                            description: { type: 'string' },
                            distance: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            email: { type: 'string' },
                            extended_location: {
                              type: 'object',
                              properties: {
                                dma: { type: 'string' },
                                census_block_id: { type: 'string' },
                              },
                            },
                            attributes: {
                              type: 'object',
                              properties: {
                                restroom: { type: 'boolean' },
                                outdoor_seating: { type: 'boolean' },
                                atm: { type: 'boolean' },
                                has_parking: { type: 'boolean' },
                                wifi: { type: 'string' },
                                delivery: { type: 'boolean' },
                                reservations: { type: 'boolean' },
                                takes_credit_card: { type: 'boolean' },
                              },
                            },
                            hours: {
                              type: 'object',
                              properties: {
                                display: { type: 'string' },
                                is_local_holiday: { type: 'boolean' },
                                open_now: { type: 'boolean' },
                                regular: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: {
                                    type: 'object',
                                    properties: {
                                      close: { type: 'string' },
                                      day: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      open: { type: 'string' },
                                    },
                                  },
                                },
                              },
                            },
                            hours_popular: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  close: { type: 'string' },
                                  day: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  open: { type: 'string' },
                                },
                              },
                            },
                            link: { type: 'string' },
                            location: {
                              type: 'object',
                              properties: {
                                address: { type: 'string' },
                                locality: { type: 'string' },
                                region: { type: 'string' },
                                postcode: { type: 'string' },
                                admin_region: { type: 'string' },
                                post_town: { type: 'string' },
                                po_box: { type: 'string' },
                                country: { type: 'string' },
                                formatted_address: { type: 'string' },
                              },
                            },
                            menu: { type: 'string' },
                            name: { type: 'string' },
                            photos: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  prefix: { type: 'string' },
                                  suffix: { type: 'string' },
                                  width: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  height: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  tip: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      text: { type: 'string' },
                                      url: { type: 'string' },
                                      photo: {},
                                      lang: { type: 'string' },
                                      agree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      disagree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                    },
                                  },
                                },
                              },
                            },
                            place_actions: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  action: { type: 'string' },
                                  url: { type: 'string' },
                                  provider_id: { type: 'string' },
                                },
                              },
                            },
                            popularity: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            placemaker_url: { type: 'string' },
                            price: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            rating: {
                              type: 'number',
                              format: 'double',
                              minimum: -1.7976931348623157e308,
                              maximum: 1.7976931348623157e308,
                            },
                            social_media: {
                              type: 'object',
                              properties: {
                                facebook_id: { type: 'string' },
                                instagram: { type: 'string' },
                                twitter: { type: 'string' },
                              },
                            },
                            stats: {
                              type: 'object',
                              properties: {
                                total_photos: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                total_ratings: {
                                  type: 'integer',
                                  format: 'int64',
                                  minimum: -9223372036854776000,
                                  maximum: 9223372036854776000,
                                },
                                total_tips: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                            store_id: { type: 'string' },
                            tastes: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tel: { type: 'string' },
                            tips: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  text: { type: 'string' },
                                  url: { type: 'string' },
                                  photo: {},
                                  lang: { type: 'string' },
                                  agree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  disagree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                },
                              },
                            },
                            website: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  social_media: {
                    type: 'object',
                    properties: {
                      facebook_id: { type: 'string' },
                      instagram: { type: 'string' },
                      twitter: { type: 'string' },
                    },
                  },
                  stats: {
                    type: 'object',
                    properties: {
                      total_photos: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      total_ratings: {
                        type: 'integer',
                        format: 'int64',
                        minimum: -9223372036854776000,
                        maximum: 9223372036854776000,
                      },
                      total_tips: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                  store_id: { type: 'string' },
                  tastes: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tel: { type: 'string' },
                  tips: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_tip_id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        text: { type: 'string' },
                        url: { type: 'string' },
                        photo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        lang: { type: 'string' },
                        agree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        disagree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                  unresolved_flags: {
                    uniqueItems: true,
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  veracity_rating: { type: 'object', additionalProperties: true },
                  website: { type: 'string' },
                  plugins: {
                    type: 'object',
                    properties: { traversable_again: { type: 'boolean' } },
                    additionalProperties: { type: 'object', additionalProperties: true },
                  },
                },
              },
              search: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  category: {
                    type: 'object',
                    properties: {
                      fsq_category_id: { type: 'string' },
                      name: { type: 'string' },
                      short_name: { type: 'string' },
                      plural_name: { type: 'string' },
                      icon: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  chain: {
                    type: 'object',
                    properties: {
                      fsq_chain_id: { type: 'string' },
                      name: { type: 'string' },
                      logo: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                      parent_id: { type: 'string' },
                    },
                  },
                },
              },
              geo: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  center: {
                    type: 'object',
                    properties: {
                      latitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      longitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                    },
                  },
                  bounds: {
                    type: 'object',
                    properties: {
                      ne: {
                        type: 'object',
                        properties: {
                          latitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          longitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                        },
                      },
                      sw: {
                        type: 'object',
                        properties: {
                          latitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                          longitude: {
                            type: 'number',
                            format: 'double',
                            minimum: -1.7976931348623157e308,
                            maximum: 1.7976931348623157e308,
                          },
                        },
                      },
                    },
                  },
                  cc: { type: 'string' },
                  type: { type: 'string' },
                },
              },
              debug: {
                type: 'object',
                properties: {
                  score: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const GeotaggingCandidates = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. If no fields are specified, all <a href="response-fields#places-pro" target="_blank">Pro Fields</a> are returned by default. \n\nFor a complete list of returnable fields, refer to the <a href="response-fields" target="_blank">Places Response Fields</a> page.',
          },
          ll: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude around which to retrieve place information. This must be specified as latitude,longitude (e.g., ll=41.8781,-87.6298). If you do not specify ll, the server will attempt to retrieve the IP address from the request, and geolocate that IP address.',
          },
          hacc: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The estimated horizontal accuracy radius in meters of the user?s location at the 68th percentile confidence level as returned by the user?s cell phone OS.',
          },
          altitude: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The altitude of the user?s location in meters above the World Geodetic System 1984 (WGS84) reference ellipsoid as returned by the user?s cell phone OS.',
          },
          query: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'A string to be matched against place name for candidates.',
          },
          limit: {
            maximum: 50,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The number of results to return, up to 50. Defaults to 10.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_place_id: { type: 'string' },
              latitude: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              longitude: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              categories: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_category_id: { type: 'string' },
                    name: { type: 'string' },
                    short_name: { type: 'string' },
                    plural_name: { type: 'string' },
                    icon: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              chains: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_chain_id: { type: 'string' },
                    name: { type: 'string' },
                    logo: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                    parent_id: { type: 'string' },
                  },
                },
              },
              date_closed: { type: 'string', format: 'date' },
              date_created: { type: 'string' },
              date_refreshed: { type: 'string' },
              description: { type: 'string' },
              distance: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              email: { type: 'string' },
              extended_location: {
                type: 'object',
                properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
              },
              attributes: {
                type: 'object',
                properties: {
                  restroom: { type: 'boolean' },
                  outdoor_seating: { type: 'boolean' },
                  atm: { type: 'boolean' },
                  has_parking: { type: 'boolean' },
                  wifi: { type: 'string' },
                  delivery: { type: 'boolean' },
                  reservations: { type: 'boolean' },
                  takes_credit_card: { type: 'boolean' },
                },
              },
              hours: {
                type: 'object',
                properties: {
                  display: { type: 'string' },
                  is_local_holiday: { type: 'boolean' },
                  open_now: { type: 'boolean' },
                  regular: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        close: { type: 'string' },
                        day: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        open: { type: 'string' },
                      },
                    },
                  },
                },
              },
              hours_popular: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    close: { type: 'string' },
                    day: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    open: { type: 'string' },
                  },
                },
              },
              link: { type: 'string' },
              location: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  locality: { type: 'string' },
                  region: { type: 'string' },
                  postcode: { type: 'string' },
                  admin_region: { type: 'string' },
                  post_town: { type: 'string' },
                  po_box: { type: 'string' },
                  country: { type: 'string' },
                  formatted_address: { type: 'string' },
                },
              },
              menu: { type: 'string' },
              name: { type: 'string' },
              photos: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    prefix: { type: 'string' },
                    suffix: { type: 'string' },
                    width: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    height: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    tip: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        text: { type: 'string' },
                        url: { type: 'string' },
                        photo: {},
                        lang: { type: 'string' },
                        agree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        disagree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                },
              },
              place_actions: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    url: { type: 'string' },
                    provider_id: { type: 'string' },
                  },
                },
              },
              popularity: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              placemaker_url: { type: 'string' },
              price: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              rating: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              social_media: {
                type: 'object',
                properties: {
                  facebook_id: { type: 'string' },
                  instagram: { type: 'string' },
                  twitter: { type: 'string' },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  total_photos: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  total_ratings: {
                    type: 'integer',
                    format: 'int64',
                    minimum: -9223372036854776000,
                    maximum: 9223372036854776000,
                  },
                  total_tips: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
              store_id: { type: 'string' },
              tastes: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              tel: { type: 'string' },
              tips: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    text: { type: 'string' },
                    url: { type: 'string' },
                    photo: {},
                    lang: { type: 'string' },
                    agree_count: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    disagree_count: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                  },
                },
              },
              website: { type: 'string' },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const GeotaggingConfirm = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          request_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The request ID pulled from the header of the /geotagging/candidates request that generated the list of candidates shown to the user. The header key is X-Fsq-Request-Id.',
          },
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The FSQ Place ID of the place which was selected by the user from the candidates list',
          },
          confirm_context: {
            type: 'string',
            enum: ['CurrentLocation', 'Nearby', 'Destination', 'Search'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Specify the use case for specified request. Options are: CurrentLocation, Nearby, Destination, Search',
          },
          delayed: { type: 'boolean', $schema: 'http://json-schema.org/draft-04/schema#' },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: { response: { type: 'string' } },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const OfflineJobsCredentialsRefresh = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_job_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The ID of the job to refresh credentials for.',
          },
        },
        required: ['fsq_job_id'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        access_key_id: { type: 'string' },
        secret_access_key: { type: 'string' },
        session_token: { type: 'string' },
        job_id: { type: 'string' },
        input_uri: { type: 'string' },
        output_uri: { type: 'string' },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const OfflineJobsExecute = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_job_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The ID of the offline job to execute.',
          },
        },
        required: ['fsq_job_id'],
      },
      {
        type: 'object',
        properties: {
          country_codes: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The list of country codes to include in the job. Valid country codes can be found [here](https://docs.foursquare.com/fsq-developers-places/reference/batch-place-match-1#valid-countries). This is only required for place_match jobs.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: { job_id: { type: 'string' }, status: { type: 'string' } },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const OfflineJobsInitialize = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          durationSeconds: {
            maximum: 43200,
            minimum: 900,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The duration, in seconds, that the credentials should remain valid. Value must be between 900 and 43200 seconds. If not provided, defaults to 3600 seconds. ',
          },
          job_type: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The type of offline job to initialize. Supported values are: place_match, transaction_match.',
          },
        },
        required: ['job_type'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        access_key_id: { type: 'string' },
        secret_access_key: { type: 'string' },
        session_token: { type: 'string' },
        job_id: { type: 'string' },
        input_uri: { type: 'string' },
        output_uri: { type: 'string' },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const OfflineJobsStatus = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          job_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'An optional comma-separated list of IDs of the Places API offline jobs to get statuses for. These IDs are returned when Places API offline jobs are initialized. If not provided, statuses for all of your previously submitted jobs will be returned.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        job_statuses: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              job_id: { type: 'string' },
              status: { type: 'string' },
              start_time: { type: 'object', additionalProperties: true },
              end_time: { type: 'object', additionalProperties: true },
              errors: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceDetails = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. If no fields are specified, all <a href="response-fields#places-pro" target="_blank">Pro Fields</a> are returned by default. \n\nFor a complete list of returnable fields, refer to the <a href="response-fields" target="_blank">Places Response Fields</a> page.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        fsq_place_id: { type: 'string' },
        latitude: {
          type: 'number',
          format: 'double',
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
        },
        longitude: {
          type: 'number',
          format: 'double',
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
        },
        categories: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_category_id: { type: 'string' },
              name: { type: 'string' },
              short_name: { type: 'string' },
              plural_name: { type: 'string' },
              icon: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  width: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  height: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  classifications: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tip: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {},
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        chains: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_chain_id: { type: 'string' },
              name: { type: 'string' },
              logo: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  width: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  height: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  classifications: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tip: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {},
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
              },
              parent_id: { type: 'string' },
            },
          },
        },
        date_closed: { type: 'string', format: 'date' },
        date_created: { type: 'string' },
        date_refreshed: { type: 'string' },
        description: { type: 'string' },
        distance: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
        email: { type: 'string' },
        extended_location: {
          type: 'object',
          properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
        },
        attributes: {
          type: 'object',
          properties: {
            restroom: { type: 'boolean' },
            outdoor_seating: { type: 'boolean' },
            atm: { type: 'boolean' },
            has_parking: { type: 'boolean' },
            wifi: { type: 'string' },
            delivery: { type: 'boolean' },
            reservations: { type: 'boolean' },
            takes_credit_card: { type: 'boolean' },
          },
        },
        hours: {
          type: 'object',
          properties: {
            display: { type: 'string' },
            is_local_holiday: { type: 'boolean' },
            open_now: { type: 'boolean' },
            regular: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  close: { type: 'string' },
                  day: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  open: { type: 'string' },
                },
              },
            },
          },
        },
        hours_popular: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              close: { type: 'string' },
              day: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
              open: { type: 'string' },
            },
          },
        },
        link: { type: 'string' },
        location: {
          type: 'object',
          properties: {
            address: { type: 'string' },
            locality: { type: 'string' },
            region: { type: 'string' },
            postcode: { type: 'string' },
            admin_region: { type: 'string' },
            post_town: { type: 'string' },
            po_box: { type: 'string' },
            country: { type: 'string' },
            formatted_address: { type: 'string' },
          },
        },
        menu: { type: 'string' },
        name: { type: 'string' },
        photos: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_photo_id: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              prefix: { type: 'string' },
              suffix: { type: 'string' },
              width: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              height: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              classifications: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              tip: {
                type: 'object',
                properties: {
                  fsq_tip_id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  text: { type: 'string' },
                  url: { type: 'string' },
                  photo: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      prefix: { type: 'string' },
                      suffix: { type: 'string' },
                      width: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      height: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      classifications: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tip: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                  },
                  lang: { type: 'string' },
                  agree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  disagree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
            },
          },
        },
        place_actions: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              action: { type: 'string' },
              url: { type: 'string' },
              provider_id: { type: 'string' },
            },
          },
        },
        popularity: {
          type: 'number',
          format: 'double',
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
        },
        placemaker_url: { type: 'string' },
        price: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
        rating: {
          type: 'number',
          format: 'double',
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
        },
        related_places: {
          type: 'object',
          properties: {
            parent: {
              type: 'object',
              properties: {
                fsq_place_id: { type: 'string' },
                latitude: {
                  type: 'number',
                  format: 'double',
                  minimum: -1.7976931348623157e308,
                  maximum: 1.7976931348623157e308,
                },
                longitude: {
                  type: 'number',
                  format: 'double',
                  minimum: -1.7976931348623157e308,
                  maximum: 1.7976931348623157e308,
                },
                categories: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      fsq_category_id: { type: 'string' },
                      name: { type: 'string' },
                      short_name: { type: 'string' },
                      plural_name: { type: 'string' },
                      icon: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                chains: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      fsq_chain_id: { type: 'string' },
                      name: { type: 'string' },
                      logo: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                      parent_id: { type: 'string' },
                    },
                  },
                },
                date_closed: { type: 'string', format: 'date' },
                date_created: { type: 'string' },
                date_refreshed: { type: 'string' },
                description: { type: 'string' },
                distance: {
                  type: 'integer',
                  format: 'int32',
                  minimum: -2147483648,
                  maximum: 2147483647,
                },
                email: { type: 'string' },
                extended_location: {
                  type: 'object',
                  properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
                },
                attributes: {
                  type: 'object',
                  properties: {
                    restroom: { type: 'boolean' },
                    outdoor_seating: { type: 'boolean' },
                    atm: { type: 'boolean' },
                    has_parking: { type: 'boolean' },
                    wifi: { type: 'string' },
                    delivery: { type: 'boolean' },
                    reservations: { type: 'boolean' },
                    takes_credit_card: { type: 'boolean' },
                  },
                },
                hours: {
                  type: 'object',
                  properties: {
                    display: { type: 'string' },
                    is_local_holiday: { type: 'boolean' },
                    open_now: { type: 'boolean' },
                    regular: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          close: { type: 'string' },
                          day: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          open: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                hours_popular: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      close: { type: 'string' },
                      day: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      open: { type: 'string' },
                    },
                  },
                },
                link: { type: 'string' },
                location: {
                  type: 'object',
                  properties: {
                    address: { type: 'string' },
                    locality: { type: 'string' },
                    region: { type: 'string' },
                    postcode: { type: 'string' },
                    admin_region: { type: 'string' },
                    post_town: { type: 'string' },
                    po_box: { type: 'string' },
                    country: { type: 'string' },
                    formatted_address: { type: 'string' },
                  },
                },
                menu: { type: 'string' },
                name: { type: 'string' },
                photos: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      prefix: { type: 'string' },
                      suffix: { type: 'string' },
                      width: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      height: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      tip: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                  },
                },
                place_actions: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      action: { type: 'string' },
                      url: { type: 'string' },
                      provider_id: { type: 'string' },
                    },
                  },
                },
                popularity: {
                  type: 'number',
                  format: 'double',
                  minimum: -1.7976931348623157e308,
                  maximum: 1.7976931348623157e308,
                },
                placemaker_url: { type: 'string' },
                price: {
                  type: 'integer',
                  format: 'int32',
                  minimum: -2147483648,
                  maximum: 2147483647,
                },
                rating: {
                  type: 'number',
                  format: 'double',
                  minimum: -1.7976931348623157e308,
                  maximum: 1.7976931348623157e308,
                },
                social_media: {
                  type: 'object',
                  properties: {
                    facebook_id: { type: 'string' },
                    instagram: { type: 'string' },
                    twitter: { type: 'string' },
                  },
                },
                stats: {
                  type: 'object',
                  properties: {
                    total_photos: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    total_ratings: {
                      type: 'integer',
                      format: 'int64',
                      minimum: -9223372036854776000,
                      maximum: 9223372036854776000,
                    },
                    total_tips: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                  },
                },
                store_id: { type: 'string' },
                tastes: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: { type: 'string' },
                },
                tel: { type: 'string' },
                tips: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {},
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
                website: { type: 'string' },
              },
            },
            children: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  fsq_place_id: { type: 'string' },
                  latitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  longitude: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  categories: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_category_id: { type: 'string' },
                        name: { type: 'string' },
                        short_name: { type: 'string' },
                        plural_name: { type: 'string' },
                        icon: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  chains: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_chain_id: { type: 'string' },
                        name: { type: 'string' },
                        logo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        parent_id: { type: 'string' },
                      },
                    },
                  },
                  date_closed: { type: 'string', format: 'date' },
                  date_created: { type: 'string' },
                  date_refreshed: { type: 'string' },
                  description: { type: 'string' },
                  distance: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  email: { type: 'string' },
                  extended_location: {
                    type: 'object',
                    properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
                  },
                  attributes: {
                    type: 'object',
                    properties: {
                      restroom: { type: 'boolean' },
                      outdoor_seating: { type: 'boolean' },
                      atm: { type: 'boolean' },
                      has_parking: { type: 'boolean' },
                      wifi: { type: 'string' },
                      delivery: { type: 'boolean' },
                      reservations: { type: 'boolean' },
                      takes_credit_card: { type: 'boolean' },
                    },
                  },
                  hours: {
                    type: 'object',
                    properties: {
                      display: { type: 'string' },
                      is_local_holiday: { type: 'boolean' },
                      open_now: { type: 'boolean' },
                      regular: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            close: { type: 'string' },
                            day: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            open: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  hours_popular: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        close: { type: 'string' },
                        day: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        open: { type: 'string' },
                      },
                    },
                  },
                  link: { type: 'string' },
                  location: {
                    type: 'object',
                    properties: {
                      address: { type: 'string' },
                      locality: { type: 'string' },
                      region: { type: 'string' },
                      postcode: { type: 'string' },
                      admin_region: { type: 'string' },
                      post_town: { type: 'string' },
                      po_box: { type: 'string' },
                      country: { type: 'string' },
                      formatted_address: { type: 'string' },
                    },
                  },
                  menu: { type: 'string' },
                  name: { type: 'string' },
                  photos: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                  },
                  place_actions: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        action: { type: 'string' },
                        url: { type: 'string' },
                        provider_id: { type: 'string' },
                      },
                    },
                  },
                  popularity: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  placemaker_url: { type: 'string' },
                  price: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  rating: {
                    type: 'number',
                    format: 'double',
                    minimum: -1.7976931348623157e308,
                    maximum: 1.7976931348623157e308,
                  },
                  social_media: {
                    type: 'object',
                    properties: {
                      facebook_id: { type: 'string' },
                      instagram: { type: 'string' },
                      twitter: { type: 'string' },
                    },
                  },
                  stats: {
                    type: 'object',
                    properties: {
                      total_photos: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      total_ratings: {
                        type: 'integer',
                        format: 'int64',
                        minimum: -9223372036854776000,
                        maximum: 9223372036854776000,
                      },
                      total_tips: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                  store_id: { type: 'string' },
                  tastes: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tel: { type: 'string' },
                  tips: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        text: { type: 'string' },
                        url: { type: 'string' },
                        photo: {},
                        lang: { type: 'string' },
                        agree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        disagree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                  website: { type: 'string' },
                },
              },
            },
          },
        },
        social_media: {
          type: 'object',
          properties: {
            facebook_id: { type: 'string' },
            instagram: { type: 'string' },
            twitter: { type: 'string' },
          },
        },
        stats: {
          type: 'object',
          properties: {
            total_photos: {
              type: 'integer',
              format: 'int32',
              minimum: -2147483648,
              maximum: 2147483647,
            },
            total_ratings: {
              type: 'integer',
              format: 'int64',
              minimum: -9223372036854776000,
              maximum: 9223372036854776000,
            },
            total_tips: {
              type: 'integer',
              format: 'int32',
              minimum: -2147483648,
              maximum: 2147483647,
            },
          },
        },
        store_id: { type: 'string' },
        tastes: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
        tel: { type: 'string' },
        tips: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_tip_id: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              text: { type: 'string' },
              url: { type: 'string' },
              photo: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  width: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  height: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  classifications: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tip: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {},
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
              },
              lang: { type: 'string' },
              agree_count: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              disagree_count: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
            },
          },
        },
        unresolved_flags: {
          uniqueItems: true,
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
        veracity_rating: { type: 'object', additionalProperties: true },
        website: { type: 'string' },
        plugins: {
          type: 'object',
          properties: { traversable_again: { type: 'boolean' } },
          additionalProperties: { type: 'object', additionalProperties: true },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceFlag = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe.",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          dry_run: {
            type: 'boolean',
            default: true,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'If true, return the expected result without actually submitting the suggestion. Useful for testing.\n**Note this defaults to *false* in all cases EXCEPT when calling through this docs page.**',
          },
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'List of fields being flagged as incorrect. Possible values are:<ul><li>address</li><li>latitude</li><li>longitude</li><li>locality</li><li>name</li><li>tel</li><li>postcode</li><li>region</li><li>state</li><li>website</li><li>placeActions</li></ul>',
          },
          comment: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'A comment describing the issue being flagged.',
          },
        },
        required: ['fields'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        suggested_edits: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fsq_place_id: { type: 'string' },
              suggested_edit_type: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              resolved_time: { type: 'string', format: 'date-time' },
              rolled_back: { type: 'object', additionalProperties: true },
              status: { type: 'string' },
              created_fsq_place_id: { type: 'string' },
              matched_fsq_place_id: { type: 'string' },
            },
          },
        },
        errors: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceMatch = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Name of the place to match.',
          },
          address: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Street address of the place to match (e.g. 1060 W Addison St).',
          },
          city: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'City, or Locality, where the place is located (e.g. Chicago).',
          },
          state: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'State, or Region, where the place is located (e.g. Illinois).',
          },
          postal_code: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The postal code for the address where the place is located (e.g. 60613).',
          },
          cc: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The 2-digit country code where the place is located (e.g. US). Only English-speaking countries currently supported.',
          },
          ll: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude of the venue location. This must be specified as latitude,longitude (e.g., ll=41.9484,-87.6553).',
          },
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. If no fields are specified, all <a href="response-fields#places-pro" target="_blank">Pro Fields</a> are returned by default. \n\nFor a complete list of returnable fields, refer to the <a href="response-fields" target="_blank">Places Response Fields</a> page.',
          },
        },
        required: ['name', 'address', 'city', 'cc'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        place: {
          type: 'object',
          properties: {
            fsq_place_id: { type: 'string' },
            latitude: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
            longitude: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
            categories: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  fsq_category_id: { type: 'string' },
                  name: { type: 'string' },
                  short_name: { type: 'string' },
                  plural_name: { type: 'string' },
                  icon: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      prefix: { type: 'string' },
                      suffix: { type: 'string' },
                      width: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      height: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      classifications: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tip: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            chains: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  fsq_chain_id: { type: 'string' },
                  name: { type: 'string' },
                  logo: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      prefix: { type: 'string' },
                      suffix: { type: 'string' },
                      width: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      height: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      classifications: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tip: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                  },
                  parent_id: { type: 'string' },
                },
              },
            },
            date_closed: { type: 'string', format: 'date' },
            date_created: { type: 'string' },
            date_refreshed: { type: 'string' },
            description: { type: 'string' },
            distance: {
              type: 'integer',
              format: 'int32',
              minimum: -2147483648,
              maximum: 2147483647,
            },
            email: { type: 'string' },
            extended_location: {
              type: 'object',
              properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
            },
            attributes: {
              type: 'object',
              properties: {
                restroom: { type: 'boolean' },
                outdoor_seating: { type: 'boolean' },
                atm: { type: 'boolean' },
                has_parking: { type: 'boolean' },
                wifi: { type: 'string' },
                delivery: { type: 'boolean' },
                reservations: { type: 'boolean' },
                takes_credit_card: { type: 'boolean' },
              },
            },
            hours: {
              type: 'object',
              properties: {
                display: { type: 'string' },
                is_local_holiday: { type: 'boolean' },
                open_now: { type: 'boolean' },
                regular: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      close: { type: 'string' },
                      day: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      open: { type: 'string' },
                    },
                  },
                },
              },
            },
            hours_popular: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  close: { type: 'string' },
                  day: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  open: { type: 'string' },
                },
              },
            },
            link: { type: 'string' },
            location: {
              type: 'object',
              properties: {
                address: { type: 'string' },
                locality: { type: 'string' },
                region: { type: 'string' },
                postcode: { type: 'string' },
                admin_region: { type: 'string' },
                post_town: { type: 'string' },
                po_box: { type: 'string' },
                country: { type: 'string' },
                formatted_address: { type: 'string' },
              },
            },
            menu: { type: 'string' },
            name: { type: 'string' },
            photos: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  fsq_photo_id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  width: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  height: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  classifications: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: { type: 'string' },
                  },
                  tip: {
                    type: 'object',
                    properties: {
                      fsq_tip_id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      text: { type: 'string' },
                      url: { type: 'string' },
                      photo: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          classifications: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: { type: 'string' },
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                      lang: { type: 'string' },
                      agree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      disagree_count: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                    },
                  },
                },
              },
            },
            place_actions: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  url: { type: 'string' },
                  provider_id: { type: 'string' },
                },
              },
            },
            popularity: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
            placemaker_url: { type: 'string' },
            price: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
            rating: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
            related_places: {
              type: 'object',
              properties: {
                parent: {
                  type: 'object',
                  properties: {
                    fsq_place_id: { type: 'string' },
                    latitude: {
                      type: 'number',
                      format: 'double',
                      minimum: -1.7976931348623157e308,
                      maximum: 1.7976931348623157e308,
                    },
                    longitude: {
                      type: 'number',
                      format: 'double',
                      minimum: -1.7976931348623157e308,
                      maximum: 1.7976931348623157e308,
                    },
                    categories: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          fsq_category_id: { type: 'string' },
                          name: { type: 'string' },
                          short_name: { type: 'string' },
                          plural_name: { type: 'string' },
                          icon: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              prefix: { type: 'string' },
                              suffix: { type: 'string' },
                              width: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              height: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              classifications: {
                                type: 'array',
                                properties: { traversable_again: { type: 'boolean' } },
                                items: { type: 'string' },
                              },
                              tip: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  text: { type: 'string' },
                                  url: { type: 'string' },
                                  photo: {},
                                  lang: { type: 'string' },
                                  agree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  disagree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                    chains: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          fsq_chain_id: { type: 'string' },
                          name: { type: 'string' },
                          logo: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              prefix: { type: 'string' },
                              suffix: { type: 'string' },
                              width: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              height: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              classifications: {
                                type: 'array',
                                properties: { traversable_again: { type: 'boolean' } },
                                items: { type: 'string' },
                              },
                              tip: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  text: { type: 'string' },
                                  url: { type: 'string' },
                                  photo: {},
                                  lang: { type: 'string' },
                                  agree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  disagree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                },
                              },
                            },
                          },
                          parent_id: { type: 'string' },
                        },
                      },
                    },
                    date_closed: { type: 'string', format: 'date' },
                    date_created: { type: 'string' },
                    date_refreshed: { type: 'string' },
                    description: { type: 'string' },
                    distance: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    email: { type: 'string' },
                    extended_location: {
                      type: 'object',
                      properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
                    },
                    attributes: {
                      type: 'object',
                      properties: {
                        restroom: { type: 'boolean' },
                        outdoor_seating: { type: 'boolean' },
                        atm: { type: 'boolean' },
                        has_parking: { type: 'boolean' },
                        wifi: { type: 'string' },
                        delivery: { type: 'boolean' },
                        reservations: { type: 'boolean' },
                        takes_credit_card: { type: 'boolean' },
                      },
                    },
                    hours: {
                      type: 'object',
                      properties: {
                        display: { type: 'string' },
                        is_local_holiday: { type: 'boolean' },
                        open_now: { type: 'boolean' },
                        regular: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              close: { type: 'string' },
                              day: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              open: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                    hours_popular: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          close: { type: 'string' },
                          day: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          open: { type: 'string' },
                        },
                      },
                    },
                    link: { type: 'string' },
                    location: {
                      type: 'object',
                      properties: {
                        address: { type: 'string' },
                        locality: { type: 'string' },
                        region: { type: 'string' },
                        postcode: { type: 'string' },
                        admin_region: { type: 'string' },
                        post_town: { type: 'string' },
                        po_box: { type: 'string' },
                        country: { type: 'string' },
                        formatted_address: { type: 'string' },
                      },
                    },
                    menu: { type: 'string' },
                    name: { type: 'string' },
                    photos: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          prefix: { type: 'string' },
                          suffix: { type: 'string' },
                          width: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          height: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          tip: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                      },
                    },
                    place_actions: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          action: { type: 'string' },
                          url: { type: 'string' },
                          provider_id: { type: 'string' },
                        },
                      },
                    },
                    popularity: {
                      type: 'number',
                      format: 'double',
                      minimum: -1.7976931348623157e308,
                      maximum: 1.7976931348623157e308,
                    },
                    placemaker_url: { type: 'string' },
                    price: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    rating: {
                      type: 'number',
                      format: 'double',
                      minimum: -1.7976931348623157e308,
                      maximum: 1.7976931348623157e308,
                    },
                    social_media: {
                      type: 'object',
                      properties: {
                        facebook_id: { type: 'string' },
                        instagram: { type: 'string' },
                        twitter: { type: 'string' },
                      },
                    },
                    stats: {
                      type: 'object',
                      properties: {
                        total_photos: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        total_ratings: {
                          type: 'integer',
                          format: 'int64',
                          minimum: -9223372036854776000,
                          maximum: 9223372036854776000,
                        },
                        total_tips: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                    store_id: { type: 'string' },
                    tastes: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: { type: 'string' },
                    },
                    tel: { type: 'string' },
                    tips: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                    website: { type: 'string' },
                  },
                },
                children: {
                  type: 'array',
                  properties: { traversable_again: { type: 'boolean' } },
                  items: {
                    type: 'object',
                    properties: {
                      fsq_place_id: { type: 'string' },
                      latitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      longitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      categories: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_category_id: { type: 'string' },
                            name: { type: 'string' },
                            short_name: { type: 'string' },
                            plural_name: { type: 'string' },
                            icon: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      chains: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_chain_id: { type: 'string' },
                            name: { type: 'string' },
                            logo: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                            parent_id: { type: 'string' },
                          },
                        },
                      },
                      date_closed: { type: 'string', format: 'date' },
                      date_created: { type: 'string' },
                      date_refreshed: { type: 'string' },
                      description: { type: 'string' },
                      distance: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      email: { type: 'string' },
                      extended_location: {
                        type: 'object',
                        properties: {
                          dma: { type: 'string' },
                          census_block_id: { type: 'string' },
                        },
                      },
                      attributes: {
                        type: 'object',
                        properties: {
                          restroom: { type: 'boolean' },
                          outdoor_seating: { type: 'boolean' },
                          atm: { type: 'boolean' },
                          has_parking: { type: 'boolean' },
                          wifi: { type: 'string' },
                          delivery: { type: 'boolean' },
                          reservations: { type: 'boolean' },
                          takes_credit_card: { type: 'boolean' },
                        },
                      },
                      hours: {
                        type: 'object',
                        properties: {
                          display: { type: 'string' },
                          is_local_holiday: { type: 'boolean' },
                          open_now: { type: 'boolean' },
                          regular: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                close: { type: 'string' },
                                day: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                open: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                      hours_popular: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            close: { type: 'string' },
                            day: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            open: { type: 'string' },
                          },
                        },
                      },
                      link: { type: 'string' },
                      location: {
                        type: 'object',
                        properties: {
                          address: { type: 'string' },
                          locality: { type: 'string' },
                          region: { type: 'string' },
                          postcode: { type: 'string' },
                          admin_region: { type: 'string' },
                          post_town: { type: 'string' },
                          po_box: { type: 'string' },
                          country: { type: 'string' },
                          formatted_address: { type: 'string' },
                        },
                      },
                      menu: { type: 'string' },
                      name: { type: 'string' },
                      photos: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                      },
                      place_actions: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            action: { type: 'string' },
                            url: { type: 'string' },
                            provider_id: { type: 'string' },
                          },
                        },
                      },
                      popularity: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      placemaker_url: { type: 'string' },
                      price: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      rating: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      social_media: {
                        type: 'object',
                        properties: {
                          facebook_id: { type: 'string' },
                          instagram: { type: 'string' },
                          twitter: { type: 'string' },
                        },
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          total_photos: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          total_ratings: {
                            type: 'integer',
                            format: 'int64',
                            minimum: -9223372036854776000,
                            maximum: 9223372036854776000,
                          },
                          total_tips: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                      store_id: { type: 'string' },
                      tastes: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tel: { type: 'string' },
                      tips: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                      website: { type: 'string' },
                    },
                  },
                },
              },
            },
            social_media: {
              type: 'object',
              properties: {
                facebook_id: { type: 'string' },
                instagram: { type: 'string' },
                twitter: { type: 'string' },
              },
            },
            stats: {
              type: 'object',
              properties: {
                total_photos: {
                  type: 'integer',
                  format: 'int32',
                  minimum: -2147483648,
                  maximum: 2147483647,
                },
                total_ratings: {
                  type: 'integer',
                  format: 'int64',
                  minimum: -9223372036854776000,
                  maximum: 9223372036854776000,
                },
                total_tips: {
                  type: 'integer',
                  format: 'int32',
                  minimum: -2147483648,
                  maximum: 2147483647,
                },
              },
            },
            store_id: { type: 'string' },
            tastes: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: { type: 'string' },
            },
            tel: { type: 'string' },
            tips: {
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: {
                type: 'object',
                properties: {
                  fsq_tip_id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  text: { type: 'string' },
                  url: { type: 'string' },
                  photo: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      prefix: { type: 'string' },
                      suffix: { type: 'string' },
                      width: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      height: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      classifications: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tip: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          created_at: { type: 'string', format: 'date-time' },
                          text: { type: 'string' },
                          url: { type: 'string' },
                          photo: {},
                          lang: { type: 'string' },
                          agree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          disagree_count: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                    },
                  },
                  lang: { type: 'string' },
                  agree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  disagree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
            },
            unresolved_flags: {
              uniqueItems: true,
              type: 'array',
              properties: { traversable_again: { type: 'boolean' } },
              items: { type: 'string' },
            },
            veracity_rating: { type: 'object', additionalProperties: true },
            website: { type: 'string' },
            plugins: {
              type: 'object',
              properties: { traversable_again: { type: 'boolean' } },
              additionalProperties: { type: 'object', additionalProperties: true },
            },
          },
        },
        match_score: {
          type: 'number',
          format: 'double',
          minimum: -1.7976931348623157e308,
          maximum: 1.7976931348623157e308,
        },
        context: {
          type: 'object',
          properties: {
            latitude: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
            longitude: {
              type: 'number',
              format: 'double',
              minimum: -1.7976931348623157e308,
              maximum: 1.7976931348623157e308,
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlacePhotos = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          limit: {
            maximum: 50,
            type: 'integer',
            format: 'int32',
            minimum: -2147483648,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The specified number of photos per page. Returns 10 photos by default, up to a maximum number of 50.',
          },
          sort: {
            type: 'string',
            enum: ['POPULAR', 'NEWEST'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Specifies the order in which results are listed. Possible values are:<ul><li>popular (default) - sorts results based on their popularity among Foursquare users</li><li>newest - sorts results from most recently added to least recently added</li></ul>',
          },
          classifications: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Restricts the results to photos matching the specified classifications, separated by a comma. Possible values are:<ul><li>exhibit</li><li>facilities</li><li>food_or_drink</li><li>indoor_facilities_and_classrooms</li><li>indoor_general</li><li>indoor_or_ambience</li><li>logos</li><li>menu</li><li>monuments_and_landmark_buildings</li><li>outdoor</li><li>outdoor_building_and_grounds</li><li>outdoor_building_exterior</li><li>outdoor_grounds</li><li>outdoor_or_storefront</li><li>outdoor_scenery</li><li>product</li></ul>',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          prefix: { type: 'string' },
          suffix: { type: 'string' },
          width: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
          height: { type: 'integer', format: 'int32', minimum: -2147483648, maximum: 2147483647 },
          classifications: {
            type: 'array',
            properties: { traversable_again: { type: 'boolean' } },
            items: { type: 'string' },
          },
          tip: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              text: { type: 'string' },
              url: { type: 'string' },
              photo: {},
              lang: { type: 'string' },
              agree_count: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              disagree_count: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceSearch = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A string to be matched against all content for this place, including but not limited to venue name, category, telephone number, taste, and tips.',
          },
          ll: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude around which to retrieve place information. This must be specified as latitude,longitude (e.g., ll=41.8781,-87.6298).',
          },
          radius: {
            maximum: 100000,
            minimum: 0,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Sets a radius distance (in meters) used to define an area to bias search results. The maximum allowed radius is 100,000 meters. Radius can be used in combination with ll or ip biased geolocation only. By using radius, global search results will be omitted. If not provided, default radius applied is 22000 meters.',
          },
          fsq_category_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Filters the response and returns FSQ Places matching the specified categories. Supports multiple Category IDs, separated by commas.\n\nFor a complete list of Foursquare Category IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/categories" target="blank">Category Taxonomy</a> page.',
          },
          fsq_chain_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Filters the response and returns FSQ Places matching the specified chains. Supports multiple chain IDs, separated by commas.\n\nFor more information on Foursquare Chain IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/chains" target="blank">Chains</a> page.',
          },
          exclude_fsq_chain_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Filters the response and returns FSQ Places not matching any of the specified chains. Supports multiple chain IDs, separated by commas. Cannot be used in conjunction with exclude_all_chains.\n\nFor more information on Foursquare Chain IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/chains" target="blank">Chains</a> page.',
          },
          exclude_all_chains: {
            type: 'boolean',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Filters the response by only returning FSQ Places that are not known to be part of any chain. Cannot be used in conjunction with exclude_chains.',
          },
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. If no fields are specified, all <a href="response-fields#places-pro" target="_blank">Pro Fields</a> are returned by default. \n\nFor a complete list of returnable fields, refer to the <a href="response-fields" target="_blank">Places Response Fields</a> page.',
          },
          min_price: {
            maximum: 4,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Restricts results to only those places within the specified price range. Valid values range between 1 (most affordable) to 4 (most expensive), inclusive.',
          },
          max_price: {
            maximum: 4,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Restricts results to only those places within the specified price range. Valid values range between 1 (most affordable) to 4 (most expensive), inclusive.',
          },
          open_at: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Support local day and local time requests through this parameter. To be specified as DOWTHHMM (e.g., 1T2130), where DOW is the day number 1-7 (Monday = 1, Sunday = 7) and time is in 24 hour format.\n\nPlaces that do not have opening hours will not be returned if this parameter is specified. Cannot be specified in conjunction with `open_now`.',
          },
          open_now: {
            type: 'boolean',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Restricts results to only those places that are open now.\n\nPlaces that do not have opening hours will not be returned if this parameter is specified. Cannot be specified in conjunction with `open_at`.',
          },
          tel_format: {
            type: 'string',
            enum: ['NATIONAL', 'E164'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Specifies the format of the returned telephone number.',
          },
          ne: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude representing the north/east points of a rectangle. Must be used with sw parameter to specify a rectangular search box. Global search results will be omitted.',
          },
          sw: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The latitude/longitude representing the south/west points of a rectangle. Must be used with ne parameter to specify a rectangular search box. Global search results will be omitted.',
          },
          near: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A string naming a locality in the world (e.g., "Chicago, IL"). If the value is not geocodable, returns an error. Global search results will be omitted.',
          },
          sort: {
            type: 'string',
            enum: ['RELEVANCE', 'RATING', 'DISTANCE', 'POPULARITY'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Specifies the order in which results are listed.',
          },
          limit: {
            maximum: 50,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The number of results to return, up to 50. Defaults to 10.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_place_id: { type: 'string' },
              latitude: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              longitude: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              categories: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_category_id: { type: 'string' },
                    name: { type: 'string' },
                    short_name: { type: 'string' },
                    plural_name: { type: 'string' },
                    icon: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              chains: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_chain_id: { type: 'string' },
                    name: { type: 'string' },
                    logo: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                    parent_id: { type: 'string' },
                  },
                },
              },
              date_closed: { type: 'string', format: 'date' },
              date_created: { type: 'string' },
              date_refreshed: { type: 'string' },
              description: { type: 'string' },
              distance: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              email: { type: 'string' },
              extended_location: {
                type: 'object',
                properties: { dma: { type: 'string' }, census_block_id: { type: 'string' } },
              },
              attributes: {
                type: 'object',
                properties: {
                  restroom: { type: 'boolean' },
                  outdoor_seating: { type: 'boolean' },
                  atm: { type: 'boolean' },
                  has_parking: { type: 'boolean' },
                  wifi: { type: 'string' },
                  delivery: { type: 'boolean' },
                  reservations: { type: 'boolean' },
                  takes_credit_card: { type: 'boolean' },
                },
              },
              hours: {
                type: 'object',
                properties: {
                  display: { type: 'string' },
                  is_local_holiday: { type: 'boolean' },
                  open_now: { type: 'boolean' },
                  regular: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        close: { type: 'string' },
                        day: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        open: { type: 'string' },
                      },
                    },
                  },
                },
              },
              hours_popular: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    close: { type: 'string' },
                    day: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    open: { type: 'string' },
                  },
                },
              },
              link: { type: 'string' },
              location: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  locality: { type: 'string' },
                  region: { type: 'string' },
                  postcode: { type: 'string' },
                  admin_region: { type: 'string' },
                  post_town: { type: 'string' },
                  po_box: { type: 'string' },
                  country: { type: 'string' },
                  formatted_address: { type: 'string' },
                },
              },
              menu: { type: 'string' },
              name: { type: 'string' },
              photos: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_photo_id: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    prefix: { type: 'string' },
                    suffix: { type: 'string' },
                    width: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    height: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    classifications: {
                      type: 'array',
                      properties: { traversable_again: { type: 'boolean' } },
                      items: { type: 'string' },
                    },
                    tip: {
                      type: 'object',
                      properties: {
                        fsq_tip_id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        text: { type: 'string' },
                        url: { type: 'string' },
                        photo: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            classifications: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: { type: 'string' },
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                        lang: { type: 'string' },
                        agree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        disagree_count: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                      },
                    },
                  },
                },
              },
              place_actions: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    action: { type: 'string' },
                    url: { type: 'string' },
                    provider_id: { type: 'string' },
                  },
                },
              },
              popularity: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              placemaker_url: { type: 'string' },
              price: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              rating: {
                type: 'number',
                format: 'double',
                minimum: -1.7976931348623157e308,
                maximum: 1.7976931348623157e308,
              },
              related_places: {
                type: 'object',
                properties: {
                  parent: {
                    type: 'object',
                    properties: {
                      fsq_place_id: { type: 'string' },
                      latitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      longitude: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      categories: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_category_id: { type: 'string' },
                            name: { type: 'string' },
                            short_name: { type: 'string' },
                            plural_name: { type: 'string' },
                            icon: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                      chains: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            fsq_chain_id: { type: 'string' },
                            name: { type: 'string' },
                            logo: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                prefix: { type: 'string' },
                                suffix: { type: 'string' },
                                width: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                height: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                classifications: {
                                  type: 'array',
                                  properties: { traversable_again: { type: 'boolean' } },
                                  items: { type: 'string' },
                                },
                                tip: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    created_at: { type: 'string', format: 'date-time' },
                                    text: { type: 'string' },
                                    url: { type: 'string' },
                                    photo: {},
                                    lang: { type: 'string' },
                                    agree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                    disagree_count: {
                                      type: 'integer',
                                      format: 'int32',
                                      minimum: -2147483648,
                                      maximum: 2147483647,
                                    },
                                  },
                                },
                              },
                            },
                            parent_id: { type: 'string' },
                          },
                        },
                      },
                      date_closed: { type: 'string', format: 'date' },
                      date_created: { type: 'string' },
                      date_refreshed: { type: 'string' },
                      description: { type: 'string' },
                      distance: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      email: { type: 'string' },
                      extended_location: {
                        type: 'object',
                        properties: {
                          dma: { type: 'string' },
                          census_block_id: { type: 'string' },
                        },
                      },
                      attributes: {
                        type: 'object',
                        properties: {
                          restroom: { type: 'boolean' },
                          outdoor_seating: { type: 'boolean' },
                          atm: { type: 'boolean' },
                          has_parking: { type: 'boolean' },
                          wifi: { type: 'string' },
                          delivery: { type: 'boolean' },
                          reservations: { type: 'boolean' },
                          takes_credit_card: { type: 'boolean' },
                        },
                      },
                      hours: {
                        type: 'object',
                        properties: {
                          display: { type: 'string' },
                          is_local_holiday: { type: 'boolean' },
                          open_now: { type: 'boolean' },
                          regular: {
                            type: 'array',
                            properties: { traversable_again: { type: 'boolean' } },
                            items: {
                              type: 'object',
                              properties: {
                                close: { type: 'string' },
                                day: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                open: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                      hours_popular: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            close: { type: 'string' },
                            day: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            open: { type: 'string' },
                          },
                        },
                      },
                      link: { type: 'string' },
                      location: {
                        type: 'object',
                        properties: {
                          address: { type: 'string' },
                          locality: { type: 'string' },
                          region: { type: 'string' },
                          postcode: { type: 'string' },
                          admin_region: { type: 'string' },
                          post_town: { type: 'string' },
                          po_box: { type: 'string' },
                          country: { type: 'string' },
                          formatted_address: { type: 'string' },
                        },
                      },
                      menu: { type: 'string' },
                      name: { type: 'string' },
                      photos: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            prefix: { type: 'string' },
                            suffix: { type: 'string' },
                            width: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            height: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            tip: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                created_at: { type: 'string', format: 'date-time' },
                                text: { type: 'string' },
                                url: { type: 'string' },
                                photo: {},
                                lang: { type: 'string' },
                                agree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                                disagree_count: {
                                  type: 'integer',
                                  format: 'int32',
                                  minimum: -2147483648,
                                  maximum: 2147483647,
                                },
                              },
                            },
                          },
                        },
                      },
                      place_actions: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            action: { type: 'string' },
                            url: { type: 'string' },
                            provider_id: { type: 'string' },
                          },
                        },
                      },
                      popularity: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      placemaker_url: { type: 'string' },
                      price: {
                        type: 'integer',
                        format: 'int32',
                        minimum: -2147483648,
                        maximum: 2147483647,
                      },
                      rating: {
                        type: 'number',
                        format: 'double',
                        minimum: -1.7976931348623157e308,
                        maximum: 1.7976931348623157e308,
                      },
                      social_media: {
                        type: 'object',
                        properties: {
                          facebook_id: { type: 'string' },
                          instagram: { type: 'string' },
                          twitter: { type: 'string' },
                        },
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          total_photos: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                          total_ratings: {
                            type: 'integer',
                            format: 'int64',
                            minimum: -9223372036854776000,
                            maximum: 9223372036854776000,
                          },
                          total_tips: {
                            type: 'integer',
                            format: 'int32',
                            minimum: -2147483648,
                            maximum: 2147483647,
                          },
                        },
                      },
                      store_id: { type: 'string' },
                      tastes: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: { type: 'string' },
                      },
                      tel: { type: 'string' },
                      tips: {
                        type: 'array',
                        properties: { traversable_again: { type: 'boolean' } },
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                      website: { type: 'string' },
                    },
                  },
                  children: {
                    type: 'array',
                    properties: { traversable_again: { type: 'boolean' } },
                    items: {
                      type: 'object',
                      properties: {
                        fsq_place_id: { type: 'string' },
                        latitude: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                        longitude: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                        categories: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              fsq_category_id: { type: 'string' },
                              name: { type: 'string' },
                              short_name: { type: 'string' },
                              plural_name: { type: 'string' },
                              icon: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  prefix: { type: 'string' },
                                  suffix: { type: 'string' },
                                  width: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  height: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  classifications: {
                                    type: 'array',
                                    properties: { traversable_again: { type: 'boolean' } },
                                    items: { type: 'string' },
                                  },
                                  tip: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      text: { type: 'string' },
                                      url: { type: 'string' },
                                      photo: {},
                                      lang: { type: 'string' },
                                      agree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      disagree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        chains: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              fsq_chain_id: { type: 'string' },
                              name: { type: 'string' },
                              logo: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  prefix: { type: 'string' },
                                  suffix: { type: 'string' },
                                  width: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  height: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  classifications: {
                                    type: 'array',
                                    properties: { traversable_again: { type: 'boolean' } },
                                    items: { type: 'string' },
                                  },
                                  tip: {
                                    type: 'object',
                                    properties: {
                                      id: { type: 'string' },
                                      created_at: { type: 'string', format: 'date-time' },
                                      text: { type: 'string' },
                                      url: { type: 'string' },
                                      photo: {},
                                      lang: { type: 'string' },
                                      agree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                      disagree_count: {
                                        type: 'integer',
                                        format: 'int32',
                                        minimum: -2147483648,
                                        maximum: 2147483647,
                                      },
                                    },
                                  },
                                },
                              },
                              parent_id: { type: 'string' },
                            },
                          },
                        },
                        date_closed: { type: 'string', format: 'date' },
                        date_created: { type: 'string' },
                        date_refreshed: { type: 'string' },
                        description: { type: 'string' },
                        distance: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        email: { type: 'string' },
                        extended_location: {
                          type: 'object',
                          properties: {
                            dma: { type: 'string' },
                            census_block_id: { type: 'string' },
                          },
                        },
                        attributes: {
                          type: 'object',
                          properties: {
                            restroom: { type: 'boolean' },
                            outdoor_seating: { type: 'boolean' },
                            atm: { type: 'boolean' },
                            has_parking: { type: 'boolean' },
                            wifi: { type: 'string' },
                            delivery: { type: 'boolean' },
                            reservations: { type: 'boolean' },
                            takes_credit_card: { type: 'boolean' },
                          },
                        },
                        hours: {
                          type: 'object',
                          properties: {
                            display: { type: 'string' },
                            is_local_holiday: { type: 'boolean' },
                            open_now: { type: 'boolean' },
                            regular: {
                              type: 'array',
                              properties: { traversable_again: { type: 'boolean' } },
                              items: {
                                type: 'object',
                                properties: {
                                  close: { type: 'string' },
                                  day: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  open: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                        hours_popular: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              close: { type: 'string' },
                              day: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              open: { type: 'string' },
                            },
                          },
                        },
                        link: { type: 'string' },
                        location: {
                          type: 'object',
                          properties: {
                            address: { type: 'string' },
                            locality: { type: 'string' },
                            region: { type: 'string' },
                            postcode: { type: 'string' },
                            admin_region: { type: 'string' },
                            post_town: { type: 'string' },
                            po_box: { type: 'string' },
                            country: { type: 'string' },
                            formatted_address: { type: 'string' },
                          },
                        },
                        menu: { type: 'string' },
                        name: { type: 'string' },
                        photos: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              prefix: { type: 'string' },
                              suffix: { type: 'string' },
                              width: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              height: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              tip: {
                                type: 'object',
                                properties: {
                                  id: { type: 'string' },
                                  created_at: { type: 'string', format: 'date-time' },
                                  text: { type: 'string' },
                                  url: { type: 'string' },
                                  photo: {},
                                  lang: { type: 'string' },
                                  agree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                  disagree_count: {
                                    type: 'integer',
                                    format: 'int32',
                                    minimum: -2147483648,
                                    maximum: 2147483647,
                                  },
                                },
                              },
                            },
                          },
                        },
                        place_actions: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              action: { type: 'string' },
                              url: { type: 'string' },
                              provider_id: { type: 'string' },
                            },
                          },
                        },
                        popularity: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                        placemaker_url: { type: 'string' },
                        price: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        rating: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                        social_media: {
                          type: 'object',
                          properties: {
                            facebook_id: { type: 'string' },
                            instagram: { type: 'string' },
                            twitter: { type: 'string' },
                          },
                        },
                        stats: {
                          type: 'object',
                          properties: {
                            total_photos: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            total_ratings: {
                              type: 'integer',
                              format: 'int64',
                              minimum: -9223372036854776000,
                              maximum: 9223372036854776000,
                            },
                            total_tips: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                        store_id: { type: 'string' },
                        tastes: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tel: { type: 'string' },
                        tips: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                              text: { type: 'string' },
                              url: { type: 'string' },
                              photo: {},
                              lang: { type: 'string' },
                              agree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                              disagree_count: {
                                type: 'integer',
                                format: 'int32',
                                minimum: -2147483648,
                                maximum: 2147483647,
                              },
                            },
                          },
                        },
                        website: { type: 'string' },
                      },
                    },
                  },
                },
              },
              social_media: {
                type: 'object',
                properties: {
                  facebook_id: { type: 'string' },
                  instagram: { type: 'string' },
                  twitter: { type: 'string' },
                },
              },
              stats: {
                type: 'object',
                properties: {
                  total_photos: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  total_ratings: {
                    type: 'integer',
                    format: 'int64',
                    minimum: -9223372036854776000,
                    maximum: 9223372036854776000,
                  },
                  total_tips: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
              store_id: { type: 'string' },
              tastes: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              tel: { type: 'string' },
              tips: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    fsq_tip_id: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    text: { type: 'string' },
                    url: { type: 'string' },
                    photo: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        created_at: { type: 'string', format: 'date-time' },
                        prefix: { type: 'string' },
                        suffix: { type: 'string' },
                        width: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        height: {
                          type: 'integer',
                          format: 'int32',
                          minimum: -2147483648,
                          maximum: 2147483647,
                        },
                        classifications: {
                          type: 'array',
                          properties: { traversable_again: { type: 'boolean' } },
                          items: { type: 'string' },
                        },
                        tip: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            created_at: { type: 'string', format: 'date-time' },
                            text: { type: 'string' },
                            url: { type: 'string' },
                            photo: {},
                            lang: { type: 'string' },
                            agree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                            disagree_count: {
                              type: 'integer',
                              format: 'int32',
                              minimum: -2147483648,
                              maximum: 2147483647,
                            },
                          },
                        },
                      },
                    },
                    lang: { type: 'string' },
                    agree_count: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                    disagree_count: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                  },
                },
              },
              unresolved_flags: {
                uniqueItems: true,
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              veracity_rating: { type: 'object', additionalProperties: true },
              website: { type: 'string' },
              plugins: {
                type: 'object',
                properties: { traversable_again: { type: 'boolean' } },
                additionalProperties: { type: 'object', additionalProperties: true },
              },
            },
          },
        },
        context: {
          type: 'object',
          properties: {
            geo_bounds: {
              type: 'object',
              properties: {
                circle: {
                  type: 'object',
                  properties: {
                    center: {
                      type: 'object',
                      properties: {
                        latitude: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                        longitude: {
                          type: 'number',
                          format: 'double',
                          minimum: -1.7976931348623157e308,
                          maximum: 1.7976931348623157e308,
                        },
                      },
                    },
                    radius: {
                      type: 'integer',
                      format: 'int32',
                      minimum: -2147483648,
                      maximum: 2147483647,
                    },
                  },
                },
              },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceSuggestEdit = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_id = 5a187743ccad6b307315e6fe.",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          dry_run: {
            type: 'boolean',
            default: true,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'If true, return the expected result without actually submitting the suggestion. Useful for testing.\n**Note this defaults to *false* in all cases EXCEPT when calling through this docs page.**',
          },
          latitude: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for the latitude at which the place should be located (e.g., 41.8781).',
          },
          longitude: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for the longitude at which the place should be located (e.g., -87.6298).',
          },
          menu: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for the url where the menu of the place can be found.',
          },
          facebook_url: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: "The proposed new value for the url for this place's Facebook Page.",
          },
          parent_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value if the place is a subvenue of a larger place (such as a coffee shop within a Target), set this attribute to the ID of the parent place. Set to "" to remove parent.',
          },
          is_private_place: {
            type: 'boolean',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for whether the place is a private place. If true, the place will be marked as private. Otherwise, it will be marked as public.',
          },
          hours: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "The proposed new value for the hours for the venue, as a semi-colon separated list of open segments and named segments (e.g., brunch or happy hour). Open segments are formatted as day,start,end. Named segments additionally have a label, formatted as day,start,end,label. Days are formatted as integers with Monday = 1,...,Sunday = 7. Start and End are formatted as [+]HHMM format. Use 24 hour format (no colon), prefix with 0 for HH or MM less than 10. Use '+' prefix, i.e., +0230 to represent 2:30 am past midnight into the following day. To indicate that a venue is open 24/7, send this value with the hours attribute: 1,0000,2400;2,0000,2400;3,0000,2400;4,0000,2400;5,0000,2400;6,0000,2400;7,0000,2400",
          },
          name: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the name of the place.',
          },
          description: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for the freeform description of the place, up to 300 characters.',
          },
          tel: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the phone number of the place.',
          },
          instagram: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the instagram handle of the place.',
          },
          twitter: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the twitter handle of the place.',
          },
          website: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the url of the homepage of the place.',
          },
          address: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the address of the place.',
          },
          locality: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new value for the name of the locality (city) where this place is.',
          },
          region: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the nearest state or province to the place.',
          },
          postcode: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the zip or postal code for the place.',
          },
          country_code: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed new 2-digit country code where the place is located (e.g. US).',
          },
          add_attributes: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A comma-separated list of attribute keys to add or enable for the venue. Possible values are: {atm, reservations, offers_delivery, parking, outdoor_seating, restroom, credit_cards, wifi}.',
          },
          remove_attributes: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A comma-separated list of attribute keys to remove or disable from the venue. Possible values are: {atm, reservations, offers_delivery, parking, outdoor_seating, restroom, credit_cards, wifi}.',
          },
          add_fsq_category_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Add category IDs. Supports multiple Category IDs, separated by commas.\n\nFor a complete list of Foursquare Category IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/categories" target="blank">Category Taxonomy</a> page. [This endpoint prefers the 5-integer style id, but can accept the BSON style id]',
          },
          remove_fsq_category_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Remove category IDs. Supports multiple Category IDs, separated by commas.\n\nFor a complete list of Foursquare Category IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/categories" target="blank">Category Taxonomy</a> page. [This endpoint prefers the 5-integer style id, but can accept the BSON style id]',
          },
          primary_fsq_category_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Change the primary category ID\n\nFor a complete list of Foursquare Category IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/categories" target="blank">Category Taxonomy</a> page. [This endpoint prefers the 5-integer style id, but can accept the BSON style id]',
          },
          add_fsq_chain_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Add chain IDs.',
          },
          remove_fsq_chain_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Remove Foursquare chain IDs.',
          },
          primary_fsq_chain_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'Change the primary chain ID.',
          },
          unset_fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Fields to unset. Supports multiple fields, separated by commas. Possible values are: <ul><li>menu (default)</li><li>facebook_url</li><li>description</li><li>address</li><li>tel</li><li>twitter</li><li>website</li><li>fsq_chain_ids</li><li>hours</li></ul>',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        suggested_edits: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fsq_place_id: { type: 'string' },
              suggested_edit_type: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              resolved_time: { type: 'string', format: 'date-time' },
              rolled_back: { type: 'object', additionalProperties: true },
              status: { type: 'string' },
              created_fsq_place_id: { type: 'string' },
              matched_fsq_place_id: { type: 'string' },
            },
          },
        },
        errors: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceSuggestRemove = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe.",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          dry_run: {
            type: 'boolean',
            default: true,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'If true, return the expected result without actually submitting the suggestion. Useful for testing.\n**Note this defaults to *false* in all cases EXCEPT when calling through this docs page.**',
          },
          reason: {
            type: 'string',
            enum: ['CLOSED', 'DOESNT_EXIST', 'INAPPROPRIATE', 'NOT_CLOSED', 'OTHER', 'PRIVATE'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Reason for removal. Possible values are:<ul><li>closed</li><li>doesnt_exist</li><li>inappropriate</li><li>not_closed</li><li>private</li></ul>',
          },
          comment: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'A comment describing the removal request.',
          },
        },
        required: ['reason'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        suggested_edits: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fsq_place_id: { type: 'string' },
              suggested_edit_type: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              resolved_time: { type: 'string', format: 'date-time' },
              rolled_back: { type: 'object', additionalProperties: true },
              status: { type: 'string' },
              created_fsq_place_id: { type: 'string' },
              matched_fsq_place_id: { type: 'string' },
            },
          },
        },
        errors: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceSuggestStatus = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          suggested_edit_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A comma seperated list of suggested edit IDs. If specified, shows only suggested edits with these IDs. If not specified, returns all edits suggested using the calling service token.',
          },
          limit: {
            maximum: 50,
            minimum: 0,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The specified number of suggested edits per page. Returns 10 suggested edits by default, up to a maximum number of 50.',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        suggested_edits: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fsq_place_id: { type: 'string' },
              suggested_edit_type: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              resolved_time: { type: 'string', format: 'date-time' },
              rolled_back: { type: 'object', additionalProperties: true },
              status: { type: 'string' },
              created_fsq_place_id: { type: 'string' },
              matched_fsq_place_id: { type: 'string' },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceTips = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          limit: {
            maximum: 50,
            minimum: 1,
            type: 'integer',
            format: 'int32',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The specified number of tips per page. Returns 10 tips by default, up to a maximum number of 50.',
          },
          fields: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Indicate which fields to return in the response, separated by commas. Supported fields are:<ul><li> fsq_tip_id - The ID of the tip to be returned.</li><li> created_at - The timestamp indicating when the tip was created; UNIX timestamp in seconds since Epoch.</li><li> text - The text of the returned tip.</li><li> lang - The language of the returned tip.</li><li> url - The URL associated with the returned tip.</li><li> agree_count - The count of users who have agreed with the returned tip.</li><li> disagree_count - The count of users who have disagreed with the returned tip.</li><li> photo - The ID of the photo asociated with the returned tip.</li></ul>Default fields if this param is omitted are "fsq_tip_id", "created_at", and "text".',
          },
          sort: {
            type: 'string',
            enum: ['POPULAR', 'NEWEST'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Specifies the order in which results are listed. Possible values are:<ul><li>popular (default) - sorts results based on their popularity among Foursquare users</li><li>newest - sorts results from most recently added to least recently added</li></ul>',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fsq_tip_id: { type: 'string' },
          created_at: { type: 'string', format: 'date-time' },
          text: { type: 'string' },
          url: { type: 'string' },
          photo: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              prefix: { type: 'string' },
              suffix: { type: 'string' },
              width: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              height: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              classifications: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              tip: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                  text: { type: 'string' },
                  url: { type: 'string' },
                  photo: {},
                  lang: { type: 'string' },
                  agree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                  disagree_count: {
                    type: 'integer',
                    format: 'int32',
                    minimum: -2147483648,
                    maximum: 2147483647,
                  },
                },
              },
            },
          },
          lang: { type: 'string' },
          agree_count: {
            type: 'integer',
            format: 'int32',
            minimum: -2147483648,
            maximum: 2147483647,
          },
          disagree_count: {
            type: 'integer',
            format: 'int32',
            minimum: -2147483648,
            maximum: 2147483647,
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlaceTopVenueWoes = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          near: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The name of the location to search near',
          },
          ne: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The north-east corner of the bounding box to search within',
          },
          sw: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The south-west corner of the bounding box to search within',
          },
        },
        required: [],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        venues: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              fsq_place_id: { type: 'string' },
              venue_name: { type: 'string' },
              location: {
                type: 'object',
                properties: {
                  address: { type: 'string' },
                  locality: { type: 'string' },
                  region: { type: 'string' },
                  postcode: { type: 'string' },
                  admin_region: { type: 'string' },
                  post_town: { type: 'string' },
                  po_box: { type: 'string' },
                  country: { type: 'string' },
                  formatted_address: { type: 'string' },
                },
              },
              woe_types: {
                uniqueItems: true,
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: { type: 'string' },
              },
              woe_count: {
                type: 'integer',
                format: 'int32',
                minimum: -2147483648,
                maximum: 2147483647,
              },
              woes: {
                type: 'array',
                properties: { traversable_again: { type: 'boolean' } },
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    fsq_place_id: { type: 'string' },
                    suggested_edit_type: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                    resolved_time: { type: 'string', format: 'date-time' },
                    rolled_back: { type: 'object', additionalProperties: true },
                    status: { type: 'string' },
                    created_fsq_place_id: { type: 'string' },
                    matched_fsq_place_id: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const PlacesSuggestPlace = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the name of the new place.',
          },
          categories: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Categories to search for. Supports multiple Category IDs, separated by commas.\n\nFor a complete list of Foursquare Category IDs, refer to the <a href="https://docs.foursquare.com/data-products/docs/categories" target="blank">Category Taxonomy</a> page.',
          },
          address: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the address of the new place.',
          },
          locality: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed value for the name of the locality (city) where this new place is.',
          },
          region: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the nearest state or province to the new place.',
          },
          postcode: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The value for the zip or postal code for the new place.',
          },
          country_code: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The 2-digit country code where the place is located (e.g. US).',
          },
          latitude: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed value for the latitude at which the new place should be located (e.g., 41.8781).',
          },
          longitude: {
            type: 'number',
            format: 'double',
            minimum: -1.7976931348623157e308,
            maximum: 1.7976931348623157e308,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed value for the longitude at which the new place should be located (e.g., -87.6298).',
          },
          chains: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed chain ids to be assosciated with this new place',
          },
          parent_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'The proposed value if the new place is a subvenue of a larger place (such as a coffee shop within a Target), set this attribute to the ID of the parent place.',
          },
          is_private_place: {
            type: 'boolean',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'If true, the new place will be marked as private.',
          },
          tel: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed new value for the phone number of the place.',
          },
          website: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the url of the homepage of the new place.',
          },
          email: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the email address for this new place',
          },
          facebook_url: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: "The proposed value for the url for this new place's Facebook Page.",
          },
          instagram: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the instagram handle for this new place',
          },
          twitter: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The proposed value for the twitter handle of the new place.',
          },
          hours: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "The proposed value for the hours for the new venue, as a semi-colon separated list of open segments and named segments (e.g., brunch or happy hour). Open segments are formatted as day,start,end. Named segments additionally have a label, formatted as day,start,end,label. Days are formatted as integers with Monday = 1,...,Sunday = 7. Start and End are formatted as [+]HHMM format. Use 24 hour format (no colon), prefix with 0 for HH or MM less than 10. Use '+' prefix, i.e., +0230 to represent 2:30 am past midnight into the following day. To indicate that a venue is open 24/7, send this value with the hours attribute: 1,0000,2400;2,0000,2400;3,0000,2400;4,0000,2400;5,0000,2400;6,0000,2400;7,0000,2400",
          },
          attributes: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'Comma seperated list that represents the attributes that the new place has. Possible values are: {atm, reservation, offers_delivery, parking, outdoor_seating, restroom, credit_cards, wifi}.',
          },
          dry_run: {
            type: 'boolean',
            default: true,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'If true, return the expected result without actually submitting the suggestion. Useful for testing.\n**Note this defaults to *false* in all cases EXCEPT when calling through this docs page.**',
          },
        },
        required: ['name'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        new_place_suggestion: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            resolved_time: { type: 'string', format: 'date-time' },
            status: { type: 'string' },
          },
        },
        matched_fsq_place: {
          type: 'object',
          properties: { fsq_place_id: { type: 'string' }, name: { type: 'string' } },
        },
        errors: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
const SuggestMerge = {
  metadata: {
    allOf: [
      {
        type: 'object',
        properties: {
          fsq_place_id: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              "A unique string identifier for a FSQ Place (formerly known as Venue ID). E.g., Foursquare HQ's fsq_place_id = 5a187743ccad6b307315e6fe.",
          },
        },
        required: ['fsq_place_id'],
      },
      {
        type: 'object',
        properties: {
          dry_run: {
            type: 'boolean',
            default: true,
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'If true, return the expected result without actually submitting the suggestion. Useful for testing.\n**Note this defaults to *false* in all cases EXCEPT when calling through this docs page.**',
          },
          duplicate_fsq_place_ids: {
            type: 'string',
            $schema: 'http://json-schema.org/draft-04/schema#',
            description:
              'A list of string identifiers that represent the same place as the given fsq_place_id.',
          },
        },
        required: ['duplicate_fsq_place_ids'],
      },
      {
        type: 'object',
        properties: {
          'X-Places-Api-Version': {
            type: 'string',
            default: '2025-06-17',
            enum: ['2025-06-17'],
            $schema: 'http://json-schema.org/draft-04/schema#',
            description: 'The version of the API to use.',
          },
        },
        required: ['X-Places-Api-Version'],
      },
    ],
  },
  response: {
    '200': {
      type: 'object',
      properties: {
        suggested_edits: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              fsq_place_id: { type: 'string' },
              suggested_edit_type: { type: 'string' },
              created_at: { type: 'string', format: 'date-time' },
              resolved_time: { type: 'string', format: 'date-time' },
              rolled_back: { type: 'object', additionalProperties: true },
              status: { type: 'string' },
              created_fsq_place_id: { type: 'string' },
              matched_fsq_place_id: { type: 'string' },
            },
          },
        },
        errors: {
          type: 'array',
          properties: { traversable_again: { type: 'boolean' } },
          items: { type: 'string' },
        },
      },
      $schema: 'http://json-schema.org/draft-04/schema#',
    },
  },
} as const
export {
  Ask,
  Autocomplete,
  GeotaggingCandidates,
  GeotaggingConfirm,
  OfflineJobsCredentialsRefresh,
  OfflineJobsExecute,
  OfflineJobsInitialize,
  OfflineJobsStatus,
  PlaceDetails,
  PlaceFlag,
  PlaceMatch,
  PlacePhotos,
  PlaceSearch,
  PlaceSuggestEdit,
  PlaceSuggestRemove,
  PlaceSuggestStatus,
  PlaceTips,
  PlaceTopVenueWoes,
  PlacesSuggestPlace,
  SuggestMerge,
}
