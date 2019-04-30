const {initializeClient, createKeys, queryPrimary} = require('../../utils/clientManager');
const {generateSwarm} = require('../../utils/daemonManager');
const {last, takeRight} = require('lodash/fp');


let numOfNodes = harnessConfigs.numOfNodes >= 5 ? harnessConfigs.numOfNodes : 5; // minimum of 5 node swarm required, if two peers unstarted
const SWARM_CHECKPOINT_OPERATIONS_COUNT = 100; // number of operations before a checkpoint is created by daemon

describe('state management', function () {

    context('one peer joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start peer that is in pbft membership', async function () {
            this.timeout(15000);

            this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
            await this.swarm.startPartial(numOfNodes - 1);

            this.api = await initializeClient({setupDB: true, log: false});

            this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

            await createKeys({api: this.api}, SWARM_CHECKPOINT_OPERATIONS_COUNT - 5);

            await this.swarm.startUnstarted();
        });


        afterEach('remove configs and peerslist and clear harness state', async function () {
            await this.swarm.stop();
            this.swarm.removeSwarmState();
        });

        it('should not be able execute request if not synced', function (done) {

            last(this.swarm.getDaemons()).getProcess().stdout.on('data', data => {
                if (data.toString().includes('Executing request header')) {
                    throw new Error('Unexpected "Executing request header" string matched in new daemon output');
                }
            });

            setTimeout(done, 3000);
        });

        context('when checkpoint is reached', function () {

            beforeEach('create keys until checkpoint is reached', async function () {
                this.timeout(15000);

                const createKeyInterval = setInterval(async () => {
                    await this.api.create(`${Math.random()}`, 'value');
                }, 500);

                await new Promise(res => {
                    this.swarm.getPrimary().getProcess().stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });


            it('should adopt checkpoint when available', function (done) {

                last(this.swarm.getDaemons()).getProcess().stdout.on('data', data => {
                    if (data.toString().includes('Adopting checkpoint')) {
                        done();
                    }
                });
            });

            it('should be able to execute requests after checkpoint sync', function (done) {

                last(this.swarm.getDaemons()).getProcess().stdout.on('data', data => {
                    if (data.toString().includes('Executing request header')) {
                        done();
                    }
                });

                this.api.create('thisShouldGetExecuted', 'value');
            });
        });

    });

    context('two peers joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start new peers', async function () {
            this.timeout(15000);

            this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
            await this.swarm.startPartial(numOfNodes - 2);

            this.api = await initializeClient({setupDB: true, log: false});

            await createKeys({api: this.api}, SWARM_CHECKPOINT_OPERATIONS_COUNT - 5);

            this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

            await this.swarm.startUnstarted();
        });


        afterEach('remove configs and peerslist and clear harness state', async function () {
            await this.swarm.stop();
            this.swarm.removeSwarmState();
        });

        it('should not be able execute request if not synced', function (done) {


            takeRight(2, this.swarm.getDaemons()).forEach(daemon => {

                daemon.getProcess().stdout.on('data', (data) => {
                    if (data.toString().includes('Executing request header')) {
                        throw new Error('Unexpected "Executing request header" string matched in new daemon output');
                    }
                });

            });

            setTimeout(done, 3000);
        });

        context('when checkpoint is reached', function () {

            beforeEach('create keys until checkpoint is reached', async function () {
                this.timeout(15000);

                const createKeyInterval = setInterval(async () => {
                    await this.api.create(`${Math.random()}`, 'value');
                }, 500);

                await new Promise(res => {
                    this.swarm.getPrimary().getProcess().stdout.on('data', (data) => {
                        if (data.toString().includes('Reached checkpoint')) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });

            it('new daemons should adopt checkpoint when available', async function () {

                await Promise.all(
                    takeRight(2, this.swarm.getDaemons())
                        .map(daemon => new Promise(res => {
                            daemon.getProcess().stdout.on('data', (data) => {
                                if (data.toString().includes('Adopting checkpoint')) {
                                    res();
                                }
                            });
                        }))
                );
            });

            it('new daemons should be able to execute requests after checkpoint sync', async function () {

                const matchExecutingStringPromises =
                    takeRight(2, this.swarm.getDaemons())
                        .map(daemon => new Promise(res => {

                            daemon.getProcess().stdout.on('data', (data) => {
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
});
