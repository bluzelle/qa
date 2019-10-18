const sharedTests = require('../shared/tests');
const {localTeardown, localSetup, remoteSetup} = require('../shared/hooks');
const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {generateString} = require('../../src/utils');
const {harnessConfigs} = require('../../resources/harness-configurations');

(harnessConfigs.testRemoteSwarm ? describe.only : describe)('basic functionality', function () {
    context('smoke test', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook({log: false, logDetailed: false}) : localSwarmHooks());

        sharedTests.crudFunctionality.apply(this);

        sharedTests.miscFunctionality.apply(this);
    });

    context('varying number of keys and various sizes', function () {

        const numberOfKeys = [50, 100, 150];
        const sizes = [1 * 1024, 55 * 1024, 100 * 1024];

        numberOfKeys.forEach(numberOfKeys => {
            sizes.forEach(size => {

                const VALUE = generateString(size);

                context(`with ${numberOfKeys} keys of ${size} size`, function () {

                    this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier);

                    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

                    it(`should be able to create`, async function () {
                        for (let i = 0; i < numberOfKeys; i ++) {
                            await this.api.create(`key-${i}`, VALUE)
                        }
                    });

                    it(`should be able to read`, async function () {
                        for (let i = 0; i < numberOfKeys; i ++) {
                            (await this.api.read(`key-${i}`)).should.be.equal(VALUE);
                        }
                    });

                    it(`should be able to quickread`, async function () {
                        for (let i = 0; i < numberOfKeys; i ++) {
                            (await this.api.quickread(`key-${i}`)).should.be.equal(VALUE);
                        }
                    });

                    it(`should be able to update and confirm result with read`, async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier * 2);

                        const NEW_VALUE = VALUE.slice(0, -1) + 'A';

                        for (let i = 0; i < numberOfKeys; i ++) {
                            await this.api.update(`key-${i}`, NEW_VALUE);
                        }

                        for (let i = 0; i < numberOfKeys; i ++) {
                            (await this.api.read(`key-${i}`)).should.be.equal(NEW_VALUE);
                        }
                    });

                    it(`should be able to get all keys`, async function () {
                        (await this.api.keys()).should.have.lengthOf(numberOfKeys);
                    });

                    it(`should be able to has all keys`, async function () {
                        for (let i = 0; i < numberOfKeys; i ++) {
                            await this.api.has(`key-${i}`);
                        }
                    });

                    it(`should be able to delete all keys`, async function () {
                        this.timeout(numberOfKeys * harnessConfigs.keyCreationTimeoutMultiplier * 2);

                        for (let i = 0; i < numberOfKeys; i ++) {
                            await this.api.delete(`key-${i}`);
                        }

                        (await this.api.keys()).should.have.lengthOf(0);

                        for (let i = 0; i < numberOfKeys; i ++) {
                            (await this.api.has(`key-${i}`)).should.be.equal(false);
                        }
                    });
                });
            });
        });
    });
});
