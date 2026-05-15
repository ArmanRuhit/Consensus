import { Router } from 'express'
import { healthCheck } from '../controllers/health.controller.js'
import { authRouter } from './auth.routes.js'
import { pollRouter } from './poll.routes.js'

const router = Router()

router.get('/health', healthCheck)
router.use('/auth', authRouter)
router.use('/polls', pollRouter)

export { router }