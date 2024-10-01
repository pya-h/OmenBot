const { BASE_URL, BOT_HEADER_TOKEN } = process.env;

const axios = require('axios');

class ApiService {
    static service = null;

    static get() {
        if(!ApiService.service) {
            return new ApiService()
        }
        return ApiService.service;
    }
    constructor() {
        if(ApiService.service)
            return ApiService.service;
        const { BASE_URL } = process.env;
        this.api = axios.create({
            baseURL: BASE_URL,
            timeout: 10000, 
        });
        this.baseURL = BASE_URL;
        ApiService.service = this;
    }

    async login({username, password}) {
        try {
            return this.api.post('/auth/login', { username, password }, {
                headers: this.getHeader()
            });
        } catch (error) {
            console.error('Error registering user:', error.message);
            return {status: 500};
        }
    }

    async register({username, password, email}) {
        try {
            return this.api.post('/auth/register', { username, email, password, verificationCode: '12345' }, {
                headers: this.getHeader()
            });
        } catch (error) {
            console.error('Error registering user:', error.message);
            return {status: 500};
        }
    }

    getHeader(jwtToken = null) {
        return {
            BotToken: BOT_HEADER_TOKEN,
            ...(jwtToken ? {Authorization: `Bearer ${jwtToken}`} : {}),
        }
    }

    async performAction(bot, action) {
        try {
            if (!bot.accessToken) {
                throw new Error(`No token found for bot with ID: ${bot.id}, username: ${bot.username}`);
            }

            const response = await this.api.request({
                method: action.methodType,
                url: action.path,
                data: action.data,
                headers: this.getHeader(bot.accessToken),
            });
            return response;
        } catch (error) {
            console.error(`Error performing action for bot ID ${id}:`, error.message);
            return {status: 500};
        }
    }
}

module.exports = ApiService;
