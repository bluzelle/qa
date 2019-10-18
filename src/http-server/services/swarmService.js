const {find} = require('lodash');
const swarmManager = require('./swarmManagerService');

exports.generateSwarm = async function (numberOfDaemons, configOptions = {}) {
    const swarm = await swarmManager.get().generateSwarm({numberOfDaemons, configOptions});
    return swarmInfo(swarm);
};

exports.startAll = function () {
    return Promise.all(
        swarmManager.get()
            .getSwarms()
            .map(swarm => swarm.startUnstarted()))
};

exports.stopAll = function () {
    return swarmManager.get().stopAll();
};

exports.removeSwarmState = function () {
    return swarmManager.get().removeSwarmState();
};

exports.getEsrContractAddress = function () {
    return swarmManager.get().getEsrContractAddress();
};

exports.getSwarms = async function () {
    const swarms = await swarmManager.get().getSwarms();
    return swarms.map(swarmInfo);
};

exports.getSwarm = async function (swarmName) {
    const swarms = await swarmManager.get().getSwarms();
    return find(swarms, swarm => swarm.getSwarmId() === swarmName);
};

exports.startSwarm = async function (swarm) {
    await swarm.startUnstarted();
    return swarmInfo(swarm);
};

exports.stopSwarm = async function (swarm) {
    await swarm.stop();
    return swarmInfo(swarm);
};

exports.addDaemon = async function (swarm, addToRegistry = true) {
    await swarm.addDaemon({addToRegistry});
    return swarmInfo(swarm);
};

exports.startPartial = async function (swarm, numberOfDaemonsToStart) {
    await swarm.startPartial(numberOfDaemonsToStart);
    return swarmInfo(swarm);
};

exports.startUnstarted = async function (swarm) {
    await swarm.startUnstarted();
    return swarmInfo(swarm);
};

exports.getPrimary = async function (swarm) {
    return await swarm.getPrimary();
};

exports.setPrimary = async function (swarm, publicKey) {
    await swarm.setPrimary(publicKey);
    return swarmInfo(swarm);
};

const swarmInfo = exports.swarmInfo = function (swarm) {
    return {
        swarmId: swarm.getSwarmId(),
        nodeUpStatus: nodeUpStatus(swarm),
        bootstrapPeersList: swarm.getPeersList(),
    }
};

const nodeUpStatus = exports.nodeUpStatus = function (swarm) {
    return swarm.getDaemons().reduce((statusObject, daemon) => {
        statusObject[daemon.listener_port] = {
            isRunning: daemon.isRunning()
        };
        return statusObject
    }, {});
};

exports.getStream = function (swarm, identifier) {
    try {
        const daemons = swarm.getDaemons();
        let daemon;

        if (isPublicKey(identifier)) {
            daemon = find(daemons, daemon => daemon.publicKey === identifier);
        } else {
            daemon = find(daemons, daemon => daemon.listener_port === parseInt(identifier));
        }

        return daemon.getProcess().stdout;
    } catch (err) {
        throw new Error(`Error retrieving stream: ${err}`)
    }

};

function isPublicKey(identifier) {
    return identifier.startsWith('MF')
};
