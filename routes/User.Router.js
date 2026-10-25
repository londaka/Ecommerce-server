import express from 'express'
import { loginUser, profile } from '../controllers/User.Controller.js'
import { verifyOtp } from '../controllers/User.Controller.js'
import { isAuth } from '../middlewares/Auth.Middleware.js'
import rateLimit from 'express-rate-limit'

const router = express.Router()

const authLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." }
  })

router.post('/login', authLimiter(10), loginUser)
router.post('/verify', authLimiter(30), verifyOtp)
router.get('/me', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}, isAuth, profile)

export default router
