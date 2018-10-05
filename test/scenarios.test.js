const {spawn, execSync} = require('child_process');

const {startSwarm, killSwarm, createKeys} = require('../utils/daemon/setup');
const shared = require('./shared');
const api = require('../bluzelle-js/lib/bluzelle.node');


describe('scenarios', () => {

    // KEP-489
    context('recover from restart', () => {

        beforeEach('start swarm', async () => {
            await startSwarm();

            await spawnNode('bluzelle2');
        });

        beforeEach('initialize client api', async () =>
            await api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

        beforeEach('populate db', done =>
            createKeys(done, api, process.env.numOfKeys));

        beforeEach('restarting 3rd node', async () => {

            execSync(`kill $(ps aux | grep '[b]luzelle2'| awk '{print $2}')`);

            await spawnNode('bluzelle2');

        });

        beforeEach('delete 3rd node state file, kill 3rd node', () => {

            execSync('rm ./daemon-build/output/.state/3726ec5f-72b4-4ce6-9e60-f5c47f619a41.dat');

            execSync(`kill $(ps aux | grep '[b]luzelle2'| awk '{print $2}')`);
        });

        beforeEach('start 3rd node', async () =>
            await spawnNode('bluzelle2'));

        afterEach('kill swarm', killSwarm);

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
