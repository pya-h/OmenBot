import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";

const { BOTS_COUNT, FETCH_BOTS, CONSIDER_PUBLIC_LEAGUES } = process.env;

const importBots = async (count) => {
    const botCredentials = await generateBotsImportData(count);
    return botCredentials?.map((botIdentity) => new Bot(botIdentity));
};

/* BOTS_COUNT not null =>> register/import new bots
    FETCH_BOT == true ==> Fetch previously generated bots from omenium endpoint.
    [better to set BOT_COUNT=0 for this, to prevent extra bot generation, if you want to use old bots.]*/
const start = async () => {
    const bots = FETCH_BOTS === "true" ? await Bot.FetchBots() : [];
    if (+BOTS_COUNT) {
        const newBots = await importBots(+BOTS_COUNT);
        bots.push(...newBots)
    }
    
};

(async () => await start())();
