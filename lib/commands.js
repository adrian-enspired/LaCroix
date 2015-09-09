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
    _self.db.run("CREATE TABLE IF NOT EXISTS command (verb TEXT UNIQUE NOT NULL, reply TEXT NOT NULL, help TEXT, syntax TEXT, permit STRING DEFAULT '*')");

    // Add, edit, remove a user permission
    // !user <name> master|teacher|ban|none
    _self.user = function (cmd, cb) {
        var name = cmd.args[0];
        var role = cmd.args[1];
        if (role !== "none") {
            if (!_self.roles.hasOwnProperty(role))
                return cb("Role does not exist.");
            _self.db.run("REPLACE INTO user (name, role) VALUES (?, ?)", name, role, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ name, "added / changed" ]);
            });
        } else {
            _self.db.run("DELETE FROM user WHERE name = ?", name, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ name, "removed" ]);
            });
        }
    };

    // List all users of a role
    // !role master|teacher|ban
    _self.role = function (cmd, cb) {
        if (!_self.roles.hasOwnProperty(cmd.args[0])) return cb("Invalid role.");
        var role = (cmd.args[0] === "master") ? [ config.master ] : [];
        _self.db.all("SELECT name FROM user WHERE role = ?", cmd.args[0], function (err, rows) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            for (var i in rows) { role.push(rows[i].name); }
            //return cb(params[0] + "s: " + role.join(", "));
            return cb(null, [ cmd.args[0], role.join(", ") ]);
        });
    };

    // Teaches the bot a new command
    // !teach <verb> "reply {w/ functions}" <params> [help] [syntax]
    _self.teach = function (cmd, cb) {
        var verb   = cmd.args[0];
        var reply  = cmd.args[1];
        var help   = cmd.args[2] || "";
        var syntax = cmd.args[3] || "";
        // no name sharing with builtin commands
        if (_self.builtin.hasOwnProperty(verb))
            return cb("Cannot override builtin command.", true);
        _self.db.run("INSERT INTO command (verb, reply, help, syntax) VALUES (?, ?, ?, ?)", verb, reply, help, syntax, function (err) {
            if (err) {
                console.error(err);
                return cb("Error teaching command.");
            }
            return cb(null, [ verb ]);
        });
    };

    // Removes a learned command
    // !forget <verb>
    _self.forget = function (cmd, cb) {
        _self.db.run("DELETE FROM command WHERE verb = ?", cmd.args[0], function (err) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            return cb(null, [ cmd.args[0] ]);
        });
    };

    // Lists available commands
    // !help
    _self.help = function (cmd, cb) {
        var builtin = [];
        var learned = [];
        _self.db.get("SELECT role FROM user WHERE name = ?", cmd.user, function (err, row) {
            var userlvl = (typeof row !== 'undefined') ?
                 _self.roles[row.role] : 0;
            userlvl = (cmd.user === _self.config.master) ?
                _self.roles.master : userlvl;
            for (var verb in _self.builtin) {
                var rolelvl = (_self.builtin[verb].permit === "*") ?
                    0 : _self.roles[_self.builtin[verb].permit];
                console.log(verb + " " + userlvl + ">=" + rolelvl + " = " + (userlvl >= rolelvl));
                if (userlvl >= rolelvl) builtin.push(verb);
            }
            _self.db.each("SELECT verb FROM command", function (err, row) {
                learned.push(row.verb); 
            }, function () {
                return cb(null, [ builtin.join(", "), learned.join(", ") ]);
            });
        });
    };

    // change to prototype
    _self.dispatch = function (reply, params, cb) {
        // next unused parameter is user to pm?
        // detech operator in match and call
        var matches = reply.match(/\{.*?\}/g);
        if (params.length < matches.length) return cb("Incorrect number of required parameters.");
        for (var i in matches) {
            reply = reply.replace(/\{.*?\}/, params[i]);
        }
        return cb(reply.replace(/"/g, "")); // remove quotes when getting command instead
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

/* Check if a verb exists and return the command object
 * @verb          : the verb to check for
 * cb(error, cmd) :
 *      error     : error, null otherwise
 *      cmd       : the command template object
 */
Commands.prototype.getVerb = function (verb, cb) {
    var _self = this;
    // check if builtin elevated command
    if (_self.builtin.hasOwnProperty(verb))
        return cb(null, _self.builtin[verb]);
    // otherwise check if learned command
    _self.db.get("SELECT * FROM command WHERE verb = ?", verb, function (err, row) {
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
                    _self[cmd.call](cmd, function (err, vars) {
                        if (err) return cb(err, true);
                        _self.dispatch(cmd.reply, vars, function (response, pm) {
                            return cb(response, pm);
                        });
                    });
                } else {
                    _self.dispatch(cmd.reply, cmd.args, function (response, pm) {
                        return cb(response, pm);     
                    });
                }
            }
        });
    });
};

module.exports = Commands;
