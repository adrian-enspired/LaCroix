var template = require('./template/commands.json');
var commands = require('./lib/commands.js');
var permit;
var config   = require('./config.json');
var redis    = require('redis').createClient();
var irc      = require('irc');
var fs       = require('fs');

var client = new irc.Client(config.server, config.nick, {
    channels: [ config.channel ],
    floodProtection: true,
});

function parse(user, message, callback) {
    var type = message[0];
    if (type !== "!" && type !== "?") return;

    var command = message.slice(1).split(" ");
    var verb    = command[0];
    var params  = command.slice(1);

    redis.hget('command_' + verb, function (err, cmd) {
        cmd = (typeof template[verb] !== 'undefined') ? template[verb] : cmd;

        if (typeof cmd === 'undefined') {
            return callback("Command not found.", true);
        }

        if (!isPermitted(user, cmd.permit)) {
            return callback("You are not permitted to perform this command.", true);
        }

        console.log('(' + user + '): ' + message);

        if (type === "?") {
            return callback(cmd.help + "\n\t" + cmd.desc, true);
        }

        if (type === "!") {
            if (params.length < cmd.params) {
                return callback("Incorrect number of parameters required:\n" + cmd.help, true);
            }
            // no commands working!
            return callback(commands[cmd.call](params));
        }
    });
}

function isPermitted(user, role) {
    if (Array.isArray(role)) {
        for (var r in role) { if (isPermitted(user, r)) return true; }
        return false;
    }
    // always allow config.master
    if (user === config.master) return true;
    // deny user if blacklisted
    if (permit.blacklist.indexOf(user) > -1) return false;
    // allow user if role contains "*" (anyone) wildcard
    if (role === "*" || permit[role].indexOf("*") > -1) return true;
    // allow user if they are listed for that role
    return (permit[role].indexOf(user) > -1) ? true : false;
}

client.addListener('message', function (from, to, message) {
    if (from === config.nick) return;
    parse(from, message, function (reply, pm) {
        var target = (to === config.nick || pm) ? from : config.channel;
        console.log('(' + config.nick + '): ' + reply);
        client.say(target, reply);
    });
});

client.on('error', function (err) {
    console.error(err);
});

redis.hgetall("permissions", function (err, value) {
    // test / change
    permit = value || {
        masters: [],
        teachers: [],
        users: ["*"],
        blacklist: [],
    };
});

redis.on('error', function (err) {
    console.error(err);
});
