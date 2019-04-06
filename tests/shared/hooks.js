const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');


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
    before('stand up swarm and client', async function () {
        [this.swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({swarm: this.swarm, setupDB: createDB});
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS, preserveSwarmState);
    });
};
