const {swarmManager} = require('../../src/swarmManager');
const {initializeClient} = require('../../src/clientManager');
const {stopSwarmsAndRemoveStateHook} = require('../shared/hooks');

const numOfNodes = harnessConfigs.numOfNodes;
const UUIDS = {
    client1: '15f3bf98-6858-40e2-b57a-8f8ff60d9373',
    client2: 'b3fe17a2-3c64-4941-9f1c-1ef77c6d8af7'
};

(harnessConfigs.testRemoteSwarm ? describe.only : describe)('multi-client', function () {

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

    context('distinct uuids', function () {

        it('client1 should be able to write to database', async function () {
            await this.api1.create('myKey', '123');
            expect(await this.api1.read('myKey')).to.be.equal('123');
        });

        it('client2 should be able to write to database', async function () {
            await this.api2.create('myKey', '345');
            expect(await this.api2.read('myKey')).to.be.equal('345');
        });

        context('clients', async function () {

            before('creating keys', async function () {
                await this.api1.create('canada', 'hello world');
                await this.api2.create('canada', 'good morning');
            });

            it('should be able to read with no cross talk', async function () {
                expect(await this.api1.read('canada')).to.be.equal('hello world');
                expect(await this.api2.read('canada')).to.be.equal('good morning');

            });

            it('should be able to update with no cross talk', async function () {
                await this.api1.update('canada', 'changed value');

                expect(await this.api2.read('canada')).to.be.equal('good morning');
            });

            it('should be able to delete with no cross talk', async function () {
                await this.api1.delete('canada');

                expect(await this.api2.read('canada')).to.be.equal('good morning');
            });

        });

        describe('attempting to access keys of another client', function () {

            before('creating keys', async function () {
                await this.api1.create('onlyInOne', 'something');
            });

            context('should throw an error', function () {

                it('when trying to has a key not in its database', async function () {
                    expect(await this.api2.has('onlyInOne')).to.be.false;
                });

                it('when trying to read a key not in its database', async function () {
                    await this.api2.read('onlyInOne').should.be.rejectedWith('RECORD_NOT_FOUND');
                });

                it('when trying to update a key not in its database', async function () {
                    await this.api2.update('onlyInOne', '123').should.be.rejectedWith('RECORD_NOT_FOUND');
                });

                it('when trying to delete a key not in its database', async function () {
                    await this.api2.delete('onlyInOne').should.be.rejectedWith('RECORD_NOT_FOUND');
                });
            });
        });
    });

    describe('colliding uuid', function () {

        before('initialize new client with colliding uuid and private_pem', async function () {
            this.timeout(harnessConfigs.defaultBeforeHookTimeout);

            const client3Apis = await initializeClient({
                esrContractAddress: this.esrAddress,
                createDB: false,
                uuid: UUIDS.client1
            });
            this.api3 = client3Apis[0];
        });

        it('client1 should be able to write to database', async function () {
            await this.api1.create('usa', '123');
            expect(await this.api1.read('usa')).to.be.equal('123');
        });

        it('client2 should be able to write to database', async function () {
            await this.api3.create('alaska', '345');
            expect(await this.api3.read('alaska')).to.be.equal('345');
        });

        it('should throw an error when creating the same key twice', async function () {
            await this.api1.create('mexico', '123');

            await this.api3.create('mexico', '321').should.be.rejectedWith('RECORD_EXISTS');
        });

        context('creating, updating, and then reading', function () {

            before('creating state', async function () {
                await this.api1.create('dubai', 'hello world');
                await this.api3.update('dubai', 'goodbye world');
            });

            it('value should be updated by last call', async function () {
                expect(await this.api1.read('dubai')).to.not.be.equal('hello world');
                expect(await this.api1.read('dubai')).to.be.equal('goodbye world');
            });

        });

        context('creating, deleting, and then reading', function () {

            before('creating state', async function () {
                await this.api1.create('kelowna', 'hello world');
                await this.api3.delete('kelowna');
            });

            it('should throw error when attempting to read', async function () {
                await this.api1.read('kelowna').should.be.rejectedWith('RECORD_NOT_FOUND')
            });
        });
    });
});

function localSwarmHooks() {
    before('stand up swarm and client', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout * 2);

        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons: numOfNodes});
        await this.swarm.start();

        const client1Apis = await initializeClient({
            esrContractAddress: this.swarmManager.getEsrContractAddress(),
            createDB: true,
            uuid: UUIDS.client1
        });
        this.api1 = client1Apis[0];

        const client2Apis = await initializeClient({
            esrContractAddress: this.swarmManager.getEsrContractAddress(),
            createDB: true,
            uuid: UUIDS.client2
        });
        this.api2 = client2Apis[0];
    });

    stopSwarmsAndRemoveStateHook({afterHook: after, preserveSwarmState: false});

};

function remoteSwarmHook() {
    before('initialize clients, setup db', async function () {
        this.timeout(harnessConfigs.defaultBeforeHookTimeout);

        this.esrAddress = harnessConfigs.testRemoteSwarm ? harnessConfigs.esrContractAddress : this.swarmManager.getEsrContractAddress();

        const client1Apis = await initializeClient({
            ethereum_rpc: harnessConfigs.ethereumRpc,
            esrContractAddress: this.esrAddress,
            createDB: false,
            uuid: UUIDS.client1
        });
        this.api1 = client1Apis[0];

        const client2Apis = await initializeClient({
            ethereum_rpc: harnessConfigs.ethereumRpc,
            esrContractAddress: this.esrAddress,
            createDB: false,
            uuid: UUIDS.client2
        });
        this.api2 = client2Apis[0];

        if (await this.api1._hasDB()) {
            await this.api1._deleteDB();
        }

        await this.api1._createDB();

        if (await this.api2._hasDB()) {
            await this.api2._deleteDB();
        }

        await this.api2._createDB();

    });
};
