const {initializeClient, createKeys} = require('../../src/clientManager');
const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');
const daemonConstants = require('../../resources/daemonConstants');
const {generateKeys: generateEllipticCurveKeys} = require('../../src/crypto');

describe('database management', function () {

    context('database creation and deletion', function () {

        (harnessConfigs.testRemoteSwarm ? context.only : context)('permissioning', function () {

            const [pubKey, privKey] = generateEllipticCurveKeys(`/tmp`);
            const notMasterKeyPair = {
                privateKey: privKey,
                publicKey: pubKey
            };

            (harnessConfigs.testRemoteSwarm
                ? remoteSwarmHook({
                    createDB: false,
                    private_pem: harnessConfigs.masterPrivateKey,
                    public_pem: harnessConfigs.masterPublicKey
                })
                : localSwarmHooks({
                    createDB: false,
                    configOptions: {owner_public_key: harnessConfigs.masterPublicKey},
                    private_pem: harnessConfigs.masterPrivateKey,
                    public_pem: harnessConfigs.masterPublicKey
                }));

            context('with matching client private key and daemon owner_public_key', function () {

                it('should not have DB', async function () {
                    (await this.api._hasDB()).should.be.false;
                });

                it('should be able to successfully createDB', async function () {
                    await this.api._createDB()
                });

                it('should have DB', async function () {
                    (await this.api._hasDB()).should.be.true;
                });

                it('should be able to successfully create key', async function () {
                    await this.api.create(`${Math.random()}`, 'world');
                });

                it('should be able to successfully updateDB', async function () {
                    await this.api._updateDB(5000)
                });

                it('should be able to successfully deleteDB', async function () {
                    await this.api._deleteDB();
                });

                it('should not have DB', async function () {
                    (await this.api._hasDB()).should.be.false;
                });

                it('should fail to create key', async function () {
                    await this.api.create(`${Math.random()}`, 'world').should.be.rejectedWith('DATABASE_NOT_FOUND')
                });
            });

            context('with mismatching client private key and daemon owner_public_key', function () {

                before('create "no access" client', async function () {

                    this.esrAddress = harnessConfigs.testRemoteSwarm ? harnessConfigs.esrContractAddress : this.swarmManager.getEsrContractAddress();

                    const apis = await initializeClient({
                        createDB: false,
                        esrContractAddress: this.esrAddress,
                        private_pem: notMasterKeyPair.privateKey,
                        public_pem: notMasterKeyPair.publicKey
                    });

                    this.noAccessApi = apis[0];
                });

                it('should fail to createDB', async function () {
                    await this.noAccessApi._createDB().should.be.rejectedWith('ACCESS_DENIED')
                });

                it('should fail to create key with master key', async function () {
                    await this.api.create(`${Math.random()}`, 'world').should.be.rejectedWith('DATABASE_NOT_FOUND')
                });

                it('should fail to updateDB', async function () {
                    await this.noAccessApi._updateDB().should.be.rejectedWith('DATABASE_NOT_FOUND')
                });

                it('should fail to deleteDB', async function () {
                    await this.noAccessApi._deleteDB().should.be.rejectedWith('ACCESS_DENIED')
                });

                it('should fail to create key with master key', async function () {
                    await this.api.create(`${Math.random()}`, 'world').should.be.rejectedWith('DATABASE_NOT_FOUND')
                });

                context('with an existing database', function () {

                    before('createDB with owner client', async function () {
                        await this.api._createDB();
                    });

                    it('should fail to createDB', async function () {
                        await this.noAccessApi._createDB().should.be.rejectedWith('ACCESS_DENIED')
                    });

                    it('should fail to updateDB', async function () {
                        await this.noAccessApi._updateDB().should.be.rejectedWith('ACCESS_DENIED')
                    });

                    it('should fail to deleteDB', async function () {
                        await this.noAccessApi._deleteDB().should.be.rejectedWith('ACCESS_DENIED')
                    });

                    it('should be able to successfully create key', async function () {
                        await this.api.create(`${Math.random()}`, 'world');
                    });
                });
            });

        });

        context('with a new swarm per test', function () {

            (harnessConfigs.testRemoteSwarm
                ? remoteSwarmHook({
                    createDB: false,
                    uuid: `${Math.random()}`
                })
                : localSwarmHooks({
                    beforeHook: beforeEach,
                    afterHook: afterEach,
                    createDB: false
                }));

            context('with no db', function () {

                noDbTests();

                it('should be able to createDB', async function () {
                    await this.api._createDB();
                });
            });

            context('with existing db', function () {

                beforeEach('createDB', async function () {
                    await this.api._createDB();
                });

                context('with keys in db', function () {

                    beforeEach('load db', async function () {
                        await createKeys({api: this.api}, 10);
                    });

                    context('basic functionality tests', function () {

                        sharedTests.crudFunctionality.apply(this);
                        sharedTests.miscFunctionality.apply(this);

                        keysAndSizeShouldReturnGreaterThanZero(10);
                    });

                    context('should throw errors', function () {

                        it('when attempting to createDB', async function () {
                            await this.api._createDB().should.be.rejectedWith('DATABASE_EXISTS');
                        });
                    });
                });

                context('with empty db', function () {

                    it('should be able to hasDB', async function () {
                        expect(await this.api._hasDB()).to.be.true;
                    });

                    it('should be able to deleteDB', async function () {
                        await this.api._deleteDB();
                    });

                    keysAndSizeShouldReturnZero();


                    context('should throw errors', function () {

                        it('when attempting to createDB', async function () {
                            await this.api._createDB().should.be.rejectedWith('DATABASE_EXISTS');
                        });
                    });
                });

                context('with deleted DB', function () {

                    beforeEach('deleteDB', async function () {
                        await this.api._deleteDB();
                    });

                    noDbTests();

                    it('should be able to createDB', async function () {
                        await this.api._createDB();
                    });
                });
            });
        });

        (harnessConfigs.testRemoteSwarm ? context.only : context)('with a persisted swarm', function () {

            (harnessConfigs.testRemoteSwarm
                ? remoteSwarmHook({
                    createDB: false,
                    uuid: `${Math.random()}`
                })
                : localSwarmHooks({createDB: false}));

            noDbTests();

            context('after creating DB', function () {

                before('createDB', async function () {
                    await this.api._createDB();
                });

                keysAndSizeShouldReturnZero();

                context('basic functionality tests', function () {

                    sharedTests.crudFunctionality.apply(this);
                    sharedTests.miscFunctionality.apply(this);

                    keysAndSizeShouldReturnGreaterThanZero(7); // sharedTests tests create 7 keys
                });

                context('after deleting DB', function () {

                    before('deleteDB', async function () {
                        await this.api._deleteDB();
                    });

                    noDbTests();
                });
            });
        });
    });

    (harnessConfigs.testRemoteSwarm ? context.only : context)('multiple databases', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false, uuid: `${Math.random()}`}) : localSwarmHooks({createDB: false}));

        const NUMBER_OF_DATABASES = 25;

        before('createDBs', async function () {
            this.timeout(harnessConfigs.keyCreationTimeoutMultiplier * NUMBER_OF_DATABASES);
            const uuids = [...Array(NUMBER_OF_DATABASES)].map(() => `${Math.random()}`);

            const esrContractAddress = harnessConfigs.testRemoteSwarm ? harnessConfigs.esrContractAddress : this.swarmManager.getEsrContractAddress()
            this.clients = await Promise.all(uuids.map(uuid => initializeClient({uuid, esrContractAddress})));
            await Promise.all(this.clients.map(apis => apis[0]._createDB().timeout(harnessConfigs.clientOperationTimeout)));
        });

        it('clients should be able to create', async function () {
            this.timeout(harnessConfigs.keyCreationTimeoutMultiplier * NUMBER_OF_DATABASES);
            await Promise.all(this.clients.map(apis => apis[0].create('hello', 'world').timeout(harnessConfigs.clientOperationTimeout)));
        });

        it('clients should be able to read', async function () {
            this.timeout(harnessConfigs.keyCreationTimeoutMultiplier * NUMBER_OF_DATABASES);
            const res = await Promise.all(this.clients.map(apis => apis[0].read('hello').timeout(harnessConfigs.clientOperationTimeout)));
            expect(res.every(value => value === 'world')).to.be.true;
        });

        it('clients should be able to update', async function () {
            this.timeout(harnessConfigs.keyCreationTimeoutMultiplier * NUMBER_OF_DATABASES);
            await Promise.all(this.clients.map(apis => apis[0].update('hello', 'universe').timeout(harnessConfigs.clientOperationTimeout)));
        });

        it('clients should be able to delete', async function () {
            this.timeout(harnessConfigs.keyCreationTimeoutMultiplier * NUMBER_OF_DATABASES);
            await Promise.all(this.clients.map(apis => apis[0].delete('hello').timeout(harnessConfigs.clientOperationTimeout)));
        });
    });

    (harnessConfigs.testRemoteSwarm ? context.only : context)('size restriction', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false, uuid: `${Math.random()}`}) : localSwarmHooks({createDB: false}));

        const testParams = {
            databaseSize: 5000,

            initialKey: 'hello',
            initialKeyValueSize: 3000,

            numberOfExtraKeys: 5,

            largeKey: 'large',
            largeKeyValueSize: 3000,

            databaseIncreaseSize: 3000
        };

        context(`with a limited db of size ${testParams.databaseSize}`, async function () {

            Object.defineProperties(testParams, {
                'initialKeyTotal': {value: testParams.initialKey.length + testParams.initialKeyValueSize},
                'largeKeyTotal': {value: testParams.largeKey.length + testParams.largeKeyValueSize}
            });

            before(`createDB of size ${testParams.databaseSize}`, async function () {
                await this.api._createDB(testParams.databaseSize)
            });

            it(`should show remainingBytes of ${testParams.databaseSize}`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize});
            });

            it(`should show maxSize of ${testParams.databaseSize}`, async function () {
                expect(await this.api.size()).to.deep.include({maxSize: testParams.databaseSize});
            });

            it('should show bytes of 0', async function () {
                expect(await this.api.size()).to.deep.include({bytes: 0});
            });

            it('should show keys of 0', async function () {
                expect(await this.api.size()).to.deep.include({keys: 0});
            });

            context(`creating a key of total size ${testParams.initialKeyTotal}`, function () {

                before(`create key of value size ${testParams.initialKeyValueSize}`, async function () {
                    await this.api.create(testParams.initialKey, generateString(testParams.initialKeyValueSize));
                });

                it(`should show remainingBytes of ${testParams.databaseSize - testParams.initialKeyTotal}`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize - testParams.initialKeyTotal});
                });

                it(`should show bytes of ${testParams.initialKeyTotal}`, async function () {
                    expect(await this.api.size()).to.deep.include({bytes: testParams.initialKeyTotal});
                });

                it('should show keys of 1', async function () {
                    expect(await this.api.size()).to.deep.include({keys: 1});
                });
            });

            context('creating more keys', function () {

                before(`creating ${testParams.numberOfExtraKeys} more keys`, async function () {
                    const keysAndValue = await createKeys({api: this.api}, testParams.numberOfExtraKeys, generateString(1));
                    const totalKeysValue = keysAndValue.keys.reduce((total, key) => total += key.length, 0);

                    Object.defineProperty(testParams, 'extraKeysTotal', {
                        value: totalKeysValue + testParams.numberOfExtraKeys * keysAndValue.value.length
                    });
                });

                it(`should show correct remainingBytes`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize - (testParams.initialKeyTotal + testParams.extraKeysTotal)});
                });

                it(`should show correct bytes`, async function () {
                    expect(await this.api.size()).to.deep.include({bytes: testParams.initialKeyTotal + testParams.extraKeysTotal});
                });

                it('should show correct amount of keys', async function () {
                    expect(await this.api.size()).to.deep.include({keys: 1 + testParams.numberOfExtraKeys});
                });
            });

            context('overfilling allotted space in DB', function () {

                it('should throw insufficient space error', async function () {
                    await this.api.create('gigantic', generateString(testParams.largeKeyValueSize)).should.be.rejectedWith(daemonConstants.insufficientSpaceError);
                });
            });

            context(`increasing db size limit by ${testParams.databaseIncreaseSize}`, function () {

                before('increase db limit', async function () {
                    await this.api._updateDB(testParams.databaseSize + testParams.databaseIncreaseSize);
                });

                it(`should show maxSize of ${testParams.databaseSize + testParams.databaseIncreaseSize}`, async function () {
                    expect(await this.api.size()).to.deep.include({maxSize: testParams.databaseSize + testParams.databaseIncreaseSize});
                });

                it(`should show correct remainingBytes`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize + testParams.databaseIncreaseSize - (testParams.initialKeyTotal + testParams.extraKeysTotal)});
                });

                it(`should show correct bytes`, async function () {
                    expect(await this.api.size()).to.deep.include({bytes: testParams.initialKeyTotal + testParams.extraKeysTotal});
                });

                it('should show correct amount of keys', async function () {
                    expect(await this.api.size()).to.deep.include({keys: 1 + testParams.numberOfExtraKeys});
                });

                it('should be able to store value exceeding original space', async function () {
                    await this.api.create(testParams.largeKey, generateString(testParams.largeKeyValueSize));
                });
            });

            context('full database', function () {

                before('fill db to full', async function () {
                    const {remainingBytes} = await this.api.size();
                    const key = 'fill';

                    await this.api.create(key, generateString(remainingBytes - key.length));
                });

                it('should report remainingBytes of 0', async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: 0});
                });

                it(`should report bytes of ${testParams.databaseSize + testParams.databaseIncreaseSize} `, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: 0});
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

                it(`should show remainingBytes of ${testParams.databaseSize + testParams.databaseIncreaseSize}`, async function () {
                    expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize + testParams.databaseIncreaseSize});
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

