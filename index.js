var template = require('./template/commands.json');
var Commands = require('./lib/commands.js');
var config   = require('./config.json');
var irc      = require('irc');
var fs       = require('fs');

var commands = new Commands(__dirname + '/db.sqlite');

/* Parse then execute if the message is a command.
 * @user: username sending the command
 * @message: message being sent
 * @cb(reply, [pm]): callback
 *      reply: reply message
 *      pm: true forces any reply as a pm to the sender
 */
function parse(user, message, cb) {
    var type = message[0];
    if (type !== "!" && type !== "?") return;

    var command = message.slice(1).split(" ");
    var verb    = command[0];
    var params  = command.slice(1);

    // get command type, built-in or taught?

    if (!commands.__proto__.hasOwnProperty(verb)) {
        return cb("Command not found.", true);
    }
    var cmd = template[verb];

    if (!isPermitted(user, cmd.permit)) {
        return cb("You are not permitted to perform this command.", true);
    }

    if (type === "?") {
        return cb(cmd.help + "\n\t" + cmd.syntax, true);
    }

    // log the requesed command
    console.log('(' + user + '): ' + message);

    if (type === "!") {
        if (params.length < cmd.params) {
            return cb("Incorrect number of parameters required:\n" + cmd.syntax, true);
        }

        commands[cmd.call](params, function (reply) {
            return cb(reply);
        });
    }
}

/* Check if user is permitted based on the provided permission level
 * @name: username to check
 * @level: the permission level to check against
 */
function isPermitted(name, level) {
    // always allow config.master
    if (name === config.master) return true;
    db.each("SELECT * FROM user WHERE name = ?", name, function (err, row) {
        // deny if user not found
        if (err || typeof row === 'undefined') return false;
        // deny banned user
        if (ROLE[row[1]] === ROLE.ban) return false;
        // allow user if role is anyone
        if (level === "*") return true;
        // allow only if user has permissions equal to or higher
        return (ROLE[row[1]] >= ROLE[level]) ? true : false;
    });
}

// create irc client
var client = new irc.Client(config.server, config.nick, {
    channels: [ config.channel ],
    floodProtection: true,
});

// listen for all messages in irc
client.addListener('message', function (from, to, message) {
    if (from === config.nick) return;
    parse(from, message, function (reply, pm) {
        var target = (to === config.nick || pm) ? from : config.channel;
        console.log('(' + config.nick + '): ' + reply);
        client.say(target, reply);
    });
});

// irc client errors
client.on('error', function (err) {
    console.error(err);
});
