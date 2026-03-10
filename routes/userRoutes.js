const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { isAuthenticated } = require('../middleware/auth');

// GET /users/profile — own profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate('friends', 'username email').lean();
        res.render('users/profile', { user, sessionUser: req.session });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Profil konnte nicht geladen werden.' });
    }
});

// GET /users/friends — friends list
router.get('/friends', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).populate('friends', 'username email').lean();
        const errorMap = { not_found: 'Benutzer nicht gefunden.', self: 'Du kannst dich nicht selbst hinzufügen.' };
        const errorMsg = req.query.error ? (errorMap[req.query.error] || null) : null;
        res.render('users/friends', { friends: user.friends, user: req.session, errorMsg });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Freundesliste konnte nicht geladen werden.' });
    }
});

// POST /users/friends/add — add a friend by username
router.post('/friends/add', isAuthenticated, async (req, res) => {
    const { username } = req.body;
    try {
        const friend = await User.findOne({ username });
        if (!friend) return res.redirect('/users/friends?error=not_found');
        if (friend._id.toString() === req.session.userId) return res.redirect('/users/friends?error=self');
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { friends: friend._id } });
        res.redirect('/users/friends');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// POST /users/friends/remove — remove a friend
router.post('/friends/remove', isAuthenticated, async (req, res) => {
    const { friendId } = req.body;
    try {
        await User.findByIdAndUpdate(req.session.userId, { $pull: { friends: friendId } });
        res.redirect('/users/friends');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

module.exports = router;


