const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const Message = require('../models/Message');
const Document = require('../models/Document');
const JoinRequest = require('../models/JoinRequest');
const { isAuthenticated } = require('../middleware/auth');
const { decrypt } = require('../utils/crypto');

// Regex-Escaping (FID-002)
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /teams — dashboard: list all teams, optionally filter by search query
router.get('/', isAuthenticated, async (req, res) => {
    const query = req.query.q ? req.query.q.trim() : '';
    try {
        const filter = query ? { name: { $regex: escapeRegex(query), $options: 'i' } } : {};
        const teams = await Team.find(filter).populate('founder', 'username').lean();
        res.render('dashboard', { teams, query, user: req.session });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Teams konnten nicht geladen werden.' });
    }
});

// GET /teams/new — create team form
router.get('/new', isAuthenticated, (req, res) => {
    res.render('team/new', { error: null, user: req.session });
});

// POST /teams — create new team
router.post('/', isAuthenticated, async (req, res) => {
    const { name, description, game } = req.body;
    if (!name) return res.render('team/new', { error: 'Name ist erforderlich.', user: req.session });
    try {
        const team = new Team({
            name, description, game,
            founder: req.session.userId,
            admins: [req.session.userId],
            members: [req.session.userId],
        });
        await team.save();
        res.redirect(`/teams/${team._id}`);
    } catch (err) {
        console.error(err);
        const dupMsg = err.code === 11000 ? 'Teamname bereits vergeben.' : 'Fehler beim Erstellen.';
        res.render('team/new', { error: dupMsg, user: req.session });
    }
});

// GET /teams/:id — team detail page
router.get('/:id', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('members', 'username')
            .populate('founder', 'username')
            .populate('admins', 'username')
            .lean();
        if (!team) return res.render('error', { message: 'Team nicht gefunden.' });

        const isMember = team.members.some(m => m._id.toString() === req.session.userId);
        const isAdmin = team.admins.some(a => a._id.toString() === req.session.userId);

        // Check if current user is timed out
        const now = new Date();
        const userTimeout = team.timeouts && team.timeouts[req.session.userId];
        const isTimedOut = userTimeout && new Date(userTimeout) > now;
        const timeoutUntil = isTimedOut ? new Date(userTimeout) : null;

        // Add timeout status to each member for display
        const membersWithTimeout = team.members.map(m => {
            const timeout = team.timeouts && team.timeouts[m._id.toString()];
            const timedOut = timeout && new Date(timeout) > now;
            return {
                ...m,
                isTimedOut: timedOut,
                timeoutUntil: timedOut ? new Date(timeout) : null
            };
        });

        const [rawMessages, documents, joinRequests, myRequest] = await Promise.all([
            isMember
                ? Message.find({ team: req.params.id })
                    .populate('author', 'username')
                    .sort({ createdAt: 1 })
                    .lean()
                : Promise.resolve([]),
            isMember
                ? Document.find({ team: req.params.id })
                    .populate('uploadedBy', 'username')
                    .sort({ createdAt: -1 })
                    .lean()
                : Promise.resolve([]),
            isAdmin
                ? JoinRequest.find({ team: req.params.id, status: 'pending' })
                    .populate('user', 'username')
                    .sort({ createdAt: 1 })
                    .lean()
                : Promise.resolve([]),
            !isMember
                ? JoinRequest.findOne({ team: req.params.id, user: req.session.userId }).lean()
                : Promise.resolve(null),
        ]);

        // Decrypt message content before sending to view
        const messages = rawMessages.map(m => ({ ...m, content: decrypt(m.content) }));

        res.render('team/detail', {
            team: { ...team, members: membersWithTimeout },
            isMember, isAdmin, isTimedOut, timeoutUntil,
            user: req.session,
            tab: req.query.tab || 'chat',
            messages, documents, joinRequests, myRequest,
            requested: !!req.query.requested,
            error: req.query.error || null,
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Fehler beim Laden des Teams.' });
    }
});

