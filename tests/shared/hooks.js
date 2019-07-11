const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');
const {wrappedError} = require('../../src/utils');


exports.remoteSwarmHook = function (clientArguments) {
    before('initialize client and setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        this.api = await remoteSetup(clientArguments);
    });

    after('deleteDB', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }
    });
};

const remoteSetup = exports.remoteSetup = async function ({createDB = true, ...clientArguments} = {}) {

    const apis = await initializeClient(clientArguments);
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

exports.localSwarmHooks = function (args = {}) {
    const {beforeHook = before, afterHook = after, preserveSwarmState, ...swarmAndClientArguments} = args;

    beforeHook('start swarm and client, create db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        const {manager, swarm, api} = await localSetup(swarmAndClientArguments);
        this.swarmManager = manager;
        this.swarm = swarm;
        this.api = api;
    });

    stopSwarmsAndRemoveStateHook({afterHook, preserveSwarmState});
};

const localSetup = exports.localSetup = async function ({numOfNodes = harnessConfigs.numOfNodes, configOptions, createDB = true, ...clientArguments} = {}) {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: numOfNodes, configOptions});

    await manager.startAll();

    const apis = await initializeClient({esrContractAddress: manager.getEsrContractAddress(), createDB, ...clientArguments});
    const api = apis[0];

    return {manager, swarm, api}
};


const localTeardown = exports.localTeardown = async function (preserveSwarmState = false) {
    await this.swarmManager.stopAll();
    if (!preserveSwarmState) {
        this.swarmManager.removeSwarmState();
    }
};

const stopSwarmsAndRemoveStateHook = exports.stopSwarmsAndRemoveStateHook = function (args) {
    const {afterHook = after, preserveSwarmState} = args;

    afterHook('stop daemons and remove state', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        await localTeardown.call(this, preserveSwarmState);
    });
};
