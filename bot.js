import ApiService from "./api.js";
import BotConfig from "./config.js";
import League from "./league.js";
import PeriodicalLeague from "./periodical-league.js";
import Shop from "./shop.js";
import { botlog, loadJsonFileData, saveJsonData } from "./tools.js";

export default class Bot {
    static api = ApiService.Get();
    static config = BotConfig.Get();

    static publicLeaguesTempList = null;

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
            gasbox: 14,
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
            const { status, data, message } = await Bot.api.performAction(
                this,
                {
                    method: "get",
                    path: "/user/balance",
                }
            );
            if (status !== 200) throw new Error(message);
            this.wallet = data;
            botlog.i(this.id, "has asked for its wallet:", this.wallet);
            return data;
        } catch (ex) {
            botlog.x(this.id, "failed to fetch its wallet");
        }
        return null;
    }

    async getMyTokensBalance(token, leagueId = null) {
        try {
            const queries = token === "chip" ? { leagueId: leagueId || 0 } : {};
            const {
                data: balance,
                status,
                message,
            } = await Bot.api.performAction(this, {
                method: "get",
                path: `/user/${token}/balance`,
                queries,
            });

            if (status !== 200) throw new Error(message);
            if (leagueId > 0) this.chipsWallet[leagueId] = balance;
            else this.wallet[token] = balance;
            botlog.i(
                this.id,
                `has asked for its ${token} balance which was: ${balance}`
            );
            return balance;
        } catch (ex) {
            botlog.x(
                this.id,
                `failed to fetch its ${token} balance since:`,
                ex
            );
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

    async getLeaguesList(periodicalLeagues = true) {
        try {
            const { data, status, message } = await Bot.api.performAction(
                this,
                {
                    method: "get",
                    path: periodicalLeagues
                        ? "/periodical-league/champions"
                        : "/league",
                }
            );
            if (status !== 200) {
                throw new Error(message);
            }
            return data;
        } catch (ex) {
            botlog.x(
                this.id,
                `failed to get ${
                    periodicalLeagues ? "periodical" : "public"
                } league list`,
                ex
            );
        }
        return [];
    }

    async getPeriodicalLeagueParticipationStatus(periodicalLeagueId) {
        try {
            const { data, status, message } = await Bot.api.performAction(
                this,
                {
                    method: "get",
                    path: `/periodical-league/${periodicalLeagueId}/participation-mode`,
                }
            );
            if (status !== 200) throw new Error(message);
            return data;
        } catch (ex) {
            botlog.x(
                this.id,
                "failed to fetch its periodical league participation status,",
                ex
            );
        }
        return null;
    }

    async join({ periodicalLeague, league, claimIfRequired = true }) {
        try {
            const { status, data, message } = await Bot.api.performAction(
                this,
                {
                    method: "post",
                    path:
                        periodicalLeague != null
                            ? `/periodical-league/${+periodicalLeague}/join`
                            : `/league/${+league}/join`,
                }
            );
            if (status !== 200) {
                if (
                    status === 403 &&
                    claimIfRequired &&
                    (!this.wallet?.omn || this.wallet.omn <= 10)
                ) {
                    if (
                        Math.random() < Bot.config.botOmenClaimChance &&
                        (await this.claimOMN())
                    ) {
                        botlog.w(
                            this.id,
                            "now tries to re-join the league/round after a successful claim..."
                        );
                        return this.join({
                            periodicalLeague,
                            league,
                            claimIfRequired: false,
                        }); // retry again, but this time if failed do not retry.
                    }
                }
                throw new Error(message);
            }
            this.wallet.omn = Math.max(
                0,
                this.wallet.omn - +data.omnEntranceFee
            );
            return data;
        } catch (ex) {
            botlog.x(
                this.id,
                `failed to join to the league/round#${
                    periodicalLeague || league
                }:`,
                ex?.toString().split("\n")[0]
            );
        }
        return null;
    }

    async loadMyLeagues() {
        // FIXME:
    }

    async analyzePeriodicalLeagues() {
        const tasks = [];
        const ongoingPeriodicalLeagues = await this.getLeaguesList(); // FIXME: Can this one be optimized like periodicalLeague temp list thing?
        for (const periodicalLeagueStats of ongoingPeriodicalLeagues) {
            const { joinStatus, currentNumberOfPlayers } =
                periodicalLeagueStats;
            const periodicalLeague = PeriodicalLeague.Get(
                periodicalLeagueStats
            );

            if (
                (joinStatus !== "current" && joinStatus !== "next") ||
                currentNumberOfPlayers >= periodicalLeague.joinLimit ||
                Math.random() > periodicalLeague.joinChance
            )
                continue;

            tasks.push(
                this.tryToJoinLeague({
                    periodicalLeague: periodicalLeague.id,
                })
            );
        }
        await Promise.all(tasks);
    }

    async tryToJoinLeague(leagueIdentifier) {
        const leagueData = await this.join(leagueIdentifier);
        if (leagueData) {
            const league = League.Get(leagueData);
            this.myLeagues.push(league);
            league.botPlayersCount++;
            league.playersCount++; // TODO: For now There is a bug which doesn't update the number of players in join response, remove after that is fixed.
            this.chipsWallet[league.id] = league.userStarterChips;
            botlog.i(
                this.id,
                `has joined ${league.name} with leagueId#${league.id} & ${
                    this.chipsWallet[league.id]
                } chips to play.`
            );
        }
    }

    async analyzePublicLeagues() {
        if (!Bot.publicLeaguesTempList) {
            // prevent fetching the exact same data over & over again
            Bot.publicLeaguesTempList = (await this.getLeaguesList(false))?.map(
                (league) => League.Get(league)
            );
        }
        const tasks = [];
        for (const league of Bot.publicLeaguesTempList) {
            if (
                (league.minNumberOfPlayers > league.playersCount ||
                    league.botPlayersCount <
                        Bot.config.publicLeagueBotToHumanRatio *
                            league.humanPlayersCount) &&
                this.myLeagues.findIndex(
                    (myLeague) => myLeague.id === league?.id
                ) === -1
            ) {
                tasks.push(this.tryToJoinLeague({ league: league.id }));
            }
        }
        await Promise.all(tasks);
    }

    updateMyLeaguesState() {
        for (let i = 0; i < this.myLeagues.length; i++) {
            if (this.myLeagues[i].isExpired) this.dropLeagueByIndex(i--);
            // else await this.getMyTokensBalance("chip", this.myLeagues[i].id); // TODO: Or use worker for this
        }
    }

    dropLeagueByIndex(index) {
        const league = this.myLeagues[index];
        this.myLeagues.splice(index, 1);
        delete this.chipsWallet[league.id];
        botlog.i(
            this.id,
            `has dropped league#${league.id} data since it was expired or finished.`
        );
    }
    /**
     * as the bot is ran out of gas, it can not do anything until next gas refill;
        So this value specifies the next time it should check its gas balance to see gas refill has happened or not. This way we prevent the bot from sending get balance request every play interval.}
        @params minutes 
     */
    sleep(minutes = 30) {
        this.sleepUntil = (Date.now() / 1000 + minutes * 3600) | 0;
        botlog.w(
            this.id,
            `is ran out of gas; Putting it to sleep for ${minutes} minutes.`
        );
    }

    async handleNoGasSituation() {
        if (Math.random() >= Bot.config.botSleepChance) {
            try {
                await Shop.Get().buy(this, "gas");
                return true;
            } catch (ex) {
                botlog.x(
                    this.id,
                    "tried to buy gas but failed, since:",
                    ex?.toString().split("\n")[0]
                );
            }
            if (!Bot.config.botSleepChance) return true;
        }
        this.sleep();
        return false;
    }

    async updateSleepState() {
        if (this.sleepUntil > ((Date.now() / 1000) | 0)) return;

        if (!(await this.handleNoGasSituation())) {
            await this.getMyTokensBalance("gas"); // check if gas refill has happened.
            if (!this.wallet.gas) {
                this.sleep();
                return;
            }
        }
        this.sleepUntil = null;
    }

    async checkGasState() {
        if (!(await this.getMyTokensBalance("gas"))) {
            await this.handleNoGasSituation();
        }
    }

    async play() {
        if (this.sleepUntil) {
            return [this.updateSleepState()];
        }
        const insignificantProcessList = [];
        const now = new Date();
        
        for (let i = 0; i < this.myLeagues.length; i++) {
            const league = this.myLeagues[i];
            if (!league.openToPrediction) continue;
            let doWalletCheck = false;
            let prediction = null;
            try {
                if (new Date(league.startsAt) > now) continue;
                if (league.isExpired) {
                    this.dropLeagueByIndex(i--);
                    continue;
                }
                prediction = league.createPrediction(this);
                const { status, message } = await Bot.api.performAction(this, {
                    method: "post",
                    path: "/prediction",
                    data: prediction,
                });
                switch (status) {
                    case 201:
                        {
                            if (this.chipsWallet[league.id])
                                this.chipsWallet[league.id] -=
                                    prediction.investment; // FIXME: Why this doesn't run
                            this.wallet.gas = Math.max(
                                0,
                                this.wallet.gas - league.gasPerPrediction
                            );
                            this.totalPredictions++;
                            this.totalInvestment += prediction.investment;
                            botlog.i(
                                this.id,
                                `did prediction worth ${prediction.investment} chips in league#${league.id}.`
                            );
                        }
                        break;
                    case 403:
                        {
                            doWalletCheck = true;
                            const msg = message.toLowerCase();
                            if (msg.includes("chip"))
                                this.chipsWallet[league.id] = 0;
                            else if (msg.includes("gas")) this.wallet.gas = 0;
                        }
                        break;
                    case 400:
                        {
                            botlog.x(
                                this.id,
                                "made a bad prediction:",
                                message
                            );
                            const msg = message.toLowerCase();
                            if (msg.includes("league is closed")) {
                                this.dropLeagueByIndex(i--);
                            } else if (msg.includes("time frame")) {
                                // so its time frame no longer available error
                                league.timeFrames = league.timeFrames.filter(
                                    (tf) => tf !== prediction.timeFrameId
                                );
                                botlog.w(
                                    this.id,
                                    ` removed timeframe#${prediction.timeFrameId} from league#${league.id} timeframes list, because its no longer available.`
                                );
                                if (!league.timeFrames?.length)
                                    this.dropLeagueByIndex(i--);
                            }
                        }
                        continue;
                    case 404:
                        this.dropLeagueByIndex(i--);
                        continue;
                    default:
                        {
                            botlog.x(
                                this.id,
                                "failed to predict due to unexpected reason:",
                                message
                            );
                            doWalletCheck = true;
                        }
                        break;
                }
            } catch (ex) {
                botlog.x(
                    this.id,
                    "had some unexpected error while playing, cause:",
                    ex
                );
                doWalletCheck = true;
            }

            if (doWalletCheck) {
                if (
                    this.chipsWallet?.[league.id] > prediction.investment ||
                    (await this.getMyTokensBalance("chip", league.id)) >
                        prediction.investment
                ) {
                    // So there may be gas insufficiency
                    insignificantProcessList.push(this.checkGasState());
                    break;
                }
                botlog.w(
                    this.id,
                    `failed to predict in league#${league.id}! investment: ${
                        prediction.investment
                    }, chip balance: ${this.chipsWallet?.[league.id]}`
                );
                if (
                    !this.chipsWallet?.[league.id] &&
                    Math.random() < Bot.config.botGasForChipChance
                ) {
                    insignificantProcessList.push(
                        this.tryGasForChipSwap(league)
                    );
                }
            }
        }

        return insignificantProcessList;
    }

    tryPlaying() {
        try {
            if (!this.accessToken) return;
            return this.play();
        } catch (ex) {
            botlog.x(this.id, "can not play in its joined leagues:", ex);
        }
        return null;
    }

    async tryParticipating() {
        try {
            if (!this.accessToken) return;
            if (!Bot.config.shouldBotParticipateInPublicLeaguesToo)
                await this.analyzePeriodicalLeagues();
            else {
                await Promise.all([
                    this.analyzePeriodicalLeagues(),
                    this.analyzePublicLeagues(),
                ]);
            }
            this.updateMyLeaguesState();
        } catch (ex) {
            botlog.x(
                this.id,
                "can not fully analyze its participation status:",
                ex
            );
        }
    }

    async tryGasForChipSwap(league) {
        try {
            this.wallet = (await this.doGasForChip(league)) || this.wallet; // if user had successful gas for chip request, he can play in at least 1 league.
            botlog.w(
                this.id,
                `had to make a gas for chip request in league#${league.id}`
            );
        } catch (ex) {
            botlog.x(
                this.id,
                "had to do gas for chip, but encountered with unexpected error:",
                ex?.toString().split("\n")[0]
            );
        }
    }

    async doGasForChip(league) {
        if (!league && league.id != null) {
            throw new Error("league expired.");
        }
        if (this.wallet.gas < league?.requiredGasToSwap) {
            throw new Error("Not enough gas.");
        }
        const { data, status, message } = await Bot.api.performAction(this, {
            method: "post",
            path: `/league/${league.id}/gas-for-chips`,
        });
        if (status !== 200) throw new Error(message);

        return data.wallet;
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
                botlog.x(
                    this.id,
                    `:#${this.username} failed to register too. Bot can not get in any way possible.`
                );
                this.accessToken = null;
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
            const { status, message, data } = await Bot.api.performAction(
                this,
                {
                    method: "get",
                    path: `/league/${this.id}/balance`,
                    queries: { token: "omn" },
                }
            );
            if (status !== 200) throw new Error(message);
            league.pool = data;
        } catch (ex) {
            botlog.x(
                this.id,
                `failed to fetch league#${league.id} pool since:`,
                ex
            );
        }
        return league.pool;
    }

    async claimOMN() {
        try {
            const { status, data, message } = await Bot.api.performAction(
                this,
                {
                    method: "post",
                    path: `/shop/claim`,
                }
            );

            if (status !== 201) {
                throw new Error(message);
            }
            await this.getMyTokensBalance("omn");
            botlog.i(
                this.id,
                `successfully claimed ${data.amount} OMNs and now has ${this.wallet.omn} OMNs in total.`
            );
            return true;
        } catch (ex) {
            botlog.w(this.id, "failed to claim OMN, since:", ex);
        }
        return false;
    }

    static async ForceLoginBots(bots) {
        // TODO: If expiry added to omenium jwt tokens, update this to reset .accessToken first.
        const processList = [];
        for (let i = 0; i < bots.length; i++) {
            if (!bots[i].accessToken && !(await bots[i].getIn())) {
                bots.splice(i, 1);
                i--;
            } else {
                processList.push(bots[i].updateMyWallet());
            }
        }
        await Promise.all(processList);
        await Bot.SaveState(bots);
    }

    static async SaveState(bots) {
        try {
            await saveJsonData(
                "state",
                bots.map((bot) => bot.userData)
            );
            botlog.i(
                "manager",
                `saved the ${bots.length} bots state successfully.`
            );
        } catch (ex) {
            botlog.x("manager", "failed to save bots state:", ex);
        }
    }

    static async UpdateTotalBotsList(newBots) {
        try {
            const bots = await loadJsonFileData("total_bots");
            bots.push(...newBots.map((bot) => bot.userData));
            await saveJsonData("total_bots", bots);
            botlog.i(
                "manager",
                `updated total bot list which is list of all bots even including dead or old bots.`
            );
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
