const {swarmManager} = require('../../src/swarmManager');

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
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: numOfNodes});

        await this.swarmManager.startAll();

        this.apis = await bluzelle({
            uuid: Math.random().toString(),
            ethereum_rpc: harnessConfigs.ethereumRpc,
            contract_address: this.swarmManager.getEsrContractAddress(),
            private_pem: harnessConfigs.masterPrivateKey,
            public_pem: harnessConfigs.masterPublicKey,
            _connect_to_all: true,
            log: false,
            logDetailed: false
        });

        this.api = this.apis[0];

        if (createDB) {
            await this.api.createDB();
        }
    });

    afterHook('remove configs and peerslist and clear harness state', async function () {
        await this.swarmManager.stopAll();
        if (!preserveSwarmState) {
            this.swarmManager.removeSwarmState();
        }
    });
};
