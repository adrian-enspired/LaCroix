# LaCroix
An IRC bot more refreshing then the beverage it's named after

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
- Memo: Leave a message for an offline user (none removes the message)
  - <code>!memo \<user\> \<message\>|none</code>

####Basic Commands
- Help: lists all commands available to you, also lists all learned commands
  - <code>!help</code>
- Command Help: lists specific helptext and sytax for a command
  - <code>?\<verb\></code>
- Learned Commands: perform any learned command
  - <code>!\<verb\></code>

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
<code>[LaCroix]: "Hey noobie, shizy wants to show you the following search results: http://duckduckgo.com/?q=how%20to%20use%20a%20search%20engine"</code>

Additional passive and active operators can be added to lib/operators.js. Within the new operator <code>this</code> will give you access to the cmd object and all it's information. Active operators also get passed one parameter, their respective command argument.
