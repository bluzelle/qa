const sharedTests = require('../shared/tests');
const {orderBy} = require('lodash');
const {initializeClient, createKeys, queryPrimary} = require('../../utils/clientManager');
const {generateSwarm} = require('../../utils/daemonManager');
const PollUntil = require('poll-until-promise');
const pTimeout = require('p-timeout');

const NEW_PRIMARY_TEST_TIMEOUT = 60000;

describe('view change', function () {

    let numOfNodes = harnessConfigs.numOfNodes;

    const primaryDeathTests = [
        {
            numOfKeys: 0,
        }, {
            numOfKeys: 50,
        }, {
            numOfKeys: 100,
        }, {
            numOfKeys: 500,
        }];

    Object.defineProperties(primaryDeathTests, {
        name: {value: obj => `primary dies with ${obj.numOfKeys} keys in db`},
        hookTimeout: {value: obj => obj.numOfKeys * harnessConfigs.keyCreationTimeoutMultiplier}
    });

    primaryDeathTests.forEach((ctx) => {

        context(primaryDeathTests.name(ctx), function () {

            before(async function () {
                this.timeout(primaryDeathTests.hookTimeout(ctx) > harnessConfigs.defaultBeforeHookTimeout ? primaryDeathTests.hookTimeout(ctx) : harnessConfigs.defaultBeforeHookTimeout);

                this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
                await this.swarm.start();

                this.api = await initializeClient({setupDB: true});

                if (ctx.numOfKeys > 0) {
                    await createKeys({api: this.api}, ctx.numOfKeys)
                }

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

                await this.swarm.getPrimary().stop();

                await pTimeout(this.api.create('trigger', 'broadcast'), 15000, `Create() after primary death failed to respond in 15000 ms`);
            });

            after('remove configs and peerslist and clear harness state', async function () {
                await this.swarm.stop();
                this.swarm.removeSwarmState();
            });

            newPrimaryTests();

            if (ctx.numOfKeys > 0) {

                it('should be able to fetch full keys list', async function () {
                    await pTimeout(this.api.keys(), harnessConfigs.clientOperationTimeout, `Keys() failed to respond in ${harnessConfigs.clientOperationTimeout}`)
                        .then(val => val.should.have.lengthOf(ctx.numOfKeys + 1))
                });

                it('should be able to read last key before primary failure', async function () {
                    (await this.api.read(`batch${ctx.numOfKeys - 1}`)).should.equal('value');
                })
            }

            sharedTests.crudFunctionality.apply(this);

            sharedTests.miscFunctionality.apply(this);
        });
    });


    const keysInFlightTests = [
        {
            keysInFlight: 50,
        }, {
            keysInFlight: 100,
        }, {
            keysInFlight: 110,
        }];

    Object.defineProperties(keysInFlightTests, {
        name: {value: obj => `primary dies while ${obj.keysInFlight} keys are in flight`},
        hookTimeout: {value: obj => obj.keysInFlight * harnessConfigs.keyCreationTimeoutMultiplier}
    });

    keysInFlightTests.forEach(ctx => {

        context(keysInFlightTests.name(ctx), function () {

            before(async function () {
                this.timeout(keysInFlightTests.hookTimeout(ctx) > harnessConfigs.defaultBeforeHookTimeout ? keysInFlightTests.hookTimeout(ctx) : harnessConfigs.defaultBeforeHookTimeout);

                this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
                await this.swarm.start();

                this.api = await initializeClient({setupDB: true});

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

                for (let i = 0; i < ctx.keysInFlight; i++) {
                    this.api.create(`bananas-${i}`, 'value');
                }

                await this.swarm.getPrimary().stop();

                await pTimeout(this.api.create('trigger', 'broadcast'), 15000, `Create() after primary death failed to respond in 15000 ms`);
            });

            after('remove configs and peerslist and clear harness state', async function () {
                await this.swarm.stop();
                this.swarm.removeSwarmState();
            });

            newPrimaryTests();

            it('should be able to fetch full keys list', async function () {
                this.timeout(keysInFlightTests.hookTimeout(ctx));
                const TRIGGER_KEY = 1;
                const pollKeys = new PollUntil();

                await pollKeys
                    .stopAfter(keysInFlightTests.hookTimeout(ctx))
                    .tryEvery(1000)
                    .execute(() => new Promise((res, rej) => {
                        setTimeout(() => rej(new Error(`Swarm failed to respond to keys request in ${harnessConfigs.clientOperationTimeout}ms`)), harnessConfigs.clientOperationTimeout);

                        this.api.keys()
                            .then(val => {

                                if (val.length === ctx.keysInFlight + TRIGGER_KEY) {
                                    return res(true);
                                } else {
                                    rej(false);
                                }
                            })
                            .catch(e => console.log(e));
                    }))
                    .catch(err => {
                        if (err.message.includes('Failed to wait')) {
                            throw new Error(`Swarm failed to return full keys list in ${NEW_PRIMARY_TEST_TIMEOUT}ms`)
                        } else {
                            throw err
                        }
                    });
            });

            sharedTests.crudFunctionality.apply(this);

            sharedTests.miscFunctionality.apply(this);

        })
    });
});


function newPrimaryTests() {
    it('new primary should take over', function (done) {
        this.timeout(NEW_PRIMARY_TEST_TIMEOUT);
        const pollPrimary = new PollUntil();

        pollPrimary
            .stopAfter(50000)
            .tryEvery(1000)
            .execute(() => new Promise((res, rej) => {

                pTimeout(this.api.status(), harnessConfigs.clientOperationTimeout, `Status() failed to respond in ${harnessConfigs.clientOperationTimeout}ms`)
                    .then(val => {
                        const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                        if (parsedStatusJson.primary.uuid !== this.swarm.getPrimary().publicKey) {
                            return res(true);
                        } else {
                            rej(new Error('Expected new primary to take over'));
                        }
                    })
                    .catch(err => {
                        if (err.name === 'TimeoutError') {
                            console.log(err.message);
                            rej(err);
                        } else {
                            console.log(err);
                            rej(err)
                        }
                    });
            }))
            .then(() => done())
            .catch(err => {
                if (err.message.includes('Failed to wait')) {
                    done(new Error(`New primary failed to take over in ${NEW_PRIMARY_TEST_TIMEOUT}ms`))
                } else {
                    done(err)
                }
            });
    });

    it('new primary should be next pubkey sorted lexicographically', async function () {

        const sortedDaemons = orderBy(this.swarm.getDaemons(), ['publicKey']);

        const statusResponse = await pTimeout(this.api.status(), 4500, 'Status() failed to respond in 4500ms');

        const swarmStatusPrimary = JSON.parse(statusResponse.moduleStatusJson).module[0].status.primary;

        swarmStatusPrimary.uuid.should.equal(sortedDaemons[2].publicKey)
    });
}
