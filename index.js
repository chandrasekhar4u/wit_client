//import requried modules from library.
module.exports = {
  log: require('./lib/log'),
  Wit: require('./lib/wit'),
  interactive: require('./lib/interactive')
}
//import body parser.
const bodyParser = require('body-parser');
//initializing response object.
var responseObj = {};
// Webserver parameter
const PORT = process.env.PORT || 8080;
var SERVER_IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP || 'localhost';
//import required dependencies.
const crypto = require('crypto');
const fetch = require('node-fetch');
const request = require('request');
var express = require('express')
  , cors = require('cors')
  , app = express()
  , favicon = require('serve-favicon')
  , path = require("path");
  
//fix for security format exception from browser.
app.use(cors());
//fix for accessing favicon and showing in browserr.
app.use(favicon(path.join(__dirname+'/favicon.ico')));
//var initialization.
let log = null;
let Wit = null;
try {
  Wit = require('./').Wit;// if running from repo
  log = require('./').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}
// Starting our webserver and putting it all together
app.set('port', PORT);
app.set('ipAddress', SERVER_IP_ADDRESS);
app.listen(app.get('port'), app.get('ipAddress') );
app.use(bodyParser.json());

console.log("Server is wating for you @" + PORT);

//get first entity valure from entities list.
const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};


// Our bot actions
const actions = {
  send({sessionId}, {text}) {
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
      // Yay, we found our recipient!
      // Let's forward our bot response to her.
      // We return a promise to let our bot know when we're done sending
      return fbMessage(recipientId, text)
      .then(() => null)
      .catch((err) => {
        console.error(
          'Oops! An error occurred while forwarding the response to',
          recipientId,
          ':',
          err.stack || err
        );
      });
    } else {
      console.error('Oops! Couldn\'t find user for session:', sessionId);
      // Giving the wheel back to our bot
      return Promise.resolve()
    }
  },
  // You should implement your custom actions here
  // See https://wit.ai/docs/quickstart
  
  //custom action called from wit.ai
  ['getCreditCardDetails']({context, entities}) {
	console.log('entities custom action: '+JSON.stringify(entities));
    return new Promise(function(resolve, reject) {
	  console.log('entities custom action: '+JSON.stringify(entities));
      context.cardNumber = 'xxxx-xxxx-xxxx-'+Math.floor(1000 + Math.random() * 9000);
	  responseObj.context = context;
	  responseObj.entities = entities;
      return resolve(context);
    });
  },
};


//find or create session object (ISO date).
const sessions = {};
const findOrCreateSession = (sid) => {
  let sessionId;
  // Let's see if we already have a session for the user
  Object.keys(sessions).forEach(k => {
    if (sessions[k].sid === sid) {
      // Yep, got it!
      sessionId = k;
    }
  });
    // No session found, let's create a new one
	if (!sessionId) {
    sessionId = new Date().toISOString();
    sessions[sessionId] = { sessionId: sessionId,  context: { sid: sessionId } }; // set context, sessionId
	}
  return sessionId;
};


const findOrCreateFBSession = (fbid) => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {fbid: fbid, context: {}};
  }
  return sessionId;
};

//TODO: move this to common static content handling.
//allow static content to access from application.
app.get('/botTest.html', function(request, response, next){
    response.sendFile(path.join(__dirname+'/botTest.html'));
});
app.get('/callLambdaService.html', function(request, response, next){
    response.sendFile(path.join(__dirname+'/callLambdaService.html'));
});
app.get('/spinner.gif', function(request, response, next){
    response.sendFile(path.join(__dirname+'/spinner.gif'));
});

// another example post service
app.post('/webhook', (req, res, next) => {
  res.send('"Only those who will risk going too far can possibly find out how far one can go." - Chandra');
  next();
});

//::::::::::::::::::::::::::::::::::::::::::::
//FB Messenger Code
//::::::::::::::::::::::::::::::::::::::::::::


// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent('ACCESS_TOKEN');
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};


app.use(({method, url}, rsp, next) => {
  rsp.on('finish', () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === 'VERIFY_TOKEN') {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;
  const wit = new Wit({accessToken: 'WIT_TOKEN', actions, logger: new log.Logger(log.INFO)});
  
  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateFBSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit.runActions(
              sessionId, // the user's current session
              text, // the user's message
              sessions[sessionId].context // the user's current session state
            ).then((context) => {
              // Our bot did everything it has to do.
              // Now it's waiting for further messages to proceed.
              console.log('Waiting for next user messages');

              // Based on the session state, you might want to reset the session.
              // This depends heavily on the business logic of your bot.
              // Example:
              // if (context['done']) {
              //   delete sessions[sessionId];
              // }

              // Updating the user's current session state
              sessions[sessionId].context = context;
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});

/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', 'APP_SECRET')
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}
