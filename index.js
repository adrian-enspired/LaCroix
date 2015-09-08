var template = require('./template/commands.json');
var Commands = require('./lib/commands.js');
var config   = require('./config.json');
var irc      = require('irc');
var fs       = require('fs');

var commands = new Commands(__dirname + '/db.sqlite');

/* Parse then execute if the message is a command.
 * @user            : username sending the command
 * @message         : message being sent
 * @cb(reply, [pm]) : callback
 *      reply : reply message
 *      pm    : true forces any reply as a pm to the sender
 */
function parse(user, message, cb) {
    var type = message[0];
    if (type !== "!" && type !== "?") return;

    // log the requested command
    console.log('(' + user + '): ' + message);

    var command = message.slice(1).split(" ");
    var verb    = command[0];
    var params  = command.slice(1);

    // get command type, built-in or taught?

    if (!commands.hasOwnProperty(verb)) {
        return cb("Command not found.", true);
    }
    var cmd = template[verb];

    // check config.master
    commands.isPermitted(user, cmd.permit, function (permitted) {

        if (!permitted) return cb("You are not permitted to perform this command.", true);
        if (type === "?") {
            return cb(cmd.help + "\n\t" + cmd.syntax, true);
        }

        if (type === "!") {
            if (params.length < cmd.params) {
                return cb("Incorrect number of parameters required:\n" + cmd.syntax, true);
            }

            commands[cmd.call](params, function (reply) {
                return cb(reply);
            });
        }
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
