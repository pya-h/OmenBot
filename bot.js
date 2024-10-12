import ApiService from "./api";
import League from "./league";
import PeriodicalLeague from "./periodical-league";
import { loadJsonFileData } from "./tools";

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
        totalPredictions = 0,
        totalInvestment = 0,
        totalParticipations = 0,
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
        };
        this.chipsWallet = {};
        this.totalPredictions = +totalPredictions;
        this.totalInvestment = +totalInvestment;
        this.totalParticipations = +totalParticipations;
        this.sleepUntil = null;
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
        console.info(new Date().toLocaleString(), `Bot#${this.id} has asked for its ${token} balance which was: ${balance}`);
        return balance;
    }

    static async FetchBots() {
        try {
            const { data: bots, status } = await Bot.api.get("/user/omens");
            if (status !== 200) throw new Error("Not Found");
            return Promise.all(
                bots?.map(async (botIdentity) => {
                    const bot = new Bot(botIdentity);
                    await bot.getIn(); // TODO: What to do if it returns false (get in failure case)
                    return bot;
                })
            );
        } catch (ex) {}
        return [];
    }

    async getPeriodicalLeagues() {
        const { data, status } = await Bot.api.performAction(this, {
            method: "get",
            path: "/periodical-league/champions",
        });
        if (status !== 200) {
            if (status === 401) this.accessToken = null;
            throw new Error("Can not get periodical leagues list.");
        }
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
        return data;
    }

    async analyzePeriodicalLeagues() {
        const ongoingPeriodicalLeagues = await this.getPeriodicalLeagues();
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
                console.info(
                    new Date().toLocaleString(),
                    `Bot#${this.id} has joined PeriodicalLeague#${
                        periodicalLeagueStats.id
                    }/Round#${round.roundIndex} with leagueId#${round.id} & ${
                        this.chipsWallet[round.id]
                    } chips to play`
                );
            } // TODO: What to do with bots that are ran out of Omens?
        }
    }

    dropExpiredLeagues() {
        for (const leagueId in this.myLeagues)
            if (this.myLeagues[leagueId].isExpired) this.dropLeague(leagueId);
    }

    dropLeague(leagueId) {
        delete this.myLeagues[leagueId];
        delete this.chipsWallet[leagueId];
        console.info(
            new Date().toLocaleString(),
            `Bot#${this.id} has dropped league#${leagueId} data since it was expired or finished.`
        );
    }
    /**
     * as the bot is ran out of gas, it can not do anything until next gas refill;
        So this value specifies the next time it should check its gas balance to see gas refill has happened or not. This way we prevent the bot from sending get balance request every play interval.}
        @params minutes 
     */
    sleep(minutes = 30) {
        this.sleepUntil = (Date.now() / 60 + minutes * 3600) | 0;
    }

    async play() {
        const apiService = ApiService.Get();

        if (this.sleepUntil) {
            if (this.sleepUntil > ((Date.now() / 60) | 0)) return;

            await this.getMyTokensBalance("gas");
            if (!this.wallet.gas) {
                this.sleep();
                return;
            }
            this.sleepUntil = null;
        }

        let roundPredictions = 0;
        for (const league of this.myLeagues) {
            if (league.isExpired) {
                this.dropLeague(league.id);
                continue;
            }
            const prediction = league.createPrediction(this);
            const { data, status } = await apiService.performAction(this, {
                method: "post",
                path: "/prediction",
                data: prediction,
            });
            if (status === 201) {
                if (this.chipsWallet[league.id])
                    this.chipsWallet[league.id] -= prediction.investment;
                this.totalPredictions++;
                this.totalInvestment += prediction.investment;
                roundPredictions++;
                console.info(
                    new Date().toLocaleString(),
                    `Bot #${this.id} did prediction in league#${league.id}`
                );
            } else if (status === 403) {
                if (
                    (await this.getMyTokensBalance("chip", league.id)) >
                    prediction.investment
                ) {
                    // So there may be gas insufficiency
                    if (!(await this.getMyTokensBalance("gas"))) {
                        this.sleep();
                        console.warn(
                            new Date().toLocaleString(),
                            `Bot#${this.id} is ran out of gas; Putting it to sleep for 30 minutes.`
                        );
                        return;
                    }
                }
                console.warn(
                    new Date().toLocaleString(),
                    `Bot#${this.id} seems to ran out of chips in league#${league.id}; Skipping this league...`
                );
            } else if (status === 401) {
                this.accessToken = null;
                console.error(
                    new Date().toLocaleString(),
                    `Bot#${this.id} is logged out unexpectedly! But no worry app will force login all bots each hour.`
                );
            }
        }
        if (!roundPredictions) {
            // means bot is ran out of chips in all leagues, so then start from last league items (which likely ends later than first leagues.) and do gas For Chip
            const leagueId = +Object.keys(this.myLeagues)[
                this.myLeagues.length - 1
            ];
            this.wallet = (await this.doGasForChip(leagueId)) || this.wallet; // if user had successful gas for chip request, he can play in at least 1 league.
            console.warn(
                new Date().toLocaleString(),
                `Bot#${this.id} had to make a gas for chip request in league#${leagueId}`
            );
        }
    }

    async doGasForChip(leagueId) {
        const { data, status } = await Bot.api.performAction(this, {
            method: "post",
            path: "/league/gas-for-chips",
            data: prediction,
        });
        return status === 200 ? data.wallet : null;
    }
    async getIn() {
        let { data, status } = await Bot.api.login(this);
        if (status !== 200) {
            const response = await Bot.api.register(this);
            if (response.status !== 201) return false;
            data = response.data;
        }
        this.accessToken = data.accessToken;
        console.info(
            new Date().toLocaleString(),
            `Bot#${this.id} was logged in.`
        );
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

    static async ForceLoginBots(bots) {
        for (let i = 0; i < bots.length; i++) {
            if (!bots[i].accessToken && !(await bots[i].getIn())) {
                bots.splice(i, 1);
                i--;
            }
        }
        await Bot.SaveState(bots);
    }

    get data() {
        const credentials = ({
            id,
            username,
            email,
            password,
            levelId,
            avatarId,
            accessToken,
            totalParticipations,
            totalInvestment,
            totalPredictions,
        } = this);
        return credentials;
    }

    static async SaveState(bots) {
        const data = JSON.stringify(bots.map((bot) => bot.data));

        // TODO: Save this to state.json file
    }

    static async LoadState() {
        const state = await loadJsonFileData("state");
        return state.map((credentials) => new Bot(credentials));
    }
}
