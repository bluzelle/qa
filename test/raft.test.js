const waitUntil = require("async-wait-until");
const {exec, execSync, spawn} = require('child_process');
const fs = require('fs');

const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const shared = require('./shared');

const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {generateSwarmConfigsAndSetState, resetHarnessState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');

let swarm, newPeerConfig;
let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;

describe('raft', () => {

    context('swarm', () => {

        it('should elect a leader', () => {
        });

        context('followers die', () => {

            context('reconnecting', () => {

                let cfgIndexObj = {index: 0};

                beforeEach('generate configs and set harness state', async () => {
                    let [configsWithIndex] = await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsWithIndex);
                    newPeerConfig = swarm[`daemon${numOfNodes - 1}`];
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: numOfNodes - 1})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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

                    try {
                        shared.daemonShouldSync(cfgIndexObj, 5, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814')
                    } catch (err) {
                        throw err
                    }
                });

                context('with consistent but outdated state', () => {

                    let newNode;

                    beforeEach('start new node', async () => {

                        newNode = swarm.lastNode;

                        cfgIndexObj.index = swarm[newNode].index;

                        await spawnDaemon(swarm[newNode].index)
                    });

                    beforeEach('create key', async () => {
                        await clientsObj.api.create('key1', '123')
                    });

                    beforeEach('kill node', () => {
                        execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[newNode].index}'| awk '{print $2}')`)
                    });

                    beforeEach('create keys after disconnect', async () => {
                        await clientsObj.api.create('key2', '123');
                        await clientsObj.api.create('key3', '123');
                    });

                    try {
                        shared.daemonShouldSync(cfgIndexObj, 8, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814')
                    } catch (err) {
                        throw err
                    }

                });

                context('with inconsistent .dat file', () => {

                    let newNode;

                    beforeEach('start new node', async () => {

                        newNode = swarm.lastNode;

                        await spawnDaemon(swarm[newNode].index)
                    });

                    beforeEach('change index to render .dat file inconsistent and kill node', async () => {

                        let fileContent;

                        try {
                            await waitUntil(() => {

                                fileContent = fs.readFileSync(`./daemon-build/output/.state/${swarm[newNode].uuid}.dat`, 'utf8');

                                return fileContent.includes('1 1')
                            }, 8000);
                        } catch (err) {
                            console.log(`State file failed to log commit index 1 and log index 1`)
                        }

                        execSync(`kill $(ps aux | grep '[b]luzelle${swarm[newNode].index}'| awk '{print $2}')`)

                        fileContent = fileContent.replace('1 1', '1 10');

                        fs.writeFileSync(`./daemon-build/output/.state/${swarm[newNode].uuid}.dat`, fileContent, 'utf8');

                    });

                    it('should reject AppendEntries', async () => {

                        let fileContent = fs.readFileSync(`./daemon-build/output/.state/${swarm[newNode].uuid}.dat`, 'utf8');

                        let node = await spawnDaemon(swarm[newNode].index);

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
                    let [configsWithIndex] = await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsWithIndex);
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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
                    let [configsWithIndex] = await generateSwarmConfigsAndSetState(numOfNodes);
                    swarm = new SwarmState(configsWithIndex);
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
                });

                beforeEach('initialize client', () => {

                    clientsObj.api = new BluzelleClient(
                        `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
                        '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                        false
                    );
                });

                beforeEach('connect client', async () =>
                    await clientsObj.api.connect());

                beforeEach('populate db', async () =>
                    await createKeys(clientsObj, 5, 500));

                beforeEach('kill all followers', () => {

                    let followers = swarm.followers;

                    followers.forEach(daemon => {

                        const cfgName = `[b]luzelle${swarm[daemon].index}`;

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
                let [configsWithIndex] = await generateSwarmConfigsAndSetState(numOfNodes);
                swarm = new SwarmState(configsWithIndex);
            });

            beforeEach('spawn swarm', async function () {
                this.timeout(20000);
                await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
            });

            beforeEach('initialize client', () => {

                clientsObj.api = new BluzelleClient(
                    `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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

                const currentLeader = swarm.leader;

                const cfgName = `[b]luzelle${swarm[swarm.leader].index}`;

                execSync(`kill $(ps aux | grep '${cfgName}' | awk '{print $2}')`);

                await waitUntil(async () => {

                    await getCurrentLeader(swarm);

                    return swarm.leader !== currentLeader
                }, 1000);
            })
        })
    });
});
