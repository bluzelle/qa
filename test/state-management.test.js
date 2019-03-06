const {spawnDaemon, initializeClient, spawnSwarm, teardown, createKeys} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');


let numOfNodes = harnessConfigs.numOfNodes >= 5 ? harnessConfigs.numOfNodes : 5; // minimum of 5 node swarm required, if two peers unstarted
const SWARM_CHECKPOINT_OPERATIONS_COUNT = 100; // number of operations before a checkpoint is created by daemon

describe('state management', () => {

    context('one peer joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start new peer', async function () {
            this.timeout(30000);

            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            this.swarm = new SwarmState(configsObject);
            await spawnSwarm(this.swarm, {partialSpawn: numOfNodes - 1});

            this.api = await initializeClient({swarm: this.swarm, setupDB: true, log: false});

            await createKeys({api: this.api}, SWARM_CHECKPOINT_OPERATIONS_COUNT - 5);

            const unstartedDaemonIdxs = getUnstartedDaemonIdxs(this.swarm, 1);
            this.newPeerName = `daemon${unstartedDaemonIdxs[0]}`;
            await spawnDaemon(this.swarm, unstartedDaemonIdxs[0]);

        });


        afterEach('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('should not be able execute request if not synced', async function () {

            await new Promise((res, rej) => {

                this.swarm[this.newPeerName].stream.stdout.on('data', (data) => {
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
                    await this.api.create(`${Math.random()}`, 'value');
                }, 500);


                await new Promise(res => {

                    this.swarm[this.swarm.primary].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });


            it('should adopt checkpoint when available', async function () {

                await new Promise(res => {

                    this.swarm[this.newPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Adopting checkpoint')) {
                            res();
                        }
                    });
                });
            });

            it('should be able to execute requests after checkpoint sync', async function () {

                await new Promise(res => {

                    this.swarm[this.newPeerName].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            res();
                        }
                    });

                    this.api.create('thisShouldGetExecuted', 'value');
                });
            });
        });

    });

    context('two peers joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start new peers', async function () {
            this.timeout(30000);

            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            this.swarm = new SwarmState(configsObject);
            await spawnSwarm(this.swarm, {partialSpawn: numOfNodes - 2});

            this.api = await initializeClient({swarm: this.swarm, setupDB: true, log: false});

            await createKeys({api: this.api}, SWARM_CHECKPOINT_OPERATIONS_COUNT - 5);

            this.unstartedDaemonIdxs = getUnstartedDaemonIdxs(this.swarm, 2);
            for (let i = 0; i < this.unstartedDaemonIdxs.length; i++ ) {
                await spawnDaemon(this.swarm, this.unstartedDaemonIdxs[i]);
            };

        });


        afterEach('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('should not be able execute request if not synced', async function () {

            await new Promise((res, rej) => {

                this.unstartedDaemonIdxs.forEach((idx) => {

                    this.swarm[`daemon${idx}`].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            rej(new Error('Unexpected "Executing request header" string matched in new daemon output'));
                        }
                    });

                });

                setTimeout(res, 3000);
            });
        });

        context('when checkpoint is reached', function () {

            beforeEach('create keys until checkpoint is reached', async function () {

                const createKeyInterval = setInterval(async () => {
                    await this.api.create(`${Math.random()}`, 'value');
                }, 500);

                await new Promise(res => {

                    this.swarm[this.swarm.primary].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });

            it('new daemons should adopt checkpoint when available', async function () {

                await Promise.all(
                    this.unstartedDaemonIdxs.map((idx) => new Promise((res) => {

                        this.swarm[`daemon${idx}`].stream.stdout.on('data', (data) => {
                            if (data.toString().includes('Adopting checkpoint')) {
                                res();
                            }
                        });

                    }))
                );
            });

            it('new daemons should be able to execute requests after checkpoint sync', async function () {

                const matchExecutingStringPromises = this.unstartedDaemonIdxs.map((idx) => new Promise((res) => {

                    this.swarm[`daemon${idx}`].stream.stdout.on('data', (data) => {
                        if (data.toString().includes('Executing request header')) {
                            res();
                        }
                    });

                }));

                this.api.create('thisShouldGetExecuted', 'value');

                await Promise.all(matchExecutingStringPromises);
            });

        });
    });

    // todo: Add tests for new peers, not in initial peers list

});

const getUnstartedDaemonIdxs = function (swarm, numberOfUnstartedDaemons) {
    const nodes = swarm.nodes;
    const pubKeyAndNamePairs = nodes.splice(nodes.length - numberOfUnstartedDaemons, nodes.length);
    return pubKeyAndNamePairs.map(([key, name]) => name[name.length -1]);
};
