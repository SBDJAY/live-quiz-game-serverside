const WebSocket = require('ws');
const mongoose = require('mongoose');

const Question = require('./questionModel');
const Score = require('./scoreModel');

mongoose.connect("mongodb://127.0.0.1:27017/quizgame")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));


const wss = new WebSocket.Server({ port: 8080 });

process.on('uncaughtException', err => {
    console.error("Server Error:", err);
});

let questionAnswered = false;

let clients = [];
let players = {};
let scores = {};

let persistentLeaderboard = {};

let questions = [];
let currentQuestion = 0;
let timer;

async function loadQuestions() {

    questions = await Question.find();

    if (questions.length === 0) {

        await Question.insertMany([
            {
                question: "What is the capital of France?",
                options: ["Berlin", "Madrid", "Paris", "Rome"],
                answer: 2
            },
            {
                question: "Which planet is the Red Planet?",
                options: ["Earth", "Mars", "Jupiter", "Venus"],
                answer: 1
            },
            {
                question: "Largest mammal?",
                options: ["Elephant", "Blue Whale", "Shark", "Horse"],
                answer: 1
            }
        ]);

        questions = await Question.find();
    }
}

async function loadLeaderboard() {

    const allScores = await Score.find();

    allScores.forEach(s => {

        if (!persistentLeaderboard[s.username]) {
            persistentLeaderboard[s.username] = 0;
        }

        persistentLeaderboard[s.username] += s.score;
    });

    console.log("Leaderboard loaded:", persistentLeaderboard);
}

loadQuestions();
loadLeaderboard();

function broadcast(data) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function sendQuestion() {

    if (currentQuestion >= questions.length) {
        endGame();
        return;
    }

    questionAnswered = false; // reset lock

    const q = questions[currentQuestion];

    broadcast({
        type: "question",
        question: q.question,
        options: q.options
    });

    startTimer();
}

function startTimer() {

    let timeLeft = 10;

    broadcast({ type: "timer", value: timeLeft });

    timer = setInterval(() => {

        timeLeft--;

        broadcast({ type: "timer", value: timeLeft });

        if (timeLeft <= 0) {
            clearInterval(timer);
            nextQuestion();
        }

    }, 1000);
}

function nextQuestion() {

    currentQuestion++;
    sendQuestion();
}

async function endGame() {

    // Save scores
    for (const id in scores) {

        const username = players[id];

        const safeScore = Number(scores[id]) || 0;

        const score = new Score({
            username: username,
            score: safeScore
        });

        await score.save();

        if (!persistentLeaderboard[username]) {
            persistentLeaderboard[username] = 0;
        }

        persistentLeaderboard[username] += scores[id];
    }

    broadcast({
        type: "end",
        scores: persistentLeaderboard
    });

}

wss.on('connection', (ws) => {

    console.log("Client connected");

    clients.push(ws);

    // send existing leaderboard immediately
    ws.send(JSON.stringify({
        type: "leaderboard",
        scores: persistentLeaderboard
    }));

    ws.on('message', (message) => {

        const data = JSON.parse(message.toString());

        if (data.type === "join") {

            players[data.userId] = data.username;

            if (scores[data.userId] === undefined) {
                scores[data.userId] = 0;
            }
        }

        if (data.type === "start") {

            currentQuestion = 0;
            scores = {};

            for (const id in players) {
                scores[id] = 0;
            }
            sendQuestion();
        }

        if (data.type === "answer") {

            if (questionAnswered) return;

            const q = questions[currentQuestion];

            if (!q) return;

            if (scores[data.userId] === undefined) {
                scores[data.userId] = 0;
            }

            if (data.answer === q.answer) {
                scores[data.userId] += 1;
            }

            questionAnswered = true;

            clearInterval(timer);

            setTimeout(() => {
                nextQuestion();
            }, 500);

        }

    });

    ws.on('close', () => {

        clients = clients.filter(c => c !== ws);

    });

});

console.log("Quiz WebSocket Server running on ws://localhost:8080");