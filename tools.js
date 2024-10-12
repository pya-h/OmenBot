import fs from "fs";

export const loadJsonFileData = (filename) => {
    if(filename.slice(-5).toLowerCase() !== '.json')
        filename += '.json';
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