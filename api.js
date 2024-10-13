import axios from "axios";
import BotConfig from "./config.js";

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
        
        this.baseURL = BotConfig.Get().baseURL;
        this.api = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
        });
        ApiService.service = this;
    }

    async login({ username, password }) {
        return this.api.post(
            "/auth/login",
            { username, password },
            {
                headers: this.getHeader(),
            }
        );
    }

    async get(url, bot = null) {
        return this.api.get(url, { headers: this.getHeader(bot?.accessToken) });
    }

    async register({ username, password, email }) {
        return this.api.post(
            "/auth/register",
            { username, email, password, verificationCode: "12345", referralCode: "" }, // FIXME: Register only works for staging server.
            {
                headers: this.getHeader(),
            }
        );
    }

    async import(bots) {
        if (!(bots instanceof Array))
            throw new Error(
                "Import payload format is invalid: Provide a List of {username, password, email, levelId, private"
            );
        const adminJwtToken = BotConfig.Get().adminAccessToken;
        if (!adminJwtToken)
            throw new Error("Importing bots requires admin privileges. Please provide admin access token first.");

        return this.api.post(
            "/user/import",
            { users: bots },
            {
                headers: this.getHeader(adminJwtToken),
            }
        );
    }

    getHeader(jwtToken = null) {
        return {
            "Content-Type": "application/json",
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
        if (!bot.accessToken) {
            throw new Error(`No token found for bot with ID: ${bot.id}, username: ${bot.username}`);
        }

        const response = await this.api.request({
            method: action.method,
            url: action.path + (action.queries?.length ? ApiService.QueryToString(action.queries) : ""),
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
    }
}
