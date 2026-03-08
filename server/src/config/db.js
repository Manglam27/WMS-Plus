import mongoose from 'mongoose'

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://mongo:27017/wmsplus'
  const maxRetries = 10
  let retries = 0

  while (retries < maxRetries) {
    try {
      const conn = await mongoose.connect(uri)
      console.log(`MongoDB connected: ${conn.connection.host}`)
      return
    } catch (error) {
      retries++
      console.error(`MongoDB connection attempt ${retries}/${maxRetries}:`, error.message)
      if (retries >= maxRetries) {
        console.error('MongoDB connection failed after retries')
        process.exit(1)
      }
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

export default connectDB
