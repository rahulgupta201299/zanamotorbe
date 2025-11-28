require('dotenv').config();
const express = require('express');
const connectDB = require('./config/database');
const cors  = require('cors')

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const routes = require('./routes');
app.use('/api/v1', routes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
