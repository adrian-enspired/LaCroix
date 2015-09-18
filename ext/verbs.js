/*
 * User and autocommands. The name of the function must match a verb from
 * template.json. Resources (db, email, irc) are passed as the keyword 'this',
 * the command object is passed as a parameter.
 *
 * @cmd  : the command object
 * cb    :
 *  err  : null, or error
 *  vars : a response object account|#channel|broadcast : message
 */
var verbs  = {};
verbs.user = {

    // Add, edit, remove a user permission
    // !user <account> master|teacher|none
    user : function (cmd, cb) {
        var name = cmd.args[0];
        var role = cmd.args[1];
            if (name === this.config.master)
                return cb(null, {
                    [cmd.sender] : "The hardcoded admin may not be changed."
                });
            if (role !== "none") {
                if (!this.ROLES.hasOwnProperty(role))
                    return cb(null, {
                        [cmd.sender] : "Role does not exist."
                    });
                    this.db.run("REPLACE INTO user (account, role) VALUES (?, ?)", name, role, (err) => {
                        if (err) return cb(err, {
                            [cmd.sender] : "Error performing command."
                        });
                        return cb(null, {
                            [cmd.sender] : name + " is now a " + role,
                            [name]       : "You are now a " + role
                        });
                    });
            } else {
                this.db.run("DELETE FROM user WHERE account = ?", name, (err) => {
                    if (err) return cb("Error performing command.");
                    return cb(null, {
                        [cmd.sender] : name + " is now a regular user"
                    });
                });
            }
    },

    // List all users of a role
    // !role master|teacher
    role : function (cmd, cb) {
        if (!this.ROLES.hasOwnProperty(cmd.args[0]))
            return cb(null, {
                [cmd.sender] : "Invalid role."
            });
        var role = [];
        this.db.all("SELECT account FROM user WHERE role = ?", cmd.args[0], (err, rows) => {
            if (err) return cb(err, {
                [cmd.sender] : "Error performing command."
            });
            for (var i in rows) { role.push(rows[i].account); }
            return cb(null, {
                [cmd.sender] : cmd.args[0] + "s: " + role.join(", ")
            });
        });
    },

    // Teaches the bot a new command
    // !teach <verb> "reply {w/ functions}" <params> [help] [syntax]
    teach : function (cmd, cb) {
        console.log(cmd);
        //TODO: CHECK FOR INVALID operators
        var verb   = cmd.args[0];
        var reply  = cmd.args[1];
        var help   = cmd.args[2] || "";
        var syntax = cmd.args[3] || "";
        // no name sharing with builtin commands
        if (this.template.user.hasOwnProperty(verb))
            return cb(null, {
                [cmd.sender] : "Cannot override builtin command."
            });
        this.db.run("INSERT INTO command (verb, public, help, syntax) VALUES (?, ?, ?, ?)", verb, reply, help, syntax, (err) => {
            if (err) return cb(err, {
                [cmd.sender] : "Error teaching command."
            });
            return cb(null, {
                'broadcast' : "I have learned how to " + verb + "!"
            });
        });
    },

    // Removes a learned command
    // !forget <verb>
    forget : function (cmd, cb) {
        this.db.run("DELETE FROM command WHERE verb = ?", cmd.args[0], (err) => {
            if (err) return cb(err, {
                [cmd.sender] : "Error performing command."
            });
            return cb(null, {
                'broadcast' : "I swear to never " + cmd.args[0] + " again!"
            });
        });
    },

    // Lists available commands
    // !help
    help : function (cmd, cb) {
        var builtin = [];
        var learned = [];
        for (var verb in this.template.user) builtin.push(verb);
        this.db.each("SELECT verb FROM command", (err, row) => {
            learned.push(row.verb);
        }, () => {
            return cb(null, {
                [cmd.sender] : "The following commands are available to you:\nElevated Commands: " + builtin.join(", ") + "\nLearned Commands: " + learned.join(", ")
            });
        });
    },

    // Leaves a message for an offline user
    // !memo <user> <message>|none
    memo : function (cmd, cb) {
        var to  = cmd.args[0];
        var msg = cmd.args[1];
        if (msg !== "none") {
            this.db.run("REPLACE INTO memo (tofrom, sender, recipient, message) VALUES (?, ?, ?, ?)", to + cmd.sender, cmd.sender, to, msg, (err) => {
                if (err) return cb(err, {
                    [cmd.sender] : "Error performing command."
                });
                return cb(null, {
                    [cmd.sender] : "Memo for " + to + " added / updated."
                });
            });
        } else {
            this.db.run("DELETE FROM memo WHERE tofrom = ?", to + cmd.sender, (err) => {
                if (err) return cb(err, {
                    [cmd.sender] : "Error performing command."
                });
                return cb(null, {
                    [cmd.sender] : "Memo for " + to + " removed."
                });
            });
        }
    },

    // TODO: add email verification
    // Allows you to be notified by email
    // !notifyme <email>|none
    notifyme : function (cmd, cb) {
        if (cmd.args[0] !== "none")  {
            this.db.run("REPLACE INTO notify (name, email) VALUES (?, ?)", cmd.sender, cmd.args[0], (err) => {
                if (err) return cb(err, {
                    [cmd.sender] : "Error performing command."
                });
                return cb(null, {
                    [cmd.sender] : "You can now be notified by email."
                });
            });
        } else {
            this.db.run("DELETE FROM notify WHERE name = ?", cmd.sender, (err) => {
                if (err) return cb(err, {
                    [cmd.sender] : "Error performing command."
                    });
                return cb(null, {
                    [cmd.sender] : "You can no longer be notified by email."
                });
            });
        }
    },

    // change from nick to account
    // Pokes an offline user, sending them an email notification
    // !poke <user> [message]
    poke : function (cmd, cb) {
        var message = (cmd.args.length === 1) ?
                      "User " + cmd.sender + " has poked you." :
                      cmd.sender + ": " + cmd.args[1];
        this.db.get("SELECT * FROM notify WHERE name = ?", cmd.args[0], (err, row) => {
            if (err) return cb(err, {
                [cmd.sender] : "Error performing command."
            });
            if (typeof row === 'undefined') return cb(null, {
                [cmd.sender] : "User has not allowed notification by email."
            });
            this.email(row.email, "notifyme@donotreply.com", "Notification from " + this.bot, message, (err, response) => {
                if (err) return cb(err, {
                    [cmd.sender]: "Error sending email."
                });
                return cb(null, {
                    [cmd.sender] : "Notification sent sucessfully."
                });
            });
        });
    },
};
verbs.auto = {

    linkinfo: function (cmd, cb) {
        console.log(cmd.match);
    },

    fetchmemo: function (cmd, cb) {
        this.db.all("SELECT * FROM memo WHERE recipient = ?", cmd.sender, (err, rows) => {
            if (err) return cb(err);
            if (rows.length === 0) return;
            cb(null, {
                [cmd.recipient] : cmd.sender + ": Messages have been left for you while you were offline, they have been PM'd to you."
            });
            for (var i in rows) {
                cb(null, { [cmd.sender]: rows[i].sender + ": " + rows[i].message });
            }
            this.db.run("DELETE FROM memo WHERE recipient = ?", cmd.sender, (err) => { if (err) return cb(err); });
        });
    },
};

module.exports = verbs;
