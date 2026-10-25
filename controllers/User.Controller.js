import TryCatch from "../utils/TryCatch.js"
import { OTP } from "../models/Otp.js"
import sendOtp from "../utils/sendOtp.js"
import { User }  from "../models/User.js"
import jwt from "jsonwebtoken"
import { randomInt } from "node:crypto"


// Replace ONLY the existing loginUser export in User.Controller.js.
// Keep your existing imports (TryCatch, OTP, sendOtp) and add:
//   import { randomInt } from "node:crypto"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const loginUser = TryCatch(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ message: "Email is required" })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" })
  }

  const subject = "Your OTP for Login"
  const otp = randomInt(100000, 1000000)

  // Send first, so a failed delivery does not destroy the user's previous valid OTP.
  await sendOtp(email, subject, otp)

  await OTP.deleteMany({ email })
  await OTP.create({
    email,
    otp
  })

  res.json({
    message: "OTP sent successfully"
  })
})

export const verifyOtp = TryCatch(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase()
  const otp = Number(req.body.otp)

  if (!email || !Number.isInteger(otp) || String(otp).length !== 6) {
    return res.status(400).json({ message: "Invalid OTP" })
  }

  const haveOtp = await OTP.findOne({ email, otp })

  if (!haveOtp) {
    return res.status(400).json({ message: "Invalid OTP" })
  }

  let user = await User.findOne({ email })

  if (user) {
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "15d" })
    await haveOtp.deleteOne()

    return res.json({
      message: "Login successful",
      token,
      user
    })
  }

  user = await User.create({ email })
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "15d" })
  await haveOtp.deleteOne()

  return res.json({
    message: "Login successful",
    token,
    user
  })
})


export const profile = TryCatch(async(req, res) => {
    const user = await User.findById(req.user._id)

    res.json({
      user
    })
})