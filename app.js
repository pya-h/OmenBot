import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";
import cron from "node-cron";
import { botlog, saveJsonData } from "./tools.js";

const importBots = async (count) => {
    const { PRIVATE_PROFILE, BOT_PASSWORD, MAX_BOT_LEVEL, SALT_ROUNDS } = process.env;

    try {
        const botCredentials = await generateBotsImportData({
            count,
            password: BOT_PASSWORD,
            maxBotLevel: +MAX_BOT_LEVEL,
            saltRounds: +SALT_ROUNDS,
            privateProfile: PRIVATE_PROFILE.toLowerCase() === "true",
            forRegister: false,
        });

        const { status, data, message } = await ApiService.Get().import(botCredentials);
        if (status !== 201) throw new Error(message);

        const { successCount, failures } = data;
        if (successCount < count) {
            botlog.w(
                "admin",
                `${
                    count - successCount
                }/count bots not imported. The list of those not imported and the probable cause is listed in log files.`
            );
            await saveJsonData('import_failures', failures);
        }
        
        return botCredentials?.map((botIdentity) => new Bot({...botIdentity, password: BOT_PASSWORD}));
    } catch (ex) {
        botlog.x("admin", "fail to import bots, since:", message);
    }
};

const manageBotsParticipation = async (bots) => {
    for (const bot of bots) {
        try {
            if (!bot.accessToken) continue;

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
            if (!bot.accessToken) continue;
            await bot.play();
        } catch (ex) {
            console.error(`Bot#${bot.id} can not play in its joined leagues:`, ex);
        }
    }
};

const setup = async () => {
    const { BOTS_COUNT, LOAD_STATE, PLAY_PUBLIC_LEAGUES, BOT_PLAY_INTERVAL, BOT_PARTICIPATION_UPDATE_INTERVAL } =
        process.env;

    let bots = LOAD_STATE.toLowerCase() === "true" ? await Bot.LoadState() : [];
    if (+BOTS_COUNT) {
        const newBots = await importBots(+BOTS_COUNT);
        bots.push(...newBots);
        await saveJsonData('total_bots', bots)
    }

    if (!bots?.length) throw new Error("Could not prepare any bot. App will close now.");

    cron.schedule("0 * * * *", async () => {
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
