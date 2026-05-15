import { Router } from 'express'
import { healthCheck } from '../controllers/health.controller.js'
import { authRouter } from './auth.routes.js'

const router = Router()

router.get('/health', healthCheck)
router.use('/auth', authRouter)

export { router }