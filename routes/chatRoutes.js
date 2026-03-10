const express = require('express');
const router  = express.Router({ mergeParams: true });
const Message = require('../models/Message');
const Team    = require('../models/Team');
const { isAuthenticated } = require('../middleware/auth');

// GET /teams/:teamId/chat — returns messages (used by detail page via redirect)
router.get('/', isAuthenticated, async (req, res) => {
    res.redirect(`/teams/${req.params.teamId}?tab=chat`);
});

// POST /teams/:teamId/chat — post a new message
router.post('/', isAuthenticated, async (req, res) => {
    const { content } = req.body;
    const teamId      = req.params.teamId;
    if (!content || !content.trim()) return res.redirect(`/teams/${teamId}?tab=chat`);
    try {
        // Only members may post
        const team = await Team.findById(teamId);
        if (!team) return res.redirect('/teams');
        const isMember = team.members.map(String).includes(req.session.userId);
        if (!isMember) return res.redirect(`/teams/${teamId}?tab=chat`);

        await Message.create({ team: teamId, author: req.session.userId, content: content.trim() });
        res.redirect(`/teams/${teamId}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=chat`);
    }
});

// POST /teams/:teamId/chat/:msgId/delete — delete own message
router.post('/:msgId/delete', isAuthenticated, async (req, res) => {
    const { teamId, msgId } = req.params;
    try {
        const msg = await Message.findById(msgId);
        if (msg && msg.author.toString() === req.session.userId) {
            await Message.findByIdAndDelete(msgId);
        }
        res.redirect(`/teams/${teamId}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=chat`);
    }
});

module.exports = router;

