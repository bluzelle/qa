const assert = require('assert');
const common = require('./common');
const {startSwarm, initializeClient, teardown, createKeys} = require('../utils/daemon/setup');
const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const PollUntil = require('poll-until-promise');


let numOfNodes = harnessConfigs.numOfNodes;

const clientsObj = {};

describe('view change', function () {

    [{
        name: 'primary dies with no pre-existing state',
        numOfKeys: 0
    }, {
        name: 'primary dies with 50 keys loaded',
        numOfKeys: 50
    }, {
        name: 'primary dies with 100 keys loaded',
        numOfKeys: 100
    }, {
        name: 'primary dies with 500 keys loaded',
        numOfKeys: 500
    }].forEach((ctx) => {

        context(ctx.name, function () {

            before(async function () {
                this.timeout(100000);

                [this.swarm] = await startSwarm({numOfNodes});
                this.api = await initializeClient({swarm: this.swarm, setupDB: true});

                if (ctx.numOfKeys > 0) {
                    await createKeys({api: this.api}, ctx.numOfKeys)
                }

                killPrimary.call(this);

                await this.api.create('trigger', 'broadcast');

                clientsObj.api = this.api
            });

            after('remove configs and peerslist and clear harness state', async function () {
                teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
            });

            it('new primary should take over', async function () {
                this.timeout(20000);

                const pollPrimary = new PollUntil();

                await new Promise((resolve, reject) => {

                    pollPrimary
                        .stopAfter(20000)
                        .tryEvery(2000)
                        .execute(() => new Promise((res, rej) => {

                            clientsObj.api.status().then(val => {

                                const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                    return res(true);
                                } else {
                                    return rej();
                                }
                            })

                        }))
                        .then(() => resolve())
                        .catch(err => reject(err));
                })
            });

            it('new primary should be next pubkey sorted lexicographically', async function () {

                const res = await clientsObj.api.status();
                const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                assert(parsedStatusJson.primary.name === this.swarm.nodes[2][1])
            });

            if (ctx.numOfKeys > 0) {

                it('should be able to fetch full keys list', async function () {
                    assert((await clientsObj.api.keys()).length === ctx.numOfKeys + 1);
                });

                it('should be able to read last key before pre-primary failure', async function () {
                    assert((await clientsObj.api.read(`batch${ctx.numOfKeys - 1}`)) === 'value')
                })
            }

            common.crudFunctionalityTests(clientsObj);

            common.miscFunctionalityTests(clientsObj);

        });

    });

    context('primary dies while operations are in flight', function() {

        // todo: add tests increasing number of keys in flight when KEP-1226 is resolved

        before(async function () {
            this.timeout(30000);

            [this.swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm: this.swarm, setupDB: true});

            this.keysInFlight = 30;

            for (let i = 0; i < this.keysInFlight; i ++) {
                this.api.create(`bananas-${i}`, 'value');
            }

            killPrimary.call(this);

            await this.api.create('trigger', 'broadcast');

            clientsObj.api = this.api
        });

        after('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('should be able to fetch full keys list', async function () {

            const keysCommitted = (await this.api.keys()).length;

            assert(keysCommitted === this.keysInFlight + 1);
        });

        common.crudFunctionalityTests(clientsObj);

        common.miscFunctionalityTests(clientsObj);

    });

    context('no client requests following primary death to trigger failure detector and view change', function () {

        before(async function () {
            this.timeout(30000);

            [this.swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm: this.swarm, setupDB: true});

            killPrimary.call(this);

            clientsObj.api = this.api
        });

        after('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('no new primary should be accepted', async function () {

            const pollPrimary = new PollUntil;

            await new Promise((resolve, reject) => {

                const timer = setTimeout(() => {
                    return resolve();
                }, 15000);

                pollPrimary
                    .stopAfter(15000)
                    .tryEvery(2000)
                    .execute(() => new Promise((res, rej) => {

                        clientsObj.api.status().then(val => {

                            const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                            if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                return rej(true);
                            }
                        })

                    }))
                    .then(() => resolve())
                    .catch(err => reject(err));
            });
        });

        it('backup should report no primary', async function () {
            this.timeout(40000);

            await new Promise(res => {
                this.swarm[this.swarm.backups[0]].stream.stdout.on('data', (data) => {
                    if (data.toString().includes('No primary alive')) {
                        res()
                    }
                })
            });
        });

    });
});

function killPrimary() {
    const primary = this.swarm.primary;
    this.deadPrimaryIdx = primary[primary.length - 1];
    this.swarm.killNode(this.deadPrimaryIdx);
}
