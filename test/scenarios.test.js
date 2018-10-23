const {spawn, execSync, exec} = require('child_process');

const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes} = require('../utils/daemon/configs');
const shared = require('./shared');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');


let swarm;
let clientsObj = {};
let numOfNodes = 6;

describe('scenarios', () => {

    // KEP-489
    context('recover from restart', () => {

        let newestNode;

        beforeEach('generate configs and set harness state', async () => {
            await generateSwarmConfigsAndSetState(numOfNodes);
            swarm = getSwarmObj();
            newestNode = getNewestNodes(1);
        });

        beforeEach('spawn swarm', async function () {
            this.timeout(20000);
            await spawnSwarm({consensusAlgo: 'raft'})
        });

        beforeEach('initialize client', () => {

            clientsObj.api = new BluzelleClient(
                `ws://${process.env.address}::${swarm[swarm.leader].port}`,
                '71e2cd35-b606-41e6-bb08-f20de30df76c',
                false
            );
        });

        beforeEach('connect client', async () => {
            await clientsObj.api.connect()
        });

        beforeEach('populate db', async function() {
            this.timeout(20000);

            await createKeys(clientsObj, 10, 500);
        });

        beforeEach('restarting 3rd node', async () => {

            execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[newestNode].index}'| awk '{print $2}')`);

            await spawnDaemon(swarm[newestNode].index);
        });

        beforeEach('delete 3rd node state file, kill 3rd node', () => {

            execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[newestNode].index}' | awk '{print $2}')`);

            execSync(`rm ./daemon-build/output/.state/${swarm.daemon4.uuid}.dat`);
        });

        beforeEach('start 3rd node', async () =>
            await spawnDaemon(swarm[newestNode].index));

        afterEach('remove configs and peerslist and clear harness state', () => {
            deleteConfigs();
            resetHarnessState();
        });

        afterEach('disconnect api', () => clientsObj.api.disconnect());

        afterEach('despawn swarm', despawnSwarm);

        shared.swarmIsOperational(clientsObj);
    });
});
