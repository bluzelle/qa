const assert = require('assert');

const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs, createKeys} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');



let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('core functionality', () => {

    beforeEach('generate configs and set harness state', async function () {
        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'})
    });

    beforeEach('initialize client', async () => {

        clientsObj.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        });
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

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

                await createKeys(clientsObj, 15);
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


