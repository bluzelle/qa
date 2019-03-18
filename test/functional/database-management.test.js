const assert = require('assert');
const {startSwarm, initializeClient, teardown, createKeys} = require('../../utils/daemon/setup');
const common = require('../common');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;
chai.use(chaiAsPromised);
chai.should();

const numOfNodes = harnessConfigs.numOfNodes;
const clientObj = {};


describe('database management', function () {

    context('with a new swarm per test', function() {

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

                try {
                    await this.api.createDB();
                } catch (err) {
                    throw new Error(`Failed to createDB \n ${err}`)
                }

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

                context('basic functionality tests', function() {
                    common.crudFunctionalityTests(clientObj);
                    common.miscFunctionalityTests(clientObj);

                    keysAndSizeShouldReturnGreaterThanZero(10);
                });

                context('should throw errors', function () {

                    it('when attempting to createDB', async function () {

                        const EXPECTED_ERROR = 'DATABASE_EXISTS';

                        await this.api.createDB().should.be.rejectedWith(EXPECTED_ERROR);

                    });
                });
            });

            context('with empty db', function () {

                it('should be able to hasDB', async function () {

                    let res;

                    try {
                        res = await this.api.hasDB();
                    } catch (err) {
                        throw new Error(`Failed to hasDB \n ${err}`)
                    }

                    assert(res === true);

                });

                it('should be able to deleteDB', async function () {

                    try {
                        await this.api.deleteDB();
                    } catch (err) {
                        throw new Error(`Failed to deleteDB \n ${err}`)
                    }

                });

                keysAndSizeShouldReturnZero();


                context('should throw errors', function () {

                    it('when attempting to createDB', async function () {

                        const EXPECTED_ERROR = 'DATABASE_EXISTS';

                        await this.api.createDB().should.be.rejectedWith(EXPECTED_ERROR);

                    });
                });

            });

            context('with deleted DB', function () {

                beforeEach('deleteDB', async function () {
                    await this.api.deleteDB();
                });

                noDbTests();


                it('should be able to createDB', async function () {

                    try {
                        await this.api.createDB();
                    } catch (err) {
                        throw new Error(`Failed to createDB \n ${err}`)
                    }

                });

            });

        });

    });

    context('with a persisted swarm', function () {


        before('stand up swarm and client', async function () {
            [swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm});

            clientObj.api = this.api;
        });

        after('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS);
        });

        noDbTests();


        context('after creating DB', function() {

            before('createDB', async function () {

                try {
                    await this.api.createDB();
                } catch (err) {
                    throw new Error(`Failed to createDB \n ${err}`)
                }
            });

            keysAndSizeShouldReturnZero();

            context('basic functionality tests', function() {
                common.crudFunctionalityTests(clientObj);
                common.miscFunctionalityTests(clientObj);

                keysAndSizeShouldReturnGreaterThanZero(6);
            });

            context('after deleting DB', function() {

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

            (await this.api.keys()).length.should.equal(0);
        });

        it('size should be equal to 0', async function () {

            (await this.api.size()).should.equal(0);
        });
    });
}

function keysAndSizeShouldReturnGreaterThanZero(numberOfKeys) {
    it('should be able to get keys list', async function () {

        (await this.api.keys()).length.should.equal(numberOfKeys);
    });

    it('should be able to get size', async function () {

        expect(await this.api.size()).to.be.above(0);
    });
}

function noDbTests() {

    it('should be able to hasDB', async function () {

        let res;

        try {
            res = await this.api.hasDB();
        } catch (err) {
            throw new Error(`Failed to hasDB \n ${err}`)
        }

        assert(res === false);

    });

    it('size should be equal to 0', async function () {

        (await this.api.size()).should.equal(0);
    });

    context('should throw errors', function () {

        it('when attempting to deleteDB', async function () {

            const EXPECTED_ERROR = 'DATABASE_NOT_FOUND';

            await this.api.deleteDB().should.be.rejectedWith(EXPECTED_ERROR)
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
