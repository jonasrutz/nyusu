require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
    console.error('❌ MONGO_URI Umgebungsvariable ist nicht gesetzt!');
    process.exit(1);
}

mongoose
    .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => {
        console.log('✅ DB Connection successful!');
        app.listen(PORT, () => console.log(`🚀 Server läuft auf http://localhost:${PORT}`));
    })
    .catch(err => {
        console.error('❌ DB Connection failed:', err.message);
        process.exit(1);
    });
