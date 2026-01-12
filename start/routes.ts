/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
const ProjectsController = () => import('#controllers/projects_controller')

router.on('/').renderInertia('home')

router
  .group(() => {
    router.get('/', [ProjectsController, 'getAll'])

    router.get('/:uuid', [ProjectsController, 'getByUuid'])

    router.post('/', [ProjectsController, 'create'])

    router.patch('/:uuid', [ProjectsController, 'update'])

    router.post('/:uuid/chat', [ProjectsController, 'chat'])
  })
  .prefix('/projects')
