const {exec, execSync, spawn} = require('child_process');
const split = require('split');
const PromiseSome = require('bluebird').some;
const {writeFileSync} = require('fs');

const {bluzelle} = require('../../bluzelle-js/lib/bluzelle-node');
const {generateSwarmJsonsAndSetState} = require('./configs');
const SwarmState = require('./swarm');


const startSwarm = async ({numOfNodes}) => {

    let [configsObject, peersList] = await generateSwarmJsonsAndSetState(numOfNodes);
    const swarm = new SwarmState(configsObject);

    await spawnSwarm(swarm);

    return [swarm, peersList];
};

const initializeClient = async ({log, swarm, setupDB, uuid = harnessConfigs.clientUuid, pem = harnessConfigs.clientPem} = {}) => {

    const api = bluzelle({
        entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
        uuid: uuid,
        private_pem: pem,
        log: log,
        p2p_latency_bound: 100
    });

    if (setupDB) {
        try {
            await api.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    }

    return api;
};

const teardown = function (logFailures, maintainState) {

    if (logFailures && this.state === 'failed') {
        exportDaemonAndHarnessState.call(this);
    };

    despawnSwarm();

    if (!maintainState) {
        clearDaemonStateAndConfigs();
    }
};

/*
 * Spawn a swarm of nodes
 * @param {swarm} Swarm class object documenting Daemon config information and node states
 * @param {consensusAlgorithm} 'raft' or 'pbft' Configures spawnSwarm to expect Raft leader election or PBFT primary expectation
 * @param {partialSpawn} Optional. Integer. Spawn a subset of nodes in list passed in Swarm class object instead of full set
 * @param {maintainState} Optional. Boolean. Persist Daemon state rather than purge state and start a fresh swarm
*/
const spawnSwarm = async (swarm, {consensusAlgorithm = 'pbft', partialSpawn, maintainState} = {}) => {


    if (!maintainState) {
        // Daemon state is persisted in .state directory, wipe it to ensure clean slate
        clearDaemonState();
    }

    const nodeNames = swarm.nodes.map(pubKeyAndNamePair => pubKeyAndNamePair[1]);

    const nodesToSpawn = partialSpawn ? nodeNames.slice(0, partialSpawn) : nodeNames;

    // todo: refactor to use spawnDaemon
    //  handle etherscan.io hangs by retrying

    try {
        await Promise.all(nodesToSpawn.map((daemon) => new Promise((res, rej) => {

            const daemonTimeout = setTimeout(() => {
                rej(new Error(`${daemon} stdout: \n ${output}`))
            }, 15000);

            let output = '';

            swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`, `daemon${swarm[daemon].index}`], {cwd: './scripts'});

            swarm[daemon].stream.stdout.on('data', (buffer) => {
                let data = buffer.toString();
                output += data;

                if (data.includes('Running node with ID:')) {
                    clearInterval(daemonTimeout);
                    swarm.pushLiveNodes(daemon);
                    res();
                }
            });

            swarm[daemon].stream.on('close', code => {
                swarm.declareDeadNode(daemon)
            });

        })));

    } catch (err) {

        if (err instanceof Array) {
            err.forEach((e) => {
                console.log(`Daemon failed to startup in time. \n ${e}`)
            });
        } else {
            throw new Error(`Swarm failed to start \n ${err}`)
        }
    }

    if (consensusAlgorithm === 'pbft') {

        swarm.primary = await new Promise((res, rej) => {

            // pbft implemntation lexicographically sorts uuids and uses position [1] as first primary
            // `sorted_uuids_list[view_number % number_of_nodes]`
            const [expectedPrimaryUuid, expectedPrimaryName] = swarm.nodes[1];

            const primaryTimeout = setTimeout(() => {
                rej(new Error(`Failed to observe ${expectedPrimaryName}: ${expectedPrimaryUuid} as primary.`))
            }, 10000);

            swarm[expectedPrimaryName].stream.stdout
                .pipe(split())
                .on('data', function (line) {


                    if (line.toString().includes(`observed primary of view 1 to be '${expectedPrimaryUuid}'`)) {
                        clearInterval(primaryTimeout);
                        res(expectedPrimaryName)
                    }
                });
        })
    }
};

const createKeys = async (clientsObj, numOfKeys = 10, base = 'batch', start = 0) => {
    for (let j = start; j < numOfKeys; j ++) {
        await clientsObj.api.create(`${base}${j}`, 'value')
    }
};

const despawnSwarm = () => {
    try {
        execSync('pkill -9 swarm');
    } catch (err) {
        // do nothing, cmd throws error if no swarm to kill
    }
};

const clearDaemonStateAndConfigs = () => {
    try {
        execSync('cd ./daemon-build/output/; rm -rf ./daemon*/')
    } catch (err) {
        if (err.message.includes('No such file or directory')) {
            // do nothing
        } else {
            throw err
        }
    }
};

const clearDaemonState = () => {
    try {
        execSync('cd ./daemon-build/output/; rm -rf .state');
    } catch (err) {
        if (err.message.includes('No such file or directory')) {
            // do nothing
        } else {
            throw err
        }
    }
};

const spawnDaemon = (swarm, index, {debug} = {}) => new Promise((resolve, reject) => {
    let daemon = 'daemon' + index;

    if (!(typeof(swarm[daemon]) === 'object')) {
        swarm[daemon] = {};
    }

    swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${index}.json`, `daemon${index}`], {cwd: './scripts'});

    swarm[daemon].stream.stdout.on('data', (data) => {

        if (debug) {
            console.log(data.toString());
        }
        if (data.toString().includes('Running node with ID:')) {
            resolve(daemon)
        }
    });

    swarm[daemon].stream.on('error', (err) => {
        reject(new Error('Failed to spawn Daemon.'));
    });
});

function exportDaemonAndHarnessState() {
    const {ctx, parent, ...culledState} = this;
    const testTitle = replaceSpacesWithDashes(culledState);
    const pathToDump = `./daemon-build/output/failure_dumps/${testTitle}`;

    execSync(`mkdir -p ${pathToDump}`);
    execSync(`cp -a ./daemon-build/output/daemon[0-9] ${pathToDump}`);

    writeFileSync(`${pathToDump}/mocha-error.json`, JSON.stringify(culledState));
    console.log(`Test failed, dumping logs and state to ${pathToDump}`);
}

const replaceSpacesWithDashes = (culledState) => {
    const testTitle = culledState.title.replace(/\s+/g, '-');
    return testTitle;
};


module.exports = {
    startSwarm,
    initializeClient,
    teardown,
    spawnSwarm,
    despawnSwarm,
    spawnDaemon,
    clearDaemonStateAndConfigs,
    clearDaemonState,
    createKeys
};
