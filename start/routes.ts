/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'
const ContactsController = () => import('#controllers/web/contacts_controller')
const ProjectsController = () => import('#controllers/web/projects/projects_controller')
const ConvoController = () => import('#controllers/web/projects/convo_controller')
const OverviewController = () => import('#controllers/web/projects/overview_controller')
const ProjectsAPIController = () => import('#controllers/api/projects_api_controller')
const VendorsAPIController = () => import('#controllers/api/vendors_api_controller')
const AuthController = () => import('#controllers/web/auth_controller')
const DashboardController = () => import('#controllers/web/dashboard_controller')
const InboxController = () => import('#controllers/web/inbox_controller')

// Public landing page (no auth required)
router
  .get('/', ({ inertia }) => {
    return inertia.render('landing')
  })
  .as('landing')
  .middleware(middleware.silentAuth())

router
  .get('/privacy', ({ inertia }) => {
    return inertia.render('privacy')
  })
  .as('privacy')
  .middleware(middleware.silentAuth())

router
  .get('/terms', ({ inertia }) => {
    return inertia.render('terms')
  })
  .as('terms')
  .middleware(middleware.silentAuth())

router
  .get('/contact', ({ inertia }) => {
    return inertia.render('contact')
  })
  .as('contact')
  .middleware(middleware.silentAuth())

// Auth routes (guest only)
router
  .group(() => {
    router.get('/login', [AuthController, 'showLogin']).as('auth.login')
    router.post('/login', [AuthController, 'login'])
    router.get('/register', [AuthController, 'showRegister']).as('auth.register')
    router.post('/register', [AuthController, 'register'])
    router.get('/forgot-password', [AuthController, 'showForgotPassword']).as('auth.forgotPassword')
    router.post('/forgot-password', [AuthController, 'forgotPassword'])
    router.get('/reset-password', [AuthController, 'showResetPassword']).as('auth.resetPassword')
    router.post('/reset-password', [AuthController, 'resetPassword'])
    router.get('/auth/google', [AuthController, 'googleRedirect']).as('auth.google')
    router
      .get('/auth/google/callback', [AuthController, 'googleCallback'])
      .as('auth.google.callback')
  })
  .middleware(middleware.guest())

// Authenticated routes
router
  .get('/dashboard', [DashboardController, 'show'])
  .as('dashboard')
  .middleware(middleware.auth())
router.post('/logout', [AuthController, 'logout']).as('auth.logout').middleware(middleware.auth())

// Inbox (connect customer inbox to listen and reply to vendors)
router
  .group(() => {
    router.get('/emails', [InboxController, 'emails']).as('inbox.emails')
    router.get('/settings', [InboxController, 'settings']).as('inbox.settings')
    router.get('/connect', [InboxController, 'connect']).as('inbox.connect')
    router.get('/callback', [InboxController, 'callback']).as('inbox.callback')
    router.post('/disconnect', [InboxController, 'disconnect']).as('inbox.disconnect')
  })
  .prefix('/inbox')
  .middleware(middleware.auth())

// UI routes for contacts
router
  .group(() => {
    router.get('/', [ContactsController, 'index'])
    router.post('/', [ContactsController, 'store'])
    router.patch('/:uuid', [ContactsController, 'update'])
    router.delete('/:uuid', [ContactsController, 'destroy'])
  })
  .prefix('/contacts')
  .middleware(middleware.auth())

// UI routes for projects
router
  .group(() => {
    router.get('/', [ProjectsController, 'index'])

    router.get('/:uuid', [ProjectsController, 'show'])

    router.post('/', [ProjectsController, 'store'])

    router.patch('/:uuid', [OverviewController, 'update'])

    router.post('/:uuid/chat', [ConvoController, 'chat'])
  })
  .prefix('/projects')
  .middleware(middleware.auth())

// API routes for projects
router
  .group(() => {
    router
      .group(() => {
        router.get('/', [ProjectsAPIController, 'getAll'])

        router.get('/:uuid', [ProjectsAPIController, 'getByUuid'])

        router.post('/', [ProjectsAPIController, 'create'])

        router.patch('/:uuid', [ProjectsAPIController, 'update'])

        router.post('/:uuid/chat', [ProjectsAPIController, 'chat'])
      })
      .prefix('/projects')
  })
  .prefix('/api')

// Fallback route for unknown GET pages (must stay last)
router
  .get('/*', ({ inertia, response }) => {
    response.status(404)
    return inertia.render('errors/not_found')
  })
  .middleware(middleware.silentAuth())

// API routes for vendors
router
  .group(() => {
    router
      .group(() => {
        router.get('/', [VendorsAPIController, 'getAll'])

        router.get('/:uuid', [VendorsAPIController, 'getByUuid'])

        router.post('/', [VendorsAPIController, 'create'])

        router.patch('/:uuid', [VendorsAPIController, 'update'])
      })
      .prefix('/vendors')
  })
  .prefix('/api')

// API routes for inbox (authenticated)
const InboxAPIController = () => import('#controllers/api/inbox_api_controller')
const InternalController = () => import('#controllers/api/internal_controller')

// Internal API for email service (forgot-password: app creates token, email service sends)
router.post('/api/internal/forgot-password-email', [InternalController, 'forgotPasswordEmail'])

router
  .group(() => {
    router.post('/reply', [InboxAPIController, 'sendReply'])
  })
  .prefix('/api/inbox')
  .middleware(middleware.auth())
