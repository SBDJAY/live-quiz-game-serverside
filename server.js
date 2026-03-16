const WebSocket = require('ws');
const mongoose = require('mongoose');

const Question = require('./questionModel');
const Score = require('./scoreModel');

mongoose.connect("mongodb://127.0.0.1:27017/quizgame")
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log(err));

const wss = new WebSocket.Server({ port: 8080 });

let clients = [];

let players = {};
let scores = {};

let questions = [];
let currentQuestion = 0;

let timer;

async function loadQuestions(){

    questions = await Question.find();

    if(questions.length === 0){

        await Question.insertMany([

            {
                question:"What is the capital of France?",
                options:["Berlin","Madrid","Paris","Rome"],
                answer:2
            },

            {
                question:"Which planet is the Red Planet?",
                options:["Earth","Mars","Jupiter","Venus"],
                answer:1
            },

            {
                question:"Largest mammal?",
                options:["Elephant","Blue Whale","Shark","Horse"],
                answer:1
            }

        ]);

        questions = await Question.find();

    }

}

loadQuestions();

function broadcast(data){

    clients.forEach(client=>{

        if(client.readyState === WebSocket.OPEN){

            client.send(JSON.stringify(data));

        }

    });

}

function sendQuestion(){

    const q = questions[currentQuestion];

    broadcast({

        type:"question",

        question:q.question,

        options:q.options

    });

    let timeLeft = 10;

    broadcast({
        type:"timer",
        value:timeLeft
    });

    timer = setInterval(()=>{

        timeLeft--;

        broadcast({
            type:"timer",
            value:timeLeft
        });

        if(timeLeft === 0){

            clearInterval(timer);

            nextQuestion();

        }

    },1000);

}

async function nextQuestion(){

    currentQuestion++;

    if(currentQuestion < questions.length){

        sendQuestion();

    }else{

        broadcast({

            type:"end",

            scores:scores

        });

        for(const id in scores){

            const score = new Score({

                username:players[id],

                score:scores[id]

            });

            await score.save();

        }

    }

}

wss.on('connection',(ws)=>{

    console.log("Client connected");

    clients.push(ws);

    ws.on('message',(message)=>{

        const data = JSON.parse(message);

        if(data.type === "join"){

            players[data.userId] = data.username;

            scores[data.userId] = 0;

        }

        if(data.type === "start"){

            currentQuestion = 0;

            sendQuestion();

        }

        if(data.type === "answer"){

            const q = questions[currentQuestion];

            if(data.answer === q.answer){

                scores[data.userId]++;

            }

        }

    });

    ws.on('close',()=>{

        console.log("Client disconnected");

        clients = clients.filter(c => c !== ws);

    });

});

console.log("Quiz WebSocket Server running on ws://localhost:8080");