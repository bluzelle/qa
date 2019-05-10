const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const sharedTests = require('../shared/tests');
const {generateString} = require('../../src/utils');
const daemonConstants = require('../../resources/daemonConstants');
const delay = require('delay');

(harnessConfigs.testRemoteSwarm ? describe.only : describe)('time to live', function () {

    const TIME_TO_LIVE = 5;

    context('key created with expiry', function () {

        context('basic functionalities', function () {

            (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

            before('create key with ttl', async function () {
                await this.api.create('salmon', 'fish', TIME_TO_LIVE);
            });

            it('should be readable', async function () {
                expect(await this.api.read('salmon')).to.equal('fish');
            });

            it('should be update-able', async function () {
                await this.api.update('salmon', 'tuna');
                expect(await this.api.read('salmon')).to.equal('tuna');
            });

            it('should be has-able', async function () {
                expect(await this.api.has('salmon')).to.be.true;
            });

            it('should be returned in keys', async function () {
                expect(await this.api.keys('salmon')).to.have.members(['salmon']);
            });

            it('should be deletable', async function () {
                await this.api.delete('salmon');
                expect(await this.api.has('salmon')).to.be.false;
            });
        });

        const alterTtlTestCases = [{
            cmdName: 'expire',
            args: ['salmon']
        }, {
            cmdName: 'update',
            args: ['salmon', 'fish']
        }];

        Object.defineProperty(alterTtlTestCases, 'name', {
            value: function (obj) {return `should be able to alter ttl with ${obj.cmdName}()`}
        });

        alterTtlTestCases.forEach((ctx) => {

            context(alterTtlTestCases.name(ctx), function () {

                (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

                const DELAY = 2000;
                const LONGER_TIME_TO_LIVE = 7;
                const SHORTER_TIME_TO_LIVE = 3;

                before('create key with ttl', async function () {
                    await this.api.create('salmon', 'fish', TIME_TO_LIVE);
                });

                it('should be able to fetch ttl', async function () {
                    await delay(DELAY);
                    expect(await this.api.ttl('salmon')).to.be.most(TIME_TO_LIVE - (DELAY / 1000));
                });

                it('should be able to extend ttl', async function () {
                    await this.api[ctx.cmdName](...ctx.args, LONGER_TIME_TO_LIVE);
                    expect(await this.api.ttl('salmon')).to.be.least(LONGER_TIME_TO_LIVE - 1);
                });

                it('should be able to shorten ttl', async function () {
                    await this.api[ctx.cmdName](...ctx.args, SHORTER_TIME_TO_LIVE);
                    expect(await this.api.ttl('salmon')).to.be.least(SHORTER_TIME_TO_LIVE - 1);
                });

                it('should expire after expiry', function (done) {
                    delay(SHORTER_TIME_TO_LIVE * 1000).then(() => {
                        this.api.read('salmon')
                            .then(() => {
                                console.log('Unexpected successful read')
                            })
                            .catch((err) => {
                                if (err.message.includes('DELETE_PENDING') || err.message.includes('RECORD_NOT_FOUND')) {
                                    done()
                                } else {
                                    console.log('Unexpected error message: ', err.message);
                                }
                            });
                    });
                });
            });
        });

        context('expired key should be deleted', function () {

            (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

            before('create key with ttl', async function () {
                this.timeout(15000);

                await this.api.create('salmon', 'fish', TIME_TO_LIVE);
                await delay((TIME_TO_LIVE * 1000) + daemonConstants.ttlPurgeLoopInterval);
            });

            it('has should return false', async function () {
                (await this.api.has('salmon')).should.be.false;
            });

            it('read should return "RECORD_NOT_FOUND"', async function () {
                await this.api.read('salmon').should.be.rejectedWith('RECORD_NOT_FOUND');
            });

            it('keys should return empty array', async function () {
                await this.api.keys().should.be.empty;
            });

        });
    });

    context('varying number of keys, expiry time, and value size', function () {

        const testCases = [{
            numOfKeys: 50,
            expiryMultiplier: 20,
            valueSize: 1 * 1024
        }, {
            numOfKeys: 50,
            expiryMultiplier: 20,
            valueSize: 55 * 1024
        }, {
            numOfKeys: 100,
            expiryMultiplier: 20,
            valueSize: 1 * 1024
        }, {
            numOfKeys: 100,
            expiryMultiplier: 20,
            valueSize: 55 * 1024
        }, {
            numOfKeys: 200,
            expiryMultiplier: 20,
            valueSize: 1 * 1024
        },{
            numOfKeys: 200,
            expiryMultiplier: 20,
            valueSize: 55 * 1024
        }];

        Object.defineProperties(testCases, {
            name: {value: obj => `${obj.numOfKeys} keys with min expiry: ${testCases.minimumDelay(obj)}, max expiry: ${testCases.minimumDelay(obj) + obj.expiryMultiplier}, value size: ${obj.valueSize}`},
            hookTimeout: {value: obj => obj.numOfKeys * harnessConfigs.keyCreationTimeoutMultiplier},
            testTimeout: {value: obj => obj.numOfKeys * harnessConfigs.keyCreationTimeoutMultiplier + (obj.expiryMultiplier * 1000)},
            minimumDelay: {value: obj => obj.numOfKeys * harnessConfigs.keyCreationTimeoutMultiplier / 1000}
        });

        testCases.forEach((ctx) => {

            context(testCases.name(ctx), function () {

                (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks({preserveSwarmState: false}));

                before('create keys', function () {
                    this.timeout(testCases.hookTimeout(ctx));

                    this.expiryTimes = generateExpiryTimes(ctx.numOfKeys, testCases.minimumDelay(ctx), ctx.expiryMultiplier);
                    this.sortedExpiryTimes = this.expiryTimes.slice().sort((a, b) => a - b);
                    this.medianDelay = this.sortedExpiryTimes[this.sortedExpiryTimes.length / 2];

                    return this.expiryTimes.reduce((p, expiryTime, idx) =>
                            p.then(() => this.api.create(`expiry-${idx}`, generateString(ctx.valueSize), expiryTime)),
                        Promise.resolve());
                });

                it('should be able to list all keys', async function () {
                    (await this.api.keys()).should.have.lengthOf(ctx.numOfKeys);
                });

                it('at least half the keys should expire', async function () {

                    this.timeout(testCases.testTimeout(ctx));

                    await delay(this.medianDelay * 1000 + daemonConstants.ttlPurgeLoopInterval);
                    (await this.api.keys()).should.have.lengthOf.at.most(ctx.numOfKeys / 2);
                });

                it('all the keys should expire', async function () {
                    this.timeout(testCases.testTimeout(ctx));


                    const highestDelay = this.sortedExpiryTimes[this.sortedExpiryTimes.length - 1];
                    await delay((highestDelay - this.medianDelay) * 1000);

                    (await this.api.keys()).should.have.lengthOf(0);
                });

                sharedTests.crudFunctionality.apply(this);

                sharedTests.miscFunctionality.apply(this);
            });
        });
    });

    context('key created without expiry', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

        before('create key without ttl', async function () {
            await this.api.create('salmon', 'fish', TIME_TO_LIVE);
        });

        it('should be readable', async function () {
            expect(await this.api.read('salmon')).to.equal('fish');
        });

        it('should be able to "persist"', async function () {
            await this.api.persist('salmon')
        });

        it('should be able to "ttl"', async function () {
            await this.api.ttl('salmon').should.be.rejectedWith('TTL_RECORD_NOT_FOUND');
        });

        it('should be able to update expiry with update()', async function () {
            await this.api.update('salmon', 'fish', TIME_TO_LIVE + 10);
            (await this.api.ttl('salmon')).should.be.at.least(TIME_TO_LIVE + 9);
        });

        it('should be able to set expiry with expire()', async function () {
            await this.api.expire('salmon', TIME_TO_LIVE);
            (await this.api.ttl('salmon')).should.be.at.most(TIME_TO_LIVE);
        });

        it('read should be rejected after expiry', function (done) {
            delay(TIME_TO_LIVE * 1000).then(() => {
                this.api.read('salmon')
                    .then(() => {
                        console.log('Unexpected successful read')
                    })
                    .catch((err) => {
                        if (err.message.includes('DELETE_PENDING') || err.message.includes('RECORD_NOT_FOUND')) {
                            done()
                        } else {
                            console.log('Unexpected error message: ', err.message);
                        }
                    });
            });
        });
    });

});

function generateExpiryTimes(numOfKeys, min = 10, multiplier = 30) {
    return Array.from({length: numOfKeys}, () => Math.floor((Math.random() * multiplier) + min))
};
