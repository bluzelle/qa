const {initializeClient, createKeys} = require('../../utils/daemon/setup');
const {generateSwarm} = require('../../utils/daemonManager');
const sharedTests = require('../shared/tests');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');


const numOfNodes = harnessConfigs.numOfNodes;

describe('database management', function () {

    context('with a new swarm per test', function () {

        beforeEach('stand up swarm and client', async function () {
            this.swarm = await generateSwarm({numberOfDaemons: numOfNodes});
            await this.swarm.start();
            this.api = await initializeClient({swarm: this.swarm, setupDB: false});
        });

        afterEach('remove configs and peerslist and clear harness state', async function () {
            await this.swarm.stop();
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
