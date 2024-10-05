import ApiService from "./api";

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
    this.joinedLeagues = [];
  }

  static findBots() {
    // this should send a req to server to find users with their user.isBot=true, with a special token is req header.
  }

  async getPeriodicalLeagues() {
    // TODO: add /api to axios base url
    const { data, status } = await ApiService.get().performAction(this, {
      method: "get",
      path: "/periodical-league",
    });
    if (status !== 200) throw new Error("Can not get periodical leagues list.");
    return data;
  }
  async getPeriodicalLeagueStatus(periodicalLeagueId) {
    const { data, status } = await ApiService.get().performAction(this, {
      method: "get",
      path: `/periodical-league/${periodicalLeagueId}/rounds-status`,
    });
    if (status !== 200) throw new Error("Can not get periodical leagues status.");
    return data;
  }

  async joinOngoingRound(periodicalLeagueId) {
    const { status, data } = await ApiService.get().performAction(this, {
      method: "post",
      path: `/periodical-league/${periodicalLeagueId}/join`,
    });
    if (status !== 201) {
      // checkout status code if its already joined or not.
    }
    this.joinedLeagues.push(data.id);
    return data;
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
