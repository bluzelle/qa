const {exec, execSync, spawn} = require('child_process');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');
const split = require('split');

const {readDir} = require('./logs');
const {editFile, getSwarmObj, clearSwarmObj} = require('./configs');


let leaderLogName;

const setupUtils = {
    startSwarm: async function ({maintainState} = {}) {

        if (!maintainState) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            setupUtils.clearState();
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

        swarm.logs = [];

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

    createKeys: (done, api, numOfKeys) => {

        const chunkedArr = chunk([...Array(parseInt(numOfKeys)).keys()]);

        chunkedArr.reduce((acc, batch) =>
            acc.then(() => Promise.all(
                batch.map((v) => api.create(`batch-key${v}`, 'value'))
            )), Promise.resolve())
            .then(() => api.keys()
                .then(keys => {
                    if (keys.length >= numOfKeys) {
                        done()
                    } else {
                        throw new Error(`Failed to create ${numOfKeys} keys`);
                    }
                })
            )
    },

    spawnSwarm: async (done, consensusAlgo) => {

        setupUtils.clearState();

        let swarm = getSwarmObj();

        Object.keys(swarm).forEach((daemon) => {
            swarm[daemon].stream = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${swarm[daemon].index}.json`], {cwd: './scripts'});
        });

        if (consensusAlgo === 'raft') {
            Object.keys(swarm.list).forEach((daemon) => {

                swarm[daemon].stream.stdout
                    .pipe(split())
                    .on('data', function (line) {
                        if (line.toString().includes('RAFT State: Leader')) {
                            swarm.leader = daemon;
                        }
                    });
            });

            const intervalId = setInterval(() => {
                if (swarm.leader) {
                    clearInterval(intervalId);
                    done();
                }
            }, 500)
        }

        if (consensusAlgo === 'pbft') {
            swarm.daemon0.stream.stdout
                .pipe(split())
                .on('data', function (line) {
                    // daemon implementation starts with daemon1 as primary
                    // `sorted_uuids_list[view_number % number_of_nodes]`
                    if (line.toString().includes(`primary: "${swarm.daemon1.uuid}"`)) {
                        done()
                    }
                });
        }
    },

    despawnSwarm: () => {
        execSync('pkill -2 swarm');
    },

    clearConfigs: () => {
        exec('cd ./daemon-build/output/; rm *.json', (error, stdout, stderr) => {
            if (error) {
                throw new Error(error);
            }
        });
    },

    clearState: () => {
        exec('cd ./daemon-build/output/; rm -rf .state', (error, stdout, stderr) => {
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

const chunk = (array, batchSize = 10) => {
    const chunked = [];

    for (let i = 0; i < array.length; i += batchSize) {
        chunked.push(array.slice(i, i + batchSize))
    }

    return chunked;
};

module.exports = setupUtils;
