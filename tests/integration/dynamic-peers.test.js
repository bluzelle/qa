const sharedTests = require('../shared/tests');
const {generateSwarm} = require('../../utils/daemonManager');
const {initializeClient, createKeys} = require('../../utils/clientManager');
const PollUntil = require('poll-until-promise');
const {last} = require('lodash/fp');

const numOfNodes = harnessConfigs.numOfNodes;

describe('dynamic peering', function () {

    [{
        name: 'add peer with no state',
        numOfKeys: 0,
        hookTimeout: 30000
    }, {
        name: 'add peer with 50 keys loaded',
        numOfKeys: 50,
        hookTimeout: 30000
    }, {
        name: 'add peer with 100 keys loaded',
        numOfKeys: 100,
        hookTimeout: 30000
    }, {
        name: 'add peer with 500 keys loaded',
        numOfKeys: 500,
        hookTimeout: 100000
    }].forEach((ctx) => {

        context(ctx.name, function () {
            [{
                name: 'new peer bootstrapped with full peers list',
                numOfNodesToBootstrap: numOfNodes
            }, {
                name: 'new peer bootstrapped with one peer',
                numOfNodesToBootstrap: 1
            }].forEach((test) => {

                context(test.name, function () {

                    before('stand up swarm and client', async function () {
                        this.timeout(ctx.hookTimeout);

                        this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
                        await this.swarm.start();
                        this.api = await initializeClient({setupDB: true, log: false});

                        if (ctx.numOfKeys > 0) {
                            await createKeys({api: this.api}, ctx.numOfKeys)
                        }

                        this.swarm.addDaemon();
                        await this.swarm.startUnstarted();

                        // // Ensure daemons don't get stuck in invalid local state
                        // const failures = [
                        //     ['Dropping message because local view is invalid', 5],
                        // ];
                        // this.swarm.addMultipleFailureListeners(failures);
                    });

                    after('remove configs and peerslist and clear harness state', async function () {
                        this.swarm.stop();
                        this.swarm.removeSwarmState();
                    });

                    it('should successfully join swarm', async function () {

                        await new Promise(res => {

                            last(this.swarm.getDaemons()).getProcess().stdout.on('data', buf => {
                                const out = buf.toString();

                                if (out.includes('Successfully joined the swarm')) {
                                    res();
                                }
                            });
                        });
                    });

                    it('should increment swarm view number by 1', async function () {
                        this.timeout(60000);

                        const pollView = new PollUntil();

                        await pollView
                            .stopAfter(60000)
                            .tryEvery(2000)
                            .execute(() => new Promise((res, rej) => {

                                this.api.status().then(val => {

                                    const response = JSON.parse(val.moduleStatusJson).module[0].status;

                                    if (response.view === 2) {
                                        return res(true)
                                    } else {
                                        rej(false)
                                    }
                                });
                            }))

                    });

                    it('should be included in status response', async function () {

                        const res = await this.api.status();

                        const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                        parsedStatusJson.peer_index.should.contain.an.item.with.property('uuid', last(this.swarm.getDaemons()).publicKey)
                    });

                    if (ctx.numOfKeys > 0) {

                        it('should be able to fetch full keys list', async function () {
                            expect((await this.api.keys()).length).to.be.equal(ctx.numOfKeys);
                        });

                        it('should be able to read last key before pre-primary failure', async function () {
                            expect(await this.api.read(`batch${ctx.numOfKeys - 1}`)).to.be.equal('value')
                        })
                    }

                    sharedTests.crudFunctionality.apply(this);

                    sharedTests.miscFunctionality.apply(this);

                });

            });
        });

    })
});
