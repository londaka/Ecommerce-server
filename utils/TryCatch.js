// Wraps an async Express handler. Expected errors (err.expose === true) keep
// their message and status code; anything unexpected becomes a generic 500
// and the real error is logged on the server only.
const TryCatch = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next)
    } catch (err) {
      console.error(`[${req.method} ${req.originalUrl}]`, err)
      if (res.headersSent) return next(err)

      const statusCode = err.statusCode || 500
      res.status(statusCode).json({
        message: err.expose ? err.message : "Something went wrong. Please try again."
      })
    }
  }
}

export default TryCatch