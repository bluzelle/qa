const assert = require('assert');
const common = require('./common');
const {startSwarm, initializeClient, teardown, createKeys} = require('../utils/daemon/setup');
const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const PollUntil = require('poll-until-promise');


let numOfNodes = harnessConfigs.numOfNodes;

const clientsObj = {};

describe('view change', function () {

    [{
        name: 'primary dies with no state',
        numOfKeys: 0
    }, {
        name: 'primary dies with loaded db',
        numOfKeys: 50
    }].forEach((ctx) => {

        context(ctx.name, function () {

            [{
                name: 'all nodes have failure detector triggered',
                numOfNodesToBroadcastTo: numOfNodes
            }, {
                name: 'f+1 nodes have failure detector triggered',
                numOfNodesToBroadcastTo: Math.floor(numOfNodes / 3) + 1
            }].forEach((test) => {

                context(test.name, function () {

                    before(async function () {
                        this.timeout(30000);

                        this.swarm = await startSwarm({numOfNodes});
                        this.api = await initializeClient({swarm: this.swarm, setupDB: true});

                        if (ctx.numOfKeys > 0) {
                            await createKeys({api: this.api}, ctx.numOfKeys)
                        }

                        killPrimary.call(this);

                        broadcastToTriggerDaemonFailureDetector.call(this, this.deadPrimaryIdx, test.numOfNodesToBroadcastTo);
                        clientsObj.api = setApi.call(this);
                    });

                    after('remove configs and peerslist and clear harness state', function () {
                        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
                    });

                    it('new primary should take over', async function () {
                        this.timeout(20000);

                        const pollPrimary = new PollUntil();

                        await new Promise((resolve, reject) => {

                            pollPrimary
                                .stopAfter(20000)
                                .tryEvery(2000)
                                .execute(() => new Promise((res, rej) => {

                                    clientsObj.api.status().then(val => {

                                        const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                        if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                            return res(true);
                                        } else {
                                            return rej();
                                        }
                                    })

                                }))
                                .then(() => resolve())
                                .catch(err => reject(err));
                        })
                    });

                    it('new primary should be next pubkey sorted lexicographically', async function () {

                        const res = await clientsObj.api.status();
                        const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                        assert(parsedStatusJson.primary.name === this.swarm.nodes[2][1])
                    });

                    if (ctx.numOfKeys > 0) {

                        it('should be able to fetch full keys list', async function () {
                            assert((await clientsObj.api.keys()).length === ctx.numOfKeys);
                        });

                        it('should be able to read last key before pre-primary failure', async function () {
                            assert((await clientsObj.api.read(`batch${ctx.numOfKeys - 1}`)) === 'value')
                        })
                    }

                    common.crudFunctionalityTests(clientsObj);

                    common.miscFunctionalityTests(clientsObj);

                });
            });

            context('f nodes have failure detector triggered', function () {

                const NUM_OF_NODES_TO_BROADCAST_TO = Math.floor(numOfNodes / 3);

                before(async function () {
                    this.timeout(30000);

                    this.swarm = await startSwarm({numOfNodes});
                    this.api = await initializeClient({swarm: this.swarm, setupDB: true});

                    killPrimary.call(this);

                    broadcastToTriggerDaemonFailureDetector.call(this, this.deadPrimaryIdx, NUM_OF_NODES_TO_BROADCAST_TO);
                    clientsObj.api = setApi.call(this);
                });

                after('remove configs and peerslist and clear harness state', function () {
                    teardown.call(this.currentTest, process.env.DEBUG_FAILS);
                });

                it('no new primary should be accepted', async function () {

                    const pollPrimary = new PollUntil;

                    await new Promise((resolve, reject) => {

                        const timer = setTimeout(() => {
                            return resolve();
                        }, 15000);

                        pollPrimary
                            .stopAfter(15000)
                            .tryEvery(2000)
                            .execute(() => new Promise((res, rej) => {

                                clientsObj.api.status().then(val => {

                                    const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                    if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                        return rej(true);
                                    }
                                })

                            }))
                            .then(() => resolve())
                            .catch(err => reject(err));
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

    // todo: Add tests around operations in execution while primary dies (requires client timeout and broadcast functionality)

});

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
