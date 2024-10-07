import ApiService from "./api";
import League from "./league";

export default class Bot {
    constructor({
        id,
        username,
        email,
        password,
        levelId,
        avatarId,
        jwtToken,
    } = {}) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.email = email;
        this.levelId = levelId;
        this.accessToken = jwtToken;
        this.avatarId = avatarId;
        this.myLeagues = [];
        this.wallet = {
            gas: 14,
            chip: 10000, // since this is only freestyle balance, and its not useful for bot.
            omn: 100,
            badge: 0,
        };
    }

    async updateMyWallet(specialLeagueId = null) {
        this.wallet = await ApiService.Get().performAction(this, {
            method: "get",
            path: "/user/balance",
            ...(specialLeagueId
                ? { queries: { leagueId: specialLeagueId } }
                : {}),
        });
    }

    async getMyTokensBalance(token, leagueId = null) {
        const queries = token === "chip" ? { leagueId: leagueId || 0 } : {};
        this.wallet[token] = await ApiService.Get().performAction({
            method: "get",
            path: `/user/${token}/balance`,
            queries,
        });

        return this.wallet[token];
    }

    static async FetchBots() {
        const bots = await ApiService.Get().get("/user/omens");
        return Promise.all(
            bots?.map(async (botIdentity) => {
                const bot = new Bot(botIdentity);
                await bot.getIn(); // TODO: What to do if it returns false (get in failure case)
                return bot;
            })
        );
    }

    async getPeriodicalLeagues() {
        const { data, status } = await ApiService.Get().performAction(this, {
            method: "get",
            path: "/periodical-league/champions",
        });
        if (status !== 200)
            throw new Error("Can not get periodical leagues list.");
        return data;
    }

    async getPeriodicalLeagueParticipationStatus(periodicalLeagueId) {
        const { data, status } = await ApiService.Get().performAction(this, {
            method: "get",
            path: `/periodical-league/${periodicalLeagueId}/participation-mode`,
        });
        if (status !== 200)
            throw new Error("Can not get periodical leagues status.");
        return data;
    }

    async joinOngoingRound(periodicalLeagueId) {
        const { status, data } = await ApiService.Get().performAction(this, {
            method: "post",
            path: `/periodical-league/${periodicalLeagueId}/join`,
        });
        if (status !== 200) {
            // checkout status code if its already joined or not.
        }
        this.myLeagues.push(data.id);
        return data;
    }

    async analyzePeriodicalLeagues(
        ongoingPeriodicalLeagues,
        maxJoins = 200,
        joinChance = 0.25
    ) {
        if (!ongoingPeriodicalLeagues)
            ongoingPeriodicalLeagues = await this.getPeriodicalLeagues();
        for (const periodicalLeague of ongoingPeriodicalLeagues) {
            const { joinStatus, currentNumberOfPlayers } = periodicalLeague;
            if (
                joinStatus !== "current" ||
                currentNumberOfPlayers >= maxJoins ||
                Math.random() > joinChance // For simplifying calculation, the True chance is when the random number is less than chance value.
            )
                continue;

            const round = await this.joinOngoingRound(periodicalLeague.id);
            if (round) {
                this.myLeagues.push(new League(round));
            } // TODO: What to do with bots that are ran out of Omens?
        }
    }

    async dropExpiredLeagues() {
        this.myLeagues = this.myLeagues.filter((league) => !league.isExpired);
    }

    async play() {
        const apiService = ApiService.Get();
        for (const league of this.myLeagues) {
            const prediction = league.createPrediction(this);
            const { data, status } = await apiService.performAction(this, {
                method: "post",
                path: "/prediction",
                data: prediction,
            });
            if(status === 201) {
              league.chip -= prediction.investment;
              // TODO: And some other changes.
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
}
