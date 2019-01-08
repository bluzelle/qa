const common = require('./common');
const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');

let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('core functionality', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        swarm = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    common.crudFunctionalityTests(clientsObj);

    common.miscFunctionalityTests(clientsObj);

});
