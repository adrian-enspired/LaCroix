module.exports = {

    // active operators {}
    ddg : function (cmd, arg) {
        return "http://duckduckgo.com/?q=" + encodeURIComponent(arg);
    },
    lmddgtfy : function (cmd, arg) {
        return "http://lmddgtfy.net/?q=" + encodeURIComponent(arg);
    },

    // passive operators []
    me : function (cmd) {
        return cmd.sender;
    },
    bot : function (cmd) {
        return this.bot;
    },
};
