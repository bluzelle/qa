const chalk = require('chalk');

const LOG_LEVEL_ENUM = Object.freeze({info: 1, warn: 2, crit: 3});
const LOG_LEVEL_CHALK_MAP = Object.freeze({info: "green", warn: "yellow", crit: "red"});

const log = module.exports.log = Object.defineProperties({}, {
    'compareLevel': {value: (level) => LOG_LEVEL_ENUM[level] >= LOG_LEVEL_ENUM[harnessConfigs.logLevel] ? true : false},
    'info': {
        value: (string) => log.compareLevel('info') && console.log(chalk[LOG_LEVEL_CHALK_MAP['info']](string)),
        enumerable: true
    },
    'warn': {
        value: (string) => log.compareLevel('warn') && console.error(chalk[LOG_LEVEL_CHALK_MAP['warn']](string)),
        enumerable: true
    },
    'crit': {
        value: (string) => log.compareLevel('crit') && console.error(chalk[LOG_LEVEL_CHALK_MAP['crit']](string)),
        enumerable: true
    }
});
