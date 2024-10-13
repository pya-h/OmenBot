const { MAX_BOT_AGE } = process.env;
import { hash } from "bcrypt";
import { getRandomElement, loadJsonFileData } from "./tools.js";

const maxBotAge = +MAX_BOT_AGE;
export const numberGenerationMethods = [
    // FIXME: It seems one of these methods, sometimes return empty string.
    () => {
        /// by birth year
        const currentYear = new Date().getFullYear();
        return ((Math.random() * maxBotAge) | 0) + (currentYear - maxBotAge);
    },
    () => {
        /// by a maximum
        const maxNumber = 9999999;
        return (Math.random() * maxNumber) | 0;
    },
    () => ((Math.random() * maxBotAge) | 0) + 18, /// by age
    () =>
        Array((Math.random() * 10) | 0)
            .fill((Math.random() * 10) | 0)
            .join(""), // by digit repeat
];

export const createRandomUsername = (possibleNames) => {
    const specialChars = ["", ".", "_", "-", "", ""];
    return (
        getRandomElement(possibleNames) + getRandomElement(specialChars) + getRandomElement(numberGenerationMethods)()
    );
};

export const createRandomEmail = (possibleDomains, username, email) => {
    let extra = "";
    if (email)
        // means the email was not unique
        extra = (Math.random() * 1000) | 0; // add another random number to make sure email is unique too.
    return `${username}${extra}@${getRandomElement(possibleDomains)}`;
};

export const generateBotsImportData = async ({
    count,
    password,
    maxBotLevel,
    saltRounds,
    privateProfile = true,
    forRegister = false,
}) => {
    const { names, domains } = await loadJsonFileData("identity");
    if (!names || !domains) throw new Error("Loading identity data was not completely successful!");
    const generatedNames = [];
    const hashedPassword = await hash(password, saltRounds);
    return Array(count)
        .fill(null)
        .map(() => {
            let username = null;
            while (!username || generatedNames.includes(username)) username = createRandomUsername(names);
            generatedNames.push(username);
            let email = null;
            while (!email) email = createRandomEmail(domains, username, email);
            return {
                username,
                email,
                password: hashedPassword,
                levelId: ((Math.random() * maxBotLevel) | 0) + 1,
                private: privateProfile,
                ...(forRegister ? { referralCode: "" } : {}),
            };
        });
};
