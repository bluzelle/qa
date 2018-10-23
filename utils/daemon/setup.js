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

            try {
                if (msgSentToFollower(msg)) {
                    swarm.leader = msg.message.leader.name;
                    res(swarm.leader)
                } else if (msgSentToLeader(msg)) {
                    swarm.leader = swarm.guaranteedNodes[0];
                    res(swarm.leader)
                } else if (electionInProgress(msg)) {
                    socket.send(JSON.stringify({"bzn-api" : "raft", "cmd" : "get_peers"}))
                }
            } catch (err) {
                console.log(`Error setting leader, \n${err.stack}`);
                console.log(`Response from daemon:`);
                console.log(msg)
            }

        })
    }),

    pollStatus: ({port, matchState, expectSingleton, expectConnected} = {}) => new Promise((resolve, reject) => {

        let state, intervalId;
        let statesArr = [];

        try {
            socket = new WebSocket(`ws:127.0.0.1:${port}`)
        } catch (err) {
            console.log(`Failed to connect to node. \n ${err.stack}`)
        }

        socket.on('open', () => {

            intervalId = setInterval(() => {
                socket.send(JSON.stringify({"bzn-api":"status"}))
            }, 1500)

        });

        /*
         {
             "bzn-api" : "status",
             "module" :
             [
                 {
                     "name" : "raft",
                     "status" :
                     {
                         "state" : "candidate"
                     }
                 }
             ],
             "version" : ".."
         }
         */

        socket.on('message', (message) => {

            let msg = JSON.parse(message);

            state = msg.module[0].status.state;

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
        exec('pkill -9 swarm');
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

    spawnDaemon: (index) => new Promise((resolve) => {

        daemon = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${index}.json`], {cwd: './scripts'});

        daemon.stdout.on('data', (data) => {
            if (data.toString().includes('AppendEntriesReply')) {
                resolve(daemon)
            }
        });
    })
};


/*
 @CASE 1: swarm in election

 {
     "error" : "ERROR_GET_PEERS_ELECTION_IN_PROGRESS_TRY_LATER"
 }

 @CASE 2: msg sent to follower
 {
     "error" : "ERROR_GET_PEERS_MUST_BE_SENT_TO_LEADER",
     "message" :
     {
         "leader" :
         {
             "host" : "127.0.0.1",
             "http_port" : 8081,
             "name" : "daemon1",
             "port" : 50001,
             "uuid" : "4f072c3d-c0b8-4286-bba3-5f47ea321dac"
         }
     }
 }

 @CASE 3: msg sent to leader
 {
     "message" :
     [
         {
             "host" : "127.0.0.1",
             "http_port" : 8080,
             "name" : "daemon0",
             "port" : 50000,
             "uuid" : "28e48261-13dc-49f0-a651-a1c70c0bddce"
         },
         {
             "host" : "127.0.0.1",
             "http_port" : 8081,
             "name" : "daemon1",
             "port" : 50001,
             "uuid" : "4f072c3d-c0b8-4286-bba3-5f47ea321dac"
         },
         {
             "host" : "127.0.0.1",
             "http_port" : 8082,
             "name" : "daemon2",
             "port" : 50002,
             "uuid" : "9687ff1f-c244-4159-9847-7bf10bee4e74"
         }
     ]
 }
 */

const msgSentToFollower = (msg) => msg.error && msg.message;

const msgSentToLeader = (msg) => msg.message;

const electionInProgress = (msg) => msg.error;


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
