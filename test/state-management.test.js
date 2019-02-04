const assert = require('assert');
const {spawnDaemon, initializeClient, spawnSwarm, teardown, createKeys} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');

let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;
const SWARM_CHECKPOINT_OPERATIONS_COUNT = 100;

describe('state management', () => {

    context('one new peer joining swarm', function () {

        beforeEach('stand up swarm and client', async function () {
            this.timeout(30000);

            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            swarm = new SwarmState(configsObject);

            await spawnSwarm(swarm, {consensusAlgorithm: 'pbft', failureAllowed: 0 ,partialSpawn: numOfNodes - 1});

            clientsObj.api = await initializeClient({swarm, setupDB: true, log: false});
        });

        beforeEach('load database with keys', async function () {

            const arrayOfKeys = [...Array(SWARM_CHECKPOINT_OPERATIONS_COUNT - 5).keys()];
            await processArray(arrayOfKeys);
        });

        beforeEach('start new peer', async function () {

            this.newDaemonName = swarm.lastNode[1];
            this.newDaemonIdx = this.newDaemonName[this.newDaemonName.length - 1];
            await spawnDaemon(swarm, this.newDaemonIdx);
        });

        afterEach('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('should not be able execute request if not synced', async function () {

            await new Promise((res, rej) => {

                swarm[this.newDaemonName].stream.stdout.on('data', (data) => {
                    if (data.toString().includes('Executing request header')) {
                        rej(new Error('Unexpected "Executing request header" string matched in new daemon output'));
                    }
                });

                setTimeout(res, 3000);
            });
        });

        context('when checkpoint is reached', function () {

            beforeEach('create keys until checkpoint is reached', async function () {

                const createKeyInterval = setInterval(async () => {
                    await clientsObj.api.create(`${Math.random()}`, 'value');
                }, 500);


                await new Promise(res => {

                    swarm[swarm.primary].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });


            it('should adopt checkpoint when available', async function () {

                await new Promise(res => {

                    swarm[this.newDaemonName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Adopting checkpoint')) {
                            res();
                        }
                    });
                });
            });

            it('should be able to execute requests after checkpoint sync', async function () {

                await new Promise(res => {

                    swarm[this.newDaemonName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            res();
                        }
                    });

                    clientsObj.api.create('thisShouldGetExecuted', 'value');
                });
            });
        });

    });

    context('two peers joining swarm', function () {

        beforeEach('stand up swarm and client', async function () {
            this.timeout(30000);

            let [configsObject] = await generateSwarmJsonsAndSetState(5);
            swarm = new SwarmState(configsObject);

            await spawnSwarm(swarm, {consensusAlgorithm: 'pbft', failureAllowed: 0, partialSpawn: 3});

            clientsObj.api = await initializeClient({swarm, setupDB: true, log: false});
        });

        beforeEach('load database with keys', async function () {

            const arrayOfKeys = [...Array(SWARM_CHECKPOINT_OPERATIONS_COUNT - 5).keys()];
            await processArray(arrayOfKeys);
        });

        beforeEach('start new peers', async function () {

            const swarmNodes = swarm.nodes;
            this.firstNewPeerName = swarmNodes[swarmNodes.length - 1][1];
            this.secondNewPeerName = swarmNodes[swarmNodes.length - 2][1];

            this.firstNewPeerIdx = this.firstNewPeerName[this.firstNewPeerName.length - 1];
            this.secondNewPeerIdx = this.secondNewPeerName[this.secondNewPeerName.length - 1];

            await spawnDaemon(swarm, this.firstNewPeerIdx);
            await spawnDaemon(swarm, this.secondNewPeerIdx);
        });

        afterEach('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('should not be able execute request if not synced', async function () {

            await new Promise((res, rej) => {

                swarm[this.firstNewPeerName].stream.stdout.on('data', (data) => {
                    if (data.toString().includes('Executing request header')) {
                        rej(new Error('Unexpected "Executing request header" string matched in new daemon output'));
                    }
                });

                swarm[this.secondNewPeerName].stream.stdout.on('data', (data) => {
                    if (data.toString().includes('Executing request header')) {
                        rej(new Error('Unexpected "Executing request header" string matched in new daemon output'));
                    }
                });

                setTimeout(res, 3000);
            });
        });

        context('when checkpoint is reached', function () {

            beforeEach('create keys until checkpoint is reached', async function () {

                const createKeyInterval = setInterval(async () => {
                    await clientsObj.api.create(`${Math.random()}`, 'value');
                }, 500);

                await new Promise(res => {

                    swarm[swarm.primary].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });

            it('should adopt checkpoint when available', async function () {

                const firstPeerAdopts = new Promise(res => {

                    swarm[this.firstNewPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Adopting checkpoint')) {
                            res();
                        }
                    });
                });

                const secondPeerAdopts = new Promise(res => {

                    swarm[this.secondNewPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Adopting checkpoint')) {
                            res();
                        }
                    });
                });

                await Promise.all([firstPeerAdopts, secondPeerAdopts])
            });

            it('should be able to execute requests after checkpoint sync', async function () {

                const firstPeerExecutes = new Promise(res => {

                    swarm[this.firstNewPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            res();
                        }
                    });

                });

                const secondPeerExecutes = new Promise(res => {

                    swarm[this.secondNewPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            res();
                        }
                    });

                });

                clientsObj.api.create('thisShouldGetExecuted', 'value');

                await Promise.all([firstPeerExecutes, secondPeerExecutes]);
            });

        });
    });

    // todo: Add tests for new peers, not in initial peers list

});


async function processArray(array) {
    for (const item of array) {
        await clientsObj.api.create(`batch-${item}`, 'value');
    }
}
