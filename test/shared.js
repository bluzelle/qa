const {expect} = require('chai');

const api = require('../bluzelle-js/src/api');

exports.connect = (address, port, uuid) => {
    api.connect(`ws://${address}:${port}`, uuid)
};

exports.swarmIsOperational = () => {

    it('should be able to create', async () => {

        await api.create('key', '123');
    });

    it('should be able to read', async () => {

        await api.create('key', 'abc');

        expect(await api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        await api.create('key', '123');

        await api.update('key', 'abc');

        expect(await api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        await api.create('key', '123');

        await api.remove('key');

        expect(await api.has('key')).to.be.false;
    })
};

exports.createShouldTimeout = () => {

    it('create should timeout at api level', done => {

        api.create('key', '123')
            .catch(e => {
                expect(e.toString()).to.include('Error: Bluzelle poll timeout - command not commited to swarm.');
                done();
            })
    });
};
