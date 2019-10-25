const stripHtml = require("string-strip-html");
const Intercom = require('intercom-client');
const Storage = require('./storage');
const Smooch = require('smooch-core');

const client = new Intercom.Client({ token: process.env.INTERCOM_ACCESS_TOKEN });

class TriageProcessor {
    constructor() {
        console.log("TRIAGE reset");

        this.storage = new Storage({});

        this.smooch = new Smooch({
            keyId: process.env.KEY,
            secret: process.env.SECRET,
            scope: 'app'
        });
    }

    // handle user message from Sunshine destined for the bot
    async dispatch(payload) {
        let target = payload.message.metadata.target;
        console.log('Dispatching to:'+ target);

        switch(target) {
            case process.env.TARGET_ZENDESK:
                console.log('Sending to Zendesk');
                await this.sendToZendesk(payload.nonce)
              break;
            case process.env.TARGET_INTERCOM:
                console.log('Sending to Intercom');
                await this.sendToIntercom(payload)
              break;
            default:
              return;
        }
    }

    //Send to Zendesk
    async sendToZendesk(nonce){
        const https = require('https');
        const data = JSON.stringify({        })
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


    //Send to Intercom
    async sendToIntercom(payload){
        console.log('sendToIntercom');
        // POST a message as a user into Intercom
        let record = await this.storage.getUserRecord({ USER_ID: payload.appUser._id });

        let body = '';

        //Check if we should the send the conversation history to Intercom
        let history = payload.message.metadata.history;
        if(history){
            //Determine from when we need the history (1mn history for demo purposes)
            var since = Math.round((new Date()).getTime() / 1000)-60000;
            //Get the conversation from Sunshine conversation and push an initial message to Intercom
            if (this.smooch) {
                let appUserId = payload.appUser._id;
                this.smooch.appUsers
                .getMessages(appUserId,{
                    query: {
                        after: since
                    }
                })
                .then((response) => {
                    console.log(response);
                    console.log('Sending history to Intercom');
                    
                    body = response.messages.map(message => "<b>"+ message.name + "</b> : " + message.text).join('<br><br>');
                })
                .catch((err) => {
                    console.log('API ERROR:\n', err);
                });
            }
        }else{
            //body = payload.messages.map(message => message.text).join('\n');
            body = payload.message.text;
        }

        if (!record) {
            try{
                //New conversation for Intercom
                await client.users.create({ user_id: payload.appUser._id });
                console.log('User created');

                record = await this.storage.setUserRecord({
                    USER_ID: payload.appUser._id
                }, {
                    user_id: payload.appUser._id
                });

                console.log('storage.setUserRecord');
                return client.messages.create({
                    from: {type: 'user', user_id: payload.appUser._id},
                    body
                });
            }
            catch(error){
                console.error(error);
            }
        }

        console.log('record ok, reply');
        return client.conversations.reply({
            id: 'last',
            user_id: payload.appUser._id,
            message_type: 'comment',
            type: 'user',
            body
        });
    }

    //Send to Sunshine
    async sendToSunshine(payload){
        console.log(payload);
        if (payload.type === 'notification_event') {
            const raw = payload.data.item.conversation_parts.conversation_parts
                .map(part => part.body)
                .join('\n')

            const text = stripHtml(raw);
            const appUserId = payload.data.item.user.user_id;

            console.log('Will send : '+ text);
            console.log('To : '+ appUserId);

            if (this.smooch && appUserId && text) {
                this.smooch.appUsers
                .sendMessage(appUserId,{
                    text: text,
                    role: 'appMaker',
                    type: 'text',
                    name: 'Intercom',
                    avatarUrl: 'http://c93fea60bb98e121740fc38ff31162a8.s3.amazonaws.com/wp-content/uploads/2016/04/intercom.png'
                })
                .then((response) => {
                    console.log(response);
                })
                .catch((err) => {
                    console.log('API ERROR:\n', err);
                });
            }
        }
    }
}
module.exports = TriageProcessor;