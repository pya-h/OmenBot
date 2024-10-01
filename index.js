import ApiService from "./api";
import { generateBotsImportData } from "./identity";

const { BOTS_COUNT, FETCH_BOTS } = process.env;

const importBots = async (count) => {
  const botCredentials = generateBotsImportData(count);

  // this must return instances of bot.
};

const fetchBots = async (max = null) => {

}

const start = async () => {
    // BOTS_COUNT not null =>> register/import nbew bots
    // FETCH_BOT == true ==> Fetch previously generated bots from omenium endpoint.
        // [better to set BOT_COUNT=0 for this, to prevent extra bot generation, if you want to use old bots.]
    let bots = [];
    if(BOTS_COUNT && +BOTS_COUNT > 0)
        bots = await importBots(BOTS_COUNT);

    if(FETCH_BOTS.toString() === 'true') {
        let previousBots = await fetchBots(); // call fetch bots endpoint; TODO: Must be implemented in backend.
        bots.push(...previousBots)
    }
};
