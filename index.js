var Commands = require('./lib/commands.js');
var config;
var irc      = require('irc');
var fs       = require('fs');

// TODO:
// add multi-channel support
// parting, joining, reconnecting
// cleanup config generation/loading
// nodemailer integration config/toggle
// !notifyme opt-in

// TEMP!
// create config if it doesn't exist
try {
    fs.statSync(__dirname + '/config.json');
    config = require('./config.json');
} catch(e) {
    if (e.code === 'ENOENT') {
        console.log("No config file found, one has been created for you. Fill it out and run again: ./config.json");
        var config = {
            server  : "",
            channel : "",
            nick    : "",
            master  : "",
        };
        fs.writeFileSync(__dirname + '/config.json', JSON.stringify(config, 4, null));
        return;
    }
}

var commands = new Commands(__dirname + '/db.sqlite', config);
// create irc client
var client = new irc.Client(config.server, config.nick, {
    channels: [ config.channel ],
    floodProtection: true,
});


function error(err, target) {
    console.error(err);
    if (typeof target !== 'undefined') client.say(target, err);
}

function respond(response, sender) {
    for (var type in response) {
        switch (type) {
            case 'public'  : client.say(config.channel, response[type]); break;
            case 'private' : client.say(sender, response[type]); break;
            case 'action'  : client.action(config.channel, response[type]); break;
        }
        console.log('(' + config.nick + '): ' + response[type]);
    }
}

// listen for all messages in irc
client.addListener('message', function (from, to, message) {

    commands.autoCommands("onmessage", message, from, function (err, response) {
        if (err) return error(err);
        respond(response);
    });

    commands.parseCommand(from, to, message, function (err, cmd) {
        if (err) return error(err, cmd.sender);

        // valid command, log attempt
        console.log('(' + from + '): ' + message);

        commands.isPermitted(cmd, function (err, permit) {
            if (err) return error(err, cmd.sender);

            if (!permit)
                return error("You are not permitted to perform this command.", cmd.sender);

            // if help
            if (cmd.prefix === "?")
                respond(cmd.template.help + "\n\t" + cmd.template.syntax, cmd.sender);

            // if command
            if (cmd.prefix === "!") {
                // parameter check?

                // **********************************************
                // Dude, clean this up! D:
                if (typeof cmd.template.call !== 'undefined') {
                    commands.calls[cmd.template.call].call(commands, cmd, function (err, args) {
                        if (err) return error(err, cmd.sender);

                        cmd.args = args;
                        commands.parseReply(cmd, function (err, response) {
                            if (err) return error(err, cmd.sender);
                            respond(response, cmd.sender);
                        });
                    });
                } else {
                    commands.parseReply(cmd, function (err, response) {
                        if (err) return error(err, cmd.sender);
                        respond(response, cmd.sender);
                    });
                }
            }
        });
    });
});

client.on('join', function (channel, user) {
    commands.autoCommands("onjoin", "", user, function (err, response) {
        if (err) return error(err);
        respond(response, user);
    });
});

// irc client errors
client.on('error', function (err) {
    error(err, config.master);
});
