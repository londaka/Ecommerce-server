import express from 'express'
import { isAuth } from '../middlewares/Auth.Middleware.js'
import { completeDemoPayment, getAllOrders, getAllOrdersAdmin, getMyOrder, getStats, initiateEsewaPayment, newOrderCod, updateStatus, verifyEsewaPayment } from '../controllers/Order.Controller.js'

const router = express.Router()

router.post('/new/cod', isAuth, newOrderCod)
router.post('/esewa/initiate', isAuth, initiateEsewaPayment)
router.post('/demo/complete', isAuth, completeDemoPayment)
router.post('/esewa/verify', isAuth, verifyEsewaPayment)
router.get('/all', isAuth, getAllOrders)
router.get('/admin/all', isAuth, getAllOrdersAdmin)
router.get('/stats', isAuth, getStats)
router.get('/:id', isAuth, getMyOrder)
router.post('/update/:id', isAuth, updateStatus)
export default router