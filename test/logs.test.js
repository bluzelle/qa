const expect = require('chai');
const {beforeStartSwarm, afterKillSwarm} = require('../utils/swarmSetup');
const {readFile} = require('../utils/daemonLogHandlers');

let logFileName;

describe.only('daemon', () => {


    describe('on startup', () => {

        beforeStartSwarm();
        afterKillSwarm();

        it('should create a log', () =>
            expect(readFile('/output/logs/', logFileName)).to.have.string('Loading: bluzelle.json')
        );
    });

    describe('on shutdown', () => {

        beforeStartSwarm();
        afterKillSwarm();

       it('should log "shutting down"', () =>
           expect(readFile('/output/logs/', logFileName)).to.have.string('signal received -- shutting down')
       );
    });

});
