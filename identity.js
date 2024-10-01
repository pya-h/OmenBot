const { BOT_PASSWORD, MAX_BOT_LEVEL } = process.env;

const maxBotAge = 70;
export const numberGenerationMethods = [
  () => {
    /// by birth year
    const currentYear = new Date().getFullYear();
    return ((Math.random() * maxBotAge) | 0) + (currentYear - maxBotAge);
  },
  () => {
    /// by a maximum
    const maxNumber = 9999999;
    return (math.random() * maxNumber) | 0;
  },
  () => ((math.random() * maxBotAge) | 0) + 18, /// by age
  () =>
    Array((math.random() * 10) | 0)
      .fill((math.random() * 10) | 0)
      .join(""), // by digit repeat
];

export const getRandomElement = (arr) => arr[(Math.random() * arr.length) | 0];

export const createRandomUsername = () => {
  const possibleNames = ["john", "roz", "sara", "anonymous", "micheal"];
  const specialChars = [".", "_", ".", "", ""];
  return (
    getRandomElement(possibleNames) +
    getRandomElement(specialChars) +
    getRandomElement(numberGenerationMethods)()
  );
};

export const createRandomEmail = (username, email) => {
  const emailDomains = ["omenium.com", "hotmail.com", "yahoo.com"];
  let extra = "";
  if (email)
    // means the email was not unique
    extra = (Math.random() * 1000) | 0; // add another random number to make sure email is unique too.
  return `${username}${extra}@${getRandomElement(emailDomains)}`;
};

export const generateBotsImportData = (count) => {
  generatedNames = [];
  return Array(count)
    .fill(null)
    .map((_, i) => {
      let username = undefined;
      while (!username || generatedNames.includes(username))
        username = createRandomUsername();
      generatedNames.push(username);
      let email = null;
      while (!email) email = createRandomEmail(username, email);
      return {
        username,
        email,
        password: BOT_PASSWORD,
        levelId: (Math.random() * (MAX_BOT_LEVEL + 1)) | 0,
        // think about avatar
        admin: false,
        referralCode: "",
      };
    });
};