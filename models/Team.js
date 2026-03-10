const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
    name:        { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    founder:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    game:        { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);

