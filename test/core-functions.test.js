const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');
const shared = require('./common');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('core functionality', () => {

    beforeEach('generate configs and set harness state', async function () {
        let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
        swarm = new SwarmState(configsObject);
    });

    beforeEach('spawn swarm', async function () {
        this.timeout(20000);
        await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'})
    });

    beforeEach('initialize client', async () => {

        clientsObj.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
            uuid: '4982e0b0-0b2f-4c3a-b39f-26878e2ac814',
            private_pem: 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='
        });

        await clientsObj.api.createDB();
    });

    afterEach('remove configs and peerslist and clear harness state', () => {
        clearDaemonStateAndConfigs();
    });

    afterEach(despawnSwarm);

    shared.crudFunctionalityTests(clientsObj);

    shared.miscFunctionalityTests(clientsObj);

});
