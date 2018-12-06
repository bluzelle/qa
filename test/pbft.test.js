const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const shared = require('./shared');
const assert = require('assert');


let clientsObj = {};
let swarm;

const killNodes = num => {
    // kills nodes starting from end of swarmObj list

    const backUpNodes = swarm.followers();
    const deathRow = backUpNodes.slice(backUpNodes.length - num);

    deathRow.forEach(daemon => {
        execSync(`kill $(ps aux | grep 'bluzelle${swarmObj[daemon].index}' | awk '{print $2}')`);
    });
};


describe('pbft', () => {

    beforeEach('generate configs and set harness state', async function () {
        let [configsObject] = await generateSwarmJsonsAndSetState(3);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'})
    });

    beforeEach('initialize clients', () => {

        clientsObj.api1 = new BluzelleClient(
            `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            false
        );
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

    context('start up', () => {

        it.only('primary is set', () => {
            assert(swarm.primary !== undefined);
        });
    });

    context('with >2/3 nodes alive', () => {

        beforeEach('kill < 1/3 of nodes', () => {
            const numOfNodesToKill = Math.floor(swarm.liveNodes().length * 1/3);
            killNodes(numOfNodesToKill)
        });

        it('swarm should be operational', () => {
            shared.swarmIsOperational(clientsObj)
        });
    });

    context('with <2/3 nodes alive', () => {

        beforeEach('kill > 1/3 of nodes', () => {
            const numOfNodesToKill = Math.ceil(swarm.liveNodes().length * 1/3);
            killNodes(numOfNodesToKill)
        });

        it('swarm should NOT be operational', () => {
            shared.createShouldTimeout(clientsObj)
        });
    });

    context('crud', () => {
        shared.swarmIsOperational(clientsObj);
    });
});
