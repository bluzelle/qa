const sharedTests = require('../shared/tests');
const {orderBy} = require('lodash');
const {initializeClient, createKeys, queryPrimary} = require('../../utils/daemon/setup');
const {generateSwarm} = require('../../utils/daemonManager');

const PollUntil = require('poll-until-promise');

let numOfNodes = harnessConfigs.numOfNodes;

describe('view change', function () {

    const primaryDeathTests = [{
        name: 'primary dies with no pre-existing state',
        numOfKeys: 0,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 50 keys loaded',
        numOfKeys: 50,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 100 keys loaded',
        numOfKeys: 100,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 500 keys loaded',
        numOfKeys: 500,
        hookTimeout: 100000
    }];

    Object.defineProperty(primaryDeathTests, 'name', {
        value: function (obj) {return `primary dies with ${obj.numOfKeys} keys in db`}
    });

    primaryDeathTests.forEach((ctx) => {

        context(primaryDeathTests.name(ctx), function () {

            before(async function () {
                this.timeout(ctx.hookTimeout);

                this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
                await this.swarm.start();

                this.api = await initializeClient({setupDB: true});

                if (ctx.numOfKeys > 0) {
                    await createKeys({api: this.api}, ctx.numOfKeys)
                }

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

                await this.swarm.getPrimary().stop();

                await this.api.create('trigger', 'broadcast');
            });

            after('remove configs and peerslist and clear harness state', async function () {
                await this.swarm.stop();
                this.swarm.removeSwarmState();
            });

            it('new primary should take over', async function () {
                const pollPrimary = new PollUntil();

                await pollPrimary
                    .stopAfter(30000)
                    .tryEvery(1000)
                    .execute(() => new Promise((res, rej) => {

                        this.api.status()
                            .then(val => {

                                const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.uuid !== this.swarm.getPrimary().publicKey) {
                                    return res(true);
                                } else {
                                    rej(false);
                                }
                            })
                            .catch(e => console.log(e));
                    }))
            });

            it('new primary should be next pubkey sorted lexicographically', async function () {

                const sortedDaemons = orderBy(this.swarm.getDaemons(), ['publicKey']);

                const swarmStatusPrimary = JSON.parse((await this.api.status()).moduleStatusJson).module[0].status.primary;

                swarmStatusPrimary.uuid.should.equal(sortedDaemons[2].publicKey)
            });

            if (ctx.numOfKeys > 0) {

                it('should be able to fetch full keys list', async function () {
                    (await this.api.keys()).should.have.lengthOf(ctx.numOfKeys + 1);
                });

                it('should be able to read last key before pre-primary failure', async function () {
                    (await this.api.read(`batch${ctx.numOfKeys - 1}`)).should.equal('value');
                })
            }

            sharedTests.crudFunctionality.apply(this);

            sharedTests.miscFunctionality.apply(this);
        });
    });


    const keysInFlightTests = [{
        keysInFlight: 50,
        hookTimeout: 20000
    }, {
        keysInFlight: 100,
        hookTimeout: 40000
    }, {
        keysInFlight: 110,
        hookTimeout: 60000
    }];

    Object.defineProperty(keysInFlightTests, 'name', {
        value: function (obj) {return `primary dies while ${obj.keysInFlight} keys are in flight`}
    });

    keysInFlightTests.forEach(ctx => {

        context(keysInFlightTests.name(ctx), function () {

            before(async function () {
                this.timeout(30000);

                this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
                await this.swarm.start();

                this.api = await initializeClient({setupDB: true});

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);


                this.keysInFlight = 30;

                for (let i = 0; i < this.keysInFlight; i++) {
                    this.api.create(`bananas-${i}`, 'value');
                }

                await this.swarm.getPrimary().stop();

                await this.api.create('trigger', 'broadcast');
            });

            after('remove configs and peerslist and clear harness state', async function () {
                await this.swarm.stop();
                this.swarm.removeSwarmState();
            });

            it('should be able to fetch full keys list', async function () {

                const TRIGGER_KEY = 1;

                const pollKeys = new PollUntil();

                await pollKeys
                    .stopAfter(30000)
                    .tryEvery(1000)
                    .execute(() => new Promise((res, rej) => {

                        this.api.keys()
                            .then(val => {

                                if (val.length === this.keysInFlight + TRIGGER_KEY) {
                                    return res(true);
                                } else {
                                    rej(false);
                                }
                            })
                            .catch(e => console.log(e));
                    }))
            });

            sharedTests.crudFunctionality.apply(this);

            sharedTests.miscFunctionality.apply(this);

        })
    });
});
