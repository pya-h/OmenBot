import { configDotenv } from "dotenv";

configDotenv({ path: "./.env" });

export default class BotConfig {
    static conf = null;

    static Get() {
        if (!BotConfig.conf) return new BotConfig();
        return BotConfig.conf;
    }

    constructor() {
        if (BotConfig.conf) return BotConfig.conf;

        BotConfig.conf = this;
    }

    get botPassword() {
        return process.env.BOT_PASSWORD;
    }

    get baseURL() {
        return process.env.BASE_URL || 'https://staging.omenium.com/api';
    }

    get adminAccessToken() {
        return process.env.ADMIN_ACCESS_TOKEN;
    }

    get hashSaltRound() {
        return +(process.env.SALT_ROUNDS || 12);
    }

    get botsCount() {
        return +(process.env.BOTS_COUNT || 1000);
    }

    get botMaxLevel() {
        return +(process.env.MAX_BOT_LEVEL || 3);
    }

    get botMaxAge() {
        return +(process.env.MAX_BOT_AGE || 70);
    }

    get isBotProfilePrivate() {
        return process.env.PRIVATE_PROFILE?.toLowerCase() === "true";
    }

    get loadLastState() {
        return (process.env.LOAD_STATE || "true").toLowerCase() === "true";
    }

    get shouldBotParticipateInPublicLeaguesToo() {
        return process.env.PLAY_PUBLIC_LEAGUES?.toLowerCase() === "true";
    }

    get publicLeagueBotToHumanRatio() {
        return +(process.env.PUBLIC_LEAGUE_BOT_TO_HUMAN_RATIO || 1.0);
    }

    get maxBotsInLeague() {
        return +(process.env.MAX_LEAGUE_BOTS || 500);
    }


    get minBotsInLeague() {
        return +(process.env.MIN_LEAGUE_BOTS || 100);
    }

    get periodicalLeagueJoinChance() {
        return +(process.env.PERIODICAL_JOIN_CHANCE || 0.25);
    }

    get botParticipationIntervalInMinutes() {
        return +(process.env.BOT_PARTICIPATION_UPDATE_INTERVAL || 1);
    }

    get botGameplayIntervalInSeconds() {
        return +(process.env.BOT_GAMEPLAY_INTERVAL || 60);
    }

    get leaguePredictionInvestmentMax() {
        return +(process.env.MAX_PREDICTION_INVESTMENTS || 500);
    }

    get fetchExistingBots() {
        return process.env.FETCH_BOTS?.toLowerCase() === "true";
    }

    get shopRenewalInterval() {
        return +(process.env?.SHOP_LIST_RENEWAL_INTERVAL || 300);
    }


    get botSleepChance() {
        return +(process.env?.BOT_SLEEP_CHANCE || 0.5);
    }

    get botGasForChipChance() {
        return +(process.env?.BOT_GAS_FOR_CHIP_CHANCE || 0.5);
    }

    get botOmenClaimChance() {
        return +(process.env?.BOT_OMEN_CLAIM_CHANCE || 0.5);
    }

    get leaguePredictionLimit() {
        return +(process.env?.BOT_OMEN_CLAIM_CHANCE || 0);
    }
}
