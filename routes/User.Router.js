import express from 'express'
import { loginUser, profile } from '../controllers/User.Controller.js'
import { verifyOtp } from '../controllers/User.Controller.js'
import { isAuth } from '../middlewares/Auth.Middleware.js'

const router = express.Router()

router.post('/login', loginUser)
router.post('/verify', verifyOtp)
router.get('/me', (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}, isAuth, profile)

export default router
