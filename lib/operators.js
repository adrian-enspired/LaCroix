module.exports = {

    // active operators {}
    ddg : function (arg) {
        return "http://duckduckgo.com/?q=" + arg.replace(" ", "%20"); 
    },

    // passive operators []
    me : function () {
        return this.sender;
    },
    bot : function () {
        return this.bot;
    },
};
