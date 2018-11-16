const {spawn, exec} = require('child_process');
const {expect} = require('chai');

const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateSwarmJsonsAndSetState, resetHarnessState} = require('../utils/daemon/configs');
const shared = require('./shared');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const SwarmState = require('../utils/daemon/swarm');

let swarm;
let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;

describe('storage', () => {

    beforeEach('generate configs and set harness state', async () => {
        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: numOfNodes - 1})
    });

    beforeEach('initialize client', () => {

        clientsObj.api = new BluzelleClient(
            `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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
        await spawnSwarm(swarm, {consensusAlgorithm: 'raft', partialSpawn: numOfNodes - 1, maintainState: true})
    });

    beforeEach('initialize client', () => {

        clientsObj.api = new BluzelleClient(
            `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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

        beforeEach('set cfgIndexObj', () => {
            let newPeer = swarm.lastNode;
            cfgIndexObj.index = swarm[newPeer].index
        });

        try {
            shared.daemonShouldSync(cfgIndexObj, 1, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        } catch (err) {
            throw err
        }
    });

    context('limit', () => {

        context('when exceeded', () => {

            let node, newPeer;

            beforeEach('edit config', () => {
                newPeer = swarm.lastNode;
                editFile({filename: `bluzelle${swarm[newPeer].index}.json`, changes: {max_storage: '700B'}})
            });

            beforeEach('create key, exceed limit', () => {
                clientsObj.api.create('key01', '123');
            });

            it('should log exceeded storage msg', async () => {
                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newPeer].index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('Maximum storage has been exceeded, please update the options file.')) {
                            resolve();
                        }
                    });
                });
            });

            it('should exit', async () => {
                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newPeer].index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });
            });

            it('should fail to restart', async function () {
                this.timeout(20000);

                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newPeer].index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.on('close', code => {
                        resolve()
                    });
                });

                node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[newPeer].index}.json`], {cwd: './scripts'});

                await new Promise(resolve => {
                    node.stdout.on('data', data => {
                        if (data.toString().includes('Maximum storage has been exceeded')) {
                            resolve()
                        }
                    });
                });
            });

            context('if limit increased', () => {

                beforeEach('edit file', () => {
                    newPeer = swarm.lastNode;
                    editFile({filename: `bluzelle${swarm[newPeer].index}.json`, changes: {max_storage: '1GB'}});
                });


                beforeEach('start daemon with increased limit', async () => {
                    await spawnDaemon(swarm[newPeer].index);
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
