import express from 'express'
import { isAuth } from '../middlewares/Auth.Middleware.js'
import { addAddress, deleteAddress, getAllAddress, getSingleAddress } from '../controllers/Address.Controller.js'

const router = express.Router()

router.post('/new', isAuth, addAddress )
router.get('/all', isAuth, getAllAddress)
router.get('/:id', isAuth, getSingleAddress)
router.delete('/:id', isAuth, deleteAddress)

export default router