const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
    username: String,
    score: Number,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.models.Score || mongoose.model("Score", scoreSchema);