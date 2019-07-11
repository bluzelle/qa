const {createKeys} = require('../../src/clientManager');
const {localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');


describe('database management', function () {

    localSwarmHooks({createDB: false});

    // ensure DB sizes > 4GiB does not cause issues for JS client
    const testParams = {
        databaseSize: 4294967296 + 1,

        numberOfKeysToCreate: 10,
        keysValueSize: 50000
    };

    context(`with a database of size ${testParams.databaseSize}`, function () {

        before(`createDB of size ${testParams.databaseSize}`, async function () {
            await this.api._createDB(testParams.databaseSize)
        });

        it(`should correctly report maxSize of ${testParams.databaseSize}`, async function () {
            expect(await this.api.size()).to.deep.include({maxSize: testParams.databaseSize});
        });

        it(`should correctly report remainingBytes of ${testParams.databaseSize}`, async function () {
            expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize});
        });

        it(`should correctly report keys of 0`, async function () {
            expect(await this.api.size()).to.deep.include({keys: 0});
        });

        it(`should correctly report bytes of 0`, async function () {
            expect(await this.api.size()).to.deep.include({bytes: 0});
        });

        context(`create ${testParams.numberOfKeysToCreate} keys with size ${testParams.keysValueSize}`, function () {

            before('create keys', async function () {
                const keysAndValue = await createKeys({api: this.api}, testParams.numberOfKeysToCreate, 'batch', generateString(testParams.keysValueSize))
                const keysValue = keysAndValue.keys.reduce((total, key) => total += key.length, 0);

                this.totalValue = keysValue + testParams.keysValueSize * testParams.numberOfKeysToCreate;
            });

            it(`should correctly report remainingBytes`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize - this.totalValue});
            });

            it(`should correctly report keys`, async function () {
                expect(await this.api.size()).to.deep.include({keys: testParams.numberOfKeysToCreate});
            });

            it(`should correctly report bytes`, async function () {
                expect(await this.api.size()).to.deep.include({bytes: this.totalValue});
            });

        });

        context('deleting all keys', function () {

            before('fetch key list and delete all', async function () {
                this.timeout(harnessConfigs.defaultTestTimeout + (harnessConfigs.keyCreationTimeoutMultiplier * (testParams.numberOfExtraKeys + 2)));

                const keys = await this.api.keys();

                await keys.reduce((p, key) =>
                        p.then(() => this.api.delete(key)),
                    Promise.resolve());
            });

            it(`should show remainingBytes of ${testParams.databaseSize}`, async function () {
                expect(await this.api.size()).to.deep.include({remainingBytes: testParams.databaseSize});
            });

            it('should show bytes of 0', async function () {
                expect(await this.api.size()).to.deep.include({bytes: 0});
            });

            it('should show keys of 0', async function () {
                expect(await this.api.size()).to.deep.include({keys: 0});
            });
        });
    });
});
