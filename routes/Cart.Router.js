import express from 'express'
import { isAuth } from '../middlewares/Auth.Middleware.js'
import { addToCart, fetchCart, removeFromCart, updateCart } from '../controllers/Cart.Controller.js'

const router = express.Router()


router.post('/addtocart', isAuth, addToCart)
router.get('/cart/remove/:id', isAuth, removeFromCart)
router.post('/cart/update', isAuth, updateCart)
router.get('/cart/all', isAuth, fetchCart)

export default router