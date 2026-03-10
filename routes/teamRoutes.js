const express   = require('express');
const router    = express.Router();
const Team      = require('../models/Team');
const Message   = require('../models/Message');
const Document  = require('../models/Document');
const { isAuthenticated } = require('../middleware/auth');

// GET /teams — dashboard: list all teams, optionally filter by search query
router.get('/', isAuthenticated, async (req, res) => {
    const query = req.query.q ? req.query.q.trim() : '';
    try {
        const filter = query ? { name: { $regex: query, $options: 'i' } } : {};
        const teams  = await Team.find(filter).populate('founder', 'username').lean();
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
            admins:  [req.session.userId],
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
        const isAdmin  = team.admins.some(a => a._id.toString() === req.session.userId);

        const [messages, documents] = await Promise.all([
            Message.find({ team: req.params.id })
                .populate('author', 'username')
                .sort({ createdAt: 1 })
                .lean(),
            Document.find({ team: req.params.id })
                .populate('uploadedBy', 'username')
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        res.render('team/detail', {
            team, isMember, isAdmin,
            user: req.session,
            tab: req.query.tab || 'chat',
            messages, documents,
        });
    } catch (err) {
        console.error(err);
        res.render('error', { message: 'Fehler beim Laden des Teams.' });
    }
});

// POST /teams/:id/join — join a team
router.post('/:id/join', isAuthenticated, async (req, res) => {
    try {
        await Team.findByIdAndUpdate(req.params.id, {
            $addToSet: { members: req.session.userId },
        });
        res.redirect(`/teams/${req.params.id}`);
    } catch (err) {
        console.error(err);
        res.redirect('/teams');
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

module.exports = router;



