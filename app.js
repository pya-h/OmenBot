import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";
import cron from "node-cron";

const importBots = async (count) => {
    const { PRIVATE_PROFILE, BOT_PASSWORD, MAX_BOT_LEVEL, SALT_ROUNDS } =
        process.env;

    const botCredentials = await generateBotsImportData({
        count,
        password: BOT_PASSWORD,
        maxBotLevel: +MAX_BOT_LEVEL,
        saltRounds: +SALT_ROUNDS,
        privateProfile: PRIVATE_PROFILE.toLowerCase() === "true",
        forRegister: false,
    });

    const { status, data } = await ApiService.Get().import(botCredentials);
    // TODO: Analyze import data to obtain how many bots were imported and other stuff
    // Then filter out credentials which were not imported.
    return botCredentials?.map((botIdentity) => new Bot(botIdentity));
};

const manageBotsParticipation = async (bots) => {
    for (const bot of bots) {
        try {
            if (!bot.accessToken)
                continue;

            await bot.analyzePeriodicalLeagues();
            bot.dropExpiredLeagues();
        } catch (ex) {
            console.error(`Bot#${bot.id} can not fully analyze its participation status:`, ex);
        }
    }

};

const manageBotsPlaying = async (bots) => {
    for (const bot of bots) {
        try {
            if (!bot.accessToken)
                continue;
            await bot.play();
        } catch(ex) {
            console.error(`Bot#${bot.id} can not play in its joined leagues:`, ex);
        }
    }

};

const setup = async () => {
    const { BOTS_COUNT, LOAD_STATE, PLAY_PUBLIC_LEAGUES, BOT_PLAY_INTERVAL, BOT_PARTICIPATION_UPDATE_INTERVAL } = process.env;

    let bots =
        LOAD_STATE.toLowerCase() === "true" ? await Bot.LoadState() : [];
    if (+BOTS_COUNT) {
        const newBots = await importBots(+BOTS_COUNT);
        bots.push(...newBots);
    }

    if(!bots?.length)
        throw new Error('Could not prepare any bot. App will close now.')

    cron.schedule('0 * * * *', async() => {
        await Bot.ForceLoginBots(bots);
    });

    cron.schedule(`*/${+BOT_PARTICIPATION_UPDATE_INTERVAL} * * * *`, async () => {
        await manageBotsParticipation(bots);
    });

    cron.schedule(`*/${+BOT_PLAY_INTERVAL} * * * * *`, async () => {
        await manageBotsPlaying(bots);
    });
};

setup().catch((err) => console.error("Bot manager failed to setup.", err));
