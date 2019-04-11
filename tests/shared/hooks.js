const {generateSwarm} = require('../../utils/daemonManager');

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

exports.localSwarmHooks = function ({createDB = true, numOfNodes = harnessConfigs.numOfNodes, preserveSwarmState = false} = {}) {
    before('start swarm and client, create db', async function () {
        this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
        await this.swarm.start();
        // await this.swarm.startPartial(3);

        this.swarm.addDaemon();

        // await this.swarm.start();

        await this.swarm.startUnstarted();

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

    after('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
    });
};
