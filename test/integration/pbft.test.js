const {execSync} = require('child_process');
const {startSwarm, initializeClient, teardown} = require('../../utils/daemon/setup');
const common = require('../common');


let clientsObj = {};
let numOfNodes = harnessConfigs.numOfNodes;

const killNodes = (num, swarmObj) => {

    const backUpNodes = swarmObj.backups;
    const deathRow = backUpNodes.slice(backUpNodes.length - num);

    deathRow.forEach(daemon => {
        execSync(`kill $(ps aux | grep 'bluzelle${swarmObj[daemon].index}' | awk '{print $2}')`);
    });
};


describe('pbft', function () {

    beforeEach('stand up swarm and client', async function () {
        [this.swarm] = await startSwarm({numOfNodes});
        clientsObj.api = await initializeClient({swarm: this.swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });


    context('start up', function () {

        it('primary is set', function () {
            expect(this.swarm.primary).to.not.be.equal(undefined);
        });

        context('test', function () {
            common.crudFunctionalityTests(clientsObj)
        })
    });

    context.skip('with >2/3 nodes alive', function () {

        beforeEach('kill < 1/3 of nodes', function () {

            console.log(execSync('ps aux | grep swarm').toString());

            const numOfNodesToKill = Math.floor(this.swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, this.swarm);

        });

        it('swarm should be operational', function () {
            common.crudFunctionalityTests(clientsObj)
        });
    });

    context.skip('with <2/3 nodes alive', function () {

        beforeEach('kill > 1/3 of nodes', function () {
            const numOfNodesToKill = Math.ceil(this.swarm.backups.length * 1/3);
            killNodes(numOfNodesToKill, this.swarm)
        });

        it('swarm should NOT be operational', function () {
            common.createShouldTimeout(clientsObj)
        });
    });
});
