export default class League {
    static leagues = {};

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

    createPrediction(bot, max = 500) {
        //  It provides the body of POST /api/prediction  to create random prediction based on league settings, and the bot and min and max params passed to
    }

    get isExpired() {
        // Checks if the game has ended or not, returning true means it's time to remove instance from bot.myLeague
        const expired =
            (this.status !== "waiting" && this.status !== "started") ||
            this.endingAt < new Date() ||
            this.startsAt?.getTime() + this.duration * 1000 <= Date.now(); // TODO: Check duration unit is ms or sec.

        if (expired) delete League.leagues[this.id];
        return expired;
    }

    static Get(leagueData) {
        if (!leagueData || leagueData.id == null) return null;
        if (leagueData.id in League.leagues)
            return League.leagues[leagueData.id];
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
