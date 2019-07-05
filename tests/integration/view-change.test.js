const sharedTests = require('../shared/tests');
const {orderBy} = require('lodash');
const {initializeClient, createKeys, queryPrimary} = require('../../src/clientManager');
const {stopSwarmsAndRemoveStateHook, localSetup} = require('../shared/hooks');
const PollUntil = require('poll-until-promise');
const {log} = require('../../src/logger');
const {wrappedError} = require('../../src/utils');

const NEW_PRIMARY_TEST_TIMEOUT = 60000;


describe('view change', function () {

    let numOfNodes = harnessConfigs.numOfNodes;

    const primaryDeathTests = [
        {
            numOfKeys: 100,
        }, {
            numOfKeys: 150,
        }, {
            numOfKeys: 250,
        }, {
            numOfKeys: 400,
        }];

    Object.defineProperties(primaryDeathTests, {
        hookTimeout: {value: obj => obj.numOfKeys * harnessConfigs.keyCreationTimeoutMultiplier + harnessConfigs.viewChangeTimeout}
    });

    primaryDeathTests.forEach((ctx) => {

        context(`primary dies with ${ctx.numOfKeys} keys in db`, function () {

            before(async function () {
                this.timeout(primaryDeathTests.hookTimeout(ctx) > harnessConfigs.defaultBeforeHookTimeout + harnessConfigs.viewChangeTimeout ? primaryDeathTests.hookTimeout(ctx) : harnessConfigs.defaultBeforeHookTimeout + harnessConfigs.viewChangeTimeout);

                const {manager: _manager, swarm: _swarm, api: _api} = await localSetup({numOfNodes});
                this.swarmManager = _manager;
                this.swarm = _swarm;
                this.api = _api;

                if (ctx.numOfKeys > 0) {
                    await createKeys({api: this.api}, ctx.numOfKeys)
                }

                this.swarm.setPrimary((await queryPrimary({api: this.api})).uuid);

                await this.swarm.getPrimary().stop();

                // establish new client if previous client's primary connection was to the primary node
                if (this.swarm.getPrimary().publicKey === this.api.entry_uuid) {
                    const newApis = await initializeClient({
                        esrContractAddress: this.swarmManager.getEsrContractAddress(),
                        createDB: false,
                        log: false,
                        logDetailed: false
                    });
                    this.api = newApis[0];
                };

                try {
                    await this.api.create('trigger', 'broadcast').timeout(harnessConfigs.viewChangeTimeout);
                } catch (err) {
                    throw wrappedError(err, 'Trigger create operation failed');
                }

            });

            stopSwarmsAndRemoveStateHook({afterHook: after, preserveSwarmState: true});

            it('new primary should take over', function (done) {
                this.timeout(NEW_PRIMARY_TEST_TIMEOUT);
                const pollPrimary = new PollUntil();

                pollPrimary
                    .stopAfter(NEW_PRIMARY_TEST_TIMEOUT - 1000)
                    .tryEvery(5000)
                    .execute(() => new Promise((res, rej) => {

                        this.api.status()
                            .then(val => {
                                const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.uuid !== this.swarm.getPrimary().publicKey) {
                                    return res(true);
                                } else {
                                    rej(new Error('Unexpected primary'));
                                }
                            })
                            .catch(err => {
                                if (err.message.includes('operation timed out')) { // client timeout message
                                    log.warn(`Status polling request failed: ${err.message}`);
                                    rej(err);
                                } else {
                                    log.crit(err);
                                    rej(err)
                                }
                            });
                    }))
                    .then(() => done())
                    .catch(err => {
                        if (err.message.includes('Failed to wait')) { // PollUntil failure message
                            done(new Error(`New primary failed to take over in ${NEW_PRIMARY_TEST_TIMEOUT}ms`))
                        } else {
                            done(err)
                        }
                    });
            });

            it('new primary should be next pubkey sorted lexicographically', async function () {

                const sortedDaemons = orderBy(this.swarm.getDaemons(), ['publicKey']);

                let statusResponse;

                try {
                    statusResponse = await this.api.status();
                } catch (err) {
                    throw wrappedError(err, 'Status request failed ');
                }

                const swarmStatusPrimary = JSON.parse(statusResponse.moduleStatusJson).module[0].status.primary;

                swarmStatusPrimary.uuid.should.equal(sortedDaemons[2].publicKey)
            });

            if (ctx.numOfKeys > 0) {

                it('should be able to fetch full keys list', async function () {
                    (await this.api.keys().timeout(harnessConfigs.clientOperationTimeout)).should.have.lengthOf(ctx.numOfKeys + 1);
                });

                it('should be able to read last key before primary failure', async function () {
                    (await this.api.read(`batch${ctx.numOfKeys - 1}`)).should.equal('value');
                })
            }

            sharedTests.crudFunctionality.apply(this);

            sharedTests.miscFunctionality.apply(this);
        });
    });
});
