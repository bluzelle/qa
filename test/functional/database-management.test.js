const {startSwarm, initializeClient, teardown, createKeys} = require('../../utils/daemon/setup');
const common = require('../common');


const numOfNodes = harnessConfigs.numOfNodes;
const clientObj = {};

describe('database management', function () {

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

                    common.crudFunctionalityTests(clientObj);
                    common.miscFunctionalityTests(clientObj);

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

    (process.env.TEST_REMOTE_SWARM ? context.only : context)('with a persisted swarm', function () {

        (process.env.TEST_REMOTE_SWARM ? remoteSwarmHook() : localSwarmHooks());

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

                common.crudFunctionalityTests(clientObj);
                common.miscFunctionalityTests(clientObj);

                keysAndSizeShouldReturnGreaterThanZero(7); // common tests create 7 keys
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

function localSwarmHooks() {
    before('stand up swarm and client', async function () {
        [swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({swarm});

        clientObj.api = this.api;
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });
}

function remoteSwarmHook() {
    before('initialize client and setup db', async function () {
        this.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: harnessConfigs.clientUuid,
            private_pem: harnessConfigs.clientPem,
            log: false
        });

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }
    });
}

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
