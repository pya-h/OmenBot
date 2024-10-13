import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";
import cron from "node-cron";
import { botlog, saveJsonData } from "./tools.js";
import BotConfig from "./config.js";

const importBots = async (count) => {
    const conf = BotConfig.Get();
    try {
        const botCredentials = await generateBotsImportData({
            count,
            password: conf.botPassword,
            maxBotLevel: conf.botMaxLevel,
            saltRounds: conf.hashSaltRound,
            privateProfile: conf.isBotProfilePrivate,
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
        
        return botCredentials?.map((botIdentity) => new Bot({...botIdentity, password: conf.botPassword}));
    } catch (ex) {
        botlog.x("admin", "fail to import bots, since:", ex);
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
    const conf = BotConfig.Get();
    let bots = conf.loadLastState ? await Bot.LoadState() : [];
    if (conf.botsCount > 0) {
        const newBots = await importBots(conf.botsCount);
        bots.push(...newBots);
        await saveJsonData('total_bots', bots)
    }

    if (!bots?.length) throw new Error("Could not prepare any bot. App will close now.");

    cron.schedule("0 * * * *", async () => {
        await Bot.ForceLoginBots(bots);
    });

    cron.schedule(`*/${+conf.botParticipationIntervalInMinutes} * * * *`, async () => {
        await manageBotsParticipation(bots);
    });

    cron.schedule(`*/${+conf.botGameplayIntervalInSeconds} * * * * *`, async () => {
        await manageBotsPlaying(bots);
    });
};

setup().catch((err) => console.error("Bot manager failed to setup.", err));
