const {generateSwarm} = require('../../utils/daemonManager');

const numOfNodes = harnessConfigs.numOfNodes;

const CLIENTS = {
    pem1: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg==',
    pem2: 'MHQCAQEEIL5a3uJRsVzjSo4A5UF1/4csXyAeaRDqglbrZw1xY1xuoAcGBSuBBAAKoUQDQgAE/3fvyvYIpo1Aehw8l8wWJkUHCU0u1az7OAEmh6WOhSAYGg1TcVNRrhUtUmWMUQuDG9ajFAybUMW7o94wjYmxOA=='

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
            this.api3 = bluzelle({
                entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
                private_pem: CLIENTS.pem1,
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
        this.swarm = generateSwarm({numberOfDaemons: numOfNodes});
        await this.swarm.start();

        this.api1 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            private_pem: CLIENTS.pem1,
            log: false
        });

        this.api2 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            private_pem: CLIENTS.pem2,
            log: false
        });

        await this.api1.createDB();
        await this.api2.createDB();
    });

    after('remove configs and peerslist and clear harness state', async function () {
        await this.swarm.stop();
    });
};

function remoteSwarmHook() {
    before('initialize clients, setup db', async function () {
        this.api1 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            private_pem: CLIENTS.pem1,
            log: false
        });

        this.api2 = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            private_pem: CLIENTS.pem2,
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
