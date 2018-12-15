const {execSync} = require('child_process');
const assert = require('assert');

const common = require('./common');


let clientsObj = {};
let swarm;
let numOfNodes = harnessConfigs.numOfNodes;

const killNodes = (num, swarmObj) => {

    const backUpNodes = swarmObj.backups;
    const deathRow = backUpNodes.slice(backUpNodes.length - num);

    deathRow.forEach(daemon => {
        execSync(`kill $(ps aux | grep 'bluzelle${swarmObj[daemon].index}' | awk '{print $2}')`);
    });
};


describe('pbft', () => {

    beforeEach('stand up swarm and client', async function () {
        swarm = await common.startSwarm({numOfNodes});
        clientsObj.api = await common.initializeClient({swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        common.teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });


    context('start up', () => {

        it('primary is set', () => {
            assert(swarm.primary !== undefined);
        });

        context('test', () => {
            common.crudFunctionalityTests(clientsObj)
        })
    });

    context.skip('with >2/3 nodes alive', () => {

        beforeEach('kill < 1/3 of nodes', () => {

            console.log(execSync('ps aux | grep swarm').toString());

            const numOfNodesToKill = Math.floor(swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, swarm);

        });

        it('swarm should be operational', () => {
            common.crudFunctionalityTests(clientsObj)
        });
    });

    context.skip('with <2/3 nodes alive', () => {

        beforeEach('kill > 1/3 of nodes', () => {
            const numOfNodesToKill = Math.ceil(swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, swarm)
        });

        it('swarm should NOT be operational', () => {
            common.createShouldTimeout(clientsObj)
        });
    });
});
