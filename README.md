#LaCroix
An IRC bot just as refreshing as the beverage it's named after.

##Install
1. Clone the repo
2. Edit the config.json:<br/>
<code>"server" : The IRC server for the bot to connect to</code><br/>
<code>"channel" : An array containing the default channels for the bot to connect to</code><br/>
<code>"nick" : The nick the bot will have</code><br/>
<code>"master" : The hardcoded admin. This should be your nickserv account, not your nick!</code>
3. Install deps (irc, nodemailer, sqlite3): <code>npm install</code>
4. Run! <code>node index.js</code>

##Commands
###Legend
- \<argument\> : Mandatory argument
- \<"argument"\> : Mandatory argument wrapped in single or double quotes
- [argument] : Optional argument
- \<argument|none\> : User specified argument, or predefined option "none"

####help
This will list all available commands, the response will be PM'd to you:<br/>
<code>!help</code><br/>
To get help for a particular command, prefix that command with a <code>?</code><br/>
Ex: <code>?memo</code>

####operators
Lists all available operators usable when teaching commands:<br/>
<code>!operators</code>

####memo
Leave a message for an offline user, the message will be delivered to them the next time they join the channel ("none" deletes the message):<br/>
<code>!memo \<nick\> \<message|none\></code>

####memos
Lists all memos you've left for other users:<br/>
<code>!memos</code>

####notifyme
Allow yourself !notify(d) notified by email if you are offline ("none" disables email notification):<br/>
<code>!notifyme \<"email address"|none\></code>

####notify
Sends an email notification to an offline user. This will only work if the user has setup email notifications using !notifyme:<br/>
<code>!notify \<nick\> ["message"]</code>

####notifiable
Lists all users who have allowed themselves to be notified by email:<br/>
<code>!notifiable</code>

####teach
Teaches the bot a new command. Refer to the Teaching Commands section below for more information:<br/>
<code>!teach \<verb\> \<"reply"\> ["help"] ["syntax"]</code>

####forget
Deletes a previously learned command:<br/>
<code>!forget \<verb\></code>

####ban
Bans a host from interacting with the bot:<br/>
<code>!ban <host></code>

####unban
Unbans a host, allowing them to interact with the bot:<br/>
<code>!unban <host></code>

####bans
Lists all banned hosts:<br/>
<code>!bans</code>

####users
Checks which user accounts have a particular permission level. Results list the nickserv account names of the user, NOT their nick:<br/>
<code>!users</code>

####user
Adjusts a user's permission level. You must specify the user's nickserv account name, NOT their nick (none removes all permissions):<br/>
<code>!user \<account\> \<master|teacher|none\></code>

####join
Commands the bot to join a new channel. It is considered best practice and common courtesy to ask a channel operator before bringing the bot into a channel:<br/>
<code>!join \<"#channel"\> ["password"]</code>

####part
Command the bot to part from a channel:<br/>
<code>!part \<"#channel"\></code>

####channels
Lists all channels the bot is connected to:<br/>
<code>!channels</code>

####nick
Changes the bot's nick:<br/>
<code>!nick \<"nick"\></code>

####say
Relays a message to a recipient under the alias of the bot. Recipient can be either a nick or a channel:<br/>
<code>!say \<recipient|broadcast\> \<"message"\></code>

##Permissions
There are two permission levels: masters and teachers. Masters have access to all commands, including the ability to adjust user permissions. Teachers can't adjust user permissions, but they can still teach the bot new commands.

All non-specified users have access to any learned command, and many of the basic communicative commands (!memo, !notifme, !notify, etc.)

Banned hosts have no access to any command.

##Teaching Commands
The syntax for teaching the bot a new command is:
<code>!teach \<verb\> \<"reply"\> [help] [syntax]</code>
- verb: The "trigger" word to call the command. For example, if my verb was <code>love</code>, then I would execute the command by typing <code>!love</code>
- reply: The reply that the bot will give to the issued command. Any reply with spaces must be wrapped in quotes. Replies can contain any number of variable placeholders or operators to extend their usefulness and functionality. See the Operators section below for more information.
- help / syntax: The help description and syntax example. These can be seen at any time by preceeding the verb with a "?" (Ex: <code>?love</code>). These fields are optional. Though it is recommended to leave help for more elaborate commands.