// GET /teams/:id/data — JSON API for real-time data polling
router.get('/:id/data', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate('members', 'username')
            .populate('founder', 'username')
            .populate('admins', 'username')
            .lean();
        if (!team) return res.status(404).json({ error: 'Team nicht gefunden' });

        const isMember = team.members.some(m => m._id.toString() === req.session.userId);
        const isAdmin = team.admins.some(a => a._id.toString() === req.session.userId);

        if (!isMember) return res.status(403).json({ error: 'Kein Zugriff' });

        const now = new Date();
        const userTimeout = team.timeouts && team.timeouts[req.session.userId];
        const isTimedOut = userTimeout && new Date(userTimeout) > now;
        const timeoutUntil = isTimedOut ? new Date(userTimeout) : null;

        const membersWithTimeout = team.members.map(m => {
            const timeout = team.timeouts && team.timeouts[m._id.toString()];
            const timedOut = timeout && new Date(timeout) > now;
            return {
                ...m,
                isTimedOut: timedOut,
                timeoutUntil: timedOut ? new Date(timeout) : null
            };
        });

        const [rawMessages, documents, joinRequests] = await Promise.all([
            Message.find({ team: req.params.id })
                .populate('author', 'username')
                .sort({ createdAt: 1 })
                .lean(),
            Document.find({ team: req.params.id })
                .populate('uploadedBy', 'username')
                .sort({ createdAt: -1 })
                .lean(),
            isAdmin
                ? JoinRequest.find({ team: req.params.id, status: 'pending' })
                    .populate('user', 'username')
                    .sort({ createdAt: 1 })
                    .lean()
                : Promise.resolve([]),
        ]);

        const messages = rawMessages.map(m => ({
            _id: m._id,
            content: decrypt(m.content),
            author: m.author,
            createdAt: m.createdAt
        }));

        res.json({
            team: { ...team, members: membersWithTimeout },
            messages,
            documents,
            joinRequests,
            isAdmin,
            isTimedOut,
            timeoutUntil,
            currentUserId: req.session.userId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Fehler beim Laden' });
    }
});

// POST /teams/:id/join — submit a join request (form with rank, experience, motivation)
router.post('/:id/join', isAuthenticated, async (req, res) => {
    const { rank, experience, motivation } = req.body;
    try {
        const team = await Team.findById(req.params.id).lean();
        if (!team) return res.redirect('/teams');

        // Already a member → just redirect
        if (team.members.map(String).includes(req.session.userId)) {
            return res.redirect(`/teams/${req.params.id}`);
        }

        // Upsert so re-submitting after decline overwrites the old request
        await JoinRequest.findOneAndUpdate(
            { team: req.params.id, user: req.session.userId },
            { rank: rank || '', experience: experience || '', motivation: motivation || '', status: 'pending' },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.redirect(`/teams/${req.params.id}?requested=1`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

// POST /teams/:id/requests/:reqId/accept — admin accepts a join request
router.post('/:id/requests/:reqId/accept', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');
        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);

        const joinReq = await JoinRequest.findById(req.params.reqId);
        if (!joinReq) return res.redirect(`/teams/${req.params.id}`);

        joinReq.status = 'accepted';
        await joinReq.save();

        await Team.findByIdAndUpdate(req.params.id, {
            $addToSet: { members: joinReq.user },
        });
        res.redirect(`/teams/${req.params.id}?tab=requests`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

// POST /teams/:id/requests/:reqId/decline — admin declines a join request
router.post('/:id/requests/:reqId/decline', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');
        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);

        await JoinRequest.findByIdAndUpdate(req.params.reqId, { status: 'declined' });
        res.redirect(`/teams/${req.params.id}?tab=requests`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

// POST /teams/:id/leave — leave a team
router.post('/:id/leave', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');
        // Founder cannot leave (must delete)
        if (team.founder.toString() === req.session.userId) {
            return res.redirect(`/teams/${req.params.id}?error=founder_cannot_leave`);
        }
        await Team.findByIdAndUpdate(req.params.id, {
            $pull: { members: req.session.userId, admins: req.session.userId },
        });
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.redirect('/teams');
    }
});

// POST /teams/:id/delete — delete team (founder only)
router.post('/:id/delete', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');
        if (team.founder.toString() !== req.session.userId) {
            return res.redirect(`/teams/${req.params.id}`);
        }
        await Team.findByIdAndDelete(req.params.id);
        res.redirect('/teams');
    } catch (err) {
        console.error(err);
        res.redirect('/teams');
    }
});

// GET /teams/:id/edit — edit team form (admin only)
router.get('/:id/edit', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id).lean();
        if (!team) return res.render('error', { message: 'Team nicht gefunden.' });
        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);
        res.render('team/edit', { team, error: null, user: req.session });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Fehler.' });
    }
});

