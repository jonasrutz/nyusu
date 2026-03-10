require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const MongoStore   = require('connect-mongo').default || require('connect-mongo');
const path         = require('path');

const authRoutes     = require('./routes/authRoutes');
const teamRoutes     = require('./routes/teamRoutes');
const userRoutes     = require('./routes/userRoutes');
const chatRoutes     = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// ─── View Engine ──────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── Session ──────────────────────────────────────────────────
app.use(session({
    secret: process.env.SESSION_SECRET || 'teammanager_secret_change_me',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI ||
            'mongodb+srv://Jonas:Guga2008@clusterm165.p4sse6y.mongodb.net/?appName=ClusterM165',
        ttl: 14 * 24 * 60 * 60, // 14 days
    }),
    cookie: { maxAge: 14 * 24 * 60 * 60 * 1000 },
}));

// ─── Local variables available in all EJS templates ───────────
app.use((req, res, next) => {
    res.locals.sessionUser = req.session.userId ? req.session : null;
    next();
});

// ─── Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/teams');
    res.redirect('/auth/login');
});

app.use('/auth',                         authRoutes);
app.use('/teams',                        teamRoutes);
app.use('/users',                        userRoutes);
app.use('/teams/:teamId/chat',           chatRoutes);
app.use('/teams/:teamId/documents',      documentRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('error', { message: 'Seite nicht gefunden (404).' });
});

module.exports = app;


