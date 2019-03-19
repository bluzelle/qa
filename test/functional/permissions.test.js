const fs = require('fs');
const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');
const {generateKey} = require('../../utils/daemon/crypto');
const common = require('../common')

let numOfNodes = harnessConfigs.numOfNodes;
const tempPath = ('./tmp');
const numOfNewWriters = 5;
const clientsObj = {};

(process.env.TEST_REMOTE_SWARM ? describe.only : describe)('permissions', function () {

    (process.env.TEST_REMOTE_SWARM ? remoteSwarmHook() : localSwarmHooks());

    before('generate temp directory and load keyPairs', function () {

        try {
            fs.mkdirSync(tempPath);
        } catch (err) {
            if (err.message.includes('EEXIST: file already exists')) {
                // do nothing
            } else {
                throw err;
            }
        }

        this.keyPairs = [...Array(numOfNewWriters).keys()].map(() => generateKey(tempPath)).reduce((results, [pubKey, privKey], idx) => {
            results[`pair${idx}`] = {
                pubKey: pubKey,
                privKey: privKey,
            };
            return results
        }, {});

        this.clients = [];

        Object.entries(this.keyPairs).map(([name, pair]) => {
            this.clients.push(
                bluzelle({
                    entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
                    uuid: harnessConfigs.clientUuid,
                    private_pem: pair.privKey,
                    log: false
                })
            )
        });

        this.clientGeneratedPubKeys = this.clients.reduce((acc, client) => {

            acc.push(client.publicKey());

            return acc;
        }, []);
    });

    before('create key', async function () {
        await this.api.create('updateKey', 'value--1');
    });

    it('can retrieve writers list', async function () {

        const res = await this.api.getWriters();

        expect(res).to.have.property('owner');
        expect(res.writers).to.have.lengthOf(0);
    });

    it(`can add writers (${numOfNewWriters})`, async function () {

        await this.api.addWriters(this.clientGeneratedPubKeys);
        const res = await this.api.getWriters();

        expect(res.writers).to.have.deep.members(this.clientGeneratedPubKeys);
    });

    for (let i = 0; i < numOfNewWriters; i++) {

        context(`writer-${i}`,function() {

            it(`should be able to interact with the same key (CRU)`, async function () {

                await this.clients[i].create(`newWriter-${i}`, `initialValue`);
                await this.clients[i].update(`newWriter-${i}`, `value-${i}`);
                const res = await this.clients[i].read(`newWriter-${i}`);

                expect(res).to.be.equal(`value-${i}`);
            });

            it(`should be able to interact with the same key (D)`, async function () {

                await this.clients[i].delete(`newWriter-${i}`);
            });

            it('** set clientsObj **', function () {
                clientsObj.api = this.clients[i];
            });

            common.crudFunctionalityTests(clientsObj);
            common.miscFunctionalityTests(clientsObj);
        });
    }
});

function localSwarmHooks() {
    before('stand up swarm and client', async function () {
        [this.swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({
            swarm: this.swarm,
            setupDB: true
        });
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
    });
};

function remoteSwarmHook() {
    before('initialize client and setup db', async function () {
        this.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: harnessConfigs.clientUuid,
            private_pem: harnessConfigs.clientPem,
            log: false
        });

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }

        await this.api.createDB();
    });
};
