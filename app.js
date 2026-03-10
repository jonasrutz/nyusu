require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default || require('connect-mongo');
const helmet = require('helmet');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const teamRoutes = require('./routes/teamRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const documentRoutes = require('./routes/documentRoutes');

const app = express();

// ─── Security Headers (FID-008) ──────────────────────────────
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
        },
    },
}));

// ─── View Engine ──────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Static Files ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ─── Session (FID-001, FID-006, FID-007) ─────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
    console.error('❌ SESSION_SECRET muss gesetzt sein (min. 32 Zeichen)!');
    process.exit(1);
}
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: 14 * 24 * 60 * 60,
        autoRemove: 'native',
    }),
    cookie: {
        maxAge: 14 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    },
}));

// ─── CSRF Protection (FID-005) ───────────────────────────────
app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }
        return next();
    }
    // POST/PUT/DELETE: validate CSRF token
    const token = req.body._csrf || req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).render('error', { message: 'Ungültiges CSRF-Token. Bitte lade die Seite neu.' });
    }
    next();
});

// ─── Local variables available in all EJS templates ───────────
app.use((req, res, next) => {
    res.locals.sessionUser = req.session.userId ? req.session : null;
    res.locals.csrfToken = req.session.csrfToken || '';
    next();
});

// ─── Routes ───────────────────────────────────────────────────
app.get('/', (req, res) => {
    if (req.session.userId) return res.redirect('/teams');
    res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

// ─── Convenience redirects for direct URLs ────────────────────
app.get('/anfragen', (req, res) => res.redirect('/users/friends'));
app.get('/documents', (req, res) => res.redirect('/teams'));
app.get('/freunde', (req, res) => res.redirect('/users/friends'));

// Specific team sub-routes first, then general team routes
app.use('/teams/:teamId/chat', chatRoutes);
app.use('/teams/:teamId/documents', documentRoutes);
app.use('/teams', teamRoutes);

// ─── 404 ──────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).render('error', { message: 'Seite nicht gefunden (404).' });
});

module.exports = app;