// POST /teams/:id/edit — update team (admin only)
router.post('/:id/edit', isAuthenticated, async (req, res) => {
    const { name, description, game } = req.body;
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.render('error', { message: 'Team nicht gefunden.' });
        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);
        await Team.findByIdAndUpdate(req.params.id, { name, description, game });
        res.redirect(`/teams/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Fehler beim Aktualisieren.' });
    }
});

// GET /teams/:id/kick/:memberId — redirect to team page (prevent 404 on direct access)
router.get('/:id/kick/:memberId', isAuthenticated, (req, res) => {
    res.redirect(`/teams/${req.params.id}`);
});

// POST /teams/:id/kick/:memberId — kick a member (admin only)
router.post('/:id/kick/:memberId', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');

        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);

        const memberId = req.params.memberId;

        // Cannot kick founder
        if (team.founder.toString() === memberId) {
            return res.redirect(`/teams/${req.params.id}?error=cannot_kick_founder`);
        }

        // Cannot kick yourself
        if (memberId === req.session.userId) {
            return res.redirect(`/teams/${req.params.id}?error=cannot_kick_self`);
        }

        // Only founder can kick admins
        if (team.admins.map(String).includes(memberId) && team.founder.toString() !== req.session.userId) {
            return res.redirect(`/teams/${req.params.id}?error=only_founder_can_kick_admin`);
        }

        await Team.findByIdAndUpdate(req.params.id, {
            $pull: { members: memberId, admins: memberId },
            $unset: { [`timeouts.${memberId}`]: '' }
        });

        res.redirect(`/teams/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

// GET /teams/:id/timeout/:memberId — redirect to team page (prevent 404 on direct access)
router.get('/:id/timeout/:memberId', isAuthenticated, (req, res) => {
    res.redirect(`/teams/${req.params.id}`);
});

// POST /teams/:id/timeout/:memberId — timeout a member (admin only)
router.post('/:id/timeout/:memberId', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');

        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);

        const memberId = req.params.memberId;
        const duration = parseInt(req.body.duration) || 60; // Default 60 minutes

        // Cannot timeout founder or other admins (unless you're founder)
        if (team.founder.toString() === memberId) {
            return res.redirect(`/teams/${req.params.id}?error=cannot_timeout_founder`);
        }

        if (team.admins.map(String).includes(memberId) && team.founder.toString() !== req.session.userId) {
            return res.redirect(`/teams/${req.params.id}?error=only_founder_can_timeout_admin`);
        }

        const timeoutUntil = new Date(Date.now() + duration * 60 * 1000);

        await Team.findByIdAndUpdate(req.params.id, {
            $set: { [`timeouts.${memberId}`]: timeoutUntil }
        });

        res.redirect(`/teams/${req.params.id}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

// GET /teams/:id/untimeout/:memberId — redirect to team page (prevent 404 on direct access)
router.get('/:id/untimeout/:memberId', isAuthenticated, (req, res) => {
    res.redirect(`/teams/${req.params.id}`);
});

// POST /teams/:id/untimeout/:memberId — remove timeout (admin only)
router.post('/:id/untimeout/:memberId', isAuthenticated, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.redirect('/teams');

        const isAdmin = team.admins.map(String).includes(req.session.userId);
        if (!isAdmin) return res.redirect(`/teams/${req.params.id}`);

        await Team.findByIdAndUpdate(req.params.id, {
            $unset: { [`timeouts.${req.params.memberId}`]: '' }
        });

        res.redirect(`/teams/${req.params.id}?tab=chat`);
    } catch (err) {
        console.error(err);
        res.redirect(`/teams/${req.params.id}`);
    }
});

module.exports = router;



