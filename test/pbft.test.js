const {spawnSwarm, despawnSwarm, swarm, createKeys} = require('../utils/daemon/setup');
const {editFile} = require('../utils/daemon/configs');
const api = require('../bluzelle-js/lib/bluzelle.node');
const shared = require('./shared');


describe.only('pbft', () => {

    before('initialize client api', () =>
        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

    beforeEach('use pbft', () => {
        [...Array(3).keys()].forEach(v => {
            editFile({
                filename: `bluzelle${v}.json`,
                changes: {
                    use_pbft: true
                }
            })
        });
    });

    beforeEach('spawn PBFT swarm', (done) => {
        spawnSwarm(done, 'pbft')
    });

    afterEach('despawn swarm', despawnSwarm);

    context('start up', () => {

        it('primary is set', (done) => {
            done()
        });
    });

    context.skip('crud', () => {
        shared.swarmIsOperational();
    });

});
