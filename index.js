//var template = require('./lib/commands.json');
var Commands = require('./lib/commands.js');
var config   = require('./config.json');
var irc      = require('irc');
var fs       = require('fs');

// config detection and setup!
var commands = new Commands(__dirname + '/db.sqlite', config);

// create irc client
var client = new irc.Client(config.server, config.nick, {
    channels: [ config.channel ],
    floodProtection: true,
});

// listen for all messages in irc
client.addListener('message', function (from, to, message) {

    var cmd = commands.parseCommand(from, to, message, function (err, cmd) {
        if (err) {
            console.error(err);
            client.say(from, err);
            return;
        }

        // valid command, log attempt
        console.log('(' + from + '): ' + message);

        commands.isPermitted(cmd, function (err, permit) {
            if (err) {
                console.error(err);
                client.say(cmd.sender, err);
                return;
            }

            if (!permit) {
                client.say(cmd.sender, "You are not permitted to perform this command.");
                return;
            }

            // if help
            if (cmd.prefix === "?") client.say(cmd.sender, cmd.template.help + "\n\t" + cmd.template.syntax);

            // if command
            if (cmd.prefix === "!") {
                // parameter check?

                // **********************************************
                // Dude, clean this up! D:
                if (typeof cmd.template.call !== 'undefined') {
                    commands.calls[cmd.template.call].call(commands, cmd, function (err, args) {
                        if (err) {
                            console.error(err);
                            client.say(cmd.sender, err);
                            return;
                        }
                        console.log(args);
                        cmd.args = args;
                        commands.parseReply(cmd, function (err, response) {
                            if (err) {
                                console.error(err);
                                client.say(cmd.sender, err);
                                return;
                            }
                            client.say(cmd.target, response);
                        });
                    });
                } else {
                    commands.parseReply(cmd, function (err, response) {
                        if (err) {
                            console.error(err);
                            client.say(cmd.sender, err);
                            return;
                        }
                        client.say(cmd.target, response);
                    });
                }
            }
        });
    });
});

// irc client errors
client.on('error', function (err) {
    console.error(err);
});
