const expect = require('chai').expect;
const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {logFileExists} = require('../utils/daemon/logs');

describe('daemon', () => {

    describe('on startup', () => {

        beforeEach(startSwarm);

        afterEach(killSwarm);

        it('should create a log', () => {
            expect(logFileExists()).to.have.string('.log')
        });
    });

});
