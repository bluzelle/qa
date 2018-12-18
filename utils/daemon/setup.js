const {exec, execSync, spawn} = require('child_process');
const split = require('split');
const PromiseSome = require('bluebird').some;
const WebSocket = require('ws');


// const setupUtils = {

const spawnSwarm = async (swarm, {consensusAlgorithm, partialSpawn, maintainState, failureAllowed = 0.2}) => {
    /*
     * Spawn a swarm of nodes
     * @param {swarm} Swarm class object documenting Daemon config information and node states
     * @param {consensusAlgorithm} 'raft' or 'pbft' Configures spawnSwarm to expect Raft leader election or PBFT primary expectation
     * @param {partialSpawn} Optional. Integer. Spawn a subset of nodes in list passed in Swarm class object instead of full set
     * @param {maintainState} Optional. Boolean. Persist Daemon state rather than purge state and start a fresh swarm
     * @param {failureAllowed} Optional. Default 0.2. The % of nodes allowed to fail to start up erroring out
     * */

    if (!maintainState) {
        // Daemon state is persisted in .state directory, wipe it to ensure clean slate
        clearDaemonState();
    }

    const nodesToSpawn = partialSpawn ? swarm.nodes.slice(0, partialSpawn) : swarm.nodes;

    const MINIMUM_NODES = Math.floor(nodesToSpawn.length * (1 - failureAllowed));

    try {
        await PromiseSome(nodesToSpawn.map((daemon) => new Promise((res, rej) => {

            const rejTimer = setTimeout(() => {
                rej(new Error(`${daemon} stdout: \n ${buffer}`))
            }, 20000);

            let buffer = '';

            swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`, `daemon${swarm[daemon].index}`], {cwd: './scripts'});

            swarm[daemon].stream.stdout.on('data', (data) => {
                buffer += data.toString();

                if (data.toString().includes('Running node with ID:')) {
                    clearInterval(rejTimer);
                    swarm.pushLiveNodes(daemon);
                    res();
                }
            });

            swarm[daemon].stream.on('close', code => {
                swarm.deadNode(daemon)
            });

        })), MINIMUM_NODES);

    } catch (err) {

        if (err instanceof Array) {
            err.forEach((e) => {
                console.log(`Daemon failed to startup in time. \n ${e}`)
            });
        } else {
            throw new Error(`Minimum swarm failed to start \n ${err}`)
        }
    }

    if (consensusAlgorithm === 'pbft') {

        swarm.primary = await new Promise((res) => {

            swarm.daemon0.stream.stdout
                .pipe(split())
                .on('data', function (line) {

                    // pbft implemntation lexicographically sorts uuids and uses position [1] as first primary
                    // `sorted_uuids_list[view_number % number_of_nodes]`

                    const sortedUuids = swarm.sortedUuidsMap.entries();
                    sortedUuids.next();
                    const [expectedPrimaryUuid, expectedPrimaryName] = sortedUuids.next().value;

                    if (line.toString().includes(`observed primary of view 1 to be '${expectedPrimaryUuid}'`)) {
                        res(expectedPrimaryName)
                    }
                });
        })
    }
};

const createKeys = async (clientsObj, numOfKeys = 10) => {

    const arrayOfKeys = [...Array(numOfKeys).keys()];

    await Promise.all(arrayOfKeys.map(v => clientsObj.api.create('batch' + v, 'value')));
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

const spawnDaemon = (index, {debug} = {}) => new Promise((resolve, reject) => {
    let daemon;

    daemon = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${index}.json`, `daemon${index}`], {cwd: './scripts'});

    daemon.stdout.on('data', (data) => {
        if (debug) {
            console.log(data.toString());
        }
        if (data.toString().includes('Running node with ID:')) {
            resolve(daemon)
        }
    });

    daemon.on('error', (err) => {
        reject(new Error('Failed to spawn Daemon.'));
    });
});
// };

module.exports = {
    spawnSwarm,
    despawnSwarm,
    spawnDaemon,
    clearDaemonStateAndConfigs,
    clearDaemonState,
    createKeys
};

// module.exports = setupUtils;

// exports.startSwarm = async ({numOfNodes}) => {
//
//     let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
//     const swarm = new SwarmState(configsObject);
//
//     await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'});
//
//     return swarm;
// };
//
// exports.initializeClient = async ({uuid = '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem = 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg==', swarm, setupDB} = {}) => {
//
//     const api = bluzelle({
//         entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
//         uuid: uuid,
//         private_pem: pem
//     });
//
//     if (setupDB) {
//         try {
//             await api.createDB();
//         } catch (err) {
//             console.log('Failed to createDB()')
//         }
//     }
//
//     return api;
// };
//
// exports.teardown = function (logFailures) {
//
//     if (logFailures && this.state === 'failed') {
//         exportDaemonAndHarnessState.call(this);
//     };
//
//     despawnSwarm();
//
//     clearDaemonStateAndConfigs();
// };
//
// function exportDaemonAndHarnessState() {
//     const {ctx, parent, ...culledState} = this;
//     const testTitle = replaceSpacesWithDashes(culledState);
//     const pathToDump = `./daemon-build/output/failure_dumps/${testTitle}`;
//
//     execSync(`mkdir -p ${pathToDump}`);
//     execSync(`cp -a ./daemon-build/output/daemon[0-9] ${pathToDump}`);
//
//     writeFileSync(`${pathToDump}/mocha-error.json`, JSON.stringify(culledState));
//     console.log(`Test failed, dumping logs and state to ${pathToDump}`);
// }
//
// const replaceSpacesWithDashes = (culledState) => {
//     const testTitle = culledState.title.replace(/\s+/g, '-');
//     return testTitle;
// };


