const waitUntil = require("async-wait-until");
const {exec, execSync, spawn} = require('child_process');
const fsPromises = require('fs').promises;

const api = require('../bluzelle-js/lib/bluzelle-node');
const shared = require('./shared');

const {spawnSwarm, despawnSwarm, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes} = require('../utils/daemon/configs');


let swarm;

describe('raft', () => {

    context('swarm', () => {

        it('should elect a leader', () => {
        });

        context('followers die', () => {

            context('reconnecting', () => {

                beforeEach('clear daemon state state', clearDaemonState);

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(4);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft', partialSpawn: 3})
                });

                beforeEach('initialize client api', async () =>
                    await api.connect(`ws://${process.env.address}:${swarm[swarm.leader].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                afterEach('remove configs and peerslist and clear harness state', () => {
                    deleteConfigs();
                    resetHarnessState();
                });

                afterEach('disconnect api', api.disconnect);

                afterEach('despawn swarm', despawnSwarm);

                context('with clear local state', () => {

                    it('should sync', done => {

                        const newestNode = getNewestNodes(1);

                        const node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});

                        node.stdout.on('data', data => {

                            if (data.toString().includes('current term out of sync:')) {
                                done();
                            }
                        });
                    });
                });

                context('with consistent but outdated state', () => {

                    let node, newestNode;
                    let cfgIndexObj = {index: 0};

                    beforeEach('start new node', () => new Promise((res) => {

                        newestNode = getNewestNodes(1);

                        cfgIndexObj.index = swarm[newestNode[0]].index

                        node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});

                        node.stdout.on('data', data => {
                            if (data.toString().includes('Received WS message:')) {
                                res()
                            }
                        });
                    }));

                    beforeEach('create key', async () => {
                        await api.create('key1', '123')
                    });

                    beforeEach('kill node', () =>
                        execSync(`kill $(ps aux | grep '[b]luzelle${swarm[newestNode].index}'| awk '{print $2}')`));

                    beforeEach('create keys after disconnect', async () => {
                        await api.create('key2', '123');
                        await api.create('key3', '123');
                    });

                    shared.daemonShouldSync(api, cfgIndexObj, 3)

                });

                context('with inconsistent .dat file', () => {

                    let node, newestNode;

                    beforeEach('start new node', () => new Promise((res) => {

                        newestNode = getNewestNodes(1);

                        node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});

                        node.stdout.on('data', data => {
                            if (data.toString().includes('Received WS message:')) {
                                res()
                            }
                        });
                    }));

                    beforeEach('create key', async () => {
                        await api.create('key1', '123')
                    });

                    beforeEach('kill node', () =>
                        execSync(`kill $(ps aux | grep '[b]luzelle${swarm[newestNode].index}'| awk '{print $2}')`));

                    beforeEach('change index to render .dat file inconsistent', async () => {

                        let fileContent = await fsPromises.readFile(`./daemon-build/output/.state/${swarm[newestNode].uuid}.dat`, 'utf8');

                        fileContent = fileContent.replace('1 1', '1 10');

                        await fsPromises.writeFile(`./daemon-build/output/.state/${swarm[newestNode].uuid}.dat`, fileContent, 'utf8');
                    });

                    it('should reject AppendEntries', async () => {

                        const node = spawn('script', ['-q' ,'/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});

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

                beforeEach('clear daemon state state', clearDaemonState);

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(3);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                beforeEach('initialize client api', async () =>
                    await api.connect(`ws://${process.env.address}:${swarm[swarm.leader].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                beforeEach('populate db', done => {
                    createKeys(done, api, process.env.numOfKeys);
                });

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

                afterEach('disconnect api', api.disconnect);

                afterEach('despawn swarm', despawnSwarm);

                shared.swarmIsOperational(api);

            });

            context('with insufficient nodes for consensus', () => {

                beforeEach('clear daemon state state', clearDaemonState);

                beforeEach('generate configs and set harness state', async () => {
                    await generateSwarmConfigsAndSetState(3);
                    swarm = getSwarmObj();
                });

                beforeEach('spawn swarm', async function () {
                    this.timeout(20000);
                    await spawnSwarm({consensusAlgo: 'raft'})
                });

                beforeEach('initialize client api', async () =>
                    await api.connect(`ws://${process.env.address}:${swarm[swarm.leader].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

                beforeEach('populate db', done => {
                    createKeys(done, api, process.env.numOfKeys);
                });

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

                afterEach('disconnect api', api.disconnect);

                afterEach('despawn swarm', despawnSwarm);

                shared.createShouldTimeout(api);
            })
        });

        context('leader dies', () => {

            beforeEach('clear daemon state state', clearDaemonState);

            beforeEach('generate configs and set harness state', async () => {
                await generateSwarmConfigsAndSetState(3);
                swarm = getSwarmObj();
            });

            beforeEach('spawn swarm', async function () {
                this.timeout(20000);
                await spawnSwarm({consensusAlgo: 'raft'})
            });

            beforeEach('initialize client api', async () =>
                await api.connect(`ws://${process.env.address}:${swarm[swarm.leader].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

            beforeEach('populate db', done => {
                createKeys(done, api, process.env.numOfKeys);
            });

            afterEach('remove configs and peerslist and clear harness state', () => {
                deleteConfigs();
                resetHarnessState();
            });

            afterEach('disconnect api', api.disconnect);

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
