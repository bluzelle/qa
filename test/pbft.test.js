const {execSync} = require('child_process');

const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const common = require('./common');
const assert = require('assert');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;

const killNodes = (num, swarmObj) => {

    const backUpNodes = swarmObj.backups;
    const deathRow = backUpNodes.slice(backUpNodes.length - num);

    deathRow.forEach(daemon => {
        execSync(`kill $(ps aux | grep 'bluzelle${swarmObj[daemon].index}' | awk '{print $2}')`);
    });
};


describe('pbft', () => {

    beforeEach('generate configs and set harness state', async function () {
        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'})
    });

    beforeEach('initialize client, create db', async () => {

        clientsObj.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        });

        try {
            await clientsObj.api.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

    context('start up', () => {

        it('primary is set', () => {
            assert(swarm.primary !== undefined);
        });
    });

    context.skip('with >2/3 nodes alive', () => {

        beforeEach('kill < 1/3 of nodes', () => {

            console.log(execSync('ps aux | grep swarm').toString());

            const numOfNodesToKill = Math.floor(swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, swarm);

        });

        it('swarm should be operational', () => {
            common.crudFunctionalityTests(clientsObj)
        });
    });

    context.skip('with <2/3 nodes alive', () => {

        beforeEach('kill > 1/3 of nodes', () => {
            const numOfNodesToKill = Math.ceil(swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, swarm)
        });

        it('swarm should NOT be operational', () => {
            common.createShouldTimeout(clientsObj)
        });
    });
});
