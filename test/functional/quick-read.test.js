const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');

let numOfNodes = harnessConfigs.numOfNodes;


describe('quick read', function () {

    beforeEach('stand up swarm and client', async function () {
        this.timeout(30000);
        [this.swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({swarm: this.swarm, setupDB: true});

        await this.api.create('hello', 'world');
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });


    it('should be functional', async function () {
        expect(await this.api.quickread('hello')).to.equal('world');
    });

    it('should be faster than normal read', async function () {

        const quickReadStartTime = new Date();
        await this.api.quickread('hello');
        const quickReadEndTime = new Date();
        const quickReadDuration = quickReadEndTime - quickReadStartTime;


        const normalReadStartTime = new Date();
        await this.api.read('hello');
        const normalReadEndTime = new Date();
        const normalReadDuration = normalReadEndTime - normalReadStartTime;

        expect(quickReadDuration).to.be.lessThan(normalReadDuration);
    });
});
