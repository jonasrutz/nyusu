const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    team:       { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title:      { type: String, required: true, trim: true },
    url:        { type: String, required: true, trim: true },
    description:{ type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);

