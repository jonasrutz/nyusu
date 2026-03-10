require('dotenv').config();
const mongoose = require('mongoose');
const app      = require('./app');

const PORT     = process.env.PORT  || 3000;
const MONGO_URI = process.env.MONGO_URI ||
    'mongodb+srv://Jonas:Guga2008@clusterm165.p4sse6y.mongodb.net/?appName=ClusterM165';

mongoose
    .connect(MONGO_URI)
    .then(() => {
        console.log('✅ DB Connection successful!');
        app.listen(PORT, () => console.log(`🚀 Server läuft auf http://localhost:${PORT}`));
    })
    .catch(err => console.error('❌ DB Connection failed:', err));
