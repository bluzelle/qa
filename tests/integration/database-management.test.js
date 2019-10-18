const {initializeClient, createKeys, queryPrimary} = require('../../src/clientManager');
const {localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');
const {find} = require('lodash');
const split2 = require('split2');
const daemonConstants = require('../../resources/daemonConstants');
const {harnessConfigs} = require('../../resources/harness-configurations');


describe('database management', function () {

    context('consensus algorithm and db state persistence (disk)', function () {

        [50, 100, 150, 200, 1000].forEach(numberOfKeys => {

            context(`with ${numberOfKeys} keys in database`, function () {

                context('swarm maintains states between restarts', function () {

                    localSwarmHooks({preserveSwarmState: false, configOptions: {mem_storage: false}});

                    before('create keys then restart swarm', async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier);
                        this.keysAndValue = await createKeys({api: this.api}, numberOfKeys);
                    });

                    before('restart swarm', async function () {
                        this.timeout(harnessConfigs.defaultBeforeHookTimeout);
                        await this.swarm.restart();
                    });

                    it('keys() should return all keys in db', async function () {
                        expect((await this.api.keys()).length).to.equal(numberOfKeys);
                    });

                    it('last created key should be readable', async function () {
                        const key = this.keysAndValue.keys[numberOfKeys - 1];
                        expect(await this.api.read(key)).to.be.equal(this.keysAndValue.value);
                    });
                });

                context('state is unchanged when node is down', function () {

                    localSwarmHooks({preserveSwarmState: false, configOptions: {mem_storage: false}});

                    before('create keys then restart swarm', async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier);
                        this.keysAndValue = await createKeys({api: this.api}, numberOfKeys);
                    });

                    before('stop a follower', async function () {
                        this.timeout(harnessConfigs.defaultTestTimeout);

                        const primary = await queryPrimary({api: this.api});

                        // find a follower node
                        this.nodeToRestart = find(this.swarm.getDaemons(), (daemonObject) =>
                            daemonObject.listener_port != primary.host_port);

                        await this.nodeToRestart.stop();

                        // initialize new client
                        const apis = await initializeClient({
                            createDB: false,
                            esrContractAddress: this.swarmManager.getEsrContractAddress()
                        });
                        this.api = apis[0];
                    });

                    it('restarted node should be able to execute requests immediately after restart', async function () {
                        this.timeout(harnessConfigs.defaultTestTimeout);

                        await this.nodeToRestart.start()

                        const executingRequestPromise = new Promise(res => {
                            this.nodeToRestart.getProcess().stdout
                                .pipe(split2())
                                .on('data', line => {
                                    if (line.includes(daemonConstants.executingRequest)) {
                                        res()
                                    }
                                });
                        })

                        this.api.create(`trigger-${Math.random()}`, 'value')

                        await executingRequestPromise;
                    });

                    it('should be able to crud', async function () {
                        await this.api.create('what', 'the');
                    });
                });

                context('state is changed when node is down', function () {

                    localSwarmHooks({preserveSwarmState: false, configOptions: {mem_storage: false}});

                    before('create keys then restart swarm', async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier);
                        this.keysAndValue = await createKeys({api: this.api}, numberOfKeys);
                    });

                    before('stop a follower, create keys', async function () {
                        const numberOfExtraKeys = 50;
                        this.timeout(numberOfExtraKeys * harnessConfigs.keyCreationTimeoutMultiplier + harnessConfigs.defaultBeforeHookTimeout);

                        const primary = await queryPrimary({api: this.api});

                        // find a follower node
                        this.nodeToRestart = find(this.swarm.getDaemons(), (daemonObject) =>
                            daemonObject.listener_port != primary.host_port);

                        await this.nodeToRestart.stop();

                        // initialize new client
                        const apis = await initializeClient({
                            createDB: false,
                            esrContractAddress: this.swarmManager.getEsrContractAddress()
                        });
                        this.api = apis[0];

                        await createKeys({api: this.api}, numberOfExtraKeys, 'batchdeux');
                    });

                    it('restarted node should not be able to execute requests immediately after restart', async function () {
                        this.timeout(harnessConfigs.defaultTestTimeout);

                        await this.nodeToRestart.start()

                        const executingRequestPromise = new Promise((res, rej) => {
                            this.nodeToRestart.getProcess().stdout
                                .pipe(split2())
                                .on('data', line => {
                                    if (line.includes(daemonConstants.executingRequest)) {
                                        throw new Error('Unexpected request execution')
                                    }
                                });

                            setTimeout(res, 2000);
                        })

                        this.api.create(`trigger-${Math.random()}`, 'value')

                        await executingRequestPromise;
                    });
                });
            });
        });
    });

    context('consensus algorithm and db state transience (in-memory)', function () {

        [50, 200].forEach(numberOfKeys => {

            context(`with ${numberOfKeys} keys in database`, function () {

                context('swarm loses all state between restarts', function () {

                    localSwarmHooks({preserveSwarmState: false, configOptions: {mem_storage: true}});

                    before('create keys then restart swarm', async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier);
                        this.keysAndValue = await createKeys({api: this.api}, numberOfKeys);

                        await this.swarm.restart();
                    });

                    it('attempt to read keys() should be rejected with DATABASE_NOT_FOUND', async function () {
                        await this.api.keys().should.be.rejectedWith('DATABASE_NOT_FOUND');
                    });

                    it('attempt to read key should be rejected with DATABASE_NOT_FOUND', async function () {
                        const key = this.keysAndValue.keys[numberOfKeys - 1];
                        await this.api.read(key).should.be.rejectedWith('DATABASE_NOT_FOUND');
                    });

                });
            });
        });
    });

    context('namespace size', function () {

        localSwarmHooks({createDB: false});

        // ensure DB sizes > 4GiB does not cause issues for JS client
        const testParams = {
            databaseSize: 4294967296 + 1,

            numberOfKeysToCreate: 10,
            keysValueSize: 50000
        };

        context(`with a database of size ${testParams.databaseSize}`, function () {

            before(`createDB of size ${testParams.databaseSize}`, async function () {
                await this.api._createDB(testParams.databaseSize)
            });

            it(`should correctly report maxSize of ${testParams.databaseSize}`, async function () {
                expect(await this.api.size()).to.deep.include({maxSize: testParams.databaseSize});
            });

            it(`should correctly report remainingBytes of ${testParams.databaseSize}`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize});
            });

            it(`should correctly report keys of 0`, async function () {
                expect(await this.api.size()).to.deep.include({keys: 0});
            });

            it(`should correctly report bytes of 0`, async function () {
                expect(await this.api.size()).to.deep.include({bytes: 0});
            });

            context(`create ${testParams.numberOfKeysToCreate} keys with size ${testParams.keysValueSize}`, function () {

                before('create keys', async function () {
                    const keysAndValue = await createKeys({api: this.api}, testParams.numberOfKeysToCreate, 'batch', generateString(testParams.keysValueSize))
                    const keysValue = keysAndValue.keys.reduce((total, key) => total += key.length, 0);

                    this.totalValue = keysValue + testParams.keysValueSize * testParams.numberOfKeysToCreate;
                });

                it(`should correctly report remainingBytes`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize - this.totalValue});
                });

                it(`should correctly report keys`, async function () {
                    expect(await this.api.size()).to.deep.include({keys: testParams.numberOfKeysToCreate});
                });

                it(`should correctly report bytes`, async function () {
                    expect(await this.api.size()).to.deep.include({bytes: this.totalValue});
                });

            });

            context('deleting all keys', function () {

                before('fetch key list and delete all', async function () {
                    this.timeout(harnessConfigs.defaultTestTimeout + (harnessConfigs.keyCreationTimeoutMultiplier * (testParams.numberOfExtraKeys + 2)));

                    const keys = await this.api.keys();

                    await keys.reduce((p, key) =>
                            p.then(() => this.api.delete(key)),
                        Promise.resolve());
                });

                it(`should show remainingBytes of ${testParams.databaseSize}`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize});
                });

                it('should show bytes of 0', async function () {
                    expect(await this.api.size()).to.deep.include({bytes: 0});
                });

                it('should show keys of 0', async function () {
                    expect(await this.api.size()).to.deep.include({keys: 0});
                });
            });
        });
    });
});
