const {spawn, exec} = require('child_process');
const {expect} = require('chai');

const {spawnSwarm, despawnSwarm, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes} = require('../utils/daemon/configs');
const shared = require('./shared');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');


let swarm;

let clientsObj = {};

let numOfNodes = 6;

describe('storage', () => {

    beforeEach('generate configs and set harness state', async () => {
        await generateSwarmConfigsAndSetState(numOfNodes);
        swarm = getSwarmObj();
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm({consensusAlgo: 'raft', partialSpawn: numOfNodes - 1})
    });

    beforeEach('initialize client', () => {

        clientsObj.api = new BluzelleClient(
            `ws://${process.env.address}::${swarm[swarm.leader].port}`,
            '71e2cd35-b606-41e6-bb08-f20de30df76c',
            false
        );
    });

    beforeEach('connect client', async () => {
        await clientsObj.api.connect()
    });

    beforeEach('create state', async () => {
        await clientsObj.api.create('stateExists', '123');
    });

    beforeEach('disconnect api after state creation', () => clientsObj.api.disconnect());

    beforeEach('despawn swarm after state creation', () => {
        despawnSwarm();
        clientsObj = {};
    });

    beforeEach('respawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm({consensusAlgo: 'raft', partialSpawn: numOfNodes - 1, maintainState: true})
    });

    beforeEach('initialize client', () => {

        clientsObj.api = new BluzelleClient(
            `ws://${process.env.address}::${swarm[swarm.leader].port}`,
            '71e2cd35-b606-41e6-bb08-f20de30df76c',
            false
        );
    });

    beforeEach('connect client', async () => {
        await clientsObj.api.connect()
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        deleteConfigs();
        resetHarnessState();
    });

    afterEach('disconnect api', () => clientsObj.api.disconnect());

    afterEach('despawn swarm', despawnSwarm);

    context('values', () => {

        it('should persist through shut down', async () => {
            expect(await clientsObj.api.read('stateExists')).to.equal('123');
        });

    });

    context('a new node, after connecting to peers', () => {

        let cfgIndexObj = {index: 0};

        beforeEach('start new node', () => {

            newestNode = getNewestNodes(1);

            cfgIndexObj.index = swarm[newestNode[0]].index
        });

        shared.daemonShouldSync(cfgIndexObj, 1, '71e2cd35-b606-41e6-bb08-f20de30df76c');

    });

    context('limit', () => {

        context('when exceeded', () => {

            let node, newestNode;

            beforeEach('edit config', () => {
                newestNode = getNewestNodes(1);
                editFile({filename: `bluzelle${swarm[newestNode].index}.json`, changes: {max_storage: '700B'}})
            });

            beforeEach('spawn node', () => {
                newestNode = getNewestNodes(1);
                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});
            });

            beforeEach('create key, exceed limit', () => {
                clientsObj.api.create('key01', '123');
            });

            it('should log exceeded storage msg', async () => {

                await new Promise(resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('Maximum storage has been exceeded, please update the options file.')) {
                            resolve();
                        }
                    });
                });
            });

            it('should exit', async () => {

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });
            });

            it('should fail to restart', async () => {

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });

                await new Promise(resolve => {
                    exec(`cd ./daemon-build/output/; ./swarm -c bluzelle${swarm[newestNode].index}.json`, (error, stdout, stderr) => {
                        if (stdout.toString().includes('Maximum storage has been exceeded')) {
                            resolve()
                        }
                    });
                });
            });

            context('if limit increased', () => {

                beforeEach('wait until exceeded daemon is stopped', async () => {
                    await new Promise(resolve => {
                        node.on('close', code => {
                            resolve()
                        });
                    });
                });

                beforeEach('edit file', () => {
                    newestNode = getNewestNodes(1);
                    editFile({filename: `bluzelle${swarm[newestNode].index}.json`, changes: {max_storage: '1GB'}});
                });


                beforeEach('start daemon with increased limit', async () => {
                    node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newestNode].index}.json`], {cwd: './scripts'});

                    await new Promise(resolve => {
                        node.stdout.on('data', data => {
                            // connected to peer log msg: [debug] (node.cpp:84) - connection from: 127.0.0.1:62506
                            if (data.toString().includes('Received WS message:')) {
                                resolve()
                            }
                        });
                    })
                });

                context('daemon is operational', () => {

                    // shared.swarmIsOperational(clientsObj);

                    it('should be able to create', async () => {

                        await clientsObj.api.create('key', '123');
                    });

                    it('should be able to read', async () => {

                        await clientsObj.api.create('key', 'abc');

                        expect(await clientsObj.api.read('key')).to.be.equal('abc');
                    });

                    it('should be able to update', async () => {

                        await clientsObj.api.create('key', '123');

                        await clientsObj.api.update('key', 'abc');

                        expect(await clientsObj.api.read('key')).to.equal('abc');

                    });

                    it('should be able to delete', async () => {

                        await clientsObj.api.create('key', '123');

                        await clientsObj.api.remove('key');

                        expect(await clientsObj.api.has('key')).to.be.false;
                    })
                });
            });
        });
    });
});
