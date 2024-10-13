import BotConfig from "./config.js";
import { randomInt } from "./tools.js";

export default class PeriodicalLeague {
    static leagues = {};
    static maxBotRatio = BotConfig.Get().maxBotsInLeague;

    constructor(data) {
        this.id = data.id;
        this.duration = data.duration;
        this.type = data.type;
        this.status = data.status;
        this.period = data.period;
        this.joinLimitValue = 0;
        this.lastJoinLimitUpdate = 0;
        this.currentNumberOfPlayers = data.currentNumberOfPlayers;
        this.joinChance = BotConfig.Get().periodicalLeagueJoinChance;
        PeriodicalLeague.leagues[this.id] = this;
    }

    static Get(data) {
        if (!data || data.id == null) return null;
        if (data.id in PeriodicalLeague.leagues) {
            const existingInstance = PeriodicalLeague.leagues[data.id];
            existingInstance.currentNumberOfPlayers =
                data?.currentNumberOfPlayers || existingInstance.currentNumberOfPlayers;
            // prevent creating multiple instances of the same league.
            return PeriodicalLeague.leagues[data.id];
        }
        return new PeriodicalLeague(data);
    }

    get joinLimit() {
        if (
            !this.joinLimitValue ||
            this.lastJoinLimitUpdate - Date.now() / 1000 >= Math.min(this.period, 10) * (this.period > 2000 ? 100 : 1)
        ) {
            this.joinLimitValue = randomInt();
            this.lastJoinLimitUpdate = (Date.now() / 1000) | 0;
        }
        return this.joinLimitValue;
    }
}
