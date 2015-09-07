var sql = require('sqlite3');

var ROLE = {
    master  : 2,
    teacher : 1,
    ban     : 0
};

var Commands = function (path) {
    this.db = new sql.Database(path);

    this.db.run("CREATE TABLE IF NOT EXISTS user (name TEXT UNIQUE NOT NULL, role TEXT NOT NULL)");
    // create commands table
};

// Add, edit, remove a user permission
// !user <name> master|teacher|ban|none
Commands.prototype.user = function (params, cb) {
    var name = params[0];
    var role = params[1];
    if (role !== "none") {
        if (!ROLE.hasOwnProperty(role)) return cb("Error: role does not exist.");
        this.db.run("REPLACE INTO user (name, role) VALUES (?, ?)", name, role, function (err) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            return cb("User added / changed sucessfully.");
        });
    } else {
        this.db.run("DELETE FROM user WHERE name = ?", name, function (err) {
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
Commands.prototype.role = function (params, cb) {
    var role = [];
    this.db.all("SELECT name FROM user WHERE role = ?", params[0], function (err, rows) {
        if (err) {
            console.error(err);
            return cb("Error performing command.");
        }
        for (var i in rows) { role.push(rows[i].name); }
        return cb(params[0] + ": " + role.join(", "));
    });
};

module.exports = Commands;
