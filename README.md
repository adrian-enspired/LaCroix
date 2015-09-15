# LaCroix
An IRC bot just as refreshing as the beverage it's named after.

##Setup
1. Clone the repo
2. Create config.json in the project root (if you attempt to run the program without a config.json, one will be created for you).
3. Set the following options in config.json:
  - "server"   : The irc server to connect to
  -  "channel" : The channel to join
  -  "nick"    : The nick of the bot
  -  "master"  : The nick of the default administrative user
4. <code>node index.js</code>

The bot will automatically connect and create a sqlite database (db.sqlite) if one doesn't already exist.

##Privileges
There are four user privileges (highest to lowest):

1. Master
2. Teacher
3. User
4. Ban

A higher privileged user will have access to all the commands of the lower users, plus their own. Banned users have no access at all.

##Commands

####Master Commands
- Role: list all users in a given role
  - <code>!role master|teacher|ban</code>
- User: change a user's role (none removes all privilages)
  - <code>!user \<user\> master|teacher|ban|none</code>

####Teacher Commands
- Teach: teaches the bot a new command (see Learning Commands below)
  - <code>!teach \<verb\> \<reply\> [description] [syntax]</code>
- Forget: forget a learned command
  - <code>!forget \<verb\></code>

####Basic Commands
- Help: lists all commands available to you, also lists all learned commands
  - <code>!help</code>
- Command Help: lists specific helptext and sytax for a command
  - <code>?\<verb\></code>
- Learned Commands: perform any learned command
  - <code>!\<verb\></code>
- Memo: Leave a message for an offline user (none removes the message)
  - <code>!memo \<user\> \<message\>|none</code>
- Notify: Register your email address with the bot to be notified by email when you are offline
  - <code>!notifyme \<email\>|none</code>
- Poke: Poke a user who is setup for notifications, they will be notified by email.
  - <code>!poke \<user\> [message]</code>

#Learning Commands
Teachers and Masters can use the <code>!teach <verb> <reply></code> command to teach the bot new commands. <code> \<reply\> </code> represents the output response text of the bot, greater than one word responses should be wrapped in quotes.

Within the reply, the following operators can be used:
-   {} : represents a variable placeholder for a command argument
-   {operator} : represents an active operator, requiring a command argument
-   [operator] : represents a passive operator, requiring no command argument

#####Example:
<code>!teach findityourself "Hey {}, [me] wants to show you the following search results: {ddg}"</code>

#####Usage:
<code>!findityourself noobie "how to use a search engine"</code>

#####Result:
<code>[LaCroix]: "Hey noobie, shizy wants to show you the following search results: https://lmddgtfy.net/?q=how%20to%20use%20a%20search%20engine"</code>


#Adding Operators
Additional passive and active operators can be added to lib/operators.js. Within the new operator the <code>this</code> keyword will give you access to the cmd object and all it's information. Active operators are also passed one parameter, their respective command argument.

#Extending Functionality
You can edit the lib/calls.js and lib/calls.json files to add new builtin/elevated commands.
lib/auto.js and lib/auto.json also can be edited to create new autocommands. Documentation for both of these will come in time.
