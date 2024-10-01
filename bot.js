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
  }

  static findBots() {
    // this should send a req to server to find users with their user.isBot=true, with a special token is req header.
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
