//var template = require('./lib/commands.json');
var Commands = require('./lib/commands.js');
var config   = require('./config.json');
var irc      = require('irc');
var fs       = require('fs');

// config detection and setup!
var commands = new Commands(__dirname + '/db.sqlite');

// create irc client
var client = new irc.Client(config.server, config.nick, {
    channels: [ config.channel ],
    floodProtection: true,
});

// listen for all messages in irc
client.addListener('message', function (from, to, message) {
    if (from === config.nick) return;
    commands.parse(from, message, function (reply, pm) {
        var target = (to === config.nick || pm) ? from : config.channel;
        console.log('(' + config.nick + '): ' + reply);
        client.say(target, reply);
    });
});

// irc client errors
client.on('error', function (err) {
    console.error(err);
});
