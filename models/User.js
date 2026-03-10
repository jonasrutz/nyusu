const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    friends:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('passwordHash')) return;
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

// Compare plain password with hash
userSchema.methods.comparePassword = function (plainPassword) {
    return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model('User', userSchema);

