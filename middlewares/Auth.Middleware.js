import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'

export const isAuth = async (req, res, next) => {
    try {
      const { token } = req.headers

      if(!token) return res.status(403).json({ 
        message: "Please Login"
     })

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = await User.findById(decoded._id)
        
        next()
    }catch (error){
       res.status(500).json({ message: "Please Login First" }) 
    }
}


