module.exports = {

    // active operators {}
    ddg : function (cmd, arg) {
        return "http://duckduckgo.com/?q=" + arg.replace(" ", "%20");
    },

    // passive operators []
    me : function (cmd) {
        return cmd.sender;
    },
    bot : function (cmd) {
        return this.bot;
    },
};
