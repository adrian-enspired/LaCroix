var operator = require('./ext/operators.js');
var Resource = require('./lib/resource.js');
var Command  = require('./lib/command.js');
var command  = new Command(); // ewwwwwww
var verbs    = require('./ext/verbs.js');
var res      = new Resource();

var TRIGGERS = [
    'PRIVMSG',
    'JOIN'
];

//TODO:
// user bans
// list notifyable users
// README for extendibility
// list operators
// change to array=>object based response objects

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
                sendResponse({ [cmd.sender] : err });
                return;
            }
            console.log('(' + cmd.sender + '): ' + cmd.raw);
            cmd.template = info.template;
            cmd.type     = info.type;

            cmd.template.permit = (typeof cmd.template.permit === 'undefined' || cmd.type === "learned") ? "*" : cmd.template.permit;

            isPermitted(cmd, (err) => {
                if (err) {
                    sendResponse({ [cmd.sender] : err });
                    return;
                }

                // a command help request?
                if (cmd.type === "user" && cmd.prefix === "?") {
                    sendResponse({
                        [cmd.sender] : cmd.template.help + "\n\t" + cmd.template.syntax
                    });
                    return;
                }

                // a learned command?
                if (cmd.type === "learned" && cmd.prefix === "!")
                    parseOperators(cmd, sendResponse);

                if (cmd.args.length < cmd.template.params) {
                    sendResponse({
                        [cmd.sender] : "Not enough arguments."
                    });
                    return;
                }

                // a user command?
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

/* Parse the response object and send a response to the specified recipients
 *
 * @response : the response object
 */
var sendResponse = (response) => {
    if (typeof response.broadcast !== 'undefined') {
        // for every channel!
        response[res.config.channel] = response.broadcast;
        delete response.broadcast;
    }
    for (var recipient in response) {
        res.irc.say(recipient, response[recipient]);
        console.log('(' + res.config.nick + '): ' + response[recipient]);
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
            if (op.trim() !== "" && !operator.hasOwnProperty(op))
                return cb({
                    [cmd.sender] : "Invalid operator in command: " + op
                });

            // variable or active operator
            if (matches[i][0] === "{") {
                if (param >= args.length)
                    return cb({
                        [cmd.sender] : "Incorrect number of required parameters."
                    });
                match = (op.trim() === "") ? match = args[param++] :
                    operator[op].call(res, cmd, args[param++]);
            }

            // pasive operator
            if (matches[i][0] === "[") match = operator[op].call(res, cmd);
            reply = reply.replace(matches[i], match);
        }
    }
    var target = (cmd.recipient === res.bot) ? cmd.sender : cmd.recipient;
    return cb({ [target] : reply });
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

var isBanned = (host, cb) => {
    res.db.get("SELECT * FROM ban WHERE host = ?", host, (err, row) => {
        if (err || typeof row !== 'undefined') return cb(true);
        return cb(false);
    });
};

/* Checks to see if a user is permitted based on the command permit
 *
 * @user   : the user nick to check
 * @permit : the command permit to check against
 * cb      :
 *  err    : error, null otherwise
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
