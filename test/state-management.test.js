const assert = require('assert');
const {spawnDaemon, initializeClient, spawnSwarm, teardown, createKeys} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe.only('state management', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);

        let [configsObject] = await generateSwarmJsonsAndSetState(3);
        swarm = new SwarmState(configsObject);

        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft', partialSpawn: 2});

        clientsObj.api = await initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS, true);
    });

    context('new peer joining swarm', function () {

        beforeEach('load database with keys', async () => {
            this.timeout(20000);

            await createKeys(clientsObj, 96);
        });


        // it('should not be able commit local if not synced', async function () {
        //     this.timeout(20000);
        //
        //     await new Promise(async (res, rej) => {
        //
        //         let newDaemonName = swarm.lastNode[1];
        //         console.log(newDaemonName)
        //         let newDaemonIdx = newDaemonName[newDaemonName.length - 1];
        //         await spawnDaemon(swarm, newDaemonIdx);
        //
        //         swarm['daemon0'].stream.stdout.on('data', (data) => {
        //             if (data.toString().includes('committed-local')) {
        //                 console.log(data.toString())
        //                 rej();
        //             }
        //         });
        //
        //         setTimeout(res, 15000);
        //
        //     });
        // });

        it('should sync at checkpoint', async function () {
            this.timeout(20000);

            await new Promise(async res => {

                let newDaemonName = swarm.lastNode[1];
                console.log(newDaemonName)
                let newDaemonIdx = newDaemonName[newDaemonName.length - 1];
                await spawnDaemon(swarm, newDaemonIdx);

                swarm['daemon0'].stream.stdout.on('data', (data) => {
                    if (data.toString().includes('committed-local')) {
                        console.log(data.toString())
                        res();
                    }
                });

                await clientsObj.api.create('one', 'value');
            });
        });

    });
});
