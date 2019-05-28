const {swarmManager} = require('./swarmManager');
const {invoke} = require('lodash/fp');


require('../tests/test.configurations');

describe('swarmManager', function () {

    const numberOfDaemons = 3;

    beforeEach('generateSwarms', async function () {
        this.timeout(10000);

        this.swarmManager = await swarmManager();
        this.swarm0 = await this.swarmManager.generateSwarm({numberOfDaemons});
        this.swarm1 = await this.swarmManager.generateSwarm({numberOfDaemons});
    });

    afterEach('stop swarm', async function () {
        await this.swarmManager.stopAll();
        this.swarmManager.removeSwarmState();
    });

    it('should be able to start all nodes', async function () {
        requestIsRunningStatusFromAllNodes.call(this)
            .should.all.be.eq(false);

        await this.swarmManager.startAll();

        requestIsRunningStatusFromAllNodes.call(this)
            .should.all.be.eq(true);
    });

    it('should be able to stop all nodes', async function () {
        await this.swarmManager.startAll();

        requestIsRunningStatusFromAllNodes.call(this)
            .should.all.be.eq(true);

        await this.swarmManager.stopAll();

        requestIsRunningStatusFromAllNodes.call(this)
            .should.all.be.eq(false);
    });

    it('swarms should have the same api', function () {
        JSON.stringify(this.swarm0).should.deep.equal(JSON.stringify(this.swarm1));
    });

    it('swarms should have different peers lists', function () {
        this.swarm0.getPeersList().should.not.deep.equal(this.swarm1.getPeersList());
    });
});

function flattenArray(acc, curr) { return acc = [...acc, ...curr] };

function requestIsRunningStatusFromAllNodes () {
    return this.swarmManager.getSwarms().map(invoke('getDaemons')).reduce(flattenArray, []).map(invoke('isRunning'))
};
