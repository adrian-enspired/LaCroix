/*
 * Builtin function calls
 * @cmd           : the command template object
 * @cb(err, vars) :
 *      err       : null, or error
 *      vars      : array of variables to match to the command template vars
 */
module.exports = {

    // Add, edit, remove a user permission
    // !user <name> master|teacher|ban|none
    user : function (cmd, cb) {
        var name = cmd.args[0];
        var role = cmd.args[1];
        if (role !== "none") {
            if (!this.roles.hasOwnProperty(role))
                return cb("Role does not exist.");
            this.db.run("REPLACE INTO user (name, role) VALUES (?, ?)", name, role, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ name, "is now a " + role ]);
            });
        } else {
            this.db.run("DELETE FROM user WHERE name = ?", name, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ name, "is now a regular user" ]);
            });
        }
    },

    // List all users of a role
    // !role master|teacher|ban
    role : function (cmd, cb) {
        if (!this.roles.hasOwnProperty(cmd.args[0])) return cb("Invalid role.");
        var role = (cmd.args[0] === "master") ? [ this.config.master ] : [];
        this.db.all("SELECT name FROM user WHERE role = ?", cmd.args[0], function (err, rows) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            for (var i in rows) { role.push(rows[i].name); }
            return cb(null, [ cmd.args[0], role.join(", ") ]);
        });
    },

    // Teaches the bot a new command
    // !teach <verb> "reply {w/ functions}" <params> [help] [syntax]
    teach : function (cmd, cb) {
        //TODO: CHECK FOR INVALID operators
        var verb   = cmd.args[0];
        var reply  = cmd.args[1];
        var help   = cmd.args[2] || "";
        var syntax = cmd.args[3] || "";
        // no name sharing with builtin commands
        if (this.t_calls.hasOwnProperty(verb))
            return cb("Cannot override builtin command.", true);
        this.db.run("INSERT INTO command (verb, reply, help, syntax) VALUES (?, ?, ?, ?)", verb, reply, help, syntax, function (err) {
            if (err) {
                console.error(err);
                return cb("Error teaching command.");
            }
            return cb(null, [ verb ]);
        });
    },

    // Removes a learned command
    // !forget <verb>
    forget : function (cmd, cb) {
        this.db.run("DELETE FROM command WHERE verb = ?", cmd.args[0], function (err) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            return cb(null, [ cmd.args[0] ]);
        });
    },

    // Lists available commands
    // !help
    help : function (cmd, cb) {
        var _self = this;
        var builtin = [];
        var learned = [];
        _self.db.get("SELECT role FROM user WHERE name = ?", cmd.user, function (err, row) {
            var userlvl = (typeof row !== 'undefined') ?
                 _self.roles[row.role] : 0;
            userlvl = (cmd.sender === _self.config.master) ?
                _self.roles.master : userlvl;
            for (var verb in _self.t_calls) {
                var rolelvl = (_self.t_calls[verb].permit === "*") ?
                    0 : _self.roles[_self.t_calls[verb].permit];
                if (userlvl >= rolelvl) builtin.push(verb);
            }
            _self.db.each("SELECT verb FROM command", function (err, row) {
                learned.push(row.verb);
            }, function () {
                return cb(null, [ builtin.join(", "), learned.join(", ") ]);
            });
        });
    },

    // Leaves a message for an offline user
    // !memo <user> <message>|none
    // TODO: Add timestamp to the memo's
    memo : function (cmd, cb) {
        var to  = cmd.args[0];
        var msg = cmd.args[1];
        if (msg !== "none") {
            this.db.run("REPLACE INTO memo (recipient, sender, message) VALUES (?, ?, ?)", to, cmd.sender, msg, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ "added / updated", to ]);
            });
        } else {
            this.db.run("DELETE FROM memo WHERE recipient = ? AND sender = ?", to, cmd.sender, function (err) {
                if (err) {
                    console.error(err);
                    return cb("Error performing command.");
                }
                return cb(null, [ "removed", to ]);
            });
        }
    },
};
