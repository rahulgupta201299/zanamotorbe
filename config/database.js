const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    const mongoURI = config.MONGODB_URI;
    console.log('Connecting to MongoDB...');

    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
