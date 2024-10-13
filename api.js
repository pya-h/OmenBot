import axios from "axios";

export default class ApiService {
    static service = null;

    static Get() {
        if (!ApiService.service) {
            return new ApiService();
        }
        return ApiService.service;
    }
    constructor() {
        if (ApiService.service) return ApiService.service;
        const { BASE_URL, BOT_HEADER_TOKEN } = process.env;
        this.api = axios.create({
            baseURL: BASE_URL,
            timeout: 10000,
        });
        this.baseURL = BASE_URL;
        this.botHeaderToken = BOT_HEADER_TOKEN;
        ApiService.service = this;
    }

    async login({ username, password }) {
        try {
            return this.api.post(
                "/auth/login",
                { username, password },
                {
                    headers: this.getHeader(),
                }
            );
        } catch (error) {
            console.error(
                "Error bot login {username:",
                username,
                "}: ",
                error.message
            );
            return { status: 500 };
        }
    }

    async get(url, bot = null) {
        return this.api.get(url, { headers: this.getHeader(bot?.accessToken) });
    }

    async register({ username, password, email }) {
        try {
            return this.api.post(
                "/auth/register",
                { username, email, password, verificationCode: "12345" }, // FIXME: Register only works for staging server.
                {
                    headers: this.getHeader(),
                }
            );
        } catch (error) {
            console.error(
                `Error registering bot {username: ${username}, email: ${email}}:`,
                error.message
            );
            return { status: 500 };
        }
    }

    async import(bots) {
        if (!(bots instanceof Array))
            throw new Error(
                "Import payload format is invalid: Provide a List of {username, password, email, levelId, private"
            );
        const { ADMIN_ACCESS_TOKEN } = process.env;
        if (!ADMIN_ACCESS_TOKEN)
            throw new Error(
                "Importing bots requires admin privileges. Please provide admin access token first."
            );
        try {
            return this.api.post(
                "/user/import",
                { users: bots },
                {
                    headers: this.getHeader(ADMIN_ACCESS_TOKEN),
                }
            );
        } catch (error) {
            console.error("Error importing bots:", error.message);
            return { status: 500 };
        }
    }

    getHeader(jwtToken = null) {
        return {
            BotToken: this.botHeaderToken,
            ...(jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}),
        };
    }

    static QueryToString(queryList) {
        return (
            "?" +
            Object.entries(queryList)
                .map(([field, value]) => `${field}=${value}`)
                .join("&")
        );
    }

    async performAction(bot, action) {
        try {
            if (!bot.accessToken) {
                throw new Error(
                    `No token found for bot with ID: ${bot.id}, username: ${bot.username}`
                );
            }
            // TODO: Also join action.queries to url
            const response = await this.api.request({
                method: action.method,
                url:
                    action.path +
                    (action.queries?.length
                        ? ApiService.QueryToString(action.queries)
                        : ""),
                ...(action?.data ? { data: action.data } : {}),
                headers: this.getHeader(bot.accessToken),
            });

            if (response?.status === 401) {
                bot.accessToken = null;
                console.error(
                    new Date().toLocaleString(),
                    `Bot#${this.id} is logged out unexpectedly! But no worry app will force login all bots each hour.`
                );
            }
            return response;
        } catch (error) {
            console.error(
                `Error performing action for bot ID ${id}:`,
                error.message
            );
            return { status: 500 };
        }
    }
}
