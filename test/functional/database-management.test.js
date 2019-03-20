const {startSwarm, initializeClient, teardown, createKeys} = require('../../utils/daemon/setup');
const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');


const numOfNodes = harnessConfigs.numOfNodes;

describe('database management', function () {

    const clientObj = {};

    context('with a new swarm per test', function () {

        beforeEach('stand up swarm and client', async function () {
            [swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm});

            clientObj.api = this.api;
        });

        afterEach('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS);
        });

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

                    sharedTests.crudFunctionality(clientObj);
                    sharedTests.miscFunctionality(clientObj);

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

                before('add api to clientsObj', function () {
                    clientObj.api = this.api;
                });

                sharedTests.crudFunctionality(clientObj);
                sharedTests.miscFunctionality(clientObj);

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

function keysAndSizeShouldReturnZero() {

    context('db should measure empty', function () {

        it('keys list should be equal to 0', async function () {
            (await this.api.keys()).should.have.lengthOf(0);
        });

        it('size should be equal to 0', async function () {
            (await this.api.size()).should.equal(0);
        });
    });
}

function keysAndSizeShouldReturnGreaterThanZero(numberOfKeys) {

    it('should be able to get keys list', async function () {
        (await this.api.keys()).should.have.lengthOf(numberOfKeys);
    });

    it('should be able to get size', async function () {
        expect(await this.api.size()).to.be.above(0);
    });
}

function noDbTests() {

    it('should be able to hasDB', async function () {
        expect(await this.api.hasDB()).to.be.false;
    });

    it('size should be equal to 0', async function () {
        (await this.api.size()).should.equal(0);
    });

    context('should throw errors', function () {

        it('when attempting to deleteDB', async function () {
            await this.api.deleteDB().should.be.rejectedWith('DATABASE_NOT_FOUND')
        });

        noDbExpectedFailureTests();
    });
}

function noDbExpectedFailureTests() {
    const CRUDQ =
        [
            {cmd: 'create', expectedError: 'DATABASE_NOT_FOUND'},
            {cmd: 'read', expectedError: 'RECORD_NOT_FOUND'},
            {cmd: 'update', expectedError: 'DATABASE_NOT_FOUND'},
            {cmd: 'delete', expectedError: 'DATABASE_NOT_FOUND'},
            {cmd: 'quickread', expectedError: 'RECORD_NOT_FOUND'},
            {cmd: 'keys', expectedError: 'DATABASE_NOT_FOUND'}
        ];

    CRUDQ.forEach(test => {

        it(`when attempting to ${test.cmd}`, async function () {
            await this.api[test.cmd]('hello', 'world').should.be.rejectedWith(test.expectedError);
        });
    });
};
