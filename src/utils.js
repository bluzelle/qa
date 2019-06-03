const {times, random} = require('lodash');

exports.generateString = function (length) {
    return times(length, () => String.fromCharCode(random(64, 90))).join('');
};
