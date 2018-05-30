const expect = require('chai').expect;
const {startSwarm, killSwarm} = require('../utils/swarmSetup');
const {logFileExists} = require('../utils/daemonLogHandlers');

describe.only('daemon', () => {

    describe('on startup', () => {

        beforeEach(startSwarm);

        afterEach(killSwarm);

        it('should create a log', () => {
            expect(logFileExists()).to.have.string('.log')
        });
    });

});
