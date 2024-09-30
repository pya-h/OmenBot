const apiService = require('./api');

class Bot {
    constructor({id, username, email, password, levelId, avatarId, jwtToken} = {}) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.email = email;
        this.levelId = levelId;
        this.jwtToken = jwtToken;
        this.avatarId = avatarId;
    }

    static findBots() {
        // this should send a req to server to find users whith their user.isBot=true, with a special token is req header.

    }

    getIn() {
        
    }
}

module.exports = Bot