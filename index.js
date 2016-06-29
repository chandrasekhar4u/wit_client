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
require('./chat-server.js');

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
  res.send('"Only those who will risk going too far can possibly find out how far one can go." - Chandra');
});

// Webhook verify setup using FB_VERIFY_TOKEN
app.get('/webhook', (req, res) => {
    res.sendStatus(400);
});

