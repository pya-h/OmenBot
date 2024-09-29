const { BASE_URL } = process.env;

const axios = require('axios');

class BotService {
    constructor(baseURL) {
        this.api = axios.create({
            baseURL,
            timeout: 10000,
        });
        this.jwtTokens = {};
    }

    async registerUser(username) {
        try {
            const response = await this.api.post('/register', { username });
            const { id, token } = response.data;
            this.jwtTokens[id] = token;
            return response.data;
        } catch (error) {
            console.error('Error registering user:', error.message);
            throw error;
        }
    }

    async performAction(id, action, data) {
        try {
            const token = this.jwtTokens[id];
            if (!token) {
                throw new Error(`No token found for bot with ID: ${id}`);
            }

            const response = await this.api.post(
                `/action/${action}`,
                data,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
            return response.data;
        } catch (error) {
            console.error(`Error performing action for bot ID ${id}:`, error.message);
            throw error;
        }
    }
}

module.exports = BotService;
