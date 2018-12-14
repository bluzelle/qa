const assert = require('assert');
const {expect} = require('chai');

const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;

describe('multi-client', () => {

    beforeEach('generate configs and set harness state', async function () {
        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'})
    });

    beforeEach('initialize clients and createDB', async () => {

        clientsObj.api1 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        });

        try {
            await clientsObj.api1.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }

        clientsObj.api2 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '71e2cd35-b606-41e6-bb08-f20de30df76c',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bh=='
        });

        try {
            await clientsObj.api2.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

    context('distinct uuids', () => {

        it('client1 should be able to write to database', async () => {
            await clientsObj.api1.create('myKey', '123');
            assert(await clientsObj.api1.read('myKey') === '123');
        });

        it('client2 should be able to write to database', async () => {
            await clientsObj.api2.create('myKey', '345');
            assert(await clientsObj.api2.read('myKey') === '345');
        });

        context('clients', async () => {

            beforeEach('creating keys', async () => {
                await clientsObj.api1.create('myKey', 'hello world');
                await clientsObj.api2.create('myKey', 'good morning');
            });

            it('should be able to read with no cross talk', async () => {
                assert(await clientsObj.api1.read('myKey') === 'hello world');
                assert(await clientsObj.api2.read('myKey') === 'good morning');

            });

            it('should be able to update with no cross talk', async () => {
                await clientsObj.api1.update('myKey', 'changed value');

                assert(await clientsObj.api2.read('myKey') === 'good morning');
            });

            it('should be able to delete with no cross talk', async () => {
                await clientsObj.api1.delete('myKey');

                assert(await clientsObj.api2.read('myKey') === 'good morning');
            });

        });

        describe('attempting to access keys of another client', () => {

            beforeEach('creating keys', async () => {
                await clientsObj.api1.create('onlyInOne', 'something');
            });

            context('should throw an error', () => {

                it('when trying to has a key not in its database', async () => {
                    assert(await clientsObj.api2.has('onlyInOne') === false);
                });

                it('when trying to read a key not in its database', done => {
                    clientsObj.api2.read('onlyInOne')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });

                it('when trying to update a key not in its database', done => {
                    clientsObj.api2.update('onlyInOne', '123')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });

                it('when trying to delete a key not in its database', done => {
                    clientsObj.api2.delete('onlyInOne')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });
            });
        });
    });

    describe('colliding uuid', () => {

        beforeEach('initialize new client with colliding uuid and private_pem', async () => {

            clientsObj.api3 = bluzelle({
                entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
                uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bh=='
            });
        });

        it('client1 should be able to write to database', async () => {
            await clientsObj.api1.create('myKey', '123');
            assert(await clientsObj.api1.read('myKey') === '123');
        });

        it('client2 should be able to write to database', async () => {
            await clientsObj.api3.create('myKey', '345');
            assert(await clientsObj.api3.read('myKey') === '345');
        });

        it('should throw an error when creating the same key twice', done => {

            clientsObj.api1.create('mykey', '123').then(() => {

                clientsObj.api3.create('mykey', '321')
                    .catch(error => {
                        expect(error.toString()).to.include('RECORD_EXISTS');
                        done()
                    });
            });
        });

        context('creating, updating, and then reading', () => {

            beforeEach('creating state', async () => {
                await clientsObj.api1.create('myTextKey', 'hello world');
                await clientsObj.api3.update('myTextKey', 'goodbye world');
            });

            it('value should be updated by last call', async () => {
                assert(await clientsObj.api1.read('myTextKey') !== 'hello world');
                assert(await clientsObj.api1.read('myTextKey') === 'goodbye world');
            });

        });

        context('creating, deleting, and then reading', () => {

            beforeEach('creating state', async () => {
                await clientsObj.api1.create('myTextKey', 'hello world');
                await clientsObj.api3.delete('myTextKey');
            });

            it('should throw error when attempting to read', done => {
                clientsObj.api1.read('myTextKey')
                    .catch(error => {
                        expect(error.toString()).to.include('RECORD_NOT_FOUND');
                        done()
                    });
            });
        });
    });
});
