const {exec, execSync, spawn} = require('child_process');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');
const split = require('split');
const PromiseSome = require('bluebird').some;
const WebSocket = require('ws');

const {readDir} = require('./logs');
const {editFile, getSwarmObj} = require('./configs');


let leaderLogName;

const setupUtils = {
    startSwarm: async function ({maintainState} = {}) {

        if (!maintainState) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            setupUtils.clearDaemonState();
        }

        let beforeContents = readDir('output/logs');

        setupUtils.execDaemon('bluzelle0');

        // Waiting briefly before starting second Daemon ensures the first starts as leader
        setTimeout(() =>
            setupUtils.execDaemon('bluzelle1'), 500);

        let afterContents;

        try {
            await waitUntil(() => {
                afterContents = readDir('output/logs');

                if (afterContents.length === beforeContents.length + 2) {
                    return afterContents
                }
            })
        } catch (error) {
            process.env.quiet ||
                console.log('\x1b[36m%s\x1b[0m', 'Failed to find new logs')
        }

        let logNames = difference(beforeContents, afterContents);

        leaderLogName = logNames[0];

        process.env.quiet ||
            console.log('\x1b[36m%s\x1b[0m', `******** leaderLogName: ${leaderLogName} *******`);

        try {
            await waitUntil(() => {

                let contents = fs.readFileSync('./daemon-build/output/logs/' + leaderLogName, 'utf8');

                return includes(contents, 'RAFT State: Leader');
            }, 8000);
            process.env.quiet ||
                console.log('\x1b[36m%s\x1b[0m', 'I am leader logged')
        } catch (error) {
            process.env.quiet ||
                console.log('\x1b[36m%s\x1b[0m', 'Failed to read leader log');
        }

        logNames.forEach(logName => swarm.logs.push(logName));
    },

    killSwarm: async () => {
        exec('pkill -2 swarm');

        await new Promise(resolve => {
            setTimeout(() => {
                resolve()
            }, 200)
        })
    },

    createState: async (api, key, value) => {
        await setupUtils.startSwarm();
        await api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        await api.create(key, value);
        await setupUtils.killSwarm();
    },

    createKeys: async (api, numOfKeys, ms) => {

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        const batched = chunk([...Array(parseInt(numOfKeys)).keys()]);

        let batchedWithDelay = batched.reduce((acc, cur) => {
            acc.push(cur);
            acc.push(delay);
            return acc
        }, []);

        await processAssortedArray(batchedWithDelay, api, ms);
    },

    spawnSwarm: async ({consensusAlgo, partialSpawn, maintainState, failureAllowed = 0.2} = {}) => {

        if (!maintainState) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            setupUtils.clearDaemonState();
        }

        let swarm = getSwarmObj();

        let filteredSwarm = Object.keys(swarm).filter(key => key.includes('daemon'))
            .reduce((obj, key) => {
                obj[key] = swarm[key];
                return obj
            }, {});

        const nodesToSpawn = partialSpawn ? Object.keys(filteredSwarm).slice(0, partialSpawn) : Object.keys(filteredSwarm);

        const MINIMUM_NODES = Math.floor(Object.keys(filteredSwarm).length * ( 1 - failureAllowed));

        let guaranteedNodes;

        try {
            console.log(`Spawning ${nodesToSpawn.length} nodes.`);

            guaranteedNodes = await PromiseSome(nodesToSpawn.map((daemon) => new Promise((res, rej) => {

                const rejTimer = setTimeout(() => {
                    rej(new Error(`${daemon} stdout: \n ${buffer}`))
                }, 20000);

                let buffer = '';

                swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`], {cwd: './scripts'});

                swarm[daemon].stream.stdout.on('data', (data) => {
                    buffer += data.toString();

                    if (data.toString().includes('Running node with ID:')) {
                        clearInterval(rejTimer);
                        res(daemon)
                    }
                })

            })), MINIMUM_NODES);

            swarm.guaranteedNodes = guaranteedNodes;

        } catch(err) {

            err.forEach((e) => {
                console.log(`Daemon failed to startup in time. \n ${e}`)
            })
        }


        if (consensusAlgo === 'raft') {
            await setupUtils.getCurrentLeader(swarm, guaranteedNodes)
        }

        if (consensusAlgo === 'pbft') {
            await new Promise((res) => {

            swarm.daemon0.stream.stdout
                .pipe(split())
                .on('data', function (line) {
                    // daemon implementation starts with daemon1 as primary
                    // `sorted_uuids_list[view_number % number_of_nodes]`
                    if (line.toString().includes(`primary: "${swarm.daemon1.uuid}"`)) {
                        res(swarm.daemon1.uuid)
                    }
                });
            })
        }
    },

    getCurrentLeader: (swarm, reliableNodes = swarm.guaranteedNodes) => new Promise((res) => {

        try {
            socket = new WebSocket(`ws://127.0.0.1:${swarm[reliableNodes[0]].port}`);
        } catch (err) {
            console.log(`Failed to connect to leader. \n ${err.stack}`)
        }

        socket.on('open', () => {
            // timeout required until KEP-684 bug resolved
            setTimeout(() => socket.send(JSON.stringify({"bzn-api" : "raft", "cmd" : "get_peers"})), 1500)
        });

        socket.on('message', (message) => {

            let msg = JSON.parse(message);

            if (msg.error) {
                swarm.leader = msg.message.leader.name
            } else {
                swarm.leader = swarm.guaranteedNodes[0];
            }
            res(swarm.leader)
        })
    }),

    despawnSwarm: () => {
        execSync('pkill -2 swarm');
    },

    deleteConfigs: () => {
        execSync('cd ./daemon-build/output/; rm *.json', (error, stdout, stderr) => {
            if (error) {
                throw new Error(error);
            }
        });
    },

    clearDaemonState: () => {
        execSync('cd ./daemon-build/output/; rm -rf .state', (error, stdout, stderr) => {
            if (error) {
                throw new Error(error);
            }
        });
    },

    execDaemon: (cfgName) => {
        exec(`cd ./scripts; ./run-daemon.sh ${cfgName}.json`, {maxBuffer: 1024 * 1024 * 10}, (error, stdout, stderr) => {
            // code 130 is thrown when process is ended with SIGINT
            if (error && error.code !== 130) {
                throw new Error(error);
            }
        });
    }
};

const difference = (arr1, arr2) => {
    return arr1
        .filter(item => !arr2.includes(item))
        .concat(arr2.filter(item => !arr1.includes(item)));
};

const chunk = (array, batchSize = 5) => {
    const chunked = [];

    for (let i = 0; i < array.length; i += batchSize) {
        chunked.push(array.slice(i, i + batchSize))
    }

    return chunked;
};

const processAssortedArray = async (array, api, delay) => {
    for (ele of array) {
        if (typeof(ele) === 'function') {
            await ele(delay)
        } else {
            await Promise.all(ele.map((v) => api.create('batch-key' + v, 'value')))
        }
    }
};

module.exports = setupUtils;
