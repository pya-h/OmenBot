export default class League {
    constructor(league) {
        if (!league || league.id == null) return null;
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
        this.chips = league.userStarterChips;
    }

    createPrediction(bot, max=500) {
        //  It provides the body of POST /api/prediction  to create random prediction based on league settings, and the bot and min and max params passed to
    }

    get isExpired() {
        // Checks if the game has ended or not, returning true means it's time to remove instance from bot.myLeague
        return (
            (this.status !== "waiting" && this.status !== "started") ||
            this.endingAt < new Date() ||
            this.startsAt?.getTime() + this.duration * 1000 <= Date.now()
        ); // TODO: Check duration unit is ms or sec.
    }
}
