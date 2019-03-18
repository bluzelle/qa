const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');


let numOfNodes = harnessConfigs.numOfNodes;

describe('multi-client', function () {

    beforeEach('stand up swarm and client', async function () {
        [this.swarm] = await startSwarm({numOfNodes});

        const client1 = {
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        };
        const client2 = {
            uuid: '71e2cd35-b606-41e6-bb08-f20de30df76c',
            pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        };

        this.api1 = await initializeClient({uuid: client1.uuid, pem: client1.pem, swarm: this.swarm, setupDB: true});
        this.api2 = await initializeClient({uuid: client2.uuid, pem: client2.pem, swarm: this.swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

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

            beforeEach('creating keys', async function () {
                await this.api1.create('myKey', 'hello world');
                await this.api2.create('myKey', 'good morning');
            });

            it('should be able to read with no cross talk', async function () {
                expect(await this.api1.read('myKey')).to.be.equal('hello world');
                expect(await this.api2.read('myKey')).to.be.equal('good morning');

            });

            it('should be able to update with no cross talk', async function () {
                await this.api1.update('myKey', 'changed value');

                expect(await this.api2.read('myKey')).to.be.equal('good morning');
            });

            it('should be able to delete with no cross talk', async function () {
                await this.api1.delete('myKey');

                expect(await this.api2.read('myKey')).to.be.equal('good morning');
            });

        });

        describe('attempting to access keys of another client', function () {

            beforeEach('creating keys', async function () {
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

        beforeEach('initialize new client with colliding uuid and private_pem', async function () {
            const client1Clone = {
                uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
                pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
            };
            this.api3 = await initializeClient({uuid: client1Clone.uuid, pem: client1Clone.pem, swarm: this.swarm});
        });

        it('client1 should be able to write to database', async function () {
            await this.api1.create('myKey', '123');
            expect(await this.api1.read('myKey')).to.be.equal('123');
        });

        it('client2 should be able to write to database', async function () {
            await this.api3.create('myKey', '345');
            expect(await this.api3.read('myKey')).to.be.equal('345');
        });

        it('should throw an error when creating the same key twice', async function () {
            await this.api1.create('mykey', '123');

            await this.api3.create('mykey', '321').should.be.rejectedWith('RECORD_EXISTS');
        });

        context('creating, updating, and then reading', function () {

            beforeEach('creating state', async function () {
                await this.api1.create('myTextKey', 'hello world');
                await this.api3.update('myTextKey', 'goodbye world');
            });

            it('value should be updated by last call', async function () {
                expect(await this.api1.read('myTextKey')).to.not.be.equal('hello world');
                expect(await this.api1.read('myTextKey')).to.be.equal('goodbye world');
            });

        });

        context('creating, deleting, and then reading', function () {

            beforeEach('creating state', async function () {
                await this.api1.create('myTextKey', 'hello world');
                await this.api3.delete('myTextKey');
            });

            it('should throw error when attempting to read', async function () {
                await this.api1.read('myTextKey').should.be.rejectedWith('RECORD_NOT_FOUND')
            });
        });
    });
});
