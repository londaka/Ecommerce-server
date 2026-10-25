import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema({
    email:{
        type:String,
        required:true,
        unique:true
    },
    otp:{
        type:Number,
        required: true
    },
    // wrong guesses so far; verifyOtp locks the code after 5
    attempts:{
        type:Number,
        default:0
    },
    expiresAt:{
        type:Date,
        default: () => new Date(Date.now()+ 5*60*1000),
        // Keep this index as it is. MongoDB removes the document 5 minutes AFTER
        // expiresAt (about 10 minutes after creation), so verifyOtp checks
        // expiresAt itself and enforces the real 5-minute lifetime.
        index: { expires: "5m"}
    }
})

export const OTP = mongoose.model('OTP', otpSchema)