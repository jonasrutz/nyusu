/**
 * Middleware: require an active session to access a route.
 * Redirects unauthenticated users to /auth/login.
 */
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/auth/login');
}

module.exports = { isAuthenticated };

