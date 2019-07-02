const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');
const {wrappedError} = require('../../src/utils');


exports.remoteSwarmHook = function ({createDB = true, log = false, logDetailed = false} = {}) {
    before('initialize client and setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);
        this.api = await remoteSetup({createDB, log, logDetailed});
    });

    after('deleteDB', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        if (await this.api.hasDB()) {
            await this.api.deleteDB();
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
            if (await api.hasDB().timeout(harnessConfigs.clientOperationTimeout)) {
                await api.deleteDB().timeout(harnessConfigs.clientOperationTimeout);
            }
            await api.createDB().timeout(harnessConfigs.clientOperationTimeout);
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

const localSetup = exports.localSetup = async function ({numOfNodes = harnessConfigs.numOfNodes, createDB = true, log, logDetailed} = {}) {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: numOfNodes});

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
