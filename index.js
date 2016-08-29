module.exports = {
  log: require('./lib/log'),
  Wit: require('./lib/wit'),
  interactive: require('./lib/interactive')
}
'use strict';

const bodyParser = require('body-parser');
const crypto = require('crypto');
const express = require('express');
const fetch = require('node-fetch');
const request = require('request');
const JSONbig = require('json-bigint');

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require('./').Wit;
  log = require('./').log;
} catch (e) {
  Wit = require('node-wit').Wit;
  log = require('node-wit').log;
}

// Webserver parameter
const PORT = process.env.PORT || 8080;
var SERVER_IP_ADDRESS = process.env.OPENSHIFT_NODEJS_IP || 'localhost';

let FB_VERIFY_TOKEN = 'VERIFY_TOKEN';
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString('hex');
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code
// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference
const fbMessage = (id, text) => {
  const body = JSON.stringify({
    recipient: { id },
    message: { text },
  });
  const qs = 'access_token=' + encodeURIComponent('ACCESS_TOKEN_NEED_TO_ADD');
  return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
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

// ----------------------------------------------------------------------------
// Wit.ai bot specific code
// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};
const findOrCreateSession = (fbid) => {
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

// Our bot actions
const actions = {
  send({sessionId}, {text}) {
	  console.log('inside actions send method of index.js:::: ');
    // Our bot has something to say!
    // Let's retrieve the Facebook user whose session belongs to
    var recipientId = sessions[sessionId].fbid;
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
  
  //custom action called from wit.ai
  getCreditCardDetails({context, entities}) {
	  delete context.cardNumber;
	console.log('entities custom action: '+JSON.stringify(entities));
    return new Promise(function(resolve, reject) {
	  console.log('entities custom action: '+JSON.stringify(entities));
      context.cardNumber = 'xxxx-xxxx-xxxx-'+Math.floor(1000 + Math.random() * 9000);
      return resolve(context);
    });
  },
  
  //custom action called from wit.ai
  logout({context, entities}) {
	console.log('entities custom action: '+JSON.stringify(entities));
    return new Promise(function(resolve, reject) {
	  delete sessions[sessionId];
	  delete context.cardNumber;
	  delete context.user_key;
	  context.invalid=true;
	  delete context.user_name;
	  delete context.accountBalance;
	  context.logout='logout';
      return resolve(context);
    });
  },
  
 validateUserKey({context, entities}) {
	console.log(':::::::::::::::::::::::inside validateUserKey method::::::::::::::::::::::: ');
	delete context.user_key;
	delete context.user_name;
	console.log('entities custom action::::::::::::::::::::::: '+JSON.stringify(entities));
    return new Promise(function(resolve, reject) {
		var userPassKey = firstEntityValue(entities, "number");
		console.log('userPassKey custom action:::::::::::::::::::::' + userPassKey);
	if(userPassKey){
		getLambdaAuthenticateUser(userPassKey,function(userName){
		if(userName&&userName!==''){
		  console.log('First Name:::::' + userName);
	      context.user_key=userPassKey;
	      context.user_name=userName; 
		  delete context.cardNumber;
		  delete context.invalid;
		  console.log('delete context.invalid;::::::::::::::::::::::: ');
		  return resolve(context);
		}
		});
	}else{
	delete context.cardNumber;
	delete context.user_key;
	delete context.user_name;
	delete context.accountBalance;
	context.invalid=true;
	console.log('context.invalid=true::::::::::::::::::::::: ');
	return resolve(context);
	}
    });
  },
  
  getAccountSummary({context, entities}) {
	console.log('entities custom action::::::::::::::::::::::: '+JSON.stringify(entities));
    return new Promise(function(resolve, reject) {
		var userPassKey = context.user_key;
		console.log('userPassKey custom action:::::::::::::::::::::' + userPassKey);
	if(userPassKey){
		userName=context.user_name;
		var accountType = firstEntityValue(entities, "account_type");
		if(accountType.search(/checking/i)!==-1){
			accountType='CHECKING';
		}
		else if(accountType.search(/savings/i)!==-1){
			accountType='SAVINGS';
		}
		getLambdaAccountSummary(userPassKey, accountType, function(accDetails){
		if(accDetails&&accDetails!==''){
		  console.log('Account BALANCE:::::' + accDetails[0]['BALANCE']);
		  context.accountBalance=accDetails[0]['BALANCE'];
		  delete context.cardNumber;
		  return resolve(context);
		}
		});
	}else{
		delete context.cardNumber;
	    delete context.user_key;
		delete context.user_name;
		delete context.accountBalance;
		context.invalid=true;
		return resolve(context);
	}
    });
  },
};

// Setting up our bot
const wit = new Wit({
  accessToken: 'WIT_ACCESS_KEY_NEED_TO_ADD',
  actions,
  logger: new log.Logger(log.INFO)
});

// Starting our webserver and putting it all together
const app = express();
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
    req.query['hub.verify_token'] === FB_VERIFY_TOKEN) {
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
  var data = req.body;
  //const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;
          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);
		  console.log('Session ID::::::::::::::::::::: ' + sessionId);
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
			  if(sessionId){
				  var current=new Date();
				  var sessionStart=new Date(sessionId);
				  console.log('Session Start Time::::::::::::::::::::: ' + sessionStart);
				  console.log('Current Time::::::::::::::::::::: ' + current);
				  var diff = Math.abs(sessionStart - current);
				  var minutes = Math.floor((diff/1000)/60);
				  console.log('Minutes in difference::::::::::::::::::::: ' + minutes);
				  if(minutes>=3){
					  delete sessions[sessionId];
					  delete context.cardNumber;
					  delete context.user_key;
					  delete context.user_name;
					  context.invalid=true;
				  }
			  }
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

function getLambdaAuthenticateUser(userKey, callback) {
	var res = '';
	console.log('getLambdaAuthenticateUser called:::::::::'); 
    request({
        uri : 'https://hu4xwdeme9.execute-api.us-east-1.amazonaws.com/DEV/bankingbot/authenticateuser?userKey='+userKey,
        method : 'GET'
    }, function (error, response, body) {
		if(error){
        /*return*/ console.log('Error:', error);
		}
        if (!error && response.statusCode == 200) {
			console.log('user Key is:'+userKey);
			res = JSONbig.parse(body);
			if(res && res[0]){
			res=res[0]['FIRST_NAME']+' '+res[0]['LAST_NAME'];
			console.log('response body FIRST NAME is:'+res);
			}
        }
		callback(res);
    });
}

function getLambdaAccountSummary(userKey, accountType, callback) {
	console.log('getLambdaAccountSummary called:::::::::');
    var options = {
        uri : 'https://hu4xwdeme9.execute-api.us-east-1.amazonaws.com/DEV/bankingbot/accountsummary?userKey='+userKey,
        method : 'GET'
    }; 
    var res = '';
    request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
			console.log('Account Summary Details:::: '+body);
            res = JSONbig.parse(body);
        }
        else {
            res = 'Not Found';
        }
        callback(res);
    });
}

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

    var expectedHash = crypto.createHmac('sha1', 'APP_SECRET_NEED_TO_ADD')
                        .update(buf)
                        .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT,SERVER_IP_ADDRESS);
console.log('Listening on :' + PORT + '...');