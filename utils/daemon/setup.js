const {exec, execSync, spawn} = require('child_process');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');
const split = require('split');
const PromiseSome = require('bluebird').some;
const WebSocket = require('ws');

const {readDir} = require('./logs');
const {editFile, getSwarmObj} = require('./configs');


const setupUtils = {

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

        const MINIMUM_NODES = Math.floor(Object.keys(nodesToSpawn).length * ( 1 - failureAllowed));

        let guaranteedNodes;

        try {
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

            if (err instanceof Array) {
                err.forEach((e) => {
                    console.log(`Daemon failed to startup in time. \n ${e}`)
                })
            } else {
                console.log(`Error spawning node: ${err}`)
            }
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

    createKeys: async (clientsObj, numOfKeys, ms) => {

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        const batched = chunk([...Array(parseInt(numOfKeys)).keys()]);

        let batchedWithDelay = batched.reduce((acc, cur) => {
            acc.push(cur);
            acc.push(delay);
            return acc
        }, []);

        await processAssortedArray(batchedWithDelay, clientsObj, ms);
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
        execSync('pkill -9 swarm');
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

const processAssortedArray = async (array, clientsObj, delay) => {
    for (ele of array) {
        if (typeof(ele) === 'function') {
            await ele(delay)
        } else {
            await Promise.all(ele.map((v) => clientsObj.api.create('batch-key' + v, 'value')))
        }
    }
};

module.exports = setupUtils;
