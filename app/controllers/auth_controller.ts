import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth_validators'

export default class AuthController {
  /**
   * Show the login form
   */
  async showLogin({ inertia, session }: HttpContext) {
    return inertia.render('auth/login', {
      flashMessage: session.flashMessages.get('success') || session.flashMessages.get('error'),
    })
  }

  /**
   * Handle login request
   */
  async login({ auth, request, response, session, inertia }: HttpContext) {
    const { email, password } = await request.validateUsing(loginValidator)

    try {
      const user = await User.verifyCredentials(email, password)
      await auth.use('web').login(user)

      session.flash('success', 'Welcome back!')

      // Get intended URL from session and redirect there, or default to dashboard
      const intendedUrl = session.get('auth.intended_url')
      if (intendedUrl) {
        session.forget('auth.intended_url')
        return response.redirect(intendedUrl)
      }

      return response.redirect().toRoute('dashboard')
    } catch (error) {
      // For Inertia requests, we need to return back to the login page with errors
      return inertia.render('auth/login', {
        flashMessage: { type: 'error', message: 'Invalid email or password' },
        errors: { email: ['Invalid credentials'] },
      })
    }
  }

  /**
   * Show the registration form
   */
  async showRegister({ inertia, session }: HttpContext) {
    return inertia.render('auth/register', {
      flashMessage: session.flashMessages.get('success') || session.flashMessages.get('error'),
    })
  }

  /**
   * Handle registration request
   */
  async register({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(registerValidator)

    try {
      await User.create({
        fullName: data.fullName,
        email: data.email,
        password: data.password,
        entitlementId: 1, // Default to user entitlement (ID 1)
        isActive: true,
      })

      session.flash('success', 'Account created successfully! Please log in.')
      return response.redirect().toRoute('auth.login')
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        session.flash('error', 'Registration failed. Please check your details and try again.')
      } else {
        session.flash('error', 'Something went wrong. Please try again.')
      }
      return response.redirect().back()
    }
  }

  /**
   * Handle logout request
   */
  async logout({ auth, response, session }: HttpContext) {
    await auth.use('web').logout()
    session.flash('success', 'You have been logged out')
    return response.redirect().toRoute('landing')
  }
}
