const assert = require('assert');
const {startSwarm, initializeClient, teardown} = require('../utils/daemon/setup');

let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;


describe('quick read', () => {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        swarm = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm, setupDB: true});

        await clientsObj.api.create('hello', 'world');
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });


    it('should be functional', async () => {
        assert(await clientsObj.api.quickread('hello') === 'world');
    });

    it('should be faster than normal read', async () => {

        const quickReadStartTime = new Date();
        await clientsObj.api.quickread('hello');
        const quickReadEndTime = new Date();
        const quickReadDuration = quickReadEndTime - quickReadStartTime;


        const normalReadStartTime = new Date();
        await clientsObj.api.read('hello');
        const normalReadEndTime = new Date();
        const normalReadDuration = normalReadEndTime - normalReadStartTime;

        assert(quickReadDuration < normalReadDuration);
    });
});
