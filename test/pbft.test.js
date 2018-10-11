const {spawnSwarm, despawnSwarm, createKeys} = require('../utils/daemon/setup');
const {editFile, getSwarmObj} = require('../utils/daemon/configs');
const api = require('../bluzelle-js/lib/bluzelle.node');
const shared = require('./shared');

const {execSync} = require('child_process');


let swarmObj = getSwarmObj();

const killNodes = num => {
    // kills nodes starting from end of swarmObj list

    const daemonList = Object.keys(swarmObj);
    const deathRow = daemonList.slice(daemonList.length - num);

    deathRow.forEach(daemon => {
        execSync(`kill $(ps aux | grep 'bluzelle${swarmObj[daemon].index}' | awk '{print $2}')`);
    });
};

describe('pbft', () => {

    before('initialize client api', () =>
        api.connect(`ws://${process.env.address}:${Object.values(swarmObj)[0].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

    beforeEach('edit configs to use pbft', () => {
        [...Array(4).keys()].forEach(v => {
            editFile({
                filename: `bluzelle${v}.json`,
                changes: {
                    use_pbft: true
                }
            })
        });
    });

    beforeEach('spawn PBFT swarm', async () => {
        await spawnSwarm('pbft')
    });

    afterEach('despawn swarm', despawnSwarm);

    context('start up', () => {

        it('primary is set', () => {
        });
    });

    context('with >2/3 nodes alive', () => {

        beforeEach('kill < 1/3 of nodes', () => {
            const numOfNodesToKill = Math.floor(Object.keys(swarmObj).length * 1/3);
            killNodes(numOfNodesToKill)
        });

        it('swarm should be operational', () => {
            shared.swarmIsOperational(api)
        });
    });

    context('with <2/3 nodes alive', () => {

        beforeEach('kill > 1/3 of nodes', () => {
            const numOfNodesToKill = Math.ceil(Object.keys(swarmObj).length * 1/3);
            killNodes(numOfNodesToKill)
        });

        it('swarm should NOT be operational', () => {
            shared.createShouldTimeout(api)
        });
    });

    context('crud', () => {
        shared.swarmIsOperational(api);
    });
});
