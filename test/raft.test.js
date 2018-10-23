const waitUntil = require("async-wait-until");
const {exec, execSync, spawn} = require('child_process');
const fsPromises = require('fs').promises;

const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const shared = require('./shared');

const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes} = require('../utils/daemon/configs');


let swarm, newPeerConfig;
let clientsObj = {};
let numOfNodes = 6;

describe('raft', () => {

    context('swarm', () => {

        it('should elect a leader', () => {
        });

        context('followers die', () => {

            context('reconnecting', () => {

                let cfgIndexObj = {index: 0};

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                    newPeerConfig = swarm[`daemon${numOfNodes - 1}`];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft', partialSpawn: numOfNodes - 1})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}:${swarm[swarm.leader].port}`,
                        '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                        false
                    );
                });

                beforeEach('connect client', async () =>
                    await clientsObj.api.connect());

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                context('with clear local state', () => {

                    beforeEach('set cfgIndexObj', () => {
                        cfgIndexObj.index = newPeerConfig.index
                    });

                    shared.daemonShouldSync(cfgIndexObj, 5, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814')
                });

                context('with consistent but outdated state', () => {

                    let newestNode;

                    beforeEach('start new node', async () => {

                        newestNode = getNewestNodes(1);

                        cfgIndexObj.index = swarm[newestNode[0]].index;

                        await spawnDaemon(swarm[newestNode].index)
                    });

                    beforeEach('create key', async () => {
                        await clientsObj.api.create('key1', '123')
                    });

                    beforeEach('kill node', () => {
                        execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[newestNode].index}'| awk '{print $2}')`)
                    });

                    beforeEach('create keys after disconnect', async () => {
                        await clientsObj.api.create('key2', '123');
                        await clientsObj.api.create('key3', '123');
                    });

                    shared.daemonShouldSync(cfgIndexObj, 8, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814')

                });

                context('with inconsistent .dat file', () => {

                    let node, newestNode;

                    beforeEach('start new node', async () => {

                        newestNode = getNewestNodes(1);

                        cfgIndexObj.index = swarm[newestNode[0]].index;

                        await spawnDaemon(swarm[newestNode].index)
                    });

                    beforeEach('create key', async () => {
                        await clientsObj.api.create('key1', '123')
                    });

                    beforeEach('kill node', () =>
                        execSync(`kill $(ps aux | grep '[b]luzelle${swarm[newestNode].index}'| awk '{print $2}')`));

                    beforeEach('change index to render .dat file inconsistent', async () => {

                        let fileContent = await fsPromises.readFile(`./daemon-build/output/.state/${swarm[newestNode].uuid}.dat`, 'utf8');

                        fileContent = fileContent.replace('1 1', '1 10');

                        await fsPromises.writeFile(`./daemon-build/output/.state/${swarm[newestNode].uuid}.dat`, fileContent, 'utf8');
                    });

                    it('should reject AppendEntries', async () => {

                        node = await spawnDaemon(swarm[newestNode].index);

                        await new Promise(resolve => {
                            node.stdout.on('data', data => {
                                if (data.toString().includes('Rejecting AppendEntries because I do not agree with the previous index')) {
                                    resolve()
                                }
                            });
                        })
                    });
                });
            });

            context('with sufficient nodes for consensus', () => {

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}:${swarm[swarm.leader].port}`,
                        '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                        false
                    );
                });

                beforeEach('connect client', async () =>
                    await clientsObj.api.connect());

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('kill one follower', () => {

                    const daemons = Object.keys(swarm).filter((key) => key.includes('daemon'));

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    const cfgName = `[b]luzelle${daemons[0].split('').pop()}`;

                    execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                shared.swarmIsOperational(clientsObj);

            });

            context('with insufficient nodes for consensus', () => {

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${process.env.address}:${swarm[swarm.leader].port}`,
                        '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                        false
                    );
                });

                beforeEach('connect client', async () =>
                    await clientsObj.api.connect());

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('kill all followers', () => {

                    const daemons = Object.keys(swarm).filter((key) => key.includes('daemon'));

                    daemons.splice(daemons.indexOf(swarm.leader), 1);

                    daemons.forEach(daemon => {

                        const cfgName = `[b]luzelle${daemon.split('').pop()}`;

                        execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`)
                    })
                });

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', () => clientsObj.api.disconnect());

                afterEach('despawn swarm', despawnSwarm);

                shared.createShouldTimeout(clientsObj);
            })
        });

        context('leader dies', () => {

            beforeEach('generate configs and set harness state', async () => {
                await generateSwarmConfigsAndSetState(numOfNodes);
                swarm = getSwarmObj();
            });

            beforeEach('spawn swarm', async function () {
                this.timeout(20000);
                await spawnSwarm({consensusAlgo: 'raft'})
            });

            beforeEach('initialize client', () => {

                clientsObj.api = new BluzelleClient(
                    `ws://${process.env.address}:${swarm[swarm.leader].port}`,
                    '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                    false
                );
            });

            beforeEach('connect client', async () =>
                await clientsObj.api.connect());

            beforeEach('populate db', async () =>
                await createKeys(clientsObj, 5, 500));

            afterEach('remove configs and peerslist and clear harness state', () => {
                deleteConfigs();
                resetHarnessState();
            });

            afterEach('disconnect api', () => clientsObj.api.disconnect());

            afterEach('despawn swarm', despawnSwarm);

            it('should elect a new leader', async () => {

                swarm = getSwarmObj();

                let guaranteedNodes = swarm.guaranteedNodes.slice();

                guaranteedNodes.splice(guaranteedNodes.indexOf(swarm.leader),1);

                const killedLeader = swarm.leader;

                const cfgName = `[b]luzelle${swarm.leader.split('').pop()}`;

                execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`);

                await waitUntil(async () => {

                    await getCurrentLeader(swarm, guaranteedNodes);

                    return swarm.leader !== killedLeader
                }, 1000);
            })
        })
    });
});
