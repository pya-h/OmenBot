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
      chip: 10000,
      omn: 100,
      badge: 0
    };
  }

  getMyWallet() {
    // TODO:
  }

  getMyTokensBalance(token, leagueId = null) {
    // TODO:
  }
  static findBots() {
    // TODO: this should send a req to server to find users with their user.isBot=true, with a special token is req header.
  }

  async getPeriodicalLeagues() {
    const { data, status } = await ApiService.get().performAction(this, {
      method: "get",
      path: "/periodical-league/champions",
    });
    if (status !== 200) throw new Error("Can not get periodical leagues list.");
    return data;
  }
  async getPeriodicalLeagueParticipationStatus(periodicalLeagueId) {
    const { data, status } = await ApiService.get().performAction(this, {
      method: "get",
      path: `/periodical-league/${periodicalLeagueId}/participation-mode`,
    });
    if (status !== 200)
      throw new Error("Can not get periodical leagues status.");
    return data;
  }

  async joinOngoingRound(periodicalLeagueId) {
    const { status, data } = await ApiService.get().performAction(this, {
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
      }
    }
  }

  async dropExpiredLeagues() {
    this.myLeagues = this.myLeagues.filter(league => !league.isExpired)
  }

  async play() {

  }

  async getIn() {
    const api = ApiService.get();
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
