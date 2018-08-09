const {expect} = require('chai');

const {startSwarm, killSwarm, swarm} = require('../utils/daemon/setup');

describe('daemon', () => {

    describe('on startup', () => {

        beforeEach(startSwarm);

        afterEach(killSwarm);

        it('should create a log', () => {
            expect(swarm.logs[0]).to.have.string('.log')
        });
    });
});

