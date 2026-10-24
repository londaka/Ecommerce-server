import express from 'express'
import { isAuth } from '../middlewares/Auth.Middleware.js'
import { createProduct, getAllProduct, getSingleProduct, updateProduct, updateProductImage } from '../controllers/Product.Controller.js'
import { upload } from '../middlewares/upload.js'

const router = express.Router()

router.post('/add', isAuth, upload.array('images', 5), createProduct)
router.get('/all', getAllProduct)
router.get('/single/:id', getSingleProduct)
router.put('/update/:id', isAuth, updateProduct)
router.post('/imgupdate/:id', isAuth, upload.array('images', 5), updateProductImage)

export default router