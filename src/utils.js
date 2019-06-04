const {times, random} = require('lodash');
const {readDaemonFile, writeDaemonFile} = require('./FileService');

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

exports.editConfigFile = (daemonObj, changes, deletes) => {

    const configFile = readDaemonFile(daemonObj.swarm_id, daemonObj, daemonObj.config_name).run();

    if (changes) {
        changes.forEach(([param, value]) => configFile[param] = value);
    }

    if (deletes) {
        deletes.forEach(param => delete configFile[param]);
    }

    writeDaemonFile(daemonObj, daemonObj.swarm_id,daemonObj.config_name, configFile).run();
};