In order to use a single or double quote in the reply, consider using the [squote] or [quote] passive operators. Failure to do otherwise will most likely result in a truncated reply.

Ex: <code>!teach denyit "I ain[squote]t doin[squote] [quote]nothin[squote][quote]"</code><br/>
Result: <code>I ain't doin' "nothin'"</code>

###Operators
Operators can be used to make replies a little more dynamic and/or personal. You can get a list of available operators at any time with the <code>!operators</code> command.
There are three types of operators available to any reply:
####Variables
These are basic placeholders for additional arguments, designated by empty curly brackets: <code>{}</code><br/>
For Example:<br/>
Teaching: <code>!teach count "v[squote]{}, {}, {}, ah-ah-ah"</code><br/>
Execution: <code>!count one two three</code><br/>
Result: <code>[LaCroix]: v'one, two, three, ah-ah-ah"</code><br/>

####Active Operators
These are basic functions requiring a single argument. They are designated with the name of the operator surrounded by curly brackets: <code>{operator}</code><br/>
For Example:<br/>
Teaching: <code>!teach findityourself "{}, learn to find things yourself: {lmddgtfy}"</code><br/>
Execution: <code>!findityourself noobie "how to use a search engine"</code><br/>
Result: <code>[LaCroix]: noobie, learn to find things yourself: http://lmddgtfy.net/?=how%20to%20use%20a%20search%20engine</code><br/>

####Passive Operators
These are basic functions requiring no arguments, but are simply replaced by a predefined value. They are designated with the name of the operator surrounded by square brackets: <code>[operator]</code><br/>
For Example:<br/>
Teaching: <code>!teach love "[bot] <3[squote]s [me]"</code><br/>
Execution: <code>!love</code><br/>
Result: <code>[LaCroix]: [LaCroix] <3's shizy</code><br/>

#Extensibility
Everything in the <code>/ext</code> folder can be edited / added to.
- <code>/ext/verbs.js</code> - Built-in functions, both user and autocommands
- <code>/ext/template.json</code> - Template for all built-in functions, both user and autocommands
- <code>/ext/operators.js</code> - Passive, and active operators

####New User Functions / Autocommands
New entries should be made in both <code>/ext/verbs.js</code> and <code>/ext/template.json</code> for any new user or autocommands.
In <code>verbs.js</code>, create a new a new function in the following format under the appropriate object (user or auto):
<code><br/>
    myfunction : function (cmd, cb) {<br/>
        /* your code goes here */<br/>
    },<br/>
</code>
The following resources are provided to you:
- cmd: all command objects including sender, recipient, etc.
- this: object resources: sqlite, irc, etc.

In addition to defining what the function does in <code>verbs.js</code>, you must also define the function template in <code>template.json</code>.
Take note that the JSON object name must match the function name!
The following is required for a user command:
<code><br/>
    "myfunction" : {<br/>
        "permit" : "",<br/>
        "help"   : "",<br/>
        "syntax" : "",<br/>
        "params" : 0<br/>
    }<br/>
</code>
Where the parameters follow the pattern:
- "permit" : the lowest level of permission required to perform the command: "master", "teacher", or "*" for everyone
- "help"   : the help syntax that will display when the user calls ?myfunction
- "syntax" : the syntax examples that display when the user calls ?myfunction
- "params" : the number of required parameters in order for the command to execute sucessfully

The following is required for an auto command:
<code><br/>
    "myfunction" : {</br>
        "permit" : "",<br/>
        "trigger": [],<br/>
        "match"  : "",<br/>
    }<br/>
</code>
Where the parameters follow the pattern:
- "permit" : the lowest level of permissions required for the user to trigger the auto command: "master", "teacher" or "*" for everyone
- "trigger" : an array of IRC message types which trigger the auto command: "join" (joining a channel), "nick" (nick change), "privmsg" (any typed message that the bot could read, either private or public)
- "match" : The regex match which will trigger the command. The match can be used in the function by calling cmd.match
