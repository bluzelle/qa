const {readFileSync, readdirSync} = require('fs');

const PATH_TO_DAEMON = './daemon-build/';

const logUtils = {
    readDir: path => {
        return readdirSync(PATH_TO_DAEMON + path);
    }
};

module.exports = logUtils;
