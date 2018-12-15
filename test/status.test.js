const common = require('./common');

let clientsObj = {};
let swarm;
let numOfNodes = 3;

describe('status', () => {

    beforeEach('stand up swarm and client', async function () {
        swarm = await common.startSwarm({numOfNodes});
        clientsObj.api = await common.initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        common.teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    it.skip('should be responsive', async () => {
        // const res = await clientsObj.api.status;
        // expect(res).to.have.property();
    });
});
