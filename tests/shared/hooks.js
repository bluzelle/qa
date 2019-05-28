const {generateSwarm, swarmManager} = require('../../src/daemonManager');
const swarmRegistry = require('../../src/swarmRegistryAdapter');

exports.remoteSwarmHook = function ({createDB = true} = {}) {
    before('initialize client and setup db', async function () {

        this.api = await bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            ethereum_rpc: harnessConfigs.ethereumRpc,
            contract_address: harnessConfigs.esrContractAddress,
            private_pem: harnessConfigs.masterPrivateKey,
            public_pem: harnessConfigs.masterPublicKey,
            _connect_to_all: true,
            log: false,
        });

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }

        if (createDB) {
            await this.api.createDB();
        }
    });
};

exports.localSwarmHooks = function ({beforeHook = before, afterHook = after, createDB = true, numOfNodes = harnessConfigs.numOfNodes, preserveSwarmState = false} = {}) {
    beforeHook('start swarm and client, create db', async function () {
        this.timeout(10000);

        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: numOfNodes});

        await this.swarmManager.startAll();

        this.api = await bluzelle({
            ethereum_rpc: harnessConfigs.ethereumRpc,
            contract_address: harnessConfigs.esrContractAddress,
            private_pem: harnessConfigs.masterPrivateKey,
            public_pem: harnessConfigs.masterPublicKey,
            _connect_to_all: true,
            log: false,
        });

        if (createDB) {
            await this.api.createDB();
        }
    });

    afterHook('remove configs and peerslist and clear harness state', async function () {
        await this.swarmManager.stopAll();
        this.swarmManager.removeSwarmState();
    });
};
