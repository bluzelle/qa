const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');
const {wrappedError} = require('../../src/utils');
const {log} = require('../../src/logger');


exports.remoteSwarmHook = function ({createDB = true, log = false, logDetailed = false} = {}) {
    before('initialize client and setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);
        this.api = await remoteSetup({createDB, log, logDetailed});
    });

    after('deleteDB', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        if (await this.api._hasDB()) {
            await this.api._deleteDB();
        }
    });
};

const remoteSetup = exports.remoteSetup = async function ({createDB = true, log = false, logDetailed = false} = {}) {
    const apis = await initializeClient({
        ethereum_rpc: harnessConfigs.ethereumRpc,
        esrContractAddress: harnessConfigs.esrContractAddress,
        createDB: false,
        log,
        logDetailed
    });

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

exports.localSwarmHooks = function ({beforeHook = before, afterHook = after, createDB = true, numOfNodes = harnessConfigs.numOfNodes, preserveSwarmState = false, log, logDetailed} = {}) {
    beforeHook('start swarm and client, create db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        const {manager, swarm, api} = await localSetup({numOfNodes, createDB, log, logDetailed});
        this.swarmManager = manager;
        this.swarm = swarm;
        this.api = api;
    });

    stopSwarmsAndRemoveStateHook({afterHook, preserveSwarmState});
};

const localSetup = exports.localSetup = async function ({numOfNodes = harnessConfigs.numOfNodes, createDB = true, log, logDetailed, configOptions} = {}) {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: numOfNodes, configOptions});

    await manager.startAll();

    const apis = await initializeClient({
        ethereum_rpc: harnessConfigs.ethereumRpc,
        esrContractAddress: manager.getEsrContractAddress(),
        createDB: createDB,
        log,
        logDetailed
    });
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

const stopSwarmsAndRemoveStateHook = exports.stopSwarmsAndRemoveStateHook = function ({afterHook = after, preserveSwarmState = false}) {
    afterHook('stop daemons and remove state', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        await localTeardown.call(this, preserveSwarmState);
    });
};
