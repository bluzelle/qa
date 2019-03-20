const sharedTests = require('../shared/tests');
const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');

let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;


describe('smoke test', () => {

    before('stand up swarm and client', async function () {
        this.timeout(30000);
        [this.swarm] = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm: this.swarm, setupDB: true});
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    sharedTests.crudFunctionality(clientsObj);

    sharedTests.miscFunctionality(clientsObj);

});
