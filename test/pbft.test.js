const bluzelle = require('../bluzelle-js/src/main');

const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const shared = require('./shared');
const assert = require('assert');

let clientsObj = {};
let swarm;

const killNodes = num => {

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

    beforeEach('initialize client, create db', async () => {

        clientsObj.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        });

        try {
            await api.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        // clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

    context('start up', () => {

        it('primary is set', () => {
            assert(swarm.primary !== undefined);
        });
    });

    context('test create', () => {

        it.only('create', async () => {
            try {
                await api.create('hello', 'world');
            } catch (err) {
                console.log('Failed to create key')
            }

            assert(await bz.has('hello'));
        })
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
