const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    founder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    game: { type: String, default: '' },
    timeouts: { type: Map, of: Date, default: {} }, // userId -> timeoutUntil
}, { timestamps: true });

// Check if a user is timed out
teamSchema.methods.isTimedOut = function (userId) {
    const timeout = this.timeouts.get(userId.toString());
    if (!timeout) return false;
    return new Date() < new Date(timeout);
};

module.exports = mongoose.model('Team', teamSchema);

