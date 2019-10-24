const Smooch = require('smooch-core');

class Bot {
    constructor() {
        this.messageStore = [];
        console.log("BOT reset");

        this.smooch = new Smooch({
            keyId: process.env.KEY,
            secret: process.env.SECRET,
            scope: 'app'
        });
    }


    //Fetch a conversation with an appUser
    async getConversation(appUser) {
        //console.log("Fetching all messages for appUser "+ appUser);
        let conversationItem = this.messageStore.find(
            function(item){
                return item.appUserId == appUser ;
            })

        if(!conversationItem){
            // The conversation doesn't exist yet, so we initialize it
            console.log("Creating conversationItem");
            let conversation = [];
            conversationItem = {appUserId : appUser, target : process.env.TARGET_BOT , conversation : conversation};
            this.messageStore.push(conversationItem);
        }

        return conversationItem;
    }


    //Receive a message from the appUser
    async userMessage(appUser, msgId, msg, nonce) {
        let conversationItem = await this.getConversation(appUser);

        if(!conversationItem){
            conversationItem = {appUserId : appUser, target : process.env.TARGET_BOT, conversation : []};
            this.messageStore.push(conversationItem);
        }

        let conversation = conversationItem.conversation;
        let messageItem = {msgId : msgId, msg : msg}
        conversation.push(messageItem);
        console.log("Message stored: " + JSON.stringify(messageItem, null, 2));

        console.log("Target 1: "+ conversationItem.target);
        //If the BOT is the recipient, we analyse the text
        if(conversationItem.target == process.env.TARGET_BOT){
            let newTarget = this.analyseUserMessage(msg);
            if(newTarget){
                conversationItem.target = newTarget;
                console.log("Target 2: "+ conversationItem.target);
            }
        }

        //We determine if the recipient should still be the bot
        if(conversationItem.target != process.env.TARGET_BOT){
            //let the message go to the backend
            console.log("NEED HUMAN");
            console.log("Target 3: "+ conversationItem.target);
            await this.continueMessage(nonce,conversationItem.target);
        }
        return messageItem;
    }

    //Review a message from an appMaker
    async bizMessage(appUser, msg) {
        let conversationItem = await this.getConversation(appUser);

        if(conversationItem){
            if(conversationItem.target != process.env.TARGET_BOT){
                //If the bot is not the current recipient, we need to analyse the text
                let newTarget = this.analyseAgentMessage(msg);
                if(newTarget){
                    //The next appUser message will go to the new target
                    conversationItem.target = newTarget;
                }
            }
        }
    }


    //Sending a Bot message to the appUser
    async sendMessage(appUserId, text){
        console.log('Will send : '+ text);
        console.log('To : '+ appUserId);

        if (this.smooch && appUserId && text) {
            this.smooch.appUsers
            .sendMessage(appUserId,{
                text: text,
                role: 'appMaker',
                type: 'text'
            })
            .then((response) => {
                console.log(response);
            })
            .catch((err) => {
                console.log('API ERROR:\n', err);
            });
        }
    }


    //Let the message go to triage
    async continueMessage(nonce, target){
        const https = require('https');
        const data = JSON.stringify({
            "metadata": {
                "handled": true,
                "target": target
            }
        })
        const options = {
            hostname: 'api.smooch.io',
            path: '/v1.1/apps/'+process.env.APPID+'/middleware/continue',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + nonce
            }
        }
        const req = https.request(options, (res) => {
                                                console.log(`statusCode: ${res.statusCode}`)
        })

        req.on('error', (error) => {
            console.error(error)
        })
        req.write(data);
        req.end();
    }

    // Determines the need for an agent to get involved
    analyseUserMessage(msg){
        if (msg.includes(process.env.ZENDESK_KEYWORD)){
            console.log("NEED TECH SUPPORT");
            return process.env.TARGET_ZENDESK;
        }else if(msg.includes(process.env.INTERCOM_KEYWORD)){
            console.log("NEED SALES SUPPORT");
            return process.env.TARGET_INTERCOM;
        }
    }
    // Determines the need to reactivate the bot
    analyseAgentMessage(msg){
        if (msg.includes(process.env.ZENDESK_KEYWORD)){
            console.log("NEED TECH SUPPORT");
            return process.env.TARGET_ZENDESK;
        }else if(msg.includes(process.env.INTERCOM_KEYWORD)){
            console.log("NEED SALES SUPPORT");
            return process.env.TARGET_INTERCOM;
        }else if(msg.includes(process.env.AGENT_TO_BOT_KEYWORD)){
            console.log("HUMAN NO LONGER NEEDED");
            return process.env.TARGET_BOT;
        };
    }

    // Toggles the Agent ON and OFF
    async toggleAgent(appUser, flag){
        let conversationItem = await this.getConversation(appUser);
        conversationItem.needHuman = flag;
    }
}
module.exports = Bot;