const express = require('express');
const router = express.Router({ mergeParams: true });
const Message = require('../models/Message');
const Team = require('../models/Team');
const { isAuthenticated } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// GET /teams/:teamId/chat — returns messages (used by detail page via redirect)
router.get('/', isAuthenticated, async (req, res) => {
    res.redirect(`/teams/${req.params.teamId}?tab=chat`);
});

// GET /teams/:teamId/chat/messages — returns messages as JSON for polling
router.get('/messages', isAuthenticated, async (req, res) => {
    const teamId = req.params.teamId;
    try {
        const team = await Team.findById(teamId);
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });

        const isMember = team.members.map(String).includes(req.session.userId);
        if (!isMember) return res.status(403).json({ error: 'Kein Zugriff' });

        const rawMessages = await Message.find({ team: teamId })
            .populate('author', 'username')
            .sort({ createdAt: 1 })
            .lean();

        const messages = rawMessages.map(m => ({
            _id: m._id,
            content: decrypt(m.content),
            author: m.author,
            createdAt: m.createdAt
        }));

        res.json({ messages, currentUserId: req.session.userId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden der Nachrichten' });
    }
});

// POST /teams/:teamId/chat — post a new message
router.post('/', isAuthenticated, async (req, res) => {
    const { content } = req.body;
    const teamId = req.params.teamId;
    if (!content || !content.trim()) return res.redirect(`/teams/${teamId}?tab=chat`);
    try {
        // Only members may post
        const team = await Team.findById(teamId);
        if (!team) return res.redirect('/teams');
        const isMember = team.members.map(String).includes(req.session.userId);
        if (!isMember) return res.redirect(`/teams/${teamId}?tab=chat`);

        // Check if user is timed out
        if (team.isTimedOut(req.session.userId)) {
            return res.redirect(`/teams/${teamId}?tab=chat&error=timeout`);
        }

        // Encrypt before storing in DB
        const encryptedContent = encrypt(content.trim());
        await Message.create({ team: teamId, author: req.session.userId, content: encryptedContent });
        res.redirect(`/teams/${teamId}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=chat`);
    }
});

// POST /teams/:teamId/chat/:msgId/delete — delete own message or admin delete any
router.post('/:msgId/delete', isAuthenticated, async (req, res) => {
    const { teamId, msgId } = req.params;
    try {
        const team = await Team.findById(teamId);
        if (!team) return res.redirect('/teams');

        const isAdmin = team.admins.map(String).includes(req.session.userId);
        const msg = await Message.findById(msgId);

        // Allow delete if: own message OR admin
        if (msg && (msg.author.toString() === req.session.userId || isAdmin)) {
            await Message.findByIdAndDelete(msgId);
        }
        res.redirect(`/teams/${teamId}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=chat`);
    }
});

module.exports = router;
