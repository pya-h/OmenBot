import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";

const importBots = async (count) => {
    const { PRIVATE_PROFILE, BOT_PASSWORD, MAX_BOT_LEVEL } = process.env;
    const botCredentials = await generateBotsImportData(
        count,
        BOT_PASSWORD,
        +MAX_BOT_LEVEL,
        PRIVATE_PROFILE.toLowerCase() === "true"
    );

    const {status, data} = await ApiService.Get().import(botCredentials);
    // TODO: Analuze import data to obtain how many bots were imported and other stuff
    // Then filter out credentials which were not imported.
    return botCredentials?.map((botIdentity) => new Bot(botIdentity));
};

/* BOTS_COUNT not null =>> register/import new bots
    FETCH_BOT == true ==> Fetch previously generated bots from omenium endpoint.
    [better to set BOT_COUNT=0 for this, to prevent extra bot generation, if you want to use old bots.]*/
const start = async () => {
    const { BOTS_COUNT, FETCH_BOTS, PLAY_PUBLIC_LEAGUES } = process.env;

    const bots =
        FETCH_BOTS.toLowerCase() === "true" ? await Bot.FetchBots() : [];
    if (+BOTS_COUNT) {
        const newBots = await importBots(+BOTS_COUNT);
        bots.push(...newBots);
    }

    for(const bot of bots) {
        if(!(await bot.getIn())) {
            // TODO: If bot couldn't get in, filter it out from the rest.
        }
        
    }
};

start().catch((err) => console.error("Bot manager failed to start."));