function keysAndSizeShouldReturnZero() {

    context('db should measure empty', function () {

        it('keys list should be equal to 0', async function () {
            (await this.api.keys()).should.have.lengthOf(0);
        });

        it('size should be equal to 0', async function () {
            const result = await this.api.size();
            expect(result.bytes).to.equal(0);
            expect(result.keys).to.equal(0);
        });
    });
}

function keysAndSizeShouldReturnGreaterThanZero(numberOfKeys) {

    it('should be able to get keys list', async function () {
        (await this.api.keys()).should.have.lengthOf(numberOfKeys);
    });

    it('should be able to get size', async function () {
        const result = await this.api.size();

        expect(result.bytes).to.be.greaterThan(0);
        expect(result.keys).to.be.greaterThan(0);
    });
}

function noDbTests() {

    it('should be able to hasDB', async function () {
        expect(await this.api._hasDB()).to.be.false;
    });

    it('size should be rejected with DATABASE_NOT_FOUND', async function () {
        await this.api.size().should.be.rejectedWith('DATABASE_NOT_FOUND');
    });

    context('should throw errors', function () {

        it('when attempting to deleteDB', async function () {
            await this.api._deleteDB().should.be.rejectedWith('DATABASE_NOT_FOUND')
        });

        noDbExpectedFailureTests();
    });
}

function noDbExpectedFailureTests() {
    const cmds = ['create', 'read', 'update', 'delete', 'quickread', 'keys'];

    cmds.forEach(cmd => {

        it(`when attempting to ${cmd}, should be rejected with DATABASE_NOT_FOUND`, async function () {
            await this.api[cmd]('hello', 'world').should.be.rejectedWith('DATABASE_NOT_FOUND');
        });
    });
};
