const assert = require('assert');
const sharedTests = require('../shared/tests');
const {startSwarm, initializeClient, teardown, createKeys} = require('../../utils/daemon/setup');
const PollUntil = require('poll-until-promise');
const delay = require('delay');


let numOfNodes = harnessConfigs.numOfNodes;

const clientsObj = {};

describe('view change', function () {

    [{
        name: 'primary dies with no pre-existing state',
        numOfKeys: 0,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 50 keys loaded',
        numOfKeys: 50,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 100 keys loaded',
        numOfKeys: 100,
        hookTimeout: 30000
    }, {
        name: 'primary dies with 500 keys loaded',
        numOfKeys: 500,
        hookTimeout: 100000
    }].forEach((ctx) => {

        context(ctx.name, function () {

            before(async function () {
                this.timeout(ctx.hookTimeout);

                [this.swarm] = await startSwarm({numOfNodes});
                this.api = await initializeClient({swarm: this.swarm, setupDB: true});

                if (ctx.numOfKeys > 0) {
                    await createKeys({api: this.api}, ctx.numOfKeys)
                }

                // Ensure daemons don't get stuck in invalid local state and don't post fatal errors
                const failures = [
                    ['Dropping message because local view is invalid', 5],
                    [' [fatal] ', 1]
                ];
                this.swarm.addMultipleFailureListeners(failures);

                killPrimary.call(this);
                await this.api.create('trigger', 'broadcast');

                clientsObj.api = this.api;
            });

            after('remove configs and peerslist and clear harness state', async function () {
                teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
            });

            it('new primary should take over', async function () {
                const pollPrimary = new PollUntil();

                await pollPrimary
                    .stopAfter(30000)
                    .tryEvery(1000)
                    .execute(() => new Promise((res, rej) => {

                        clientsObj.api.status()
                            .then(val => {

                                const parsedStatusJson = JSON.parse(val.moduleStatusJson).module[0].status;

                                if (parsedStatusJson.primary.name !== this.swarm.primary) {
                                    return res(true);
                                } else {
                                    rej(false);
                                }
                            })
                            .catch(e => console.log(e));
                    }))
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

            sharedTests.crudFunctionality(clientsObj);

            sharedTests.miscFunctionality(clientsObj);

        });

    });

    context('primary dies while operations are in flight', function () {

        // todo: add tests increasing number of keys in flight when KEP-1226 is resolved

        before(async function () {
            this.timeout(30000);

            [this.swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm: this.swarm, setupDB: true});

            this.keysInFlight = 30;

            for (let i = 0; i < this.keysInFlight; i++) {
                this.api.create(`bananas-${i}`, 'value');
            }

            // Ensure daemons don't get stuck in invalid local state and don't post fatal errors
            const failures = [
                ['Dropping message because local view is invalid', 5],
                [' [fatal] ', 1]
            ];
            this.swarm.addMultipleFailureListeners(failures);

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

        sharedTests.crudFunctionality(clientsObj);

        sharedTests.miscFunctionality(clientsObj);

    });

    context('no client requests following primary death to trigger failure detector and view change', function () {

        before(async function () {
            this.timeout(30000);

            [this.swarm] = await startSwarm({numOfNodes});
            this.api = await initializeClient({swarm: this.swarm, setupDB: true});

            killPrimary.call(this);

            clientsObj.api = this.api;
        });

        after('remove configs and peerslist and clear harness state', function () {
            teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
        });

        it('no new primary should be accepted', async function () {

            const results = [];

            for (let i = 0; i < 10; i++ ) {
                await delay(1000);

                const resp = await clientsObj.api.status();
                const primaryReported = JSON.parse(resp.moduleStatusJson).module[0].status.primary.name;

                results.push(primaryReported)
            }

            const valuesAreTheSame = (arr) => arr.every((val, i, arr) => val === arr[0]);

            assert(valuesAreTheSame(results));
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
