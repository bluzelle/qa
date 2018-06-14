const expect = require('chai').expect;

const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {fileExists} = require('../utils/daemon/logs');

describe('daemon', () => {

    describe('on startup', () => {

        beforeEach(startSwarm);

        afterEach(killSwarm);

        it('should create a log', () => {
            expect(fileExists()).to.have.string('.log')
        });
    });
});

