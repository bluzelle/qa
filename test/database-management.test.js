const assert = require('assert');
const {startSwarm, initializeClient, teardown, createKeys} = require('../utils/daemon/setup');
const common = require('./common');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('database management', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        [swarm] = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });


    context('with no db', () => {

        it('should be able to createDB', async () => {

            try {
                await clientsObj.api.createDB();
            } catch (err) {
                throw new Error(`Failed to createDB \n ${err}`)
            }

        });

        it('should be able to hasDB', async () => {

            let res;

            try {
                res = await clientsObj.api.hasDB();
            } catch (err) {
                throw new Error(`Failed to hasDB \n ${err}`)
            }

            assert(res === false);

        });

        it('should be able to deleteDB', async () => {

            try {
                await clientsObj.api.deleteDB();
            } catch (err) {
                if (err.message.includes('DATABASE_NOT_FOUND')) {
                    // expected, do nothing
                } else {
                    throw new Error(`Failed to deleteDB \n ${err}`)
                }
            }

        });
    });

    context('with existing db', () => {

        beforeEach('createDB', async () => {
            await clientsObj.api.createDB();
        });

        context('with keys in db', () => {

            beforeEach('load db', async function () {
                this.timeout(30000);

                await createKeys(clientsObj, 10);
            });

            it('should be able to createDB', async () => {

                try {
                    await clientsObj.api.createDB();
                } catch (err) {
                    if (err.message.includes('DATABASE_EXISTS')) {
                        // expected, do nothing
                    } else {
                        throw new Error(`Failed to createDB \n ${err}`)
                    }
                }

            });

            it('should be able to hasDB', async () => {

                let res;

                try {
                    res = await clientsObj.api.hasDB();
                } catch (err) {
                    throw new Error(`Failed to hasDB \n ${err}`)
                }

                assert(res === true);

            });

            it('should be able to deleteDB', async () => {

                try {
                    await clientsObj.api.deleteDB();
                } catch (err) {
                    throw new Error(`Failed to deleteDB \n ${err}`)
                }

            });
        });

        context('with empty db', () => {

            it('should be able to createDB', async () => {

                try {
                    await clientsObj.api.createDB();
                } catch (err) {
                    if (err.message.includes('DATABASE_EXISTS')) {
                        // expected, do nothing
                    } else {
                        throw new Error(`Failed to createDB \n ${err}`)
                    }
                }

            });

            it('should be able to hasDB', async () => {

                let res;

                try {
                    res = await clientsObj.api.hasDB();
                } catch (err) {
                    throw new Error(`Failed to hasDB \n ${err}`)
                }

                assert(res === true);

            });

            it('should be able to deleteDB', async () => {

                try {
                    await clientsObj.api.deleteDB();
                } catch (err) {
                    throw new Error(`Failed to deleteDB \n ${err}`)
                }

            });
        });
    });
});


