var mail = require('nodemailer').createTransport();
var sql  = require('sqlite3');
var Irc  = require('irc');

module.exports = Resource = function () {

    this.ROLES = {
        master  : 2,
        teacher : 1,
    };

    this.operator = require('../ext/operators.js');
    this.template = require('../ext/template.json');
    this.config   = require('../config.json');

    this.config.master = this.config.master || process.env.IRC_MASTER;
    this.config.nick   = this.config.nick   || process.env.IRC_NICK;
    this.config.server = this.config.server || process.env.IRC_SERVER;
    if (this.config.channel.length < 1) this.config.channel[0] = process.env.IRC_CHANNEL;

    console.log(this.config);

    this.db       = new sql.Database('./db.sqlite');
    this.irc      = new Irc.Client(this.config.server, this.config.nick, {
        channels: this.config.channel
    });
    this.bot      = this.config.nick;

    this.db.run("CREATE TABLE IF NOT EXISTS user (account TEXT UNIQUE NOT NULL, role TEXT NOT NULL)", (err) => {
        if (err === null && this.config.master.trim() !== "") {
            this.db.run("REPLACE INTO user (account, role) VALUES (?, ?)", this.config.master, "master");
        }
    });
    this.db.run("CREATE TABLE IF NOT EXISTS command (verb TEXT UNIQUE NOT NULL, public TEXT NOT NULL, help TEXT, syntax TEXT, permit STRING DEFAULT '*')");
    this.db.run("CREATE TABLE IF NOT EXISTS memo (tofrom TEXT UNIQUE NOT NULL, sender TEXT NOT NULL, recipient TEXT NOT NULL, message TEXT NOT NULL)");
    this.db.run("CREATE TABLE IF NOT EXISTS notify (name TEXT UNIQUE NOT NULL, email TEXT NOT NULL)");
    this.db.run("CREATE TABLE IF NOT EXISTS ban (host TEXT UNIQUE NOT NULL)");
};

/* Sends an email
 *
 * @to      : the address to send the email to
 * @from    : the reply address
 * @subject : the subject of the email
 * @text    : the body of the email
 * @cb      :
 *  err     : error message, null otherwise
 *  info    : success message
 */
Resource.prototype.email = function (to, from, subject, text, cb) {
    mail.sendMail({
       from    : from,
       to      : to,
       subject : subject,
       text    : text
    }, function (err, info) {
        if (err) return cb(err);
        return cb(null, "Mail sent sucessfully.");
    });
};

/* IRC whois lookup
 *
 * @nick    : the nick to perform a whois against
 * @cb      :
 *  account : the account name of the nick, false otherwise
 */
Resource.prototype.whois = function (nick, cb) {
    this.irc.whois(nick, (info) => {
        return (typeof info.account === 'undefined') ?
            cb(false) :
            cb(info.account);
    });
};
