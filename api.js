const { BASE_URL, BOT_HEADER_TOKEN } = process.env;

const axios = require('axios');

class ApiService {
    static service = null;

    static get() {
        if(!ApiService.service) {
            new ApiService()
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
        this.jwtTokens = {};
        ApiService.service = this;
    }

    async registerUser(username) {
        try {
            const response = await this.api.post('/auth/register', { username });
            const { id, token } = response.data;
            this.jwtTokens[id] = token;
            return response;
        } catch (error) {
            console.error('Error registering user:', error.message);
            throw error;
        }
    }
    getActionPath() {
        return '/whatever'; // TODO
    }
    async performAction(id, action, data) {
        try {
            const token = this.jwtTokens[id];
            if (!token) {
                throw new Error(`No token found for bot with ID: ${id}`);
            }
            const actionPath = ApiService.getActionPath(action);
            const response = await this.api.post(
                actionPath,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        BotToken: BOT_HEADER_TOKEN
                    },
                }
            );
            return response;
        } catch (error) {
            console.error(`Error performing action for bot ID ${id}:`, error.message);
            throw error;
        }
    }
}

module.exports = ApiService;
