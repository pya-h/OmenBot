import ApiService from "./api";
import League from "./league";
import PeriodicalLeague from "./periodical-league";

export default class Bot {
    static api = ApiService.Get();

    constructor({
        id,
        username,
        email,
        password,
        levelId,
        avatarId,
        accessToken,
    } = {}) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.email = email;
        this.levelId = levelId;
        this.accessToken = accessToken;
        this.avatarId = avatarId;
        this.myLeagues = [];
        this.wallet = {
            gas: 14,
            chip: 10000, // since this is only freestyle balance, and its not useful for bot.
            omn: 100,
            badge: 0,
        };
        this.chipsWallet = {};
    }

    async updateMyWallet() {
        this.wallet = await Bot.api.performAction(this, {
            method: "get",
            path: "/user/balance",
        });
    }

    async getMyTokensBalance(token, leagueId = null) {
        const queries = token === "chip" ? { leagueId: leagueId || 0 } : {};
        const balance = await Bot.api.performAction(this, {
            method: "get",
            path: `/user/${token}/balance`,
            queries,
        });

        if (queries?.leagueId > 0) this.chipsWallet[queries.leagueId] = balance;
        else this.wallet[token] = balance;

        return balance;
    }

    static async FetchBots() {
        const bots = await Bot.api.get("/user/omens");
        return Promise.all(
            bots?.map(async (botIdentity) => {
                const bot = new Bot(botIdentity);
                await bot.getIn(); // TODO: What to do if it returns false (get in failure case)
                return bot;
            })
        );
    }

    async getPeriodicalLeagues() {
        const { data, status } = await Bot.api.performAction(this, {
            method: "get",
            path: "/periodical-league/champions",
        });
        if (status !== 200)
            throw new Error("Can not get periodical leagues list.");
        return data;
    }

    async getPeriodicalLeagueParticipationStatus(periodicalLeagueId) {
        const { data, status } = await Bot.api.performAction(this, {
            method: "get",
            path: `/periodical-league/${periodicalLeagueId}/participation-mode`,
        });
        if (status !== 200)
            throw new Error("Can not get periodical leagues status.");
        return data;
    }

    async joinOngoingRound(periodicalLeagueId) {
        const { status, data } = await Bot.api.performAction(this, {
            method: "post",
            path: `/periodical-league/${periodicalLeagueId}/join`,
        });
        if (status !== 200) {
            // checkout status code if its already joined or not.
            switch (status) {
                case 403:
                    await this.getMyTokensBalance("omn");
                    break;
                case 401:
                    this.accessToken = null; // There may be jwt expiry, reset the access token, so in next cron interval it tries to re-login, or be dropped out if there is other problem with login.
                    break;
            }
        }
        this.myLeagues.push(data.id);
        return data;
    }

    async analyzePeriodicalLeagues(ongoingPeriodicalLeagues) {
        if (!ongoingPeriodicalLeagues)
            ongoingPeriodicalLeagues = await this.getPeriodicalLeagues();
        for (const periodicalLeagueStats of ongoingPeriodicalLeagues) {
            const { joinStatus, currentNumberOfPlayers } =
                periodicalLeagueStats;
            const periodicalLeague = PeriodicalLeague.Get(
                periodicalLeagueStats
            );
            if (
                joinStatus !== "current" ||
                currentNumberOfPlayers >= periodicalLeague.joinLimit ||
                Math.random() <= periodicalLeague.joinChance // For simplifying calculation, the True chance is when the random number is less than chance value.
            )
                continue;

            const round = await this.joinOngoingRound(periodicalLeague.id);
            if (round) {
                this.myLeagues.push(new League(round));
                this.chipsWallet[round.id] = round.userStarterChips;
            } // TODO: What to do with bots that are ran out of Omens?
        }
    }

    dropExpiredLeagues() {
        for (const leagueId in this.myLeagues)
            if (this.myLeagues[leagueId].isExpired)
                delete this.myLeagues[leagueId];
    }

    async play() {
        const apiService = ApiService.Get();
        this.myLeagues = this.myLeagues.filter((league) => !league.isExpired);

        for (const league of this.myLeagues) {
            const prediction = league.createPrediction(this);
            const { data, status } = await apiService.performAction(this, {
                method: "post",
                path: "/prediction",
                data: prediction,
            });
            if (status === 201) {
                league.chip -= prediction.investment;
                // TODO: And some other changes.
            } else if (status === 403) {
                // Most probably is because of insufficient balance:
                await this.getMyTokensBalance("chip", league.id);
                if (
                    this.chipsWallet[league.id] &&
                    this.chipsWallet[league.id] > prediction.investment
                ) {
                    // So there may be gas insufficiency
                    await this.getMyTokensBalance("gas");
                }
            }
        }
    }

    async getIn() {
        // TODO: Then checkout that accessToken will set correctly
        const api = ApiService.Get();
        let { data, status } = await api.login(this);
        if (status !== 200) {
            const response = await api.register(this);
            if (response.status !== 201) return false;
            data = response.data;
        }
        this.accessToken = data.accessToken;
        return true;
    }

    async updateLeaguePool(leagueId) {
        const league = League.GetById(leagueId);
        if (!league) return null;
        league.pool = await Bot.api.performAction(this, {
            method: "get",
            path: `/league/${this.id}/balance`,
            queries: { token: "omn" },
        });
    }
}
