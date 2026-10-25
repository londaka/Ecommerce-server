import TryCatch from "../utils/TryCatch.js"
import { OTP } from "../models/Otp.js"
import sendOtp from "../utils/sendOtp.js"
import { User }  from "../models/User.js"
import jwt from "jsonwebtoken"
import { randomInt } from "node:crypto"



const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/


const OTP_TTL_MS = 5 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

export const loginUser = TryCatch(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase()

  if (!email) {
    return res.status(400).json({ message: "Email is required" })
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ message: "Please enter a valid email address" })
  }

  // One code per address per minute: stops someone flooding a victim's inbox
  // and burning the free email quota. A code was created at (expiresAt - TTL).
  const existing = await OTP.findOne({ email })
  if (existing && existing.expiresAt.getTime() - OTP_TTL_MS > Date.now() - RESEND_COOLDOWN_MS) {
    return res.status(429).json({ message: "Please wait a minute before requesting another code" })
  }

  const subject = "Your OTP for Login"
  const otp = randomInt(100000, 1000000)

  // Send first, so a failed delivery does not destroy the user's previous valid OTP.
  await sendOtp(email, subject, otp)

  await OTP.findOneAndUpdate(
    { email },
    { otp, attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )

  res.json({
    message: "OTP sent successfully"
  })
})

// Replace ONLY the verifyOtp export in User.Controller.js. Existing imports
// (TryCatch, OTP, User, jwt) stay as they are.
const MAX_OTP_ATTEMPTS = 5

export const verifyOtp = TryCatch(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase()
  const otp = Number(req.body.otp)

  if (!email || !Number.isInteger(otp) || String(otp).length !== 6) {
    return res.status(400).json({ message: "Invalid OTP" })
  }

  const record = await OTP.findOne({ email })

  if (!record) {
    return res.status(400).json({ message: "Invalid OTP" })
  }

  // The TTL index alone lets a code live ~10 minutes; enforce 5 here.
  if (record.expiresAt.getTime() <= Date.now()) {
    await OTP.deleteOne({ _id: record._id })
    return res.status(400).json({ message: "OTP expired. Please request a new one." })
  }

  if (record.otp !== otp) {
    const updated = await OTP.findOneAndUpdate(
      { _id: record._id },
      { $inc: { attempts: 1 } },
      { new: true }
    )
    if (updated && updated.attempts >= MAX_OTP_ATTEMPTS) {
      await OTP.deleteOne({ _id: record._id })
      return res.status(429).json({ message: "Too many wrong attempts. Please request a new OTP." })
    }
    return res.status(400).json({ message: "Invalid OTP" })
  }

  // Consume the code atomically so it can only be used once, even with parallel requests.
  const consumed = await OTP.findOneAndDelete({ _id: record._id, otp })
  if (!consumed) {
    return res.status(400).json({ message: "Invalid OTP" })
  }

  let user = await User.findOne({ email })

  if (!user) {
    user = await User.create({ email })
  }

  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: "15d" })

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