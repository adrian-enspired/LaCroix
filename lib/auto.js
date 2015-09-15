// cherrio and request are serious overkill
var cheerio = require('cheerio');
var request = require('request');

module.exports = {

    // linkinfo
    linkinfo : function (cmd, cb) {
        request(cmd.match, function (err, res, body) {
            if (err) return cb(err);
            //var type = res.headers['content-type'].split("/")[0].toUpperCase();
            if (typeof body !== 'undefined') {
                var $ = cheerio.load(body);
                var title = $('title').text();
                if (title.trim() !== '') {
                    return cb(null, {
                        'action': [$('title').text()]
                    });
                }
            }
        });
    },

    // memo
    fetchmemo : function (cmd, cb) {
        var _self = this;
        _self.db.all("SELECT * FROM memo WHERE recipient = ?", cmd.sender, function (err, rows) {
            if (err) return cb(err);
            if (rows.length === 0) return;
            cb(null, {
                'action'  : [],
            });
            for (var i in rows) {
                cb(null, { 'private' : [ "Message from " + rows[i].sender + ": " + rows[i].message ] });
            }
            // delete the messages after notification
            _self.db.run("DELETE FROM memo WHERE recipient = ?", cmd.sender, function (err) { if (err) return cb(err); });
        });
    },
};