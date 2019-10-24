# smooch-pipeline_triage_intercom-demo
Demo project to dispatch user messages between Zendesk and Intercom

## What does it do?
This project provides a webpage include the Sunshine Conversation Web Messenger. This will be the input for the user messages.

Those messages go to a bot which is simulated inthe main window. Received messages are displayed in the upper section and bot replies can be made in the lower section.

The "bot" will analyse the user messages to determine if the message should be sent to an agent on Zendesk or to someone on Intercom.

Agents on both business system can also redirect the conversation to one another or back to the bot.

(Demo Video)

## How does it work?
We use the Pipeline API for this project. We have 2 processors:
1. The Bot
The bot handles the messages first and stops them. It analyses the content of the message and, using some keywords, it will determine if the messages should flow to Zendesk or to Intercom. It will add a `target` metadata to the message accordingly.

2. The triage processor
The triage processor will read the message metadata given by the bot and dispatch the message:
- to Zendesk: it will let the message flow to the business system by a simple continue message
- to Intercom: it will send the message to Intercom using their Conversation API and will not let it flow to the end of the Pipeline

## How to make it run?
### Prerequisite
1. A Sunshine conversation App
2. A Zendesk instance connected to the Sunshine conversation App
3. An Intercom account with a Developer access and Inbox/Messages activated
4. A tool to give access to your server (serveo is advised to interact with Intercom)

### Installation
After cloning the repo, you need to install the required dependencies:
`npm install`

### Setup
**1. `.env` file**
```
APPID=[Sunshine Conversation APP ID]
KEY=[SC app key]
SECRET=[SC app secret]
TARGET_BOT=BOT
TARGET_ZENDESK=ZENDESK
TARGET_INTERCOM=INTERCOM
ZENDESK_KEYWORD=[keyword to redirect the conversation to Zendesk]
AGENT_TO_BOT_KEYWORD=[keyword to redirect the conversation to the bot]
INTERCOM_KEYWORD=[keyword to redirect the conversation to Intercom]
INTERCOM_ACCESS_TOKEN=[Intercom token from the app in the Intercom developer hub]
```

**2. Endpoints**

**- In the code:**
In the /public/workbench.html file 
  - provide your Sunshine conversation App ID in : `const appID = "[your app id]";`
  - in the `function getMessages()`, provide your server address in the fetch (a full path is necessary for Serveo, on ngrok a relative path would be enough)

**- On Intercom:**

In the developer hub, in your app webhook section, provide the endpoint to receive Intercom messages: https://[your URL]/intercom

**- On Sunshine Conversation:**
  1. Setup a webhook to receive and analyse appMaker messages: https://[your URL]/agentmessage
  2. Setup the Pipeline in this order
     - Bot processor: https://[your URL]/messages
     - Triage processor: https://[your URL]/triage


## What do do next?
- [ ] send the history of the conversation to Intercom when necessary
- [ ] use a specific syntax to transfer the control of the conversation from one actor to another and use delegates to hide them from the user window (only on SDKs)
- [ ] make a persona for the bot, for a better demo
