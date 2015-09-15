var sql = require('sqlite3');

var Commands = function (path, config) {

    this.t_calls = require('./calls.json');
    this.calls   = require('./calls.js');
    this.t_auto  = require('./auto.json');
    this.auto    = require('./auto.js');
    this.ops     = require('./operators.js');
    this.db      = new sql.Database(path);
    // TODO: better config handling!
    this.config  = config;
    this.roles   = {
        master  : 2,
        teacher : 1,
        ban     : 0
    };

    this.db.run("CREATE TABLE IF NOT EXISTS user (name TEXT UNIQUE NOT NULL, role TEXT NOT NULL)");
    this.db.run("CREATE TABLE IF NOT EXISTS command (verb TEXT UNIQUE NOT NULL, public TEXT NOT NULL, help TEXT, syntax TEXT, permit STRING DEFAULT '*')");
    this.db.run("CREATE TABLE IF NOT EXISTS memo (tofrom TEXT UNIQUE NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, message TEXT NOT NULL)");
    this.db.run("CREATE TABLE IF NOT EXISTS notify (name TEXT UNIQUE NOT NULL, email TEXT NOT NULL)");
};

/* Create reply based on reply template and provided parameters
 * @cmd          : the command template object
 * @cb           :
 *      err      : error, null otherwise
 *      response : response object
 */
Commands.prototype.parseReply = function (cmd, cb) {
    for (var type in cmd.template.reply) {
       if (cmd.args.hasOwnProperty(type)) {
            var args  = cmd.args[type];
            var reply = cmd.template.reply[type];
            var param = 0;
            matches   = reply.match(/[{|\[].*?[}|\]]/g);
            if (matches !== null) {
                for (var i in matches) {
                    var match;
                    var op = matches[i].replace(/[{|\[|}|\]]/g, '');

                    // variable or active operator
                    if (matches[i][0] === "{") {
                        if (param >= args.length) return cb("Incorrect number of required parameters.\n" + cmd.template.syntax);
                        match = (op.trim() === "") ? args[param++] :
                            this.ops[op].call(cmd, args[param++]);
                    }

                    // passive operator
                    if (matches[i][0] === '[') match = this.ops[op].call(cmd);
                    reply = reply.replace(matches[i], match);
                }
            }
            // TODO: respond as a single object?
            var response = {};
            response[type] = reply.replace(/"/g, "");
            cb(null, response);
       }
    }
};

/* Check if user is permitted based on the provided permission level
 * @cmd       : the command object to check
 * @cb
 *  error     : error
 *  permitted : true if the user is permitted, false otherwise
 */
Commands.prototype.isPermitted = function (cmd, cb) {
    var _self  = this;
    // always allow hardcoded config.master
    if (_self.config.master === cmd.sender) return cb(null, true);
    _self.db.get("SELECT * FROM user WHERE name = ?", cmd.sender, function (err, row) {
        if (err) cb("Error looking up permissions.");
        // is user listed?
        if (typeof row === 'undefined') {
            // user is not listed, is the command avaialble to everyone?
            return cb(null, (cmd.template.permit === "*") ? true : false);
        } else {
            // user is listed, are they banned?
            if (_self.roles[row.role] === _self.roles.ban) return cb(null, false);
            // is the command available to everyone else?
            if (cmd.template.permit === "*") return cb(null, true);
            // allow only if user has permissions equal to or higher
            return cb(null, (_self.roles[row.role] >= _self.roles[cmd.template.permit]) ? true : false);
        }
    });
};

/* Determines if the message is a valid command, and returns a command object
 * @sender  : the sender of the message
 * @target  : the target of the message
 * @message : the message sent
 * @cb
 *  error   : error
 *  cmd     : cmd object
 */
Commands.prototype.parseCommand = function (sender, target, message, cb) {
    //TODO: custom prefix choice in config?

    // prevent looping
    if (sender === this.config.nick) return;
    // is the message formatted as a command?
    if (!message.match(/^[\!|\?]\w+/)) return;

    // begin creation of cmd object
    var parameter = message.match(/"[^"]+"|[\w]+/g);
    var cmd       =  {
        prefix : message[0],
        verb   : parameter[0],
        args   : parameter.slice(1),
        bot    : this.config.nick,
        sender : sender,
        // pm's to the bot will be returned in pm form
        //target : (target === this.config.nick) ? sender : target,
        target : target,
    };

    // is this a builtin command?
    if (this.t_calls.hasOwnProperty(cmd.verb)) {
        // all elevated commands reply in pm form
        cmd.template = this.t_calls[cmd.verb];
        return cb(null, cmd);
    }

    // check if it is a learned command?
    this.db.get("SELECT * FROM command WHERE verb = ?", cmd.verb, function (err, row) {
        if (err || typeof row === 'undefined') return cb("Command not found.", cmd);
        cmd.template = row;
        cmd.template.reply = {};
        cmd.template.reply['public'] = row['public'];
        return cb(null, cmd);
    });
};

//TODO: consolidate command chain and extensions for auto and user commands (regex match might be a good basis!)
/* Triggers auto commands based on regex match defined in auto.json
 * @type     : the type of autocommand onmessage|onjoin|onleave
 * @message  : the message associated with the event
 * @cb       :
 *  err      : an error, null otherwise
 *  response : the response message
 */
Commands.prototype.autoCommands = function (type, message, sender, cb) {
    var _self = this;
    for (var i in _self.t_auto[type]) {
        var match = message.match(_self.t_auto[type][i].match);
        if (match !== null) {
            var cmd = {
                match : match[0],
                template : _self.t_auto[type][i],
                sender : sender,
            };
            _self.auto[i].call(_self, cmd, function (err, args) {
                if (err) return cb('(' + sender + ':' + type + '): ' + err);
                if (typeof args === 'undefined') return;
                cmd.args = args;
                _self.parseReply(cmd, cb);
            });
        }
    }
};

module.exports = Commands;
