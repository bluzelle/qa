const assert = require('assert');
const {spawnDaemon, initializeClient, spawnSwarm, teardown, createKeys} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');
const PromiseMap = require('bluebird').map;

let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe.only('state management', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);

        let [configsObject] = await generateSwarmJsonsAndSetState(3);
        swarm = new SwarmState(configsObject);

        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft', partialSpawn: 2});

        clientsObj.api = await initializeClient({swarm, setupDB: true, log: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
    });

    context('new peer joining swarm', function () {

        it.only('create keys', async function () {

            let numOfKeys = 200;

            const arrayOfKeys = [...Array(numOfKeys).keys()];

            await Promise.all(arrayOfKeys.map(v => clientsObj.api.create('batch' + v, 'value')));

            // Using Bluebird's Promise.amp to batch firing doesn't seem to help:
            // await PromiseMap(arrayOfKeys, v => clientsObj.api.create('batch' + v, 'value'), {concurrency: 10});
        })

        // beforeEach('load database with keys', async function () {
        //     await createKeys(clientsObj, 96);
        // });
        //
        // it('should not be able commit local if not synced', async function () {
        //
        //     await new Promise(async (res, rej) => {
        //
        //         let newDaemonName = swarm.lastNode[1];
        //         // console.log(newDaemonName)
        //         let newDaemonIdx = newDaemonName[newDaemonName.length - 1];
        //         await spawnDaemon(swarm, newDaemonIdx);
        //
        //         swarm['daemon0'].stream.stdout.on('data', (data) => {
        //             if (data.toString().includes('committed-local')) {
        //                 // console.log(data.toString())
        //                 rej(new Error('Unexpected committed-local string matched in new daemon output'));
        //             }
        //         });
        //
        //         setTimeout(res, 5000);
        //     });
        // });
        //
        // it('should sync at checkpoint', async function () {
        //
        //     await new Promise(async res => {
        //
        //         let newDaemonName = swarm.lastNode[1];
        //         console.log(newDaemonName)
        //         let newDaemonIdx = newDaemonName[newDaemonName.length - 1];
        //         await spawnDaemon(swarm, newDaemonIdx);
        //
        //         swarm['daemon0'].stream.stdout.on('data', (data) => {
        //             // if (data.toString().includes('committed-local')) {
        //                 // console.log(data.toString())
        //                 // res();
        //             // }
        //         });
        //
        //         setTimeout(res, 10000)
        //
        //         await clientsObj.api.create('one', 'value');
        //     });
        // });

    });
});
