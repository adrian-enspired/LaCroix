//var patterns = require('../ext/patterns.json');
var patterns = require('../ext/template.json').auto;

module.exports = Command = function () {};

/* Forms a Command object from string input
 *
 * @input     : the raw string input to parse
 * @sender    : the sender of the input
 * @recipient : the user or channel to which the command was sent
 * @bot       : the name of the bot
 */
Command.prototype.parse = function (input, sender, recipient, trigger, cb) {

    // does the input qualify as a command or autocommand?
    matchCommand(input, trigger, (match) => {

        return cb({
            trigger   : trigger,
            type      : match.type,
            match     : match.match,
            raw       : match.raw,
            prefix    : match.prefix,
            verb      : match.verb,
            args      : parseParams(input),
            sender    : sender.nick,
            host      : sender.host,
            recipient : recipient,
            template  : {},
        });
    });
};


/* Checks if the input qualifies as a command or autocommand
 *
 * @input   : the raw input message to check
 * @trigger : the trigger type
 * return   : an object with the regex match, verb and type, false otherwise
 */
var matchCommand = (input, trigger, cb) => {

    var match = null;
    // is user command?
    if (trigger === 'privmsg') {
        if (typeof input === 'undefined') return;

        match = input.match(/^[\!\?]\w+/);
        if (match !== null) return cb({
            raw    : input,
            prefix : input[0],
            match  : match[0].slice(1),
            verb   : match[0].slice(1),
            type   : "user",
        });
    }

    // is autocommand?
    for (var verb in patterns) {
        //if (trigger === patterns[verb].trigger) {
        if (patterns[verb].trigger.indexOf(trigger) > -1) {
            if (trigger === 'privmsg')  {
                var re  = new RegExp(patterns[verb].match);
                match   = input.match(re);
                if (match !== null) cb({
                    raw    : input,
                    prefix : "",
                    match  : match[0],
                    verb   : verb,
                    type   : "auto"
                });
            } else {
                cb({
                    raw    : trigger,
                    prefix : "",
                    match  : "",
                    verb   : verb,
                    type   : "auto"
                });
            }
        }
    }
};

/* Parses command input into word and quote specific matches, then strips
 * any quotes from the argument before returning.
 *
 * @input : the raw string input to parse
 * return : an array of arguments
 */
var parseParams = (input) => {
    if (typeof input === 'undefined') return [];
    var params = input.match(/"[^"]+"|[\w]+|'[^']+'|[\w]+/g);
    if (params === null) return [];
    for (var i in params) params[i] = params[i].replace(/^["|']|["|']$/g, '');
    return params.slice(1);
};
