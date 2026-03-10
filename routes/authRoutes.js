const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');

// Rate Limiting (FID-009)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: 'Zu viele Versuche. Bitte versuche es in 15 Minuten erneut.',
    standardHeaders: true,
    legacyHeaders: false,
});

// GET /auth/register
router.get('/register', (req, res) => {
    res.render('auth/register', { error: null, success: null });
});

// Passwort-Policy Regex (FID-002 Fix: min 8 Zeichen, Gross-/Kleinbuchstaben, Zahl, Sonderzeichen)
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

// POST /auth/register (FID-009, FID-010)
router.post('/register', authLimiter, async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password) {
        return res.render('auth/register', { error: 'Alle Felder sind erforderlich.', success: null });
    }
    // FID-002 Fix: Passwort-Komplexität validieren
    if (!passwordRegex.test(password)) {
        return res.render('auth/register', { error: 'Passwort muss mindestens 8 Zeichen mit Gross-/Kleinbuchstaben, Zahl und Sonderzeichen (@$!%*?&#) enthalten.', success: null });
    }
    if (password !== confirmPassword) {
        return res.render('auth/register', { error: 'Passwörter stimmen nicht überein.', success: null });
    }
    try {
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            // FID-003 Fix: Generische Fehlermeldung verhindert Account-Enumeration
            return res.render('auth/register', { error: 'Registrierung nicht möglich. Bitte verwende andere Angaben oder melde dich an.', success: null });
        }
        const user = new User({ username, email, passwordHash: password });
        await user.save();
        req.session.userId = user._id.toString();
        req.session.username = user.username;
        req.session.accentColor = user.accentColor;
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.render('auth/register', { error: 'Fehler bei der Registrierung.', success: null });
    }
});

// GET /auth/login
router.get('/login', (req, res) => {
    res.render('auth/login', { error: null });
});

// POST /auth/login (FID-009)
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render('auth/login', { error: 'E-Mail und Passwort erforderlich.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', { error: 'Ungültige Anmeldedaten.' });
        }
        req.session.userId = user._id.toString();
        req.session.username = user.username;
        req.session.accentColor = user.accentColor;
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.render('auth/login', { error: 'Anmeldefehler.' });
    }
});

// POST /auth/logout (FID-013)
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;

