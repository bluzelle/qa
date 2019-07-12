const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');
const {wrappedError} = require('../../src/utils');
const {log} = require('../../src/logger');


exports.remoteSwarmHook = function ({createDB, uuid, ethereum_rpc, esrContractAddress, private_pem, public_pem, log, logDetailed} = {}) {
    const clientArguments = {uuid, ethereum_rpc, esrContractAddress, private_pem, public_pem, log, logDetailed};

    before('initialize client and setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        this.api = await remoteSetup({createDB, ...clientArguments});
    });

    after('deleteDB', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);

        if (await this.api._hasDB()) {
            await this.api._deleteDB();
        }
    });
};

const remoteSetup = exports.remoteSetup = async function ({createDB = true, uuid, ethereum_rpc, esrContractAddress, private_pem, public_pem, log, logDetailed} = {}) {
    const clientArguments = {uuid, ethereum_rpc, esrContractAddress, private_pem, public_pem, log, logDetailed};

    const apis = await initializeClient({createDB: false, ...clientArguments});
    const api = apis[0];

    try {
        if (createDB) {
            if (await api._hasDB().timeout(harnessConfigs.clientOperationTimeout)) {
                await api._deleteDB().timeout(harnessConfigs.clientOperationTimeout);
            }
            await api._createDB().timeout(harnessConfigs.clientOperationTimeout);
        }
    } catch (err) {
        throw wrappedError(err, 'Problem with handling DB')
    }

    return api;
};

exports.localSwarmHooks = function ({beforeHook = before, afterHook = after, createDB, configOptions, preserveSwarmState, uuid, ethereum_rpc, private_pem, public_pem, log, logDetailed} = {}) {

    beforeHook('start swarm and client, create db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        const clientArguments = {uuid, ethereum_rpc, private_pem, public_pem, log, logDetailed};
        const {manager, swarm, api} = await localSetup({createDB, configOptions, ...clientArguments});
        this.swarmManager = manager;
        this.swarm = swarm;
        this.api = api;
    });

    stopSwarmsAndRemoveStateHook({afterHook, preserveSwarmState});
};

const localSetup = exports.localSetup = async function ({numOfNodes = harnessConfigs.numOfNodes, configOptions, createDB = true, uuid, ethereum_rpc, private_pem, public_pem, log, logDetailed} = {}) {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: numOfNodes, configOptions});
    await manager.startAll();

    const clientArguments = {esrContractAddress: manager.getEsrContractAddress(), uuid, ethereum_rpc, private_pem, public_pem, log, logDetailed};
    const apis = await initializeClient({createDB, ...clientArguments});
    const api = apis[0];

    return {manager, swarm, api}
};

const localTeardown = exports.localTeardown = async function (preserveSwarmState = false) {
    if (this.swarmManager === undefined) {
        log.info("No swarm manager (before hook likely failed), skipping teardown");
        return;
    }
    await this.swarmManager.stopAll();
    if (!preserveSwarmState) {
        this.swarmManager.removeSwarmState();
    }
};

const stopSwarmsAndRemoveStateHook = exports.stopSwarmsAndRemoveStateHook = function ({afterHook = after, preserveSwarmState} = {}) {
    afterHook('stop daemons and remove state', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        await localTeardown.call(this, preserveSwarmState);
    });
};
