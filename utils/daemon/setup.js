const {exec, execSync, spawn} = require('child_process');
const split = require('split');
const PromiseSome = require('bluebird').some;
const PromiseMap = require('bluebird').map;

const {writeFileSync} = require('fs');

const {bluzelle} = require('../../bluzelle-js/lib/bluzelle-node');
const {generateSwarmJsonsAndSetState} = require('./configs');
const SwarmState = require('./swarm');
const {memoize, curry, first} = require('lodash/fp');

exports.startSwarm = async ({numOfNodes}) => {
    const swarm = new SwarmState(await generateSwarmJsonsAndSetState(numOfNodes).then(first));
    await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'});
    return swarm;
};

exports.initializeClient = async ({log, swarm, setupDB, uuid = '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem = 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg=='} = {}) => {

    const api = bluzelle({
        entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
        uuid: uuid,
        private_pem: pem,
        log: log
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

exports.teardown = function (logFailures, maintainState) {
    logFailures && this.state === 'failed' && exportDaemonAndHarnessState(this);
    despawnSwarm();
    maintainState || clearDaemonStateAndConfigs();
};

/*
 * Spawn a swarm of nodes
 * @param {swarm} Swarm class object documenting Daemon config information and node states
 * @param {consensusAlgorithm} 'raft' or 'pbft' Configures spawnSwarm to expect Raft leader election or PBFT primary expectation
 * @param {partialSpawn} Optional. Integer. Spawn a subset of nodes in list passed in Swarm class object instead of full set
 * @param {maintainState} Optional. Boolean. Persist Daemon state rather than purge state and start a fresh swarm
 * @param {failureAllowed} Optional. Default 0.2. The % of nodes allowed to fail to start up erroring out
*/

const withTimeout = (timeout, error, fn) => new Promise((resolve, reject) => {
    setTimeout(() => reject(error), timeout);
    fn().then(resolve);
});


const spawnDaemon = curry((swarm, daemon, idx) => {
    const buffer = Buffer.alloc(0);
    withTimeout(
        15000,
        new Error(`${daemon} stdout: \n ${buffer.join('')}`),
        () => new Promise((resolve, reject) => {
            const stream = swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`, `daemon${swarm[daemon].index}`], {cwd: './scripts'});

            stream.stdout.on('data', (data) => {
                Buffer.concat([buffer, data]);

                if (data.toString().includes('Running node with ID:')) {
                    swarm.pushLiveNodes(daemon);
                    resolve();
                }
            });


            stream.on('close', code => {
                console.log('daemon died', code);
                swarm.declareDeadNode(daemon)
            });
        })
    )
});


const spawnSwarm = exports.spawnSwarm = async (swarm, {consensusAlgorithm, partialSpawn, maintainState, failureAllowed = 0.2}) => {

    // Daemon state is persisted in .state directory, wipe it to ensure clean slate
    maintainState || clearDaemonState();

    const nodeNames = memoize(() => swarm.nodes.map(pubKeyAndNamePair => pubKeyAndNamePair[1]));

    const nodesToSpawn = memoize(() => partialSpawn ? nodeNames().slice(0, partialSpawn) : nodeNames());

    const minimumNodes = () => Math.floor(nodesToSpawn().length * (1 - failureAllowed));


    try {
        await PromiseSome(nodesToSpawn().map(spawnDaemon(swarm)), minimumNodes());
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

exports.createKeys = async (clientsObj, numOfKeys = 10) => {

    const arrayOfKeys = [...Array(numOfKeys).keys()];

    // await Promise.all(arrayOfKeys.map(v => clientsObj.api.create('batch' + v, 'value')));

    await PromiseMap(arrayOfKeys, v => clientsObj.api.create('batch' + v, 'value'), {concurrency: 10});
};

const despawnSwarm = exports.despawnSwarm = () => {
    try {
        execSync('pkill -9 swarm');
    } catch (err) {
        // do nothing, cmd throws error if no swarm to kill
    }
};

const clearDaemonStateAndConfigs = exports.clearDaemonStateAndConfigs = () => {
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

const clearDaemonState = exports.clearDaemonState = () => {
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


function exportDaemonAndHarnessState({ctx, parent, ...culledState}) {
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


