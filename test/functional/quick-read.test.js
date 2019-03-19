const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');

let numOfNodes = harnessConfigs.numOfNodes;



(process.env.TEST_REMOTE_SWARM ? describe.only : describe)('quick read', function () {

    (process.env.TEST_REMOTE_SWARM ? remoteSwarmHook() : localSwarmHooks());

    before('create a key', async function () {
        await this.api.create('hello', 'world');
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

function localSwarmHooks() {
    before('stand up swarm and client', async function () {
        this.timeout(30000);
        [this.swarm] = await startSwarm({numOfNodes});
        this.api = await initializeClient({swarm: this.swarm, setupDB: true});
    });

    after('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });
};

function remoteSwarmHook() {
    before('initialize client and setup db', async function () {
        this.api = bluzelle({
            entry: `ws://${harnessConfigs.address}:${harnessConfigs.port}`,
            uuid: harnessConfigs.clientUuid,
            private_pem: harnessConfigs.clientPem,
            log: false
        });

        if (await this.api.hasDB()) {
            await this.api.deleteDB();
        }

        await this.api.createDB();
    });
};
