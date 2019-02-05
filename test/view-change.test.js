const assert = require('assert');
const common = require('./common');
const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');
const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');

let numOfNodes = harnessConfigs.numOfNodes;

const clientsObj = {};

describe('view change', function () {

    context('primary dies', function() {

        context('all nodes have failure detector triggered', function () {

            before(async function () {
                this.timeout(30000);
                await setup.call(this, numOfNodes)
            });

            after('remove configs and peerslist and clear harness state', function () {
                teardown.call(this.currentTest, process.env.DEBUG_FAILS);
            });

            it('new primary should take over', async function () {

                await new Promise((resolve, reject) => {

                    const timer = setTimeout(reject, 20000);

                    const id = setInterval(() => {

                        Object.values(this.multiclients)[0].status()
                            .then(res => {

                                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                    clearInterval(id);
                                    resolve();
                                }
                            });
                    }, 1000)
                });
            });

            it('new primary should be next pubkey sorted lexicographically', async function () {

                const res = await Object.values(this.multiclients)[0].status();
                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                assert(parsedStatusJson.primary.name === this.swarm.nodes[2][1])
            });

            common.crudFunctionalityTests(clientsObj);

            common.miscFunctionalityTests(clientsObj);

        });

        context('f+1 nodes have failure detector triggered', function () {

            const NUM_OF_NODES_TO_BROADCAST_TO = Math.floor(numOfNodes / 3) + 1;

            before(async function () {
                this.timeout(30000);
                await setup.call(this, NUM_OF_NODES_TO_BROADCAST_TO)
            });

            after('remove configs and peerslist and clear harness state', function () {
                teardown.call(this.currentTest, process.env.DEBUG_FAILS);
            });

            it('new primary should take over', async function () {

                await new Promise((resolve, reject) => {

                    const timer = setTimeout(reject, 20000);

                    const id = setInterval(() => {

                        Object.values(this.multiclients)[0].status()
                            .then(res => {

                                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                    clearInterval(id);
                                    resolve();
                                }
                            });
                    }, 1000)
                });
            });

            it('new primary should be next pubkey sorted lexicographically', async function () {

                const res = await Object.values(this.multiclients)[0].status();
                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                assert(parsedStatusJson.primary.name === this.swarm.nodes[2][1])
            });

            common.crudFunctionalityTests(clientsObj);

            common.miscFunctionalityTests(clientsObj);

        });

        context('f nodes have failure detector triggered', function () {

            const NUM_OF_NODES_TO_BROADCAST_TO = Math.floor(numOfNodes / 3);

            before(async function () {
                this.timeout(30000);
                await setup.call(this, NUM_OF_NODES_TO_BROADCAST_TO)
            });

            after('remove configs and peerslist and clear harness state', function () {
                teardown.call(this.currentTest, process.env.DEBUG_FAILS);
            });

            it('no new primary should be accepted', async function () {

                await new Promise((resolve, reject) => {

                    const timer = setTimeout(resolve, 10000);

                    const id = setInterval(() => {

                        Object.values(this.multiclients)[0].status()
                            .then(res => {

                                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                    clearInterval(id);
                                    reject();
                                }
                            });
                    }, 1000)
                });
            });

            it('backup should report no primary', async function () {
                this.timeout(40000);

                await new Promise(res => {
                    this.swarm[this.swarm.backups[0]].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('No primary alive')) {
                            res()
                        }
                    })
                });
            });

        });
    });
});

async function setup(numOfNodesToBroadcastTo) {
    this.swarm = await startSwarm({numOfNodes});
    this.api = await initializeClient({swarm: this.swarm, setupDB: true});

    killPrimary.call(this);

    broadcastToTriggerDaemonFailureDetector.call(this, this.deadPrimaryIdx, numOfNodesToBroadcastTo);
    clientsObj.api = setApi.call(this);
};

function killPrimary() {
    const primary = this.swarm.primary;
    this.deadPrimaryIdx = primary[primary.length - 1];
    this.swarm.killNode(this.deadPrimaryIdx);
}

function broadcastToTriggerDaemonFailureDetector(primaryIdx, numOfNodesToBroadcastTo) {
    this.multiclients = {};

    this.swarm.liveNodes
        .map(daemonName => daemonName[daemonName.length - 1])
        .filter(daemonIdx => daemonIdx !== primaryIdx)
        .slice(0, numOfNodesToBroadcastTo || this.swarm.liveNodes.length)
        .forEach(daemonIdx => {

            this.multiclients[`api-${daemonIdx}`] = bluzelle({
                entry: `ws://${harnessConfigs.address}:${harnessConfigs.port + parseInt(daemonIdx)}`,
                uuid: harnessConfigs.clientUuid,
                private_pem: harnessConfigs.clientPem,
                log: false
            })
        });

    Object.values(this.multiclients).forEach(api => api.create(`${Math.random()}`, 'hello'));
}

function setApi() {
    return Object.values(this.multiclients)[0];
}
