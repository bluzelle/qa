const common = require('./common');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('core functionality', () => {

    beforeEach('stand up swarm and client', async function () {
        swarm = await common.startSwarm({numOfNodes});
        clientsObj.api = await common.initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        common.teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    common.crudFunctionalityTests(clientsObj);

    common.miscFunctionalityTests(clientsObj);

});
