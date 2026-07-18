import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import VendorService, { VendorAuthorizationError } from '#services/vendor_service'
import VendorDiscoveryService, {
  VendorDiscoveryDependencyError,
} from '#services/vendor_discovery_service'
import { VendorRequest } from '../../../types/request.js'
import {
  createVendorValidator,
  requestParamsValidator,
  updateVendorValidator,
  trustedVendorMatchesValidator,
  authenticatedVendorSearchValidator,
} from '#validators/vendors_validator'
import { getVendorsValidator } from '#validators/vendors_validator'
import { isOnlyActivatingRecord } from '../../utils/controller_utils.js'
import UserRoleService from '#services/user_role_service'
import {
  adminVendorSearchRateLimitRules,
  getClientIp,
  rejectWhenRateLimited,
} from '#utils/rate_limit_utils'

export default class VendorsAPIController {
  private async getConsumer(auth: HttpContext['auth']) {
    const user = auth.getUserOrFail()
    if (!user.isActive || !(await UserRoleService.isConsumer(user))) return null
    return user
  }

  async search({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    const input = await request.validateUsing(authenticatedVendorSearchValidator)
    const rateLimitResponse = await rejectWhenRateLimited(
      request,
      response,
      adminVendorSearchRateLimitRules({ userUuid: userId, ip: getClientIp(request) })
    )
    if (rateLimitResponse) return rateLimitResponse

    try {
      const discovery = await VendorDiscoveryService.discover(input, {
        userUuid: userId,
        discoveryContext: 'authenticated-consumer',
      })
      const mappings = await VendorService.getUserVendorMappingsByListingUuids(
        userId,
        discovery.listings.map((listing) => listing.uuid)
      )

      return response.status(200).json({
        vendorSearches: discovery.vendorSearches,
        vendors: discovery.listings.map((listing) =>
          VendorService.toAuthenticatedRecommendation(listing, mappings.get(listing.uuid))
        ),
        emptyStateReason: discovery.emptyStateReason,
        liveSearchUnavailable: discovery.liveSearchUnavailable,
      })
    } catch (error) {
      if (error instanceof VendorDiscoveryDependencyError) {
        return response.status(502).json({ error: error.message, retryable: true })
      }
      throw error
    }
  }

  async getAvailable({ auth, request, response }: HttpContext) {
    if (!(await this.getConsumer(auth))) {
      return response.status(403).json({ error: 'User is not authorized' })
    }

    const { limit, offset } = await request.validateUsing(getVendorsValidator)
    const listings = await VendorService.getAvailableVendorListings(limit, offset)
    return response.status(200).json({
      vendors: listings.map((listing) => VendorService.toPublicRecommendation(listing)),
      count: listings.length,
      limit,
      offset,
    })
  }

  async getTrustedMatches({ auth, request, response }: HttpContext) {
    if (!(await this.getConsumer(auth))) {
      return response.status(403).json({ error: 'User is not authorized' })
    }

    const input = await request.validateUsing(trustedVendorMatchesValidator)
    const listings = await VendorService.findTrustedExistingListings(input)
    return response.status(200).json({
      vendors: listings.map((listing) => VendorService.toPublicRecommendation(listing)),
    })
  }

  async selectAvailable({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    const { uuid: vendorListingUuid } = await requestParamsValidator.validate(request.params())
    const listing = await VendorService.resolveCanonicalListing(vendorListingUuid)
    if (!listing?.isActive) {
      return response.status(404).json({ error: 'Listing is unavailable' })
    }

    const mapping = await VendorService.ensureUserVendorMapping(userId, listing.uuid)
    if (!mapping) {
      return response.status(404).json({ error: 'Listing is unavailable' })
    }

    return response.status(200).json({
      vendorUuid: mapping.uuid,
      savedToContacts: true,
      listing: VendorService.toAuthenticatedRecommendation(listing, mapping),
    })
  }

  /**
   * Display all vendors
   */
  async getAll({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { limit, offset } = await request.validateUsing(getVendorsValidator)

    // Get all vendors
    try {
      const vendors = await VendorService.getUserVendors(userId, limit, offset)
      return response.status(200).json({
        vendors: vendors,
        count: vendors.length,
        limit: limit,
        offset: offset,
      })
    } catch (error) {
      logger.error('Error fetching vendors:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to fetch contacts', developerText: error.message })
    }
  }

  /**
   * Get a single vendor
   */
  async getByUuid({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { uuid: vendorUuid } = await requestParamsValidator.validate(request.params())

    // Get vendor
    try {
      const vendor = await VendorService.getUserVendorByUuid(userId, vendorUuid)
      if (!vendor) {
        return response.status(404).json({ error: 'Contact not found' })
      }
      return response.status(200).json({ vendor })
    } catch (error) {
      logger.error('Error fetching contact:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to fetch contact', developerText: error.message })
    }
  }

  /**
   * Create a new vendor
   */
  async create({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const validatedRequest = await request.validateUsing(createVendorValidator)
    if (validatedRequest.isActive === false) {
      return response.status(400).json({ error: 'Contacts cannot be deleted during creation' })
    }

    // Save vendor
    try {
      const vendor = await VendorService.createVendor(userId, validatedRequest as VendorRequest)

      return response.status(201).json(vendor)
    } catch (error) {
      logger.error('Error creating contact:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to create contact', developerText: error.message })
    }
  }

  /**
   * Update a vendor
   */
  async update({ auth, request, response }: HttpContext) {
    const user = await this.getConsumer(auth)
    if (!user) return response.status(403).json({ error: 'User is not authorized' })
    const userId = user.uuid

    // Validate request
    const { uuid: vendorUuid } = await requestParamsValidator.validate(request.params())
    const validatedRequest = await request.validateUsing(updateVendorValidator)

    // Update vendor
    try {
      const vendor = await VendorService.updateVendor(
        userId,
        vendorUuid,
        validatedRequest as VendorRequest,
        isOnlyActivatingRecord(validatedRequest)
      )
      if (!vendor) {
        return response.status(404).json({ error: 'Contact not found' })
      }

      return response.status(201).json(vendor)
    } catch (error) {
      if (error instanceof VendorAuthorizationError) {
        return response.status(error.statusCode).json({ error: error.message })
      }
      logger.error('Error updating contact:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to update contact', developerText: error.message })
    }
  }
}
