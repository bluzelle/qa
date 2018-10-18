const assert = require('assert');
const {expect} = require('chai');

const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonState, deleteConfigs} = require('../utils/daemon/setup');
const {generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj} = require('../utils/daemon/configs');


let clients = {};
let swarm;

describe('multi-client', () => {

    beforeEach('generate configs and set harness state', async () => {
        await generateSwarmConfigsAndSetState(5);
        swarm = getSwarmObj();
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm({consensusAlgo: 'raft'})
    });

    beforeEach('initialize clients', () => {

        clients.api1 = new BluzelleClient(
            `ws://${process.env.address}:${swarm[swarm.leader].port}`,
            '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            false
        );

        clients.api2 = new BluzelleClient(
            `ws://${process.env.address}:${swarm[swarm.leader].port}`,
            '71e2cd35-b606-41e6-bb08-f20de30df76c',
            false
        );

    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        deleteConfigs();
        resetHarnessState();
    });

    afterEach(despawnSwarm);

    context('distinct uuids', () => {

        beforeEach('connect clients', async () => {
            await clients.api1.connect();
            await clients.api2.connect();
        });

        afterEach('disconnect clients', () => {
            clients.api1.disconnect();
            clients.api2.disconnect();
        });

        it('client1 should be able to write to database', async () => {
            await clients.api1.create('myKey', '123');
            assert(await clients.api1.read('myKey') === '123');
        });

        it('client2 should be able to write to database', async () => {
            await clients.api2.create('myKey', '345');
            assert(await clients.api2.read('myKey') === '345');
        });

        context('clients', async () => {

            beforeEach('creating keys', async () => {
                await clients.api1.create('myKey', 'hello world');
                await clients.api2.create('myKey', 'good morning');
            });

            it('should be able to read with no cross talk', async () => {
                assert(await clients.api1.read('myKey') === 'hello world');
                assert(await clients.api2.read('myKey') === 'good morning');

            });

            it('should be able to update with no cross talk', async () => {
                await clients.api1.update('myKey', 'changed value');

                assert(await clients.api2.read('myKey') === 'good morning');
            });

            it('should be able to delete with no cross talk', async () => {
                await clients.api1.remove('myKey');

                assert(await clients.api2.read('myKey') === 'good morning');
            });

        });

        describe('attempting to access keys of another client', () => {

            beforeEach('creating keys', async () => {
                await clients.api1.create('onlyInOne', 'something');
            });

            context('should throw an error', () => {

                it('when trying to has a key not in its database', async () => {
                    assert(await clients.api2.has('onlyInOne') === false);
                });

                it('when trying to read a key not in its database', done => {
                    clients.api2.read('onlyInOne')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });

                it('when trying to update a key not in its database', done => {
                    clients.api2.update('onlyInOne', '123')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });

                it('when trying to delete a key not in its database', done => {
                    clients.api2.remove('onlyInOne')
                        .catch(error => {
                            expect(error.toString()).to.include('RECORD_NOT_FOUND');
                            done()
                        });
                });
            });
        });
    });

    describe('colliding uuid', () => {

        beforeEach('initialize new client with colliding uuid', () => {

            clients.api3 = new BluzelleClient(
                `ws://${process.env.address}:${swarm[swarm.leader].port}`,
                '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                false
            );
        });

        beforeEach('connect clients', async () => {
            await clients.api1.connect();
            await clients.api3.connect();
        });

        afterEach('disconnect clients', () => {
            clients.api1.disconnect();
            clients.api3.disconnect();
        });

        it('client1 should be able to write to database', async () => {
            await clients.api1.create('myKey', '123');
            assert(await clients.api1.read('myKey') === '123');
        });

        it('client2 should be able to write to database', async () => {
            await clients.api3.create('myKey', '345');
            assert(await clients.api3.read('myKey') === '345');
        });

        it('should throw an error when creating the same key twice', done => {

            clients.api1.create('mykey', '123').then(() => {

                clients.api3.create('mykey', '321')
                    .catch(error => {
                        expect(error.toString()).to.include('RECORD_EXISTS');
                        done()
                    });
            });
        });

        context('creating, updating, and then reading', () => {

            beforeEach('creating state', async () => {
                await clients.api1.create('myTextKey', 'hello world');
                await clients.api3.update('myTextKey', 'goodbye world');
            });

            it('value should be updated by last call', async () => {
                assert(await clients.api1.read('myTextKey') !== 'hello world');
                assert(await clients.api1.read('myTextKey') === 'goodbye world');
            });

        });

        context('creating, deleting, and then reading', () => {

            beforeEach('creating state', async () => {
                await clients.api1.create('myTextKey', 'hello world');
                await clients.api3.remove('myTextKey');
            });

            it('should throw error when attempting to read', done => {
                clients.api1.read('myTextKey')
                    .catch(error => {
                        expect(error.toString()).to.include('RECORD_NOT_FOUND');
                        done()
                    });
            });
        });
    });
});
