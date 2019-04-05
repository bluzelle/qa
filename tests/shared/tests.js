exports.crudFunctionality = function () {

    const random = Math.random().toString().slice(0,10);

    it('should be able to create', async function () {

        try {
            await this.api.create(`create-test-key-${random}`, '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }
    });

    it('should be able to read', async function () {

        try {
            await this.api.create(`read-test-key-${random}`, 'abc');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        expect(await this.api.read(`read-test-key-${random}`)).to.be.equal('abc');
    });

    it('should be able to quickread', async function () {

        try {
            await this.api.create(`quickread-test-key-${random}`, 'abc');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        expect(await this.api.quickread(`quickread-test-key-${random}`)).to.be.equal('abc');
    });

    it('should be able to update', async function () {

        try {
            await this.api.create(`update-test-key-${random}`, '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await this.api.update(`update-test-key-${random}`, 'abc');
        } catch (err) {
            throw new Error(`Failed to update \n ${err}`);
        }

        expect(await this.api.read(`update-test-key-${random}`)).to.equal('abc');

    });

    it('should be able to delete', async function () {

        try {
            await this.api.create(`delete-test-key-${random}`, '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await this.api.delete(`delete-test-key-${random}`);
        } catch (err) {
            throw new Error(`Failed to remove \n ${err}`);
        }

        expect(await this.api.has(`delete-test-key-${random}`)).to.be.false;
    })
};

exports.miscFunctionality = function () {

    const random = Math.random().toString().slice(0,10);

    it('should be able to "has"', async function () {

        let result;

        try {
            await this.api.create(`has-test-key-${random}`, '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await this.api.has(`has-test-key-${random}`);
        } catch (err) {
            throw new Error(`Failed to "has" \n ${err}`);
        }

        expect(result).to.be.true;
    });


    it('should be able to get keys', async function () {

        let result;

        try {
            await this.api.create(`get-test-key-${random}`, '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await this.api.keys()
        } catch (err) {
            throw new Error(`Failed to "keys"\n ${err}`);
        }

        expect(result).to.have.lengthOf.greaterThan(0);
    });

    it('should be able to get size', async function () {

        let result;

        try {
            await this.api.create(`size-test-key-${random}`, '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await this.api.size();
        } catch (err) {
            throw new Error(`Failed to get size \n ${err}`);
        }

        expect(result.bytes).to.be.greaterThan(0);
        expect(result.keys).to.be.greaterThan(0);
    });

};
