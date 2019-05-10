const {initializeClient, createKeys, queryPrimary} = require('../../src/clientManager');
const {generateSwarm} = require('../../src/daemonManager');
const {invoke, take} = require('lodash/fp');
const {orderBy} = require('lodash');
const daemonConstants = require('../../resources/daemonConstants');


describe('state management', function () {

    let numOfNodes = harnessConfigs.numOfNodes >= 5 ? harnessConfigs.numOfNodes : 5; // minimum of 5 node swarm required, if two peers unstarted

    context('one peer joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start peer that is in pbft membership', async function () {
            this.timeout(15000);

            this.swarm = generateSwarm({numberOfDaemons: numOfNodes});

            const pubKeySortedDaemons = orderBy(this.swarm.getDaemons(), ['publicKey']);
            await Promise.all(take(numOfNodes - 1, pubKeySortedDaemons).map(invoke('start')));

            this.api = await initializeClient({port: pubKeySortedDaemons[0].listener_port, setupDB: true, log: false});

            this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

            await createKeys({api: this.api}, daemonConstants.checkpointOperationsCount - 5);

            this.getNewPeerProcess = (await this.swarm.startUnstarted())[0];
        });


        afterEach('remove configs and peerslist and clear harness state', async function () {
            await this.swarm.stop();
            this.swarm.removeSwarmState();
        });

        it('should not be able execute request if not synced', function (done) {

            this.getNewPeerProcess().stdout.on('data', data => {
                if (data.toString().includes(daemonConstants.executingRequest)) {
                    throw new Error(`Unexpected "${daemonConstants.executingRequest}" string matched in new daemon output`);
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
                        if (data.toString().includes(daemonConstants.reachedCheckpoint)) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });


            it('should adopt checkpoint when available', function (done) {
                this.timeout(60000);

                this.getNewPeerProcess().stdout.on('data', data => {
                    if (data.toString().includes(daemonConstants.adoptCheckpoint)) {
                        done();
                    }
                });
            });

            it('should be able to execute requests after checkpoint sync', function (done) {
                this.timeout(60000);

                this.getNewPeerProcess().stdout.on('data', data => {
                    if (data.toString().includes(daemonConstants.executingRequest)) {
                        done();
                    }
                });

                this.api.create('thisShouldGetExecuted', 'value');
            });
        });

    });

    context('two peers joining swarm', function () {

        beforeEach('stand up swarm and client, load db without creating checkpoint, start new peers', async function () {
            this.timeout(100000);

            this.swarm = generateSwarm({numberOfDaemons: numOfNodes});

            const pubKeySortedDaemons = orderBy(this.swarm.getDaemons(), ['publicKey']);
            await Promise.all(take(numOfNodes - 2, pubKeySortedDaemons).map(invoke('start')));

            this.api = await initializeClient({port: pubKeySortedDaemons[0].listener_port, setupDB: true, log: false});

            await createKeys({api: this.api}, daemonConstants.checkpointOperationsCount - 5);

            this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

            this.newPeers = await this.swarm.startUnstarted();
        });


        afterEach('remove configs and peerslist and clear harness state', async function () {
            await this.swarm.stop();
            this.swarm.removeSwarmState();
        });

        it('should not be able execute request if not synced', function (done) {

            this.newPeers.forEach(getDaemonProcess => {

                getDaemonProcess().stdout.on('data', (data) => {
                    if (data.toString().includes(daemonConstants.executingRequest)) {
                        throw new Error(`Unexpected "${daemonConstants.executingRequest}" string matched in new daemon output`);
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
                        if (data.toString().includes(daemonConstants.reachedCheckpoint)) {
                            clearInterval(createKeyInterval);
                            res();
                        }
                    });
                })
            });

            it('new daemons should adopt checkpoint when available', async function () {
                this.timeout(60000);

                await Promise.all(
                    this.newPeers
                        .map(getDaemonProcess => new Promise(res => {
                            getDaemonProcess().stdout.on('data', (data) => {
                                if (data.toString().includes(daemonConstants.adoptCheckpoint)) {
                                    res();
                                }
                            });
                        }))
                );
            });

            it('new daemons should be able to execute requests after checkpoint sync', async function () {
                this.timeout(60000);

                const matchExecutingStringPromises =
                    this.newPeers
                        .map(getDaemonProcess => new Promise(res => {

                            getDaemonProcess().stdout.on('data', (data) => {
                                if (data.toString().includes(daemonConstants.executingRequest)) {
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
