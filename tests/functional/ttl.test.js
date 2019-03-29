const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');
const {crudFunctionality, miscFunctionality} = require('../shared/tests');
const delay = require('delay');

(harnessConfigs.testRemoteSwarm ? describe.only : describe.only)('time to live', function () {

    const clientObj = {};

    const TIME_TO_LIVE = 5;
    const DAEMON_PURGE_LOOP_TIMER = 5; // daemons check for ttl expiry every 5 seconds

    context('key created with expiry', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

        context('basic functionalities', function () {

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

        context('should have expiry functionalities', function () {

            const DELAY = 2000;

            before('create key with ttl', async function () {
                await this.api.create('salmon', 'fish', TIME_TO_LIVE);
            });

            it('should be able to set ttl', async function () {
                await delay(DELAY);
                expect(await this.api.ttl('salmon')).to.be.most(TIME_TO_LIVE - (DELAY / 1000));
            });

            it('should expire after expiry', function (done) {
                delay(TIME_TO_LIVE * 1000 - DELAY).then(() => {
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

        context('should be able to set persisted / expiry numerous times', function () {

            before('create key with ttl', async function () {
                await this.api.create('salmon', 'fish', TIME_TO_LIVE);
            });

            it('should be able to set persist', async function () {
                await this.api.persist('salmon');
                // expect this to return something indicating persistence
                expect(await this.api.ttl('salmon'))
            });

            it('should be able to set expiry', async function () {
                await this.api.expire('salmon', TIME_TO_LIVE);
                expect(await this.api.ttl('salmon')).to.be.equal(TIME_TO_LIVE);
            });

            it('should be able to set persist', async function () {
                await this.api.persist('salmon');
                // expect this to return something indicating persistence
                expect(await this.api.ttl('salmon'))
            });

            it('should be able to set expiry', async function () {
                await this.api.expire('salmon', TIME_TO_LIVE);
                expect(await this.api.ttl('salmon')).to.be.equal(TIME_TO_LIVE);
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

            it('should return false for "has" after expiry', async function () {
                expect(await this.api.has('salmon')).to.be.false;
            });

            it('should return empty array for keys after expiry', async function () {
                await this.api.keys().should.be.empty;
            })

        });

        context('expired key should be deleted', function () {

            before('create key with ttl', async function () {
                await this.api.create('salmon', 'fish', TIME_TO_LIVE);
                await delay((TIME_TO_LIVE + DAEMON_PURGE_LOOP_TIMER) * 1000);
            });

            it('has should return false', async function () {
                (await this.api.has('salmon')).should.be.false;
                // (await Promise.resolve(true)).should.be.false;
            });

            it('read should return "RECORD_NOT_FOUND"', async function () {
                await this.api.read('salmon').should.be.rejectedWith('RECORD_NOT_FOUND');
            });

            it('keys should return empty array', async function () {
                await this.api.keys().should.be.empty;
            });

        });
    });

    context.only('numerous keys with varying expiry', function () {

        (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks({preserveSwarmState: true}));

        const expiryCases = [{
            numOfKeys: 50,
            hookTimeout: 50000,
            expiryMinDelay: 10,
            expiryMultiplier: 20
        }/*, {
            numOfKeys: 50,
            hookTimeout: 100000,
            expiryMinDelay: 10,
            expiryMultiplier: 60
        }, {
            numOfKeys: 100,
            hookTimeout: 30000,
            expiryMinDelay: 10,
            expiryMultiplier: 20
        }, {
            numOfKeys: 300,
            hookTimeout: 100000,
            expiryMinDelay: 10,
            expiryMultiplier: 20
        }*/];

        Object.defineProperty(expiryCases, 'name', {value: function (obj) {return `${obj.numOfKeys} keys with min expiry: ${obj.expiryMinDelay}, max expiry: ${obj.expiryMinDelay + obj.expiryMultiplier}`}, enumerable: false});

        expiryCases.forEach((ctx) => {

            context(expiryCases.name(ctx), function () {

                this.timeout(ctx.hookTimeout);

                before('create keys', function () {
                    this.expiryTimes = generateExpiryTimes(ctx.numOfKeys, ctx.expiryMinDelay, ctx.expiryMultiplier);
                    this.sortedExpiryTimes = this.expiryTimes.slice().sort((a, b) => a - b);
                    this.medianDelay = this.sortedExpiryTimes[this.sortedExpiryTimes.length / 2];

                    return this.expiryTimes.reduce((p, expiryTime, idx) =>
                            p.then(() => this.api.create(`expiry-${idx}`, 'value', expiryTime)),
                        Promise.resolve());
                });

                before('set client to to clientObj', function () {
                    clientObj.api = this.api;
                });

                it('should be able to list all keys', async function () {
                    (await this.api.keys()).should.have.lengthOf(ctx.numOfKeys);
                });

                it('half the keys should expire', async function () {
                    // console.log('sorted expiryTimes', this.sortedExpiryTimes);
                    console.log('waitng medianDelay + DAEMON_PURGE_LOOP_TIMER = ', this.medianDelay + DAEMON_PURGE_LOOP_TIMER);
                    await delay((this.medianDelay) * 1000);
                    await delay((DAEMON_PURGE_LOOP_TIMER) * 1000);
                    (await this.api.keys()).should.have.lengthOf.at.most(ctx.numOfKeys / 2);
                });

                it('all the keys should expire', async function () {
                    const highestDelay = this.sortedExpiryTimes[this.sortedExpiryTimes.length - 1];
                    console.log('waiting an extra: ', highestDelay - this.medianDelay);
                    await delay((highestDelay - this.medianDelay) * 1000);

                    (await this.api.keys()).should.have.lengthOf(0);
                });

                crudFunctionality(clientObj);

                miscFunctionality(clientObj);
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

        it('should be able to "persist" a persisted key', async function () {
            await this.api.persist('salmon')
        });

        it('should be able to "ttl"', async function () {
            await this.api.ttl('salmon');
            // expect ttl to show persisted
        });

        it('should be able to set expire', async function () {
            await this.api.expire('salmon', TIME_TO_LIVE)
        });

        it('should be able to "ttl"', async function () {
            await this.api.ttl('salmon');
            // expect ttl to show new ttl
        });
    });

});

function generateExpiryTimes(numOfKeys, min = 10, mutiplier = 30) {
    return Array.from({length: numOfKeys}, () => Math.floor((Math.random() * mutiplier) + min))
}
