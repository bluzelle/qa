const assert = require('assert');
const path = require('path');

const {startSwarm, killSwarm} = require('../utils/daemon/setup');


const clients = {'api1': null, 'api2': null, 'api3': null, 'api4': null};

clients.api1 = require('../bluzelle-js/src/api');

// This enables us to have two copies of the library with separate state
delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/communication.js')];
delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/api.js')];

clients.api2 = require('../bluzelle-js/src/api');


describe('multi-client', () => {

    beforeEach(startSwarm);

    afterEach(killSwarm);

    describe('two clients with different UUID\'s', () => {

        context('interacting with the same key', () => {

            beforeEach(() => {
                clients.api1.connect(`ws://${process.env.address}:${process.env.port}`, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814');

                clients.api2.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
            });

            // it('clients.api1 should be able to ping the connection', () =>
            //     clients.api1.ping());

            // it('clients.api2 should be able to ping the connection', () =>
            //     clients.api2.ping());

            it('client1 should be able to write to database', async () => {
                await clients.api1.create('myKey', '123');
                assert(await clients.api1.read('myKey') === '123');
            });

            it('client2 should be able to write to database', async () => {
                await clients.api2.create('myKey', '345');
                assert(await clients.api2.read('myKey') === '345');
            });

            context('text fields', async () => {

                beforeEach(async () => {
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

                beforeEach(async () => {
                    await clients.api1.create('onlyInOne', 'something');
                });

                it('should only be able to access keys in its database', async () => {
                    assert(await clients.api1.has('onlyInOne'));
                    assert(!await clients.api2.has('onlyInOne'));
                });

                context('should throw an error', () => {

                    it('when trying to read a key not in its database', done => {
                        clients.api2.read('onlyInOne').catch(() => done());
                    });

                    it('when trying to update a key not in its database', done => {
                        clients.api2.update('onlyInOne', '123').catch(() => done());
                    });

                    it('when trying to delete a key not in its database', done => {
                        clients.api2.remove('onlyInOne').catch(() => done());
                    });
                });
            });
        });
    });

    describe('two clients with the same UUID\'s', () => {

        context('interacting with the same key', () => {

            beforeEach(() => {
                clients.api1.connect(`ws://${process.env.address}:${process.env.port}`, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814');

                clients.api2.connect(`ws://${process.env.address}:${process.env.port}`, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814');
            });

            // it('clients.api1 should be able to ping the connection', () =>
            //     clients.api1.ping());

            // it('clients.api2 should be able to ping the connection', () =>
            //     clients.api2.ping());

            it('client1 should be able to write to database', async () => {
                await clients.api1.create('myKey', '123');
                assert(await clients.api1.read('myKey') === '123');
            });

            it('client2 should be able to write to database', async () => {
                await clients.api2.create('myKey', '345');
                assert(await clients.api2.read('myKey') === '345');
            });

            it('should throw an error when creating the same key twice', done => {

                clients.api1.create('mykey', '123').then(() => {

                    clients.api2.create('mykey', '321').catch(() => done());

                });

            });

            context('creating, updating, and then reading', () => {

                context('number fields', () => {

                    beforeEach(async () => {
                        await clients.api1.create('myNumKey', '123');
                        await clients.api2.update('myNumKey', '345');
                    });

                    it('value should be updated by last call', async () => {
                        assert(await clients.api1.read('myNumKey') !== '123');
                        assert(await clients.api1.read('myNumKey') === '345');
                    });
                });

                context('text fields', () => {

                    beforeEach(async () => {
                        await clients.api1.create('myTextKey', 'hello world');
                        await clients.api2.update('myTextKey', 'goodbye world');
                    });

                    it('value should be updated by last call', async () => {
                        assert(await clients.api1.read('myTextKey') !== 'hello world');
                        assert(await clients.api1.read('myTextKey') === 'goodbye world');
                    });
                });

            });

            context('creating, deleting, and then reading', () => {

                context('number field', () => {

                    beforeEach(async () => {
                        await clients.api1.create('myNumKey', '123');
                        await clients.api2.remove('myNumKey');
                    });

                    it('should throw error when attempting to read', done => {
                        clients.api1.read('myNumKey').catch(() => done());
                    });

                });

                context('text field', () => {

                    beforeEach(async () => {
                        await clients.api1.create('myTextKey', 'hello world');
                        await clients.api2.remove('myTextKey');
                    });

                    it('should throw error when attempting to read', done => {
                        clients.api1.read('myTextKey').catch(() => done());
                    });

                });

            });
        });

    });

    describe('basic multi threading test', () => {

        delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/communication.js')];
        delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/api.js')];

        clients.api3 = require('../bluzelle-js/src/api');

        delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/communication.js')];
        delete require.cache[path.resolve(__dirname + '/../bluzelle-js/src/api.js')];

        clients.api4 = require('../bluzelle-js/src/api');

        context('four clients with unique UUID\'s', () => {

            beforeEach(() => {
                clients.api1.connect(`ws://${process.env.address}:${process.env.port}`, '4982e0b0-0b2f-4c3a-b39f-26878e2ac814');
                clients.api2.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
                clients.api3.connect(`ws://${process.env.address}:${process.env.port}`, 'cffb4aaa-5c4f-41e0-b098-c899635701e7');
                clients.api4.connect(`ws://${process.env.address}:${process.env.port}`, 'af56a449-ae8d-473d-aade-4fdf9dac5bfc');
            });

            context('in a reasonable time', () => {

                it('should be able to write and read', async () => {

                    await Promise.all(
                        Object.keys(clients)
                            .map(api => clients[api].create('myKey', '123')));

                    await Promise.all(
                        Object.keys(clients).map(api => clients[api].read('myKey')))
                        .then(results => results.forEach(value => assert(value === '123')));
                });

                it('should be able to write, update, and read', async function () {
                    this.timeout(10000);

                    await Promise.all(
                        Object.keys(clients)
                            .map(api => clients[api].create('myKey', '123')));

                    await Promise.all(
                        Object.keys(clients)
                            .map(api => clients[api].update('myKey', '1234')));

                    await Promise.all(
                        Object.keys(clients).map(api => clients[api].read('myKey')))
                        .then(results => results.forEach(value => assert(value === '1234')));
                });
            })

        });

    });

});
