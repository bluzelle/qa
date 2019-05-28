const {times, random} = require('lodash');

exports.generateString = function (length) {
    return times(length, () => String.fromCharCode(random(64, 90))).join('');
};

exports.counter = ({start, step = 1}) => {
    let count = start - 1;
    return () => count += step
};

exports.useState = (initialValue) => {
    let value = initialValue;
    return [
        () => value,
        (newValue) => value = newValue
    ]
};
