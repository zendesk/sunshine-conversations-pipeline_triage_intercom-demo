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
        //let body = payload.message.map(message => message.text).join('\n');
        let body = payload.message.text;

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
    }
}
module.exports = TriageProcessor;