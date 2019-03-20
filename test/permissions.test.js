const assert = require('assert');
const fs = require('fs');
const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');
const {generateKey} = require('../utils/daemon/crypto');

let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;
let keyPairs;
const tempPath = ('./tmp');


describe('permissions', () => {

    before('generate temp directory and load keyPairs', () => {

        try {
            fs.mkdirSync(tempPath);
        } catch (err) {
            if (err.message.includes('EEXIST: file already exists')) {
                // do nothing
            } else {
                throw err;
            }
        }

        keyPairs = [...Array(10).keys()].map(() => generateKey(tempPath)).reduce((results, ele, idx) => {
            results[`pair${idx}`] = {
                pubKey: ele[0],
                privKey: ele[1],
            };
            return results
        }, {});
    });

    before('stand up swarm and client', async function () {
        this.timeout(30000);
        [swarm] = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm, setupDB: true, uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='});
        await clientsObj.api.create('updateKey', 'value--1');
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
    });

    it('can retrieve writers list', async () => {

        const res = await clientsObj.api.getWriters();

        assert(res.owner);
        assert(res.writers.length === 0);
    });

    it('can add writers', async () => {

        const pubKeys = [];

        for (let key in keyPairs) {
            pubKeys.push(keyPairs[key].pubKey);
        }

        await clientsObj.api.addWriters(pubKeys);
        const res = await clientsObj.api.getWriters();

        assert(compareArrays(res.writers, pubKeys));
    });

    const privKeys = [];

    for (let key in keyPairs) {
        privKeys.push(keyPairs[key].privKey)
    }

    for (let i = 0; i < 10; i++ ) {

        it(`added writer can CRU - ${i}`, async () => {

            let client = await initializeClient({swarm, uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem: privKeys[i]});


            await client.create(`newWriter-${i}`, `initialValue`);
            await client.update(`newWriter-${i}`, `value-${i}`);
            const res = await client.read(`newWriter-${i}`);
            assert(res === `value-${i}`);
        });
    }

    for (let i = 0; i < 10; i++ ) {

        it(`added writer can delete - ${i}`, async () => {

            let client = await initializeClient({swarm, uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem: privKeys[i]});

            await client.delete(`newWriter-${i}`);
        });
    }

});

const compareArrays = (array1, array2) =>
    array1.length === array2.length && array1.sort().every((value, index) => value === array2.sort()[index]);
