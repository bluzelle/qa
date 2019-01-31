const assert = require('assert');
const {spawnDaemon, initializeClient, spawnSwarm, teardown, createKeys} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');
const PromiseMap = require('bluebird').map;

const {startSwarm} = require('../structured/daemonManager');

let swarm;
let numOfNodes = harnessConfigs.numOfNodes;
const {times} = require('lodash/fp');


describe.only('state management', () => {

    // beforeEach('initialize client and connect to external swarm', async function () {
    //
    //     const UUID = '4982e0b0-0b2f-4c3a-b39f-26878e2ac814';
    //     const PEM = 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg==';
    //
    //     const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
    //
    //     this.client = bluzelle({
    //         entry: `ws://127.0.0.1:50000`,
    //         uuid: UUID,
    //         private_pem: PEM,
    //         log: true
    //     });
    //
    //     await this.client.createDB();
    //
    // });

    afterEach('delete database for external swarm', async function () {
        await this.client.deleteDB();
        await this.swarm.stop();
    });

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);

        this.swarm = await startSwarm({numberOfDaemons: 3});

       //  const {configsObject} = await generateSwarmJsonsAndSetState(3);
       //  swarm = new SwarmState(configsObject);
       //
       // await spawnSwarm(swarm, {consensusAlgorithm: 'pbft', partialSpawn: 3});
       //
         this.client = await initializeClient({swarm: this.swarm, setupDB: true, log: false});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
// SAB - commented to leave config file to run manually        teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
    });

    context('new peer joining swarm', function () {

        it.only('create keys', async function () {
            const NUM_OF_KEYS = 10;

            const createKey = idx => this.client.create(`batch${idx}`, 'value');

            await Promise.all(times(createKey, NUM_OF_KEYS));


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
