const {expect} = require('chai');
const assert = require('assert');


exports.crudFunctionalityTests = clientsObj => {

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

exports.miscFunctionalityTests = clientsObj => {

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
