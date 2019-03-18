exports.crudFunctionalityTests = clientsObj => {

    it('should be able to create', async () => {

        try {
            await clientsObj.api.create('create-test-key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }
    });

    it('should be able to read', async () => {

        try {
            await clientsObj.api.create('read-test-key', 'abc');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        expect(await clientsObj.api.read('read-test-key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        try {
            await clientsObj.api.create('update-test-key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.update('update-test-key', 'abc');
        } catch (err) {
            throw new Error(`Failed to update \n ${err}`);
        }

        expect(await clientsObj.api.read('update-test-key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        try {
            await clientsObj.api.create('delete-test-key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.delete('delete-test-key');
        } catch (err) {
            throw new Error(`Failed to remove \n ${err}`);
        }

        expect(await clientsObj.api.has('delete-test-key')).to.be.false;
    })
};

exports.miscFunctionalityTests = clientsObj => {

    it('should be able to "has"', async () => {

        let result;

        try {
            await clientsObj.api.create('has-test-key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.has('has-test-key');
        } catch (err) {
            throw new Error(`Failed to "has" \n ${err}`);
        }

        expect(result).to.be.true;
    });


    it('should be able to get keys', async () => {

        let result;

        try {
            await clientsObj.api.create('get-test-key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.keys()
        } catch (err) {
            throw new Error(`Failed to "keys"\n ${err}`);
        }

        expect(result).to.have.lengthOf.greaterThan(0);
    });

    it('should be able to get size', async () => {

        let result;

        try {
            await clientsObj.api.create('size-test-key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.size();
        } catch (err) {
            throw new Error(`Failed to get size \n ${err}`);
        }

        expect(result).to.be.greaterThan(0);
    });

};
