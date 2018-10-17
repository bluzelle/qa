const {spawn, execSync} = require('child_process');

const shared = require('./shared');
const api = require('../bluzelle-js/lib/bluzelle.node');


const {startSwarm, killSwarm, spawnSwarm, despawnSwarm, deleteConfigs, clearDaemonState, createKeys, getCurrentLeader} = require('../utils/daemon/setup');
const {editFile, generateSwarmConfigsAndSetState, resetHarnessState, getSwarmObj, getNewestNodes} = require('../utils/daemon/configs');

let swarm;

describe.skip('scenarios', () => {

    // KEP-489
    context('recover from restart', () => {

        beforeEach('generate configs and set harness state', async () => {
            await generateSwarmConfigsAndSetState(3);
            swarm = getSwarmObj();
        });

        beforeEach('spawn swarm', async function () {
            this.timeout(20000);
            await spawnSwarm({consensusAlgo: 'raft'})
        });

        beforeEach('initialize client api', async () =>
            await api.connect(`ws://${process.env.address}:${swarm[swarm.leader].port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));


        beforeEach('populate db', async function() {
            this.timeout(20000);

            await createKeys(api, 5, 500);

            console.log(await api.keys());
            console.log((await api.keys()).length);

        });

        // beforeEach('restart 3rd node', async () => {
        //
        // });

        // beforeEach('populate db', done =>
        //     createKeys(done, api, process.env.numOfKeys));
        //
        beforeEach('restarting 3rd node', async () => {

            execSync('ps aux | grep swarm', (err, stdout, stderr) => {
                console.log(err.toString())
                console.log(stdout.toString())
                console.log(stderr.toString())
            })

            // await new Promise((resolve) => {
                execSync(`pkill -9 $(ps aux | grep '[b]luzelle2'| awk '{print $2}')`);
                // setTimeout(resolve, 1000)
            // });

            await spawnNode('bluzelle2');

        });

        beforeEach('delete 3rd node state file, kill 3rd node', async () => {

            execSync(`kill $(ps aux | grep '[b]luzelle2'| awk '{print $2}')`);

            execSync(`rm ./daemon-build/output/.state/${swarm.daemon2.uuid}.dat`);

            await new Promise((resolve) => {
                execSync(`pkill -9 $(ps aux | grep '[b]luzelle2'| awk '{print $2}')`);
                setTimeout(resolve, 1000)
            });
        });

        beforeEach('start 3rd node', async () =>
            await spawnNode('bluzelle2'));

        afterEach('remove configs and peerslist and clear harness state', () => {
            deleteConfigs();
            resetHarnessState();
        });

        afterEach('disconnect api', api.disconnect);

        afterEach('despawn swarm', despawnSwarm);

        shared.swarmIsOperational(api);
    });
});

const spawnNode = cfgName =>
    new Promise(resolve => {
        let node = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `${cfgName}.json`], {cwd: './scripts'});

        node.stdout.on('data', data => {

            if (data.toString().includes('Running node with ID')) {
                resolve()
            }
        });
    });
