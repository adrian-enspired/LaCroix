var sql = require('sqlite3');

var Commands = function (path, config) {

    this.builtin = require('./calls.json');
    this.calls   = require('./calls.js');
    this.ops     = require('./operators.js');
    this.db      = new sql.Database(path);
    this.config  = config; // ewwww
    this.roles   = {
        master  : 2,
        teacher : 1,
        ban     : 0
    };

    this.db.run("CREATE TABLE IF NOT EXISTS user (name TEXT UNIQUE NOT NULL, role TEXT NOT NULL)");
    this.db.run("CREATE TABLE IF NOT EXISTS command (verb TEXT UNIQUE NOT NULL, reply TEXT NOT NULL, help TEXT, syntax TEXT, permit STRING DEFAULT '*')");
};

/* Create reply based on reply template and provided parameters
 * @cmd                 : the command template object
 * @cb(target, message) :
 *      target          : target for response public|private|error|action
 *      message         : reply message
 */
Commands.prototype.parseReply = function (cmd, cb) {
    var reply = cmd.template.reply;
    var param = 0;
    matches   = reply.match(/[{|\[].*?[}|\]]/g);
    if (matches !== null) {
        for (var i in matches) {
            var match;
            var op = matches[i].replace(/[{|\[|}|\]]/g, '');

            // variable or active operator
            if (matches[i][0] === "{") {
                if (param >= cmd.args.length)
                    return cb("Incorrect number of required parameters.\n" + cmd.template.syntax);
                match = (op.trim() === "") ? cmd.args[param++] :
                    this.ops[op].call(cmd, cmd.args[param++]);
            }

            // passive operator
            if (matches[i][0] === '[') match = this.ops[op].call(cmd);
            reply = reply.replace(matches[i], match);
        }
    }
    return cb(null, reply.replace(/"/g, ""));
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
            if (_self.roles[row.role] === _self.roles.ban) return cb(false);
            // is the command available to everyone else?
            if (cmd.template.level === "*") return cb(true);
            // allow only if user has permissions equal to or higher
            return cb(null, (_self.roles[row.role] >= _self.roles[cmd.template.level]) ? true : false);
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
        target : (target === this.config.nick) ? sender : target,
    };

    // is this a builtin command?
    if (this.builtin.hasOwnProperty(cmd.verb)) {
        cmd.template = this.builtin[cmd.verb];
        return cb(null, cmd);
    }
    // check if it is a learned command?
    this.db.get("SELECT * FROM command WHERE verb = ?", cmd.verb, function (err, row) {
        if (err || typeof row === 'undefined') return cb("Command not found.", cmd);
        cmd.template = row;
        return cb(null, cmd);
    });
};

module.exports = Commands;
