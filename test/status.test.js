const common = require('./common');
const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');

let clientsObj = {};
let swarm;
let numOfNodes = 3;

describe('status', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        swarm = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    it.skip('should be responsive', async () => {
        // const res = await clientsObj.api.status;
        // expect(res).to.have.property();
    });
});
