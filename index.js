'use strict';

// Imports
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Smooch = require('smooch-core');
const Bot = require('./bot');
const TriageProcessor = require('./triage_processor');

let bot = new Bot();
let triageProcessor = new TriageProcessor();

express()
    .use(express.static('public'))
    .use(bodyParser.json()).get('/', function(req, res) {
        res.sendFile(__dirname + '/public/workbench.html');
    })
    //Pipeline processor 1
    .post('/messages', userMessage)
    //Pipeline processor 2
    .post('/triage', dispatch)
    //GET conversation history
    .get('/users/:id/messages', messageHistory)
    //Send a bot message
    .post('/botmessage', botMessage)
    //message:appMaker trigger
    .post('/agentmessage', bizMessage)
    //Intercom agent message
    .post('/intercom', intercomMessage)
    .listen(process.env.PORT || 8000);


// handle user message from Sunshine destined for the bot
async function userMessage(req, res) {
    console.log('newMessage:\n', JSON.stringify(req.body, null, 4));
    if (req.body.trigger === 'message:appUser') {
        try {
            await bot.userMessage(req.body.appUser._id,req.body.message._id, req.body.message.text, req.body.nonce);
            return res.status(200).end();
        } catch (error) {
            console.error('Error sending message to bot', error);
            return res.status(500).end();
        }
    }
}

// handle user message from an appMaker to the user
async function bizMessage(req, res) {
    console.log('AppMaker Message:\n', JSON.stringify(req.body, null, 4));
    if (req.body.trigger === 'message:appMaker') {
        try {
            await bot.bizMessage(req.body.appUser._id, req.body.messages[0].text);
            return res.status(200).end();
        } catch (error) {
            console.error('Error sending message to bot', error);
            return res.status(500).end();
        }
    }
}

// fetch message history from thebot
async function messageHistory(req, res) {
    //console.log('GET messages for user ' + req.params.id);
    try {
        let conversationItem = await bot.getConversation(req.params.id);
        res.send(conversationItem.conversation);
        return res.status(200).end();
    } catch (error) {
        console.error('Error fetching messages', error);
        return res.status(500).end();
    }
}

// send a message as the bot
async function botMessage(req, res) {
    console.log('Bot message');
    try {
        await bot.sendMessage(req.body.appUser, req.body.message);
        return res.status(200).end();
    } catch (error) {
        console.error('Error sending bot message', error);
        return res.status(500).end();
    }
}

// Receive a message to triage
async function dispatch(req, res) {
    console.log('Going to triage...');
    try {
        triageProcessor.dispatch(req.body);
        return res.status(200).end();
    } catch (error) {
        console.error('Error dispatching messages', error);
        return res.status(500).end();
    }
}

// handle agent message from Intercom
async function intercomMessage(req, res) {
    try {
        console.log('Intercom event:\n', JSON.stringify(req.body, null, 4));
        await triageProcessor.sendToSunshine(req.body);
        return res.status(200).end();
    } catch (error) {
        console.error('Error handling webhook event from Intercom', error);
        return res.status(500).end();
    }
}