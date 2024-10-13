import ApiService from "./api.js";
import League from "./league.js";
import PeriodicalLeague from "./periodical-league.js";
import { botlog, loadJsonFileData, saveJsonData } from "./tools.js";

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

    get userData() {
        return {
            id: this.id,
            username: this.username,
            email: this.email,
            password: this.password,
            levelId: this.levelId,
            avatarId: this.avatarId,
            accessToken: this.accessToken,
            totalParticipations: this.totalParticipations,
            totalInvestment: this.totalInvestment,
            totalPredictions: this.totalPredictions,
        };
    }

    async updateMyWallet() {
        try {
            const { status, data, message } = await Bot.api.performAction(this, {
                method: "get",
                path: "/user/balance",
            });
            if (status !== 200) throw new Error(message);
            this.wallet = data;
            botlog.i(this.id, "has asked for its wallet:", this.wallet);
            return data;
        } catch (ex) {
            botlog.x(this.id, "failed to fetch its wallet, since:", message);
        }
        return null;
    }

    async getMyTokensBalance(token, leagueId = null) {
        try {
            const queries = token === "chip" ? { leagueId: leagueId || 0 } : {};
            const { data, status, message } = await Bot.api.performAction(this, {
                method: "get",
                path: `/user/${token}/balance`,
                queries,
            });

            if (status !== 200) throw new Error(message);
            if (queries?.leagueId > 0) this.chipsWallet[queries.leagueId] = balance;
            else this.wallet[token] = balance;
            botlog.i(this.id, `has asked for its ${token} balance which was: ${balance}`);
            return balance;
        } catch (ex) {
            botlog.x(this.id, `failed to fetch its ${token} balance since:`, ex);
        }
        return null;
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
        try {
            const { data, status, message } = await Bot.api.performAction(this, {
                method: "get",
                path: "/periodical-league/champions",
            });
            if (status !== 200) {
                throw new Error(message);
            }
            return data;
        } catch (ex) {
            botlog.x(this.id, "failed to get periodical league list", ex);
        }
        return [];
    }

    async getPeriodicalLeagueParticipationStatus(periodicalLeagueId) {
        try {
            const { data, status, message } = await Bot.api.performAction(this, {
                method: "get",
                path: `/periodical-league/${periodicalLeagueId}/participation-mode`,
            });
            if (status !== 200) throw new Error(message);
            return data;
        } catch (ex) {
            botlog.x(this.id, "failed to fetch its periodical league participation status, ex");
        }
        return null;
    }

    async join({ periodicalLeague, league, claimIfRequired = true }) {
        try {
            const { status, data, message } = await Bot.api.performAction(this, {
                method: "post",
                path:
                    periodicalLeague != null
                        ? `/periodical-league/${+periodicalLeague}/join`
                        : `/league/${+league}/join`,
            });
            if (status !== 200) {
                if (status === 403 && claimIfRequired && (!this.wallet?.omn || this.wallet.omn <= 10)) {
                    if (await this.claimOMN()) {
                        botlog.w(this.id, "now tries to re-join the league/round after a successful claim...");
                        return this.join({
                            periodicalLeague,
                            league,
                            claimIfRequired: false,
                        }); // retry again, but this time if failed do not retry.
                    }
                }
                throw new Error(message);
            }
            return data;
        } catch (ex) {
            botlog.x(this.id, `failed to join to the league/round#${periodicalLeague || league}.`);
        }
        return null;
    }

    async analyzePeriodicalLeagues() {
        const ongoingPeriodicalLeagues = await this.getPeriodicalLeagues();
        for (const periodicalLeagueStats of ongoingPeriodicalLeagues) {
            const { joinStatus, currentNumberOfPlayers } = periodicalLeagueStats;
            const periodicalLeague = PeriodicalLeague.Get(periodicalLeagueStats);
            if (
                (joinStatus !== "current" && joinStatus !== "next") ||
                currentNumberOfPlayers >= periodicalLeague.joinLimit ||
                Math.random() <= periodicalLeague.joinChance
            )
                continue;
            // TODO: Modify it for when the status is 'joined' to fetch the current round and add it to myLeagues.
            const round = await this.join({
                periodicalLeague: periodicalLeague.id,
            });
            if (round) {
                this.myLeagues.push(new League(round));
                this.chipsWallet[round.id] = round.userStarterChips;
                botlog.i(
                    this.id,
                    `has joined PeriodicalLeague#${periodicalLeagueStats.id}/Round#${round.roundIndex} with leagueId#${
                        round.id
                    } & ${this.chipsWallet[round.id]} chips to play.`
                );
            }
        }
    }

    dropExpiredLeagues() {
        for (let i = 0; i < this.myLeagues.length; i++) {
            if (this.myLeagues[i].isExpired) this.dropLeagueByIndex(i--);
        }
    }

    dropLeagueByIndex(index) {
        const leagueId = this.myLeagues[index];
        this.myLeagues.splice(index, 1);
        delete this.chipsWallet[leagueId];
        botlog.i(this.id, `has dropped league#${leagueId} data since it was expired or finished.`);
    }
    /**
     * as the bot is ran out of gas, it can not do anything until next gas refill;
        So this value specifies the next time it should check its gas balance to see gas refill has happened or not. This way we prevent the bot from sending get balance request every play interval.}
        @params minutes 
     */
    sleep(minutes = 30) {
        this.sleepUntil = (Date.now() / 1000 + minutes * 3600) | 0;
        botlog.w(this.id, `is ran out of gas; Putting it to sleep for ${minutes} minutes.`);
    }

    async play() {
        if (this.sleepUntil) {
            if (this.sleepUntil > ((Date.now() / 1000) | 0)) return;

            await this.getMyTokensBalance("gas");
            if (!this.wallet.gas) {
                this.sleep();
                return;
            }
            this.sleepUntil = null;
        }

        let chipFinishCount = 0;
        const now = new Date();
        for (let i = 0; i < this.myLeagues.length; i++) {
            const league = this.myLeagues[i];
            if (new Date(league.startsAt) > now) continue;
            if(league.isExpired) {
                this.dropLeagueByIndex(i--);
                continue;
            }
            const prediction = league.createPrediction(this);
            const { status } = await Bot.api.performAction(this, {
                method: "post",
                path: "/prediction",
                data: prediction,
            });
            if (status === 201) {
                if (this.chipsWallet[league.id]) this.chipsWallet[league.id] -= prediction.investment;
                this.totalPredictions++;
                this.totalInvestment += prediction.investment;
                botlog.i(this.id, `did prediction in league#${league.id}`);
            } else if (status === 403) {
                if ((await this.getMyTokensBalance("chip", league.id)) > prediction.investment) {
                    // So there may be gas insufficiency
                    if (!(await this.getMyTokensBalance("gas"))) {
                        this.sleep();
                        return;
                    }
                }
                botlog.w(this.id, "seems to ran out of chips in league#${league.id}; Skipping this league...");
                chipFinishCount++;
            }
        }
        if (chipFinishCount > this.myLeagues.length / 2) {
            // means bot is ran out of chips in all leagues, so then start from last league items (which likely ends later than first leagues.) and do gas For Chip
            const league = this.myLeagues[this.myLeagues.length - 1];
            this.wallet = (await this.doGasForChip(league.id)) || this.wallet; // if user had successful gas for chip request, he can play in at least 1 league.
            botlog.w(this.id, `had to make a gas for chip request in league#${league.id}`);
        }
    }

    async doGasForChip(leagueId) {
        try {
            const { data, status, message } = await Bot.api.performAction(this, {
                method: "post",
                path: `/league/${leagueId}/gas-for-chips`,
                data: prediction,
            });
            if (status !== 200) throw new Error(message);

            return data.wallet;
        } catch (ex) {
            botlog.w(this.id, `failed to perform gas for chip request, since:`, ex);
        }
        return null;
    }

    async getIn() {
        let { data, status } = await Bot.api.login(this);
        if (status !== 200) {
            botlog.w(
                this.id,
                `:#${this.username} failed to login, maybe it's not imported correctly, trying to register.`
            );
            const response = await Bot.api.register(this);
            if (response.status !== 201) {
                botlog.x(this.id, `:#${this.username} failed to register too. Bot can not get in any way possible.`);
                return false;
            }
            data = response.data;
        }
        this.accessToken = data.accessToken;
        this.id = data.id;
        botlog.i(this.id, "was logged in.");
        return true;
    }

    async updateLeaguePool(leagueId) {
        const league = League.GetById(leagueId);
        if (!league) return null;
        try {
            const { status, message, data } = await Bot.api.performAction(this, {
                method: "get",
                path: `/league/${this.id}/balance`,
                queries: { token: "omn" },
            });
            if (status !== 200) throw new Error(message);
            league.pool = data;
        } catch (ex) {
            botlog.x(this.id, `failed to fetch league#${league.id} pool since:`, ex);
        }
        return league.pool;
    }

    async claimOMN() {
        try {
            const { status, data, message } = await Bot.api.performAction(this, {
                method: "post",
                path: `/api/shop/claim`,
            });

            if (status !== 201) {
                throw new Error(message);
            }
            await this.getMyTokensBalance("omn");
            botlog.i(this.id, `successfully claimed ${data.amount} OMNs and now has ${this.wallet.omn} OMNs in total.`);
            return true;
        } catch (ex) {
            botlog.w(this.id, "failed to claim OMN, since:", ex);
        }
        return false;
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

    static async SaveState(bots) {
        try {
            await saveJsonData(
                "state",
                bots.map((bot) => bot.userData)
            );
            botlog.i("manager", `saved the ${bots.length} bots state successfully.`);
        } catch (ex) {
            botlog.x("manager", "failed to save bots state:", ex);
        }
    }

    static async UpdateTotalBotsList(newBots) {
        try {
            const bots = await loadJsonFileData("total_bots");
            bots.push(...newBots.map((bot) => bot.userData));
            await saveJsonData("total_bots", bots);
            botlog.i("manager", `updated total bot list which is list of all bots even including dead or old bots.`);
        } catch (ex) {
            botlog.x("manager", "failed to save bots state:", ex);
        }
    }

    /**
     * This method saves the state active running bots, which means it ignores dead bots or those who have failed due to any reason.
     * @returns bots: Bot[]
     */
    static async LoadState() {
        const state = await loadJsonFileData("state");
        return state.map((credentials) => new Bot(credentials));
    }
}
