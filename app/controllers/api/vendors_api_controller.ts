import logger from '@adonisjs/core/services/logger'
import type { HttpContext } from '@adonisjs/core/http'
import VendorService from '#services/vendor_service'
import { VendorRequest } from '../../../types/request.js'
import {
  createVendorValidator,
  requestParamsValidator,
  updateVendorValidator,
} from '#validators/vendors_validator'
import { getVendorsValidator } from '#validators/vendors_validator'
import { isOnlyActivatingRecord, validateUser } from '../../utils/controller_utils.js'

export default class VendorsAPIController {
  /**
   * Display all vendors
   */
  async getAll({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const { limit, offset } = await request.validateUsing(getVendorsValidator)

    // Get all vendors
    try {
      const vendors = await VendorService.getVendors(limit, offset)
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
        .json({ error: 'Failed to fetch vendors', developerText: error.message })
    }
  }

  /**
   * Get a single vendor
   */
  async getByUuid({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const { uuid: vendorUuid } = await requestParamsValidator.validate(request.params())

    // Get vendor
    try {
      const vendor = await VendorService.getVendorByUuid(vendorUuid)
      if (!vendor) {
        return response.status(404).json({ error: 'Vendor not found' })
      }
      return response.status(200).json({ vendor })
    } catch (error) {
      logger.error('Error fetching vendor:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to fetch vendor', developerText: error.message })
    }
  }

  /**
   * Create a new vendor
   */
  async create({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

    // Validate request
    const validatedRequest = await request.validateUsing(createVendorValidator)
    if (validatedRequest.isActive === false) {
      return response.status(400).json({ error: 'Vendors cannot be deleted during creation' })
    }

    // Save vendor
    try {
      const vendor = await VendorService.createVendor(userId, validatedRequest as VendorRequest)

      return response.status(201).json(vendor)
    } catch (error) {
      logger.error('Error creating vendor:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to create vendor', developerText: error.message })
    }
  }

  /**
   * Update a vendor
   */
  async update({ request, response }: HttpContext) {
    // Validate user
    const userId = request.header('x-user-id') || ''
    try {
      const isValidUser = await validateUser(userId)
      if (!isValidUser) {
        return response.status(403).json({
          error: 'User is not authorized',
          developerText: 'User is not active or does not exist',
        })
      }
    } catch (error) {
      return response.status(401).json({ error: error.message })
    }

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
        return response.status(404).json({ error: 'Vendor not found' })
      }

      return response.status(201).json(vendor)
    } catch (error) {
      logger.error('Error updating vendor:')
      logger.error(error)
      return response
        .status(500)
        .json({ error: 'Failed to update vendor', developerText: error.message })
    }
  }
}
