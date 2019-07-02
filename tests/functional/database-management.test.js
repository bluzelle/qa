const {createKeys} = require('../../src/clientManager');
const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');
const daemonConstants = require('../../resources/daemonConstants');


describe('database management', function () {

    context('database creation and deletion', function () {

        context('with a new swarm per test', function () {

            (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({createDB: false}) : localSwarmHooks({beforeHook: beforeEach, afterHook: afterEach, createDB: false}));

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

        const DB_SIZE = 5000;
        const KEY_SIZE = 5;
        const KEY_VALUE_SIZE = 3000;

        before('createDB of size', async function () {
            await this.api.createDB(DB_SIZE)
        });

        it(`should show remainingBytes of ${DB_SIZE}`, async function () {
            expect(await this.api.size()).to.deep.include({remainingBytes: DB_SIZE});
        });

        it('should show bytes of 0', async function () {
            expect(await this.api.size()).to.deep.include({bytes: 0});
        });

        it('should show keys of 0', async function () {
            expect(await this.api.size()).to.deep.include({keys: 0});
        });

        context('creating a key', function () {

            const KEY = 'hello';

            before(`create key of value size ${KEY_VALUE_SIZE}`, async function () {
                await this.api.create(KEY, generateString(KEY_VALUE_SIZE));
            });

            it(`should show remainingBytes of ${DB_SIZE - KEY_VALUE_SIZE}`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: DB_SIZE - KEY_VALUE_SIZE - KEY_SIZE});
            });

            it(`should show bytes of ${KEY_VALUE_SIZE - KEY_SIZE}`, async function () {
                expect(await this.api.size()).to.deep.include({bytes: KEY_VALUE_SIZE + KEY_SIZE});
            });

            it('should show keys of 1', async function () {
                expect(await this.api.size()).to.deep.include({keys: 1});
            });
        });

        context('creating more keys', function () {

            const KEY_STRING_SIZE = 2;
            const NUMBER_OF_KEYS_TO_ADD = 5;
            const VALUE_SIZE = 5;

            before(`creating ${NUMBER_OF_KEYS_TO_ADD} more keys`, async function () {
                // createKeys creates keys as create(base_string + i, 'value'), so a total size of base_string + 1 + 5. Passing in a single byte string will result in a 2 byte key.
                await createKeys({api: this.api}, NUMBER_OF_KEYS_TO_ADD, generateString(KEY_STRING_SIZE - 1));
            });

            it(`should show correct remainingBytes`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: DB_SIZE - KEY_VALUE_SIZE - KEY_SIZE - (NUMBER_OF_KEYS_TO_ADD * (VALUE_SIZE + KEY_STRING_SIZE))});
            });

            it(`should show correct bytes`, async function () {
                expect(await this.api.size()).to.deep.include({bytes: KEY_VALUE_SIZE + KEY_SIZE + (NUMBER_OF_KEYS_TO_ADD * (VALUE_SIZE + KEY_STRING_SIZE))});
            });

            it('should show correct amount of keys', async function () {
                expect(await this.api.size()).to.deep.include({keys: 1 + NUMBER_OF_KEYS_TO_ADD});
            });
        });

        context('overfilling allotted space in DB', function () {

            it('should throw insufficient space error', async function () {
                await this.api.create('gigantic', generateString(5000)).should.be.rejectedWith(daemonConstants.insufficientSpaceError);
            });

            it('should be able to store smaller value', async function () {
                await this.api.create('asdf0', generateString(30));
            });
        });

        context('deleting all keys', function () {

            before('fetch key list and delete all', async function () {
                this.timeout(harnessConfigs.defaultTestTimeout + (harnessConfigs.keyCreationTimeoutMultiplier * 7));

                const keys = await this.api.keys();

                await keys.reduce((p, key) =>
                        p.then(() => this.api.delete(key)),
                    Promise.resolve());
            });

            it(`should show remainingBytes of ${DB_SIZE}`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: DB_SIZE});
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
