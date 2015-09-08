var sql = require('sqlite3');

var Commands = function (path) {
    var _self   = this;
    _self.db    = new sql.Database(path);
    _self.roles = {
        master  : 2,
        teacher : 1,
        ban     : 0
    };

    _self.db.run("CREATE TABLE IF NOT EXISTS user (name TEXT UNIQUE NOT NULL, role TEXT NOT NULL)");
    // create commands table too!!

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
        var role = [];
        _self.db.all("SELECT name FROM user WHERE role = ?", params[0], function (err, rows) {
            if (err) {
                console.error(err);
                return cb("Error performing command.");
            }
            for (var i in rows) { role.push(rows[i].name); }
            return cb(params[0] + ": " + role.join(", "));
        });
    };
};

/* Check if user is permitted based on the provided permission level
 * @name          : username to check
 * @level         : the permission level to check against
 * @cb(permitted) : callback
 *      permitted : true if the user is permitted, false otherwise
 */
Commands.prototype.isPermitted = function (name, level, cb) {
    var _self = this;
    _self.db.each("SELECT * FROM user WHERE name = ?", name, function (err, row) {
        // deny if user not found
        if (err || typeof row === 'undefined') return cb(false);
        // deny banned user
        if (_self.roles[row.role] === _self.roles.ban) return cb(false);
        // allow user if role is anyone
        if (level === "*") return cb(true);
        // allow only if user has permissions equal to or higher
        return cb((_self.roles[row.role] >= _self.roles[level]) ? true : false);
    });
};

module.exports = Commands;
