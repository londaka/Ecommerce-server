import express from 'express'
import { loginUser, profile } from '../controllers/User.Controller.js'
import { verifyOtp } from '../controllers/User.Controller.js'
import { isAuth } from '../middlewares/Auth.Middleware.js'

const router = express.Router()

router.post('/login', loginUser, authLimiter(10))
router.post('/verify', verifyOtp, authLimiter(30))
router.get('/me', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}, isAuth, profile)

export default router
