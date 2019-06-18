const {swarmManager} = require('../../src/swarmManager');
const {initializeClient, createKeys, queryPrimary} = require('../../src/clientManager');
const {invoke, take} = require('lodash/fp');
const {orderBy} = require('lodash');
const daemonConstants = require('../../resources/daemonConstants');

describe('state management', function () {

    const peersMembershipJoiningTest = [{
        numberOfPeersJoining: 1,
    }, {
        numberOfPeersJoining: 2
    }];

    // make sure sufficient nodes in swarm to achieve consensus prior to peers joining
    Object.defineProperty(peersMembershipJoiningTest, 'numberOfNodesToSpawn', {
        value: obj => harnessConfigs.numOfNodes > obj.numberOfPeersJoining * 3 ? harnessConfigs.numOfNodes : obj.numberOfPeersJoining * 3
    });

    peersMembershipJoiningTest.forEach((ctx) => {

        context(`${ctx.numberOfPeersJoining} peers joining swarm`, function () {

            beforeEach('stand up swarm and client, load db without creating checkpoint, start new peers', async function () {
                this.timeout(harnessConfigs.defaultBeforeHookTimeout + harnessConfigs.keyCreationTimeoutMultiplier * daemonConstants.checkpointOperationsCount);

                this.swarmManager = await swarmManager();
                this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: peersMembershipJoiningTest.numberOfNodesToSpawn(ctx)});
                await startAllSortedDaemonsLessN(this.swarm.getDaemons(), peersMembershipJoiningTest.numberOfNodesToSpawn(ctx), ctx.numberOfPeersJoining);

                const apis = await initializeClient({
                    esrContractAddress: this.swarmManager.getEsrContractAddress(),
                    createDB: true,
                    log: false,
                    logDetailed: false
                });
                this.api = apis[0];

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

                await createKeys({api: this.api}, daemonConstants.checkpointOperationsCount - 5);
                this.newPeersProcesses = await this.swarm.startUnstarted();
            });

            afterEach('remove configs and peerslist and clear harness state', async function () {
                await this.swarmManager.stopAll();
                this.swarmManager.removeSwarmState();
            });

            it('should not be able execute request if not synced', function (done) {

                this.newPeersProcesses.forEach(getDaemonProcess => {

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
                    this.timeout(harnessConfigs.defaultBeforeHookTimeout);

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
                        this.newPeersProcesses
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
                        this.newPeersProcesses
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
});

async function startAllSortedDaemonsLessN(daemons, nodesInSwarm, nodesUnstarted) {
    await Promise.all(take(nodesInSwarm - nodesUnstarted, sortDaemonsByPublicKey(daemons)).map(invoke('start')));
};

function sortDaemonsByPublicKey(daemons) {
    return orderBy(daemons, ['publicKey']);
};
