import BotConfig from "./config.js";
import { getRandomElement, randomInt } from "./tools.js";

export default class League {
    static leagues = {};
    static maxInvestmentHundreds = (BotConfig.Get().leaguePredictionInvestmentMax / 100) | 0;

    constructor(league) {
        this.id = league.id;
        this.startsAt = league.shouldStartAt;
        this.endsAt = league.endingAt;
        this.duration = league.duration;
        this.type = league.type;
        this.status = league.status;
        this.parentId = league.periodicalLeagueId;
        this.roundIndex = league.periodicalLeagueId;
        this.gasPerPrediction = league.gasPerPrediction;
        this.minInvestment = league.minPredictionInvestment;
        this.totalPredictions = league.totalNumberOfPredictions;
        this.playersCount = league.currentNumberOfPlayers;
        this.predictionItems = league.predictionItems?.map((item) => item.id);
        this.timeFrames = league.timeFrames?.map((tf) => tf.id);
        this.userStarterChips = league.userStarterChips;
        this.poolBalance = 0;
        League.leagues[this.id] = this;
    }

    static RandomInvestment(chipBalance) {
        return (chipBalance > 200 ? randomInt(1, League.maxInvestmentHundreds, (chipBalance / 100) | 0) : 1) * 100;
    }

    createPrediction(bot) {
        return {
            direction: Math.random() >= 0.5 ? "up" : "down",
            leagueId: this.id,
            predictionItemId: getRandomElement(this.predictionItems),
            timeFrameId: getRandomElement(this.timeFrames),
            investment: League.RandomInvestment(bot?.chipsWallet?.[this.id] * (bot.levelId > 1 ? 0.75 : 0.5)),
        };
    }

    get isExpired() {
        const expired = (this.status !== "waiting" && this.status !== "started") || this.endingAt < new Date();
        // this.startsAt?.getTime() + this.duration * 1000 <= Date.now(); // this one doesn't seem necessary

        if (expired) delete League.leagues[this.id];
        return expired;
    }

    static Get(leagueData) {
        if (!leagueData || leagueData.id == null) return null;
        if (leagueData.id in League.leagues) return League.leagues[leagueData.id];
        return new League(leagueData);
    }

    set pool(omns) {
        this.poolBalance = omns;
    }

    get pool() {
        return this.poolBalance;
    }

    static GetById(leagueId) {
        return League.leagues[leagueId];
    }

    requiredGasToSwap(levelId) {
        return 2 ** (levelId - 1) * 10; // Change it if swap rules change
    }
}
