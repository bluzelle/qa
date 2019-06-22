const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');

exports.remoteSwarmHook = function ({createDB = true, log = false, logDetailed = false} = {}) {
    before('initialize client and setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        const apis = await initializeClient({
            ethereum_rpc: harnessConfigs.ethereumRpc,
            esrContractAddress: harnessConfigs.esrContractAddress,
            createDB: createDB,
            log,
            logDetailed
        });

        this.api = apis[0];

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }

        if (createDB) {
            await this.api.createDB();
        }
    });
};

const stopSwarmsAndRemoveStateHook  = exports.stopSwarmsAndRemoveStateHook = function ({afterHook = after, preserveSwarmState = false}) {
    afterHook('stop daemons and remove state', async function () {
        this.timeout(harnessConfigs.defaultAfterHookTimeout);
        await this.swarmManager.stopAll();
        if (!preserveSwarmState) {
            this.swarmManager.removeSwarmState();
        }
    });
};

exports.localSwarmHooks = function ({beforeHook = before, afterHook = after, createDB = true, numOfNodes = harnessConfigs.numOfNodes, preserveSwarmState = false} = {}) {
    beforeHook('start swarm and client, create db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: numOfNodes});
        await this.swarmManager.startAll();

        const apis = await initializeClient({
            esrContractAddress: this.swarmManager.getEsrContractAddress(),
            createDB: createDB
        });
        this.api = apis[0];
    });

    stopSwarmsAndRemoveStateHook({afterHook, preserveSwarmState});
};
