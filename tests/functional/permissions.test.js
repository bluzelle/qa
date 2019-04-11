const fs = require('fs');
const {generateKey} = require('../../utils/daemon/crypto');
const sharedTests = require('../shared/tests');
const {localSwarmHooks, remoteSwarmHook} = require('../shared/hooks');


const numOfNodes = harnessConfigs.numOfNodes;

// permissioning is deprecated

(harnessConfigs.testRemoteSwarm ? describe.skip : describe.skip)('permissions', function () {

    const tempPath = ('./tmp');
    const numOfNewWriters = 5;

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

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

        const res = await this.api._getWriters();

        expect(res).to.have.property('owner');
        expect(res.writers).to.have.lengthOf(0);
    });

    it(`can add writers (${numOfNewWriters})`, async function () {

        await this.api._addWriters(this.clientGeneratedPubKeys);
        const res = await this.api._getWriters();

        expect(res.writers).to.have.deep.members(this.clientGeneratedPubKeys);
    });

    for (let i = 0; i < numOfNewWriters; i++) {

        context(`writer-${i}`, function () {

            before('set api', function () {
                this.api = this.clients[i];
            });

            it(`should be able to interact with the same key (CRU)`, async function () {

                await this.api.create(`newWriter-${i}`, `initialValue`);
                await this.api.update(`newWriter-${i}`, `value-${i}`);
                const res = await this.api.read(`newWriter-${i}`);

                expect(res).to.be.equal(`value-${i}`);
            });

            it(`should be able to interact with the same key (D)`, async function () {

                await this.api.delete(`newWriter-${i}`);
            });

            sharedTests.crudFunctionality.apply(this);
            sharedTests.miscFunctionality.apply(this);
        });
    }
});
