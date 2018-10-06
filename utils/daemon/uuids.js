const fs = require('fs');
const uuid = require('uuid/v4');

let blacklist;

module.exports = {
    generate: (num) => {
        return [...Array(num).keys()].reduce(acc => {
            acc.push(uuid());
            return acc;
        }, []).sort()
    },

    blacklist: () => {

        if (!blacklist) {
            blacklist = fs.readFileSync('./configs/uuidslist.txt').toString().split('\n')
        }

        return blacklist;
    }
};
