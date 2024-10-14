import ApiService from "./api.js";
import BotConfig from "./config.js";
import { botlog, getRandomElement } from "./tools.js";

export default class Shop {
    static instance = null;

    constructor(bot) {
        if (Shop.instance) return Shop.instance;
        this.list = {};
        this.lastListRenewal = null;
        this.renewalInterval = BotConfig.Get().shopRenewalInterval * 60;
        this.loadShopList(bot).catch((err) => botlog.x(bot?.id, "failed to load shop list.", err));
        Shop.instance = this;
    }

    static Get(bot) {
        if (!Shop.instance) return new Shop(bot);
        return Shop.instance;
    }

    async loadShopList(bot) {
        const { data, status, message } = await ApiService.Get().performAction(bot, {
            method: "get",
            path: "/shop-item",
        });
        if (status !== 200) {
            throw new Error(message);
        }

        this.list = {};
        for (const item of data) {
            if (!["gas", "gas-box", "omn"].includes(item.tokenType)) continue;
            if (!this.list[item.tokenType]) this.list[item.tokenType] = [];
            this.list[item.tokenType].push({
                id: item.id,
                amount: item.tokenAmount,
                price: item.currencyAmount,
                priceToken: item.currencyType,
            });
        }
        this.lastListRenewal = (Date.now() / 1000) | 0;
        botlog.i(bot.id, "has renewed the shop item list.");
    }

    getMinOmenCostFor(token) {
        return Math.min(...this.list[token].filter((item) => item.priceToken === "omn").map((item) => item.price));
    }

    async buy(bot, token) {
        if (!Object.keys(this.list)?.length || +this.lastListRenewal + this.renewalInterval <= Date.now() / 1000)
            await this.loadShopList(bot);

        if (!this.list[token]?.length) throw new Error(`shop does not provide ${token}`);

        if (!Object.keys(bot.wallet)?.length) await bot.updateMyWallet();

        if (token === "gas" && this.getMinOmenCostFor("gas") > bot.wallet.omn) {
            await bot.claimOMN();
        }

        const canBuy = this.list[token]?.filter(
            (item) =>
                item.price <= (bot.wallet[item.priceToken] || 0) &&
                (token !== "gas" || item.amount + +bot.wallet.gas <= bot.wallet.gasbox)
        );
        if (!canBuy?.length) throw new Error(`insufficient ${this.list[token][0].priceToken} balance.`);
        const preferredItem = canBuy[canBuy.length - 1];

        const { status, data, message } = await ApiService.Get().performAction(bot, {
            method: "post",
            path: "/shop/buy",
            data: { itemId: preferredItem.id },
        });

        if (status !== 201 && status !== 200) {
            if(status === 403)
                bot.getMyTokensBalance(preferredItem.priceToken);
            throw new Error(message.slice(0, 30));
        }
        bot.wallet[token] += data.delivery?.amount || 0;
    }
}
