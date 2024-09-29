const apiService = require('./api');

const {BOTS_COUNT} = process.env;

const maxBotAge = 70;
const numberGenerationMethods = [
    () => { /// by birth year
        const currentYear = (new Date()).getFullYear();
        return ((Math.random() * maxBotAge) | 0) + (currentYear - maxBotAge);
    },
    () => {
        /// by a maximum
        const maxNumber = 9999999;
        return (math.random() * maxNumber) | 0;
    },
    () => ((math.random() * maxBotAge) | 0) + 18, /// by age  
    () => Array((math.random() * 10) | 0).fill((math.random() * 10) | 0).join(''), // by digit repeat
];

const getRandomElement = arr => arr[(Math.random() * arr.length) | 0];

const createRandomUsername = () => {
    const possibleNames = ['john', 'roz', 'sara', 'anonymous', 'micheal'];
    const specialChars = ['.', '_', '.', '', ''];
    return getRandomElement(possibleNames) + getRandomElement(specialChars)
        + getRandomElement(numberGenerationMethods)();
}

const createRandomEmail = username => {
    const emailDomains = ['omenium.com', 'hotmail.com', 'yahoo.com', ];

    return `${username}@${getRandomElement(emailDomains)}`
}
const generateBotsImportData = (count) => {
    generatedNames = [];
    return Array(count).fill(null).map((_, i) => {
        let username = undefined;
        while(!username || generatedNames.includes(username)) username = createRandomUsername();
        generatedNames.push(username);
    })
}
const importBots = (count) => {
    
}

const start = () => {

}