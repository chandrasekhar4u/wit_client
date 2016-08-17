# node_wit_client :zap: 
:sunny: Nodejs application with a client which connects to wit.ai server and displays response in web client.

[![Dependency Status](https://dependencyci.com/github/chandrasekhar4u/node_wit_client/badge)](https://dependencyci.com/github/chandrasekhar4u/node_wit_client)

## Usage :zap: 
install <a href="https://nodejs.org/en/download/" >node.js</a> <br/>
install <a href="https://toolbelt.heroku.com/" >heroku toolbelt</a> (for windows) <br/>
`git clone https://github.com/{forked}/node_wit_client.git` <br/>
Open Node.js command prompt... <br/>
`$ cd node_wit_client/`  <br/>
`$ git init`  <br/>
`$ npm install` <br/>
After completing installation of required dependencies/modules.<br/>
`$ heroku login` <br/>
Enter your Heroku credentials. <br/>
Email: adam@example.com <br/>
Password (typing will be hidden): <br/>
Authentication successful. <br/>
go to the application location <br/>
`$ heroku git:remote -a appName` (while creting app first time, else fallow below steps)  <br/>
`$ git add . ` <br/>
`$ git commit -m "your comment"` <br/>
`$ git push heroku master` <br/>

## Running Application :zap:
Run `npm start` Or `node index.js` from node command prompt in the folder `node_wit_client/`. <br/>
if nodejs is < 6.x version then run with command `node --harmony_destructuring --use_strict index.js`.

Open the browser and give the url `http://localhost:port/botTest.html`, then we should be able to see the screen with user says and bot says text areas.

## Task List :zap:
- [x] Client to communicate with node.js services.
- [x] Support formatted json request
- [x] Support formatted json response
- [x] Get entities/intent from the wit.ai and show it in response.
- [ ] Show ajax request loading spinner and disable send message button.
- [ ] Session/transaction management.
- [ ] Custom functions should be able to invoke from wit.ai or shold be able to invoke based on entities/context.

<!-- ## Developing -->
