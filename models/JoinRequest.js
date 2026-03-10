const mongoose = require('mongoose');

const joinRequestSchema = new mongoose.Schema({
    team:        { type: mongoose.Schema.Types.ObjectId, ref: 'Team',    required: true },
    user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    rank:        { type: String, default: '' },
    experience:  { type: String, default: '' },
    motivation:  { type: String, default: '' },
    status:      { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
}, { timestamps: true });

// One active request per user per team
joinRequestSchema.index({ team: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('JoinRequest', joinRequestSchema);

