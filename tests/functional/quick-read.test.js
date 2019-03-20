const {remoteSwarmHook, localSwarmHooks} = require('../shared/hooks');


(harnessConfigs.testRemoteSwarm ? describe.only : describe)('quick read', function () {

    (harnessConfigs.testRemoteSwarm ? remoteSwarmHook() : localSwarmHooks());

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
