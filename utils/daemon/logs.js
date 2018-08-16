const {readFileSync, readdirSync} = require('fs');

const PATH_TO_DAEMON = './daemon-build/';

const logUtils = {
    readFile: (dirPath, fileName) => {
        return readFileSync(PATH_TO_DAEMON + dirPath + fileName, 'utf8');
    },
    readDir: path => {
        return readdirSync(PATH_TO_DAEMON + path);
    },
    compareData: (done, dataObj, removeFlag = false) => {
        let value;
        let results = [];

        for (let key in dataObj) {

            let data = dataObj[key];

            if (removeFlag) {
                // remove first entry
                let arr = data.split('\n');
                arr.splice(0,1);
                data = arr.toString();
            }

            if (!value) {
                value = data;
            }

            results.push(value === data);
        }

        if (results.every(v => v)) {
            done()
        }
    }
};

module.exports = logUtils;
