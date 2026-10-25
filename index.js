import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import connectDB from "./utils/db.js";
import router from "./routes/User.Router.js";
import productRoutes from './routes/Product.Router.js';
import cartRoutes from './routes/Cart.Router.js'
import addressRoutes from './routes/Address.Router.js'
import orderRoutes from './routes/Order.Router.js'
import cors from 'cors'
import axios from 'axios'
import { setDefaultResultOrder } from 'node:dns'
import rateLimit from 'express-rate-limit'

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") })

setDefaultResultOrder("ipv4first")

const app = express()

app.get('/health', (req, res) => {
  res.status(200).json({ status: "ok" })
})

const healthUrl = process.env.RENDER_EXTERNAL_URL
  ? `${process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "")}/health`
  : null
const interval = 30000;

function keepServiceAwake() {
  if (!healthUrl) return

  axios
    .get(healthUrl)
    .catch((error) => {
      console.error(`Health check failed: ${error.message}`);
    })
}

if (healthUrl) {
  setInterval(keepServiceAwake, interval)
}

app.set('trust proxy', 1)

export const authLimiter = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." }
  })

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cors())
connectDB()

const port = process.env.PORT || 3000

app.use('/api/user', router)
app.use('/api/product', productRoutes)
app.use('/api/', cartRoutes)
app.use('/api/address', addressRoutes)
app.use('/api/order', orderRoutes)


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port} `)
})