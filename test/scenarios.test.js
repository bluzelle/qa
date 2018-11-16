const {spawn, execSync, exec} = require('child_process');

const {spawnSwarm, despawnSwarm, spawnDaemon, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {generateSwarmJsonsAndSetState, resetHarnessState} = require('../utils/daemon/configs');
const shared = require('./shared');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const SwarmState = require('../utils/daemon/swarm');

let swarm;
let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;

describe('scenarios', () => {

    // KEP-489
    context('recover from restart', () => {

        let randomPeer;

        beforeEach('generate configs and set harness state', async () => {
            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            swarm = new SwarmState(configsObject);
        });

        beforeEach('spawn swarm', async function () {
            this.timeout(20000);
            await spawnSwarm(swarm, {consensusAlgorithm: 'raft'});
            randomPeer = swarm.liveNodes[0];
        });

        beforeEach('initialize client', () => {

            clientsObj.api = new BluzelleClient(
                `ws://${harnessConfigs.address}:${swarm[swarm.leader].port}`,
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

        beforeEach('restarting node', async () => {

            execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[randomPeer].index}'| awk '{print $2}')`);

            await spawnDaemon(swarm[randomPeer].index);
        });

        beforeEach('delete node state file, kill node', () => {

            execSync(`kill -9 $(ps aux | grep 'swarm -c [b]luzelle${swarm[randomPeer].index}' | awk '{print $2}')`);

            execSync(`rm ./daemon-build/output/.state/${swarm[randomPeer].uuid}.dat`);
        });

        beforeEach('restart node', async () =>
            await spawnDaemon(swarm[randomPeer].index));

        afterEach('remove configs and peerslist and clear harness state', () => {
            deleteConfigs();
            resetHarnessState();
        });

        afterEach('disconnect api', () => clientsObj.api && clientsObj.api.disconnect());

        afterEach('despawn swarm', despawnSwarm);

        shared.swarmIsOperational(clientsObj);
    });
});
