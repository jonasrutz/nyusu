const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

// GET /auth/register
router.get('/register', (req, res) => {
    res.render('auth/register', { error: null, success: null });
});

// POST /auth/register
router.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    if (!username || !email || !password) {
        return res.render('auth/register', { error: 'Alle Felder sind erforderlich.', success: null });
    }
    if (password !== confirmPassword) {
        return res.render('auth/register', { error: 'Passwörter stimmen nicht überein.', success: null });
    }
    try {
        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) {
            return res.render('auth/register', { error: 'Benutzername oder E-Mail bereits vergeben.', success: null });
        }
        const user = new User({ username, email, passwordHash: password });
        await user.save();
        req.session.userId = user._id.toString();
        req.session.username = user.username;
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

// POST /auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.render('auth/login', { error: 'E-Mail und Passwort erforderlich.' });
    }
    try {
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.render('auth/login', { error: 'Ungültige Anmeldedaten.' });
        }
        req.session.userId   = user._id.toString();
        req.session.username = user.username;
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.render('auth/login', { error: 'Anmeldefehler.' });
    }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/login'));
});

module.exports = router;

