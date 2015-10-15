var Resource = require('./lib/resource.js');
var Command  = require('./lib/command.js');
var verbs    = require('./ext/verbs.js');

var command  = new Command(); // ewwwwwww
var res      = new Resource();

// only these raw messages are considered as commands, all else are discarded!
var TRIGGERS = [
    'PRIVMSG',
    'JOIN',
    'NICK'
];

// cheap hack!
var lastsender;

//TODO:
// README for extendibility
// operator check specificity between active and passive. probably just split the two in operators.js
// consider moving config to sqlite. Upon setup, only the server needs to be provided as a command line argument. !save then updates all the saved info (nick, channels, server, etc)

res.irc.addListener('raw', (input) => {

    // is the output from the bot (loop prevention)
    if (input.nick === res.config.nick) return;

    // check input trigger
    if (TRIGGERS.indexOf(input.rawCommand) === -1) return;

    // attempt to create a valid command object
    command.parse(input.args[1], { nick: input.nick, host: input.host }, input.args[0], input.rawCommand.toLowerCase(), (cmd) => {

        // fetch the command template
        getCommandTemplate(cmd.verb, cmd.type, (err, info) => {
            if (err) {
                sendResponse([ { recipient : cmd.sender, message : err } ]);
                return;
            }
            console.log('(' + cmd.sender + ' => ' + res.bot  + '): ' + cmd.raw);
            lastsender   = cmd.sender;
            cmd.template = info.template;
            cmd.type     = info.type;

            cmd.template.permit = (typeof cmd.template.permit === 'undefined' || cmd.type === "learned") ? "*" : cmd.template.permit;

            // is the user permitted to run the command?
            isPermitted(cmd, (err) => {
                if (err) {
                    sendResponse([ { recipient : cmd.sender, message : err } ]);
                    return;
                }

                // a command help request?
                if (cmd.type === "user" && cmd.prefix === "?") {
                    sendResponse([
                        { recipient : cmd.sender,
                          message   : cmd.template.help + "\n\t" + cmd.template.syntax }
                    ]);
                    return;
                }

                // a learned command?
                if (cmd.type === "learned" && cmd.prefix === "!")
                    parseOperators(cmd, sendResponse);

                // must be an auto or user command
                // are there enough arguments for the user or auto command?
                if (cmd.args.length < cmd.template.params) {
                    sendResponse([
                        { recipient : cmd.sender,
                          message   : "Not enough arguments." }
                    ]);
                    return;
                }

                // a user or auto command?
                if ((cmd.type === "user" && cmd.prefix === "!") || cmd.type === "auto") {
                    verbs[cmd.type][cmd.verb].call(res, cmd, (err, response) => {
                        if (err) console.error(err);
                        sendResponse(response);
                    });
                }
            });
        });
    });
});

// error handling (cheap hack for !part, !join, and !nick)
res.irc.addListener('error', (message) => {
    console.log('(' + res.bot + ' => ' + lastsender + '): ' + message.args[2]);
    res.irc.say(lastsender, message.args[2]);
});

/* Parse the response object and send a response to the specified recipients
 *
 * @response : the response object
 */
var sendResponse = (response) => {
    for (var i in response) {
        console.log('(' + res.bot + ' => ' + response[i].recipient + '): ' + response[i].message);
        if (response[i].recipient === 'broadcast') {
            for (var chan in res.irc.chans) res.irc.say(chan, response[i].message);
        } else res.irc.say(response[i].recipient, response[i].message);
    }
};

/* Parses output for learned commands
 *
 * @cmd      : the command object
 * @cb       :
 *  response : the response object
 */
var parseOperators = (cmd, cb) => {
    var args    = cmd.args;
    var reply   = cmd.template.public;
    var param   = 0;
    var match;
    var matches = reply.match(/[{|\[].*?[}|\]]/g);
    if (matches !== null) {
        for (var i in matches) {
            var op = matches[i].replace(/[{|\[|}|\]]/g, '');
            if (op.trim() !== "" && !res.operator.hasOwnProperty(op))
                return cb([
                    { recipient : cmd.sender,
                      message   : "Invalid operator in command: " + op }
                ]);

            // variable or active operator
            if (matches[i][0] === "{") {
                if (param >= args.length)
                    return cb([
                        { recipient : cmd.sender,
                          message   : "Incorrect number of required parameters." }
                    ]);
                match = (op.trim() === "") ? match = args[param++] :
                    res.operator[op].call(res, cmd, args[param++]);
            }

            // pasive operator
            if (matches[i][0] === "[") match = res.operator[op].call(res, cmd);
            reply = reply.replace(matches[i], match);
        }
    }
    var target = (cmd.recipient === res.bot) ? cmd.sender : cmd.recipient;
    return cb([ { recipient : target, message : reply } ]);
};

/* Searches the json templates and sqlite db for a command template
 * associated with the provided command verb and type.
 *
 * @verb : the verb to search for
 * @type : the type of command to search in
 * cb    :
 *  err  : error, null otherwise
 *  info : an object containing the template and the type
 */
var getCommandTemplate = (verb, type, cb) => {

    // predefined command?
    if (typeof type === 'undefined') return cb("Command not found.");
    for (var title in res.template[type]) {
        if (title === verb) return cb(null, {
            template : res.template[type][title],
            type     : type
        });
    }

    // learned command?
    res.db.get("SELECT * FROM command WHERE verb = ?", verb, (err, row) => {
        if (err || typeof row === 'undefined') return cb("Command not found.");
        return cb(null, {
            template : row,
            type     : "learned"
        });
    });
};

/* Checks to see if a host is banned
 *
 * @host   : The host to check
 * cb      :
 *  banned : true if banned, false otherwise
 */
var isBanned = (host, cb) => {
    res.db.get("SELECT * FROM ban WHERE host = ?", host, (err, row) => {
        if (err || typeof row !== 'undefined') return cb(true);
        return cb(false);
    });
};

/* Checks to see if a user is permitted based on the command permit
 *
 * @cmd : the command object containing the users data
 * cb   :
 *  err : error, null otherwise
 */
var isPermitted = (cmd, cb) => {

    isBanned(cmd.host, (banned) => {
        var user   = cmd.sender;
        var permit = cmd.template.permit;
        // can anyone perform this command?
        if (permit === "*" && !banned) return cb();
        // must be an elevated command, check if user is logged into nickserv
        res.whois(user, (account) => {
            if (!account && !banned) return cb("You must be registered and logged into nickserv to perform that command.");
            // does the user's account match config.master?
            if (account === res.config.master) return cb();
            // is the account banned?
            if (banned) return cb("You are banned.");
            // the user is logged in, do we have a record of their account name?
            res.db.get("SELECT * FROM user WHERE account = ?", account, (err, row) => {
                if (err) cb("Error lookup up user permissions.");
                if (typeof row === 'undefined')
                    return cb("You are not permitted to perform this command");
                // only allow if users permissions are equal to or higher command permit
                return (res.ROLES[row.role] >= res.ROLES[permit]) ?
                    cb() :
                    cb("You are not permitted to perform this command.");
            });
        });
    });
};
