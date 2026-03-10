const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
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

// GET /users/friends — friends list with requests
router.get('/friends', isAuthenticated, async (req, res) => {
    try {
        const [user, incomingRequests, outgoingRequests] = await Promise.all([
            User.findById(req.session.userId).populate('friends', 'username email').lean(),
            FriendRequest.find({ to: req.session.userId, status: 'pending' })
                .populate('from', 'username email')
                .sort({ createdAt: -1 })
                .lean(),
            FriendRequest.find({ from: req.session.userId, status: 'pending' })
                .populate('to', 'username email')
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        const errorMap = {
            not_found: 'Benutzer nicht gefunden.',
            self: 'Du kannst dich nicht selbst hinzufügen.',
            already_friends: 'Ihr seid bereits befreundet.',
            already_requested: 'Du hast bereits eine Anfrage gesendet.',
            request_exists: 'Dieser Benutzer hat dir bereits eine Anfrage gesendet.',
        };
        const successMap = {
            sent: 'Freundschaftsanfrage gesendet!',
            accepted: 'Freundschaftsanfrage angenommen!',
            declined: 'Freundschaftsanfrage abgelehnt.',
            removed: 'Freund entfernt.',
            cancelled: 'Anfrage zurückgezogen.',
        };
        const errorMsg = req.query.error ? (errorMap[req.query.error] || null) : null;
        const successMsg = req.query.success ? (successMap[req.query.success] || null) : null;

        res.render('users/friends', {
            friends: user.friends,
            incomingRequests,
            outgoingRequests,
            user: req.session,
            errorMsg,
            successMsg,
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Freundesliste konnte nicht geladen werden.' });
    }
});

// GET /users/friends/data — JSON API for polling friend requests
router.get('/friends/data', isAuthenticated, async (req, res) => {
    try {
        const [user, incomingRequests, outgoingRequests] = await Promise.all([
            User.findById(req.session.userId).populate('friends', 'username email').lean(),
            FriendRequest.find({ to: req.session.userId, status: 'pending' })
                .populate('from', 'username email')
                .sort({ createdAt: -1 })
                .lean(),
            FriendRequest.find({ from: req.session.userId, status: 'pending' })
                .populate('to', 'username email')
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.json({
            friends: user.friends,
            incomingRequests,
            outgoingRequests,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /users/friends/request — send a friend request
router.post('/friends/request', isAuthenticated, async (req, res) => {
    const { username } = req.body;
    try {
        const targetUser = await User.findOne({ username });
        if (!targetUser) return res.redirect('/users/friends?error=not_found');
        if (targetUser._id.toString() === req.session.userId) return res.redirect('/users/friends?error=self');

        // Check if already friends
        const currentUser = await User.findById(req.session.userId);
        if (currentUser.friends.map(String).includes(targetUser._id.toString())) {
            return res.redirect('/users/friends?error=already_friends');
        }

        // Check if request already exists from me
        const existingOutgoing = await FriendRequest.findOne({
            from: req.session.userId,
            to: targetUser._id,
            status: 'pending'
        });
        if (existingOutgoing) return res.redirect('/users/friends?error=already_requested');

        // Check if incoming request exists - auto-accept in that case
        const existingIncoming = await FriendRequest.findOne({
            from: targetUser._id,
            to: req.session.userId,
            status: 'pending'
        });
        if (existingIncoming) {
            // Auto-accept the existing request
            existingIncoming.status = 'accepted';
            await existingIncoming.save();

            // Add each other as friends
            await User.findByIdAndUpdate(req.session.userId, { $addToSet: { friends: targetUser._id } });
            await User.findByIdAndUpdate(targetUser._id, { $addToSet: { friends: req.session.userId } });

            return res.redirect('/users/friends?success=accepted');
        }

        // Create new request
        await FriendRequest.create({ from: req.session.userId, to: targetUser._id });
        res.redirect('/users/friends?success=sent');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// POST /users/friends/accept/:requestId — accept a friend request
router.post('/friends/accept/:requestId', isAuthenticated, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);
        if (!request || request.to.toString() !== req.session.userId || request.status !== 'pending') {
            return res.redirect('/users/friends');
        }

        request.status = 'accepted';
        await request.save();

        // Add each other as friends
        await User.findByIdAndUpdate(req.session.userId, { $addToSet: { friends: request.from } });
        await User.findByIdAndUpdate(request.from, { $addToSet: { friends: req.session.userId } });

        res.redirect('/users/friends?success=accepted');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// POST /users/friends/decline/:requestId — decline a friend request
router.post('/friends/decline/:requestId', isAuthenticated, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);
        if (!request || request.to.toString() !== req.session.userId || request.status !== 'pending') {
            return res.redirect('/users/friends');
        }

        request.status = 'declined';
        await request.save();

        res.redirect('/users/friends?success=declined');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// POST /users/friends/cancel/:requestId — cancel an outgoing request
router.post('/friends/cancel/:requestId', isAuthenticated, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.requestId);
        if (!request || request.from.toString() !== req.session.userId || request.status !== 'pending') {
            return res.redirect('/users/friends');
        }

        await FriendRequest.findByIdAndDelete(req.params.requestId);
        res.redirect('/users/friends?success=cancelled');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// POST /users/friends/remove — remove a friend
router.post('/friends/remove', isAuthenticated, async (req, res) => {
    const { friendId } = req.body;
    try {
        // Remove from both users' friend lists
        await User.findByIdAndUpdate(req.session.userId, { $pull: { friends: friendId } });
        await User.findByIdAndUpdate(friendId, { $pull: { friends: req.session.userId } });

        // Also delete any friend requests between them
        await FriendRequest.deleteMany({
            $or: [
                { from: req.session.userId, to: friendId },
                { from: friendId, to: req.session.userId }
            ]
        });

        res.redirect('/users/friends?success=removed');
    } catch (err) {
        console.error(err);
        res.redirect('/users/friends');
    }
});

// GET /users/profile/color — redirect to profile (prevent 404 on direct access)
router.get('/profile/color', isAuthenticated, (req, res) => {
    res.redirect('/users/profile');
});

// POST /users/profile/color — update accent color
router.post('/profile/color', isAuthenticated, async (req, res) => {
    const { accentColor } = req.body;
    try {
        // Validate hex color
        if (!/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
            return res.redirect('/users/profile?error=invalid_color');
        }
        await User.findByIdAndUpdate(req.session.userId, { accentColor });
        // Update session
        req.session.accentColor = accentColor;
        res.redirect('/users/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/users/profile');
    }
});

module.exports = router;


