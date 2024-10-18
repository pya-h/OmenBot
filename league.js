import BotConfig from "./config.js";
import { getRandomElement, randomInt } from "./tools.js";

export default class League {
    static leagues = {};
    static maxInvestmentHundreds =
        (BotConfig.Get().leaguePredictionInvestmentMax / 100) | 0;

    constructor(league) {
        if (league.id in League.leagues) {
            return League.leagues[league.id].update(league);
        }
        this.id = league.id;
        this.startsAt = new Date(league.shouldStartAt);
        this.endsAt = new Date(league.endingAt);
        this.duration = league.duration;
        this.type = league.type;
        this.name = league.name;
        this.status = league.status;
        this.parentId = league.periodicalLeagueId;
        this.roundIndex = league.periodicalLeagueId;
        this.gasPerPrediction = league.gasPerPrediction;
        this.minInvestmentInHundreds =
            ((league.minPredictionInvestment || 100) / 100) | 0;
        this.totalPredictions = league.totalNumberOfPredictions;
        this.playersCount = league.currentNumberOfPlayers;
        this.botPlayersCount = 0;
        this.humanPlayersCount = this.playersCount;
        this.minNumberOfPlayers = league.minNumberOfPlayers;
        this.minGasBox = league.minGasBox;
        this.minLevel = league.minLevelRank;
        this.predictionItems = league.predictionItems?.map((item) => item.id);
        this.timeFrames = league.timeFrames?.map((tf) => tf.id);
        this.userStarterChips = league.userStarterChips;
        this.poolBalance = 0;
        this.omnFee = league.omnEntranceFee;
        League.leagues[this.id] = this;
    }

    static RandomInvestment(chipBalance, minInHundreds = 1) {
        return (
            (chipBalance > 200
                ? randomInt(
                      minInHundreds,
                      League.maxInvestmentHundreds,
                      (chipBalance / 100) | 0
                  )
                : 1) * 100
        );
    }

    createPrediction(bot) {
        return {
            direction: Math.random() >= 0.5 ? "up" : "down",
            leagueId: this.id,
            predictionItemId:
                this.predictionItems.length > 1
                    ? getRandomElement(this.predictionItems)
                    : this.predictionItems[0],
            timeFrameId: this.timeFrames.length
                ? getRandomElement(this.timeFrames)
                : this.timeFrames[0],
            investment: League.RandomInvestment(
                bot.chipsWallet?.[this.id],
                this.minInvestmentInHundreds
            ),
        };
    }

    // TODO: Maybe fetch sometimes some league to get updated data
    get isExpired() {
        const expired =
            (this.status !== "waiting" && this.status !== "started") ||
            this.endingAt <= new Date() ||
            this.startsAt.getTime() + this.duration * 1000 <= Date.now(); // this one doesn't seem necessary

        if (expired) delete League.leagues[this.id];
        return expired;
    }

    update(league) {
        this.playersCount = league.currentNumberOfPlayers;
        this.totalPredictions = league.totalNumberOfPredictions;
        this.status = league.status;
        this.endsAt = new Date(league.endingAt);
        return this;
    }

    static Get(leagueData) {
        if (!leagueData || leagueData.id == null) return null;
        if (leagueData.id in League.leagues) {
            return League.leagues[leagueData.id].update(leagueData);
        }
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
