const express = require('express');
const router = express.Router({ mergeParams: true });
const Document = require('../models/Document');
const Team = require('../models/Team');
const { isAuthenticated } = require('../middleware/auth');

// GET /teams/:teamId/documents — redirect to detail page docs tab
router.get('/', isAuthenticated, (req, res) => {
    res.redirect(`/teams/${req.params.teamId}?tab=docs`);
});

// POST /teams/:teamId/documents — add a new document link
router.post('/', isAuthenticated, async (req, res) => {
    const { title, url, description } = req.body;
    const teamId = req.params.teamId;
    if (!title || !url) return res.redirect(`/teams/${teamId}?tab=docs`);
    // URL-Validierung (FID-011)
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return res.redirect(`/teams/${teamId}?tab=docs`);
        }
    } catch {
        return res.redirect(`/teams/${teamId}?tab=docs`);
    }
    try {
        const team = await Team.findById(teamId);
        if (!team) return res.redirect('/teams');
        const isMember = team.members.map(String).includes(req.session.userId);
        if (!isMember) return res.redirect(`/teams/${teamId}?tab=docs`);

        await Document.create({ team: teamId, uploadedBy: req.session.userId, title, url, description });
        res.redirect(`/teams/${teamId}?tab=docs`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=docs`);
    }
});

// POST /teams/:teamId/documents/:docId/delete — delete own document
router.post('/:docId/delete', isAuthenticated, async (req, res) => {
    const { teamId, docId } = req.params;
    try {
        const doc = await Document.findById(docId);
        if (doc && doc.uploadedBy.toString() === req.session.userId) {
            await Document.findByIdAndDelete(docId);
        }
        res.redirect(`/teams/${teamId}?tab=docs`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${teamId}?tab=docs`);
    }
});

module.exports = router;

