module.exports = {
  Logger: require('./lib/logger.js').Logger,
  logLevels: require('./lib/logger.js').logLevels,
  Wit: require('./lib/wit.js').Wit,
}

// Quickstart example
// See https://wit.ai/l5t/Quickstart

// When not cloning the `node-wit` repo, replace the `require` like so:
// const Wit = require('node-wit').Wit;
const bodyParser = require('body-parser');
const express = require('express');
const Wit = require('./').Wit;
//require('./chat-server.js');
const mg = require('./message.js');

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Starting our webserver and putting it all together
const app = express();
var path = require("path");
//var expressWs = require('express-ws')(app);
app.set('port', PORT);
app.listen(app.get('port'));
app.use(bodyParser.json());
console.log("I'm wating for you @" + PORT);

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

const getFirstMessagingEntry = (body) => {
  const val = body.object === 'msg' &&
    body.entry &&
    Array.isArray(body.entry) &&
    body.entry.length > 0 &&
    body.entry[0] &&
    body.entry[0].messaging &&
    Array.isArray(body.entry[0].messaging) &&
    body.entry[0].messaging.length > 0 &&
    body.entry[0].messaging[0];

  return val || null;
};

const actions = {
  say(sessionId, context, message, cb) {
    console.log(message);
    cb();
  },
  merge(sessionId, context, entities, message, cb) {
    // Retrieve the location entity and store it into a context field
    const loc = firstEntityValue(entities, 'location');
    if (loc) {
      context.loc = loc;
	  console.log("location::" + loc);
    }
    cb(context);
  },
  ['fetch-weather'](sessionId, context, cb) {
    // Here should go the api call, e.g.:
    // context.forecast = apiCall(context.loc)
	switch(context.loc){
		case 'bangalore','hyderabad':
			context.forecast = "sunny";
			break;
		case 'america', 'canada':
			context.forecast = "rainy";
			break;
		default:
			context.forecast = "foggy";
	}
    cb(context);
  },
  error(sessionId, context, error) {
    console.log(error.message);
  },
};

const sessions = {};

const findOrCreateSession = () => {
  var sessionId;
    // No session found, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = {
      sessionId: sessionId,
      context: {
        _sessionId_: sessionId
      }
    }; // set context, _sessionId_
  return sessionId;
};

app.get('/frontend.html', function(request, response){
    response.sendFile(path.join(__dirname+'/frontend.html'));
});
app.get('/chat-frontend.js', function(request, response){
    response.sendFile(path.join(__dirname+'/chat-frontend.js'));
});

// The main message handler
app.post('/webhook', (req, res) => {
  res.send('"Only those who will risk going too far can possibly find out how far one can go." - Chandra');
});

app.post('/callwit', (req, res) => {
	// Parsing the Messenger API response
  const messaging = getFirstMessagingEntry(req.body);
    
	const client = new Wit('LN4ZRTK5KULKZZUKI33WMM3I7J3QGA33', actions);
	console.log('wit client object: ' + client);
	
    // We retrieve the user's current session, or create one if it doesn't exist
    // This is needed for our bot to figure out the conversation history
    const sessionId = findOrCreateSession();
	console.log('sessionID: ' + sessionId);
	// We retrieve the message content
    const msg = messaging.message.text;
	console.log('user message: ' + msg);
	if (msg) {
      // We received a text message

      // Let's forward the message to the Wit.ai Bot Engine
      // This will run all actions until our bot has nothing left to do
      client.runActions(
        sessionId, // the user's current session
        msg, // the user's message 
        sessions[sessionId].context, // the user's current session state
        (error, context) => {
          if (error) {
            console.log('Oops! Got an error from Wit:', error);
          } else {
            console.log('Waiting for futher messages.');
            // Updating the user's current session state
            sessions[sessionId].context = context;
          }
		  console.log('final msg: '+client.respMsg());
		  res.send(client.respMsg())
        }
      );
    }
	console.log('Response Object: ' + res);
	
  //res.send('"Only those who will risk going too far can possibly find out how far one can go." - Chandra');
});


// Webhook verify setup using FB_VERIFY_TOKEN
app.get('/webhook', (req, res) => {
    res.sendStatus(400);
});



