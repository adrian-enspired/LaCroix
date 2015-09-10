var sql = require('sqlite3');

// TODO:
// [me] passive operator, {google} active operator

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
 * @cmd                : the command template object
 * @cb(response, [pm]) :
 *      response       : the final response message
 *      pm             : whether the reply should be a private message
 */
Commands.prototype.dispatch = function (cmd, cb) {
    var reply   = cmd.reply;
    var param = 0;
    matches = reply.match(/[{|\[].*?[}|\]]/g);
    if (matches !== null) {
        for (var i in matches) {
            var match;
            var op = matches[i].replace(/[{|\[|}|\]]/g, '');

            // variable or active operator
            if (matches[i][0] === "{") {
                if (param >= cmd.args.length)
                    return cb("Incorrect number of required parameters.", cb);
                match = (op.trim() === "") ? cmd.args[param++] :
                    this.ops[op].call(cmd, cmd.args[param++]);
            }

            // passive operator
            if (matches[i][0] === '[') match = this.ops[op].call(cmd);
            reply = reply.replace(matches[i], match);
        }
    }
    return cb(reply.replace(/"/g, "")); // remove quotes when getting command instead
};

/* Check if user is permitted based on the provided permission level
 * @name          : username to check
 * @level         : the permission level to check against
 * @cb(permitted) : callback
 *      permitted : true if the user is permitted, false otherwise
 */
Commands.prototype.isPermitted = function (name, level, cb) {
    var _self  = this;
    // always allow hardcoded config.master
    if (_self.config.master === name) return cb(true);
    _self.db.get("SELECT * FROM user WHERE name = ?", name, function (err, row) {
        // deny if error
        if (err) cb(false);
        // is user listed?
        if (typeof row === 'undefined') {
            // user is not listed, is the command avaialble to everyone?
            return cb((level === "*") ? true : false);
        } else {
            // user is listed, are they banned?
            if (_self.roles[row.role] === _self.roles.ban) return cb(false);
            // is the command available to everyone else?
            if (level === "*") return cb(true);
            // allow only if user has permissions equal to or higher
            return cb((_self.roles[row.role] >= _self.roles[level]) ? true : false);
        }
    });
};

/* Check if a verb exists and return the command object
 * @verb          : the verb to check for
 * cb(error, cmd) :
 *      error     : error, null otherwise
 *      cmd       : the command template object
 */
Commands.prototype.getVerb = function (verb, cb) {
    // check if builtin elevated command
    if (this.builtin.hasOwnProperty(verb))
        return cb(null, this.builtin[verb]);
    // otherwise check if learned command
    this.db.get("SELECT * FROM command WHERE verb = ?", verb, function (err, row) {
        if (err || typeof row === 'undefined') return cb("Command not found.");
        return cb(null, row);
    });
};

/* Parse then execute if the message is a command.
 * @user            : username sending the command
 * @message         : message being sent
 * @cb(reply, [pm]) : callback
 *      reply : reply message
 *      pm    : true forces any reply as a pm to the sender
 */
Commands.prototype.parse = function (user, message, cb) {
    if (message.length <= 1) return;
    if (message.length >= 1 && message[1] === ' ') return;
    var type = message[0];
    if (type !== "!" && type !== "?") return;

    // log the requested command
    console.log('(' + user + '): ' + message);

    var _self   = this;
    var command = message.match(/"[^"]+"|[\w]+/g);
    var verb    = command[0];
    var args    = command.slice(1);

    _self.getVerb(verb, function (err, cmd) {

        if (err) return cb(err, true);
        cmd.args = args;
        cmd.user = user;
        cmd.config = _self.config;

        // pass cmd object instead?
        _self.isPermitted(cmd.user, cmd.permit, function (permitted) {

            if (!permitted) return cb("You are not permitted to perform this command.", true);

            if (type === "?") {
                return cb(cmd.help + "\n\t" + cmd.syntax, true);
            }

            if (type === "!") {
                if (cmd.args.length < cmd.params) {
                    return cb("Incorrect number of required parameters:\n" + cmd.syntax, true);
                }

                // if call, perform call, then / or dispatch
                if (typeof cmd.call !== 'undefined') {
                    _self.calls[cmd.call].call(_self, cmd, function (err, vars, pmforce) {
                        if (err) return cb(err, true);
                        cmd.args = vars;
                        _self.dispatch(cmd, function (response, pm) {
                            pm = (pmforce) ? pmforce : pm;
                            return cb(response, pm);
                        });
                    });
                } else {
                    _self.dispatch(cmd, function (response, pm) {
                        return cb(response, pm);
                    });
                }
            }
        });
    });
};

module.exports = Commands;
