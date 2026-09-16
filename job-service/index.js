require('dotenv').config();
const express = require('express');
const jobRoutes = require('./routes/jobs');

const app = express();
app.use(express.json());
app.use('/jobs', jobRoutes);

app.listen(process.env.PORT, () => console.log(`Job service running on port ${process.env.PORT}`));