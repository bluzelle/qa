const {generateSwarm} = require('../../src/daemonManager');

exports.remoteSwarmHook = function ({createDB = true} = {}) {
    before('initialize client and setup db', async function () {
        this.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: harnessConfigs.clientUuid,
            private_pem: harnessConfigs.clientPem,
            log: false
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

        this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
        await this.swarm.start();

        this.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            private_pem: harnessConfigs.clientPem,
            log: false,
            p2p_latency_bound: 100
        });

        if (createDB) {
            await this.api.createDB();
        }
    });

    afterHook('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
        this.swarm.removeSwarmState();
    });
};
