const {createKeys} = require('../../src/clientManager');
const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');
const daemonConstants = require('../../resources/daemonConstants');


describe('database management', function () {

    context('database creation and deletion', function () {

        context('with a new swarm per test', function () {

            (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false}) : localSwarmHooks({
                beforeHook: beforeEach,
                afterHook: afterEach,
                createDB: false
            }));

            context('with no db', function () {

                noDbTests();

                it('should be able to createDB', async function () {
                    await this.api.createDB();
                });
            });

            context('with existing db', function () {

                beforeEach('createDB', async function () {
                    await this.api.createDB();
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
                            await this.api.createDB().should.be.rejectedWith('DATABASE_EXISTS');
                        });
                    });
                });

                context('with empty db', function () {

                    it('should be able to hasDB', async function () {
                        expect(await this.api.hasDB()).to.be.true;
                    });

                    it('should be able to deleteDB', async function () {
                        await this.api.deleteDB();
                    });

                    keysAndSizeShouldReturnZero();


                    context('should throw errors', function () {

                        it('when attempting to createDB', async function () {
                            await this.api.createDB().should.be.rejectedWith('DATABASE_EXISTS');
                        });
                    });
                });

                context('with deleted DB', function () {

                    beforeEach('deleteDB', async function () {
                        await this.api.deleteDB();
                    });

                    noDbTests();

                    it('should be able to createDB', async function () {
                        await this.api.createDB();
                    });
                });
            });
        });

        (harnessConfigs.testRemoteSwarm ? context.only : context)('with a persisted swarm', function () {

            (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false}) : localSwarmHooks({createDB: false}));

            noDbTests();

            context('after creating DB', function () {

                before('createDB', async function () {
                    await this.api.createDB();
                });

                keysAndSizeShouldReturnZero();

                context('basic functionality tests', function () {

                    sharedTests.crudFunctionality.apply(this);
                    sharedTests.miscFunctionality.apply(this);

                    keysAndSizeShouldReturnGreaterThanZero(7); // sharedTests tests create 7 keys
                });

                context('after deleting DB', function () {

                    before('deleteDB', async function () {
                        await this.api.deleteDB();
                    });

                    noDbTests();
                });
            });
        });
    });

    context('size restriction', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false}) : localSwarmHooks({createDB: false}));

        context('with a limited db', async function () {

            const testParams = {
                databaseSize: 5000,
                initialKey: 'hello',
                initialKeyValueSize: 3000,

                numberOfExtraKeys: 5,
                extraKeysValueSize: 5,
                extraKeysKeySize: 2,

                largeKey: 'large',
                largeKeyValueSize: 3000,

                databaseIncreaseSize: 3000
            };

            Object.defineProperties(testParams, {
                'initialKeyTotal': {value: calculateTotalSize(calculateKeySize(testParams.initialKey), testParams.initialKeyValueSize)},
                'extraKeysTotal': {value: calculateTotalSize(calculateKeySize(testParams.extraKeysKeySize), testParams.extraKeysValueSize) * testParams.numberOfExtraKeys},
                'largeKeyTotal': {value: calculateTotalSize(calculateKeySize(testParams.largeKey), testParams.largeKeyValueSize)}
            });

            before('createDB of size', async function () {
                await this.api.createDB(testParams.databaseSize)
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

            context('creating a key', function () {


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
                    // createKeys creates keys as create(base_string + i, 'value'), so a total size of base_string + 1 + 5. Passing in a single byte string will result in a 2 byte key.
                    await createKeys({api: this.api}, testParams.numberOfExtraKeys, generateString(  1));
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

            context('increasing db size limit', function () {

                before('increase db limit', async function () {
                    await this.api.updateDB(testParams.databaseSize + testParams.databaseIncreaseSize);
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
        expect(await this.api.hasDB()).to.be.false;
    });

    it('size should be rejected with DATABASE_NOT_FOUND', async function () {
        await this.api.size().should.be.rejectedWith('DATABASE_NOT_FOUND');
    });

    context('should throw errors', function () {

        it('when attempting to deleteDB', async function () {
            await this.api.deleteDB().should.be.rejectedWith('DATABASE_NOT_FOUND')
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


function calculateTotalSize(keyValueSize, valueSize) {
    return keyValueSize + valueSize;
}

function calculateKeySize(key) {
    let keyValueSize;
    if (Number.isInteger(key)) {
        keyValueSize = key;
    } else if (typeof key === 'string') {
        keyValueSize = key.length;
    }

    return keyValueSize
};
