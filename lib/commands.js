var sql = require('sqlite3');

var Commands = function (path, config) {
    var _self     = this;
    _self.builtin = require('./commands.json');
    _self.db      = new sql.Database(path);
    _self.config  = config;
    _self.roles   = {
        master  : 2,
        teacher : 1,
        ban     : 0
    };

    _self.db.run("CREATE TABLE IF NOT EXISTS user (name TEXT UNIQUE NOT NULL, role TEXT NOT NULL)");
    _self.db.run("CREATE TABLE IF NOT EXISTS command (verb TEXT UNIQUE NOT NULL, reply TEXT NOT NULL, help TEXT, syntax TEXT)");

    // Add, edit, remove a user permission
    // !user <name> master|teacher|ban|none
    _self.user = function (params, cb) {
        var name = params[0];
        var role = params[1];
        if (role !== "none") {
            if (!_self.roles.hasOwnProperty(role)) return cb("Error: role does not exist.");
            _self.db.run("REPLACE INTO user (name, role) VALUES (?, ?)", name, role, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb("User added / changed sucessfully.");
            });
        } else {
            _self.db.run("DELETE FROM user WHERE name = ?", name, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb("User removed sucessfully.");
            });
        }
    };

    // List all users of a role
    // !role master|teacher|ban
    _self.role = function (params, cb) {
        if (!_self.roles.hasOwnProperty(params[0])) return cb("Invalid role.");
        var role = (params[0] === "master") ? [ config.master ] : [];
        _self.db.all("SELECT name FROM user WHERE role = ?", params[0], function (err, rows) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            for (var i in rows) { role.push(rows[i].name); }
            return cb(params[0] + "s: " + role.join(", "));
        });
    };

    // Teaches the bot a new command
    // !teach <verb> "reply {w/ functions}" <params> [help] [syntax]
    _self.teach = function (params, cb) {
        var verb   = params[0];
        var reply  = params[1];
        var help   = params[2] || "";
        var syntax = params[3] || "";
        // no name sharing with builtin commands
        if (_self.builtin.hasOwnProperty(verb)) return cb("Cannot override builtin command.", true);
        _self.db.run("INSERT INTO command (verb, reply, help, syntax) VALUES (?, ?, ?, ?)", verb, reply, help, syntax, function (err) {
            if (err) {
                console.error(err);
                return cb("Error teaching command.");
            }
            return cb("Command learned sucessfully.");
        });
    };

    // Removes a learned command
    // !forget <verb>
    _self.forget = function (params, cb) {
        _self.db.run("DELETE FROM command WHERE verb = ?", params[0], function (err) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            return cb("Command forgotten sucessfully.");
        });
    };

    // Lists available commands
    // !help
    _self.help = function (params, cb) {
        // fix to only add commands that the userlevel has available to them
        var elevated = "Builtin commands: " + Object.keys(_self.builtin) + "\n";
        var list = [];
        _self.db.all("SELECT verb FROM command", function (err, rows) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            for (var i in rows) { list.push(rows[i].verb); }
            return cb("The following commands are available. Type ?<command> to get help for a particular command:\n" + elevated + "Learned commands: " + list.join(","), true);
        });
    };

    _self.say = function (params, cb) {
        // next unused parameter is user to pm?
        // detech operator in match and call
        var message = params[0];
        var matches = message.match(/\{.*?\}/g);
        params = params.slice(1);
        if (params.length < matches.length) return cb("Incorrect number of required parameters.");
        for (var i in matches) {
            message = message.replace(/\{.*?\}/, params[i]);
        }
        return cb(message.replace(/"/g, "")); // remove quotes when getting command instead
    };
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
            // allow only if user has permissions equal to or higher
            return cb((_self.roles[row.role] >= _self.roles[level]) ? true : false);
        }
    });
};

/* Check if a verb exists as builtin or learned
 * @verb                  : the verb to check for
 * @params                : the parameters provided by the user
 * cb(error, cmd, params) :
 *      error             : error, null otherwise
 *      cmd               : the command template object
 *      params            : the parameters for the command
 */
Commands.prototype.getVerb = function (verb, params, cb) {
    var _self = this;
    // check if builtin elevated command
    if (_self.builtin.hasOwnProperty(verb))
        return cb(null, _self.builtin[verb], params);
    // otherwise check if learned command
    _self.db.get("SELECT * FROM command WHERE verb = ?", verb, function (err, row) {
        if (err || typeof row === 'undefined')
            return cb("Command not found.");
        row.call = "say"; // all learned commands filter through the say operator
        row.permit = "*"; // all learned commands are accessible to anyone
        params.unshift(row.reply);
        return cb(null, row, params);
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
    var type = message[0];
    if (type !== "!" && type !== "?") return;

    // log the requested command
    console.log('(' + user + '): ' + message);

    var _self   = this;
    var command = message.match(/"[^"]+"|[\w]+/g);
    var verb    = command[0];
    var params  = command.slice(1);

    _self.getVerb(verb, params, function (err, cmd, params) {

        if (err) return cb(err, true);

        _self.isPermitted(user, cmd.permit, function (permitted) {

            if (!permitted) return cb("You are not permitted to perform this command.", true);

            if (type === "?") {
                return cb(cmd.help + "\n\t" + cmd.syntax, true);
            }

            if (type === "!") {
                if (params.length < cmd.params) {
                    return cb("Incorrect number of required parameters:\n" + cmd.syntax, true);
                }

                _self[cmd.call](params, function (reply, pm) {
                    return cb(reply, pm);
                });
            }
        });
    });
};

module.exports = Commands;
