const {expect} = require('chai');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnDaemon} = require('../utils/daemon/setup');
const assert = require('assert');


exports.crudFunctionality = clientsObj => {

    it('should be able to create', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }
    });

    it('should be able to read', async () => {

        try {
            await clientsObj.api.create('key', 'abc');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        expect(await clientsObj.api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.update('key', 'abc');
        } catch (err) {
            throw new Error(`Failed to update \n ${err}`);
        }

        expect(await clientsObj.api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.delete('key');
        } catch (err) {
            throw new Error(`Failed to remove \n ${err}`);
        }

        expect(await clientsObj.api.has('key')).to.be.false;
    })
};

exports.miscFunctionality = clientsObj => {

    it('should be able to "has"', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.has('key');
        } catch (err) {
            throw new Error(`Failed to "has" \n ${err}`);
        }

        assert(result);
    });


    it('should be able to get keys', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.keys()
        } catch (err) {
            throw new Error(`Failed to "keys"\n ${err}`);
        }

        assert(result.length > 0);
    });

    it('should be able to get size', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.size();
        } catch (err) {
            throw new Error(`Failed to get size \n ${err}`);
        }

        assert(result > 0);
    });

};

exports.createShouldTimeout = clientsObj => {

    it('create should timeout at api level', () => {

        return clientsObj.api.create('key', '123')
            .then(() => {
                throw new Error('Create was successful, expected to fail.')
            })
            .catch(err => {
                if (err.message.includes('Timed out after waiting for 5000ms')) {
                    return Promise.resolve()
                } else {
                    throw (err);
                }
            })
    });
};

exports.daemonShouldSync = (cfgIndexObj, numOfKeys, uuid) => {

    let api;

    beforeEach('spawn new daemon', async () => {
       await spawnDaemon(cfgIndexObj.index);
    });

    beforeEach('initialize client', () => {

        api = new BluzelleClient(
            `ws://${harnessConfigs.address}:${harnessConfigs.port + parseInt(cfgIndexObj.index)}`,
            uuid,
            false
        );
    });

    beforeEach('connect client', async () =>
        await api.connect());

    it('should sync and return full keylist', async () => new Promise((res, rej) => {

        const startTime = new Date();

        const timeId = setInterval(() => {
            let timeElapsed = () => (new Date) - startTime;

            api.keys().then((keys) => {

                if (keys.length === numOfKeys) {
                    clearInterval(timeId);
                    res();
                } else if (timeElapsed() >= 8000) {
                    clearInterval(timeId);
                    rej(new Error(`Daemon returned ${keys.length}, expected ${numOfKeys} keys`))
                }
            });

            if (timeElapsed() >= 9000) {
                clearInterval(timeId);
                rej(new Error(`Daemon failed to return keys.`))
            }
        }, 500);

    }));
};
