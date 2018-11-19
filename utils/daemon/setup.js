const {exec, execSync, spawn} = require('child_process');
const split = require('split');
const PromiseSome = require('bluebird').some;
const WebSocket = require('ws');


const setupUtils = {

    spawnSwarm: async (swarm, {consensusAlgorithm, partialSpawn, maintainState, failureAllowed = 0.2}) => {
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
            setupUtils.clearDaemonState();
        }

        const nodesToSpawn = partialSpawn ? swarm.nodes.slice(0, partialSpawn) : swarm.nodes;

        const MINIMUM_NODES = Math.floor(nodesToSpawn.length * ( 1 - failureAllowed));

        try {
            await PromiseSome(nodesToSpawn.map((daemon) => new Promise((res, rej) => {

                const rejTimer = setTimeout(() => {
                    rej(new Error(`${daemon} stdout: \n ${buffer}`))
                }, 20000);

                let buffer = '';

                swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`], {cwd: './scripts'});

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

        } catch(err) {

            if (err instanceof Array) {
                err.forEach((e) => {
                    console.log(`Daemon failed to startup in time. \n ${e}`)
                });
            } else {
                throw new Error(`Minimum swarm failed to start \n ${err}`)
            }
        }

        if (consensusAlgorithm === 'raft') {
            await setupUtils.getCurrentLeader(swarm)
        }

        if (consensusAlgorithm === 'pbft') {
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

        try {
            await processAssortedArray(batchedWithDelay, clientsObj, ms);
        } catch (err) {
            return Promise.reject(err)
        }

    },

    getCurrentLeader: (swarm) => new Promise((res, rej) => {

        let startTime, socket, nodePort;

        startTime = Date.now();

        rejAfterTimeElapsed(startTime, 9000, rej);

        // if leader exists, connect to a follower, otherwise connect to any live node which could include leader
        if (swarm.leader) {
            nodePort = swarm[swarm.followers[0]].port
        } else {
            nodePort = swarm[swarm.liveNodes[0]].port
        }

        try {
            socket = new WebSocket(`ws://127.0.0.1:${nodePort}`);
        } catch (err) {
            rej(new Error(`Failed to connect to leader. \n ${err.stack}`))
        }

        socket.on('open', () => {
            // timeout required until KEP-684 bug resolved
            setTimeout(() => socket.send(JSON.stringify({"bzn-api" : "raft", "cmd" : "get_peers"})), 2000)
        });

        socket.on('message', (message) => {

            let msg = JSON.parse(message);

            try {
                if (msgSentToFollower(msg)) {
                    swarm.leader = msg.message.leader.name;
                    res(swarm.leader);
                    socket.close();
                } else if (msgSentToLeader(msg)) {
                    swarm.leader = swarm.liveNodes[0];
                    res(swarm.leader);
                    socket.close();
                } else if (electionInProgress(msg)) {
                    socket.send(JSON.stringify({"bzn-api" : "raft", "cmd" : "get_peers"}))
                }
            } catch (err) {
                rej(new Error(`Error setting leader, \n${err.stack}`));
            }
        })
    }),

    pollStatus: ({port, matchState, expectSingleton, expectConnected, debug}) => new Promise((resolve, reject) => {

        /*
        * Connect to a specific node to query its Raft status
        * @params {port} Integer. Port of node to connect and query status
        * @params {matchState} String. 'leader' or 'follower' for Raft. Expect node to be in a specific state
        * @params {expectSingleton}. Boolean. Expect node to remain in 'candidate' state
        * @params {expectConnected}. Boolean. Expect node to be either 'follower' or 'leader' state
        * */

        let state, intervalId;
        let statesArr = [];

        try {
            socket = new WebSocket(`ws:127.0.0.1:${port}`)
        } catch (err) {
            reject(new Error(`Failed to connect to node. \n ${err.stack}`));
        }

        socket.on('open', () => {

            intervalId = setInterval(() => {
                socket.send(JSON.stringify({"bzn-api":"status"}))
            }, 1500)
        });

        socket.on('message', (message) => {

            let msg = JSON.parse(message);

            state = msg.module[0].status.state;

            if (debug) {
                console.log(msg)
            }

            if (matchState && state === matchState) {
                clearInterval(intervalId);
                resolve(`Daemon reached ${matchState}`);
                socket.close();
            }

            if (expectConnected && (state === 'leader' || state === 'follower')) {
                clearInterval(intervalId);
                resolve(`Daemon reached ${matchState}`);
                socket.close();
            }

            statesArr.push(state);

        });

        if (expectSingleton) {

            setTimeout(() => {

                if (!statesArr.includes('follower') && !statesArr.includes('leader') ) {
                    clearInterval(intervalId);
                    resolve('Daemon stayed as singleton');
                    socket.close();
                } else {
                    clearInterval(intervalId);
                    reject(new Error('New peer connected to swarm. Expected to be singleton.'));
                    socket.close();
                }
            }, 6000)
        }

    }),

    despawnSwarm: () => {
        try {
            execSync('pkill -9 swarm');
        } catch (err) {
            // do nothing, cmd throws error if no swarm to kill
        }
    },

    deleteConfigs: () => {
        try {
            execSync('cd ./daemon-build/output/; rm *.json');
        } catch (err) {
            if (err.message.includes('No such file or directory')) {
                // do nothing
            } else {
                throw err
            }
        }
    },

    clearDaemonState: () => {
        try {
            execSync('cd ./daemon-build/output/; rm -rf .state');
        } catch (err) {
            if (err.message.includes('No such file or directory')) {
                // do nothing
            } else {
                throw err
            }
        }
    },

    spawnDaemon: (index, {debug} = {}) => new Promise((resolve, reject) => {
        let daemon;

        daemon = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${index}.json`], {cwd: './scripts'});

        daemon.stdout.on('data', (data) => {
            if (debug) {
                console.log(data.toString());
            }
            if (data.toString().includes('AppendEntriesReply')) {
                resolve(daemon)
            }
        });

        daemon.on('error', (err) => {
            reject(new Error('Failed to spawn Daemon.'));
        });
    })
};

const rejAfterTimeElapsed = (startTime, ms, rej) => {
    setInterval(() => {
        let timeElapsed = Date.now() - startTime;

        if (timeElapsed >= ms) {
            rej(new Error(`Timed out after time elapsed: ${ms}`))
        }
    }, 500);
};

const msgSentToFollower = (msg) => msg.error && msg.message;

const msgSentToLeader = (msg) => msg.message;

const electionInProgress = (msg) => msg.error;

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
            try {
                await Promise.all(ele.map((v) => clientsObj.api.create('batch-key' + v, 'value')))
            } catch (err) {
                throw err
            }
        }
    }
};

module.exports = setupUtils;
