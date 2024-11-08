import ApiService from "./api.js";
import Bot from "./bot.js";
import { generateBotsImportData } from "./identity.js";
import cron from "node-cron";
import { botlog, saveJsonData } from "./tools.js";
import BotConfig from "./config.js";

const importBots = async (count) => {
    const conf = BotConfig.Get();
    const botCredentials = await generateBotsImportData({
        count,
        password: conf.botPassword,
        maxBotLevel: conf.botMaxLevel,
        saltRounds: conf.hashSaltRound,
        privateProfile: conf.isBotProfilePrivate,
        forRegister: false,
    });
    try {
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
            await saveJsonData("import_failures", failures);
        }
    } catch (ex) {
        botlog.x("admin", "fail to import bots, since:", ex);
    }

    return botCredentials?.map((botIdentity) => new Bot({ ...botIdentity, password: conf.botPassword }));
};

const loadBotsPreviousLeagues = async (bots) => {
    await Promise.all(bots.map((bot) => bot.loadMyLeagues()));
};

const manageBotsParticipation = async (bots) => {
    await Promise.all(bots.map((bot) => bot.tryParticipating()));

    if (Bot.publicLeaguesTempList?.length) Bot.publicLeaguesTempList = null;
};

const manageBotsPlaying = async (bots) => {
    const insignificantTasks = await Promise.all(bots.map((bot) => bot.tryPlaying()));
    await Promise.all(insignificantTasks.flat());
};

const setup = async () => {
    const conf = BotConfig.Get();
    let bots = conf.loadLastState ? await Bot.LoadState() : [];
    if (conf.botsCount > 0) {
        botlog.w("admin", `importing ${conf.botsCount} bots, wait a little ...`);
        const newBots = await importBots(conf.botsCount);
        bots.push(...newBots);
        await saveJsonData("total_bots", bots);
    }

    if (!bots?.length) throw new Error("Could not prepare any bot. App will close now.");

    await Bot.ForceLoginBots(bots);

    if (conf.loadLastState) await loadBotsPreviousLeagues(bots);

    cron.schedule("0 * * * *", async () => {
        await Bot.ForceLoginBots(bots);
    });

    cron.schedule(`*/${+conf.botParticipationIntervalInMinutes} * * * * *`, async () => {
        await manageBotsParticipation(bots);
    });

    cron.schedule(`*/${+conf.botGameplayIntervalInSeconds} * * * * *`, async () => {
        await manageBotsPlaying(bots);
    });
};

setup().catch((err) => botlog.x("manager", "Bot manager failed to setup.", err));
