const {swarmManager} = require('./swarmManager');
const {random, last} = require('lodash/fp');

require('../tests/test.configurations');

describe('daemonManager', function () {

    const numberOfDaemons = 3;

    beforeEach('generateSwarm', async function () {
        this.swarmManager = await swarmManager();
        this.swarm = await this.swarmManager.generateSwarm({numberOfDaemons});
    });

    afterEach('stop swarm', async function () {
        await this.swarm.stop();
        this.swarmManager.removeSwarmState();
    });

    it('swarm should have correct number of daemons', function () {
        this.swarm.getDaemons().should.have.lengthOf(numberOfDaemons)
    });

    it('should be able to query daemon running status', function () {
        this.swarm.getDaemons().map(daemon => daemon.isRunning()).should.all.be.equal(false)
    });

    it('should be able to start daemons', async function () {
        await this.swarm.start();

        this.swarm.getDaemons().map(daemon => daemon.isRunning()).should.all.be.equal(true)
    });

    it('should be able to stop all daemons', async function () {
        await this.swarm.start();
        await this.swarm.stop();

        this.swarm.getDaemons().map(daemon => daemon.isRunning()).should.all.be.equal(false);
    });

    it('should be able to start a select number of daemons', async function () {
        await this.swarm.startPartial(2);

        this.swarm.getDaemons().map(daemon => daemon.isRunning()).should.deep.equal([true, true, false]);
    });

    it('should be able to start unstarted daemons', async function () {
        await this.swarm.startPartial(1);
        await this.swarm.startUnstarted();

        this.swarm.getDaemons().map(daemon => daemon.isRunning()).should.all.be.equal(true);
    });

    it('should be able to add daemon to unstarted swarm', async function () {
        await this.swarm.addDaemon();

        this.swarm.getDaemons().should.have.lengthOf(numberOfDaemons + 1);
    });

    it('should be able to add daemon to started swarm', async function () {
        await this.swarm.start();
        await this.swarm.addDaemon();

        this.swarm.getDaemons().should.have.lengthOf(numberOfDaemons + 1);
    });

    it('unstarted new daemon should have correct isRunning status', async function () {
        await this.swarm.start();
        await this.swarm.addDaemon();

        last(this.swarm.getDaemons()).isRunning().should.equal(false);
    });

    it('starting new daemon should change isRunning status', async function () {
        await this.swarm.start();
        await this.swarm.addDaemon();
        await this.swarm.startUnstarted();

        last(this.swarm.getDaemons()).isRunning().should.equal(true);
    });

    it('should be able to stop daemons selectively', async function () {
        await this.swarm.start();
        const randomDaemon = random(numberOfDaemons - 1, 0);
        await this.swarm.getDaemons()[randomDaemon].stop();

        this.swarm.getDaemons()[randomDaemon].isRunning().should.equal(false);
    });

    it('should be able to restart daemons selectively', async function () {
        await this.swarm.start();
        const randomDaemon = random(numberOfDaemons - 1, 0);
        await this.swarm.getDaemons()[randomDaemon].restart()
    });

    it('should be able to read daemon streams', async function () {
        await this.swarm.start();

        this.swarm.getDaemons().forEach(daemon => {
            daemon.getProcess().stdout.on('data', (buf) => {
                const out = buf.toString();
                out.should.have.lengthOf.greaterThan(0);
            });
        });
    });

    it('should be able to setPrimary() and getPrimary()', async function () {
        await this.swarm.start();
        const publicKey = this.swarm.getDaemons()[0].publicKey;
        this.swarm.setPrimary(publicKey);

        this.swarm.getPrimary().publicKey.should.equal(publicKey);
    });
});

