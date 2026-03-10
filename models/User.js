const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    accentColor: {
        type: String,
        default: '#00d4aa',
        validate: {
            validator: v => /^#[0-9A-Fa-f]{6}$/.test(v),
            message: 'accentColor muss ein gültiger Hex-Farbcode sein.'
        }
    },
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

