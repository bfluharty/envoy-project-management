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
const ProjectsController = () => import('#controllers/web/projects_controller')
const ProjectsAPIController = () => import('#controllers/api/projects_api_controller')
const AuthController = () => import('#controllers/web/auth_controller')

// Public landing page (no auth required)
router
  .get('/', ({ inertia }) => inertia.render('landing'))
  .as('landing')
  .middleware(middleware.silentAuth())

// Auth routes (guest only)
router
  .group(() => {
    router.get('/login', [AuthController, 'showLogin']).as('auth.login')
    router.post('/login', [AuthController, 'login'])
    router.get('/register', [AuthController, 'showRegister']).as('auth.register')
    router.post('/register', [AuthController, 'register'])
  })
  .middleware(middleware.guest())

// Authenticated routes
router
  .get('/dashboard', async ({ inertia, auth }) => {
    await auth.check()
    const user = auth.user
    return inertia.render('home', { user })
  })
  .as('dashboard')
  .middleware(middleware.auth())
router.post('/logout', [AuthController, 'logout']).as('auth.logout').middleware(middleware.auth())

// UI routes for projects
router
  .group(() => {
    router.get('/', [ProjectsController, 'getAll'])

    router.get('/:uuid', [ProjectsController, 'getByUuid'])

    router.post('/', [ProjectsController, 'create'])

    router.patch('/:uuid', [ProjectsController, 'update'])

    router.post('/:uuid/chat', [ProjectsController, 'chat'])
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
