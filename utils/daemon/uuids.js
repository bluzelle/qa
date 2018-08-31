const fs = require('fs');

let uuids;

if (!uuids) {
    uuids = fs.readFileSync('./configs/uuidslist.txt').toString().split('\n');
}

module.exports = uuids;
