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

        console.log("Current target: "+ conversationItem.target);
        //If the BOT is the recipient, we analyse the text
        let newTarget = conversationItem.target;
        if((conversationItem.target == process.env.TARGET_BOT) || (msg.includes("[CONVERSATION REDIRECTION - "))){
            newTarget = this.analyseUserMessage(msg);
            if(!newTarget){
                newTarget = conversationItem.target;
            }
            console.log("New target: "+ newTarget);
        }

        //If the target is not the bot
        if(newTarget != process.env.TARGET_BOT){
            console.log("NEED HUMAN");
            //If the target changed and the new target is Intercom, we need to send the conversation history
            let history = false;
            if(newTarget != conversationItem.target && newTarget == process.env.TARGET_INTERCOM){
                history = true ;
                console.log("Sending history = true");
            }
            //otherwise we simply let the message go to the backend
            conversationItem.target = newTarget;
            await this.continueMessage(nonce,conversationItem.target, history);
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
                //If a new target has been found
                if(newTarget && newTarget!=conversationItem.target){
                    //If the new target is the bot, we just update the target so that the messages won't flow to a business system anymore
                    if(newTarget == process.env.TARGET_BOT){
                        //The next appUser message will go to the new target
                        conversationItem.target = newTarget;
                    }else{
                        //We notify the new target using a new appUser message
                        await this.sendRedirectionMessage(appUser,newTarget);
                    }
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
                type: 'text',
                name: 'Bot',
                avatarUrl: 'https://media.smooch.io/apps/5d796095205c150011a25e06/Dd4H4lLUQgDOwLlS4aqgHgW_/webimage-DE247BD8-7744-4BFD-A5620B9BAD83F567.png'
            })
            .then((response) => {
                console.log(response);
            })
            .catch((err) => {
                console.log('API ERROR:\n', err);
            });
        }
    }
    
    //Sending an appUser message to redirect the conversation to the new targeted business system
    async sendRedirectionMessage(appUserId, target){
        let text = '';
        switch(target){
            case process.env.TARGET_ZENDESK:
                text = "[CONVERSATION REDIRECTION - " + process.env.ZENDESK_KEYWORD + "]";
                break;
            case process.env.TARGET_INTERCOM:
                text = "[CONVERSATION REDIRECTION - " + process.env.INTERCOM_KEYWORD + "]";
                break;
            default:
                return;
        }

        console.log('Will send : '+ text);
        console.log('As : '+ appUserId);

        if (this.smooch && appUserId && text) {
            this.smooch.appUsers
            .sendMessage(appUserId,{
                text: text,
                role: 'appUser',
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
    async continueMessage(nonce, target, history){
        const https = require('https');
        const data = JSON.stringify({
            "metadata": {
                "handled": true,
                "target": target,
                "history": history
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
}
module.exports = Bot;