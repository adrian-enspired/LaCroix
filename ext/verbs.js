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
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "The hardcoded admin may not be changed." }
                ]);
            if (role !== "none") {
                if (!this.ROLES.hasOwnProperty(role))
                    return cb(null, [
                        { recipient : cmd.sender,
                          message   : "Role does not exist." }
                    ]);
                    this.db.run("REPLACE INTO user (account, role) VALUES (?, ?)", name, role, (err) => {
                        if (err) return cb(err, [
                            { recipient : cmd.sender,
                              message   : "Error performing command." }
                        ]);
                        return cb(null, [
                            { recipient : cmd.sender,
                              message   : name + " is now a " + role },
                            { recipient : name,
                              message   : "You are now a " + role }
                        ]);
                    });
            } else {
                this.db.run("DELETE FROM user WHERE account = ?", name, (err) => {
                    if (err) return cb(err, [
                        { recipient : cmd.sender,
                          message   : "Error performing command." }
                    ]);
                    return cb(null, [
                        { recipient : cmd.sender,
                          message   : name + " is now a regular user" }
                    ]);
                });
            }
    },

    // TODO: List all users, don't specify role
    // List all users of a role
    // !users master|teacher
    users : function (cmd, cb) {
        if (!this.ROLES.hasOwnProperty(cmd.args[0]))
            return cb(null, [
                { recipient : cmd.sender,
                  message   : "Invalid role." }
            ]);
        var role = [];
        this.db.all("SELECT account FROM user WHERE role = ?", cmd.args[0], (err, rows) => {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error performing command." }
            ]);
            for (var i in rows) { role.push(rows[i].account); }
            return cb(null, [
                { recipient : cmd.sender,
                  message   : cmd.args[0] + "s: " + role.join(", ") }
            ]);
        });
    },

    // Ban a user by ip
    // !ban <host>
    ban : function (cmd, cb) {
        var host = cmd.args[0];
        this.db.run("REPLACE INTO ban (host) VALUES (?)", host, (err) => {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error performing command." }
            ]);
            return cb(null, [
                { recipient : cmd.sender,
                  message   : host + " is now banned from all commands." }
            ]);
        });
    },

    // Unban's a user by ip
    // !unban <host>
    unban : function (cmd, cb) {
        var host = cmd.args[0];
        this.db.run("DELETE FROM ban WHERE host = ?", host, (err) =>  {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error performing command." }
            ]);
            return cb(null, [
                { recipient : cmd.sender,
                  message   : host + " is now unbanned" }
            ]);
        });
    },

    // Lists all banned hosts
    // !bans
    bans : function (cmd, cb) {
        var hosts = [];
        this.db.each("SELECT * FROM ban", (err, row) => {
            hosts.push(row.host);
        }, () => {
            return cb(null,  [
                { recipient : cmd.sender,
                  message   : "Hosts: " + hosts.join(", ") }
            ]);
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
        if (this.template.user.hasOwnProperty(verb))
            return cb(null, [
                { recipient : cmd.sender,
                  message   : "Cannot override builtin command." }
            ]);
        this.db.run("INSERT INTO command (verb, public, help, syntax) VALUES (?, ?, ?, ?)", verb, reply, help, syntax, (err) => {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error teaching command, or command already exists." }
            ]);
            return cb(null, [
                { recipient : 'broadcast',
                  message   : "I have learned how to " + verb + "!" }
            ]);
        });
    },

    // Removes a learned command
    // !forget <verb>
    forget : function (cmd, cb) {
        this.db.run("DELETE FROM command WHERE verb = ?", cmd.args[0], (err) => {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error performing command." }
            ]);
            return cb(null, [
                { recipient : 'broadcast',
                  message   : "I swear to never " + cmd.args[0] + " again!" }
            ]);
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
            return cb(null, [
                { recipient : cmd.sender,
                  message   : "The following commands are available:\nType ?<command> to get help and syntax information about that command.\n\tElevated Commands: " + builtin.join(", ") + "\n\tLearned Commands: " + learned.join(", ") + "\nConsult https://github.com/shizy/LaCroix for more information." }
            ]);
        });
    },

    // TODO: expand to include help text for each operator, seperate by type!
    // Lists all available operators
    // !operators
    operators : function (cmd, cb) {
        return cb(null, [
            { recipient : cmd.sender,
              message   : "Operators: " + Object.keys(this.operator).join(", ") }
        ]);
    },

    // Leaves a message for an offline user
    // !memo <user> <message>|none
    memo : function (cmd, cb) {
        var to  = cmd.args[0];
        var msg = cmd.args[1];
        if (msg !== "none") {
            this.db.run("REPLACE INTO memo (tofrom, sender, recipient, message) VALUES (?, ?, ?, ?)", to + cmd.sender, cmd.sender, to, msg, (err) => {
                if (err) return cb(err, [
                    { recipient : cmd.sender,
                      message   : "Error performing command." }
                ]);
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "Memo for " + to + " added / updated." }
                ]);
            });
        } else {
            this.db.run("DELETE FROM memo WHERE tofrom = ?", to + cmd.sender, (err) => {
                if (err) return cb(err, [
                    { recipient : cmd.sender,
                      message   : "Error performing command." }
                ]);
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "Memo for " + to + " removed." }
                ]);
            });
        }
    },

    // TODO: add email verification
    // Allows you to be notified by email
    // !notifyme <email>|none
    notifyme : function (cmd, cb) {
        if (cmd.args[0] !== "none")  {
            this.db.run("REPLACE INTO notify (name, email) VALUES (?, ?)", cmd.sender, cmd.args[0], (err) => {
                if (err) return cb(err, [
                    { recipient : cmd.sender,
                      message   : "Error performing command." }
                ]);
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "You can now be notified by email." }
                ]);
            });
        } else {
            this.db.run("DELETE FROM notify WHERE name = ?", cmd.sender, (err) => {
                if (err) return cb(err, [
                    { recipient : cmd.sender,
                      message   : "Error performing command." }
                ]);
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "You can no longer be notified by email." }
                ]);
            });
        }
    },

    // Notifies an offline user, sending them an email notification
    // !notify <user> [message]
    notify : function (cmd, cb) {
        var message = (cmd.args.length === 1) ?
                      "User " + cmd.sender + " has poked you." :
                      cmd.sender + ": " + cmd.args[1];
        this.db.get("SELECT * FROM notify WHERE name = ?", cmd.args[0], (err, row) => {
            if (err) return cb(err, [
                { recipient : cmd.sender,
                  message   : "Error performing command." }
            ]);
            if (typeof row === 'undefined') return cb(null, [
                { recipient : cmd.sender,
                  message   : "User has not allowed notification by email." }
            ]);
            this.email(row.email, "notifyme@donotreply.com", "Notification from " + this.bot, message, (err, response) => {
                if (err) return cb(err, [
                    { recipient : cmd.sender,
                      message   : "Error performing command." }
                ]);
                return cb(null, [
                    { recipient : cmd.sender,
                      message   : "Notification sent sucessfully." }
                ]);
            });
        });
    },

    // Lists all notifiable users
    // !notifiable
    notifiable : function (cmd, cb) {
        var users = [];
        this.db.each("SELECT * FROM notify", (err, row) => {
            users.push(row.name);
        }, () => {
            return cb(null,  [
                { recipient : cmd.sender,
                  message   : "Notifiable Users: " + users.join(", ") }
            ]);
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
            cb(null, [
                { recipient : cmd.recipient,
                  message   : cmd.sender + ": Messages have been left for you while you were offline, they have been PM'd to you." }
            ]);
            for (var i in rows) {
                cb(null, [
                    { recipient : cmd.sender,
                      message   : rows[i].sender + ": " + rows[i].message }
                ]);
            }
            this.db.run("DELETE FROM memo WHERE recipient = ?", cmd.sender, (err) => { if (err) return cb(err); });
        });
    },
};

module.exports = verbs;
