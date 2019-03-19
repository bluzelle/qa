const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');


let numOfNodes = harnessConfigs.numOfNodes;

const CLIENT_1 = {
    uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
    pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
};
const CLIENT_2 = {
    uuid: '71e2cd35-b606-41e6-bb08-f20de30df76c',
    pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
};

(process.env.TEST_REMOTE_SWARM ? describe.only : describe)('multi-client', function () {

    (process.env.TEST_REMOTE_SWARM ? remoteSwarmHook() : localSwarmHooks());

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
            this.api3 = bluzelle({
                entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
                uuid: CLIENT_1.uuid,
                private_pem: CLIENT_1.pem,
                log: false
            });
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
        [this.swarm] = await startSwarm({numOfNodes});

        this.api1 = await initializeClient({uuid: CLIENT_1.uuid, pem: CLIENT_1.pem, swarm: this.swarm, setupDB: true});
        this.api2 = await initializeClient({uuid: CLIENT_2.uuid, pem: CLIENT_2.pem, swarm: this.swarm, setupDB: true});
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });
};

function remoteSwarmHook() {
    before('initialize clients, setup db', async function () {
        this.api1 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: CLIENT_1.uuid,
            private_pem: CLIENT_1.pem,
            log: false
        });

        this.api2 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: CLIENT_2.uuid,
            private_pem: CLIENT_2.pem,
            log: false
        });

        if (await this.api1.hasDB()) {
            await this.api1.deleteDB();
        }

        await this.api1.createDB();

        if (await this.api2.hasDB()) {
            await this.api2.deleteDB();
        }

        await this.api2.createDB();

    });
};
