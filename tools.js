import fs from "fs";

export const loadJsonFileData = (filename) => {
    if (filename.slice(-5).toLowerCase() !== ".json") filename += ".json";
    return new Promise((resolve, reject) => {
        fs.readFile(`data/${filename}`, "utf8", (err, data) => {
            if (err) reject("Error loading identity data: " + err);
            try {
                resolve(JSON.parse(data));
            } catch (error) {
                reject("Error parsing identity data: " + error);
            }
        });
    });
};

export const getRandomElement = (arr) => arr[(Math.random() * arr.length) | 0];

export const randomInt = (min, ...maximums) => {
    return ((Math.random() * (Math.min(...maximums) - min + 1)) | 0) + min;
};

const logMessagePrefix = (botId, message) =>
    `${new Date().toLocaleString()}: \t Bot#${botId} ${message}`;

export const botlog = {
    x: (botId, message, ...extra) =>
        console.error(logMessagePrefix(botId, message), ...extra),
    w: (botId, message, ...extra) =>
        console.warn(logMessagePrefix(botId, message), ...extra),
    i: (botId, message, ...extra) =>
        console.info(logMessagePrefix(botId, message), ...extra),
    l: (botId, message, ...extra) =>
        console.log(logMessagePrefix(botId, message), ...extra),
};
