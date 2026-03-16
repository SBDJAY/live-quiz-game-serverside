const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    question: String,
    options: [String],
    answer: Number
});

module.exports = mongoose.models.Question || mongoose.model("Question", questionSchema);