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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") })






const app = express()

const url = `https://ecommerce-server-1-qvg5.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);

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