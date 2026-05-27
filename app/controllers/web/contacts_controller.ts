import type { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import VendorService from '#services/vendor_service'
import { VendorRequest } from '../../../types/request.js'
import {
  createVendorValidator,
  requestParamsValidator,
  updateVendorValidator,
} from '#validators/vendors_validator'

export default class ContactsController {
  /**
   * Display all contacts for the authenticated user
   */
  async index({ inertia, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    // No pagination for the contacts library — load all active contacts
    const vendorListings = await VendorService.getUserVendors(user.uuid, 10_000)
    const contacts = vendorListings.map((vl) => ({ uuid: vl.uuid, name: vl.name, email: vl.email }))

    return inertia.render('contacts/index', { contacts })
  }

  /**
   * Create a new contact
   */
  async store({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const validatedRequest = await request.validateUsing(createVendorValidator)

    try {
      const listing = await VendorService.createVendor(user.uuid, validatedRequest as VendorRequest)
      return response.status(201).json({
        contact: { uuid: listing.uuid, name: listing.name, email: listing.email },
      })
    } catch (error) {
      logger.error('Error creating contact:')
      logger.error(error)
      return response.status(500).json({ error: 'Failed to create contact' })
    }
  }

  /**
   * Update a contact's name or email inline
   */
  async update({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const { uuid: vendorUuid } = await requestParamsValidator.validate(request.params())
    const validatedRequest = await request.validateUsing(updateVendorValidator)

    try {
      const listing = await VendorService.updateVendor(
        user.uuid,
        vendorUuid,
        validatedRequest as VendorRequest,
        false
      )

      if (!listing) {
        return response.status(404).json({ error: 'Contact not found' })
      }

      return response.status(200).json({
        contact: { uuid: listing.uuid, name: listing.name, email: listing.email },
      })
    } catch (error) {
      logger.error('Error updating contact:')
      logger.error(error)
      return response.status(500).json({ error: 'Failed to update contact' })
    }
  }

  /**
   * Deactivate (soft-delete) a contact
   */
  async destroy({ request, response, auth }: HttpContext) {
    const user = auth.getUserOrFail()

    const { uuid: vendorUuid } = await requestParamsValidator.validate(request.params())

    try {
      const listing = await VendorService.updateVendor(
        user.uuid,
        vendorUuid,
        { isActive: false } as VendorRequest,
        false
      )

      if (!listing) {
        return response.status(404).json({ error: 'Contact not found' })
      }

      return response.status(200).json({ success: true })
    } catch (error) {
      logger.error('Error deactivating contact:')
      logger.error(error)
      return response.status(500).json({ error: 'Failed to deactivate contact' })
    }
  }
}
