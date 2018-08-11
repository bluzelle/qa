const {exec, execSync, spawn} = require('child_process');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');

const api = require('../../bluzelle-js/lib/bluzelle.node');
const {readDir} = require('./logs');
const {editFile} = require('./configs');


let leaderLogName;

const setupUtils = {
    startSwarm: async function (flag = false) {

        if (!flag) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            exec('cd ./daemon-build/output/; rm -rf .state', (error, stdout, stderr) => {
                if (error) {
                    throw new Error(error);
                }
            });
        }

        let beforeContents = readDir('output/logs');

        exec('cd ./scripts; ./run-daemon.sh bluzelle0.json', {maxBuffer: 1024 * 1024 * 10}, (error, stdout, stderr) => {
            // code 130 is thrown when process is ended with SIGINT
            if (error && error.code !== 130) {
                throw new Error(error);
            }
        });

        // Waiting briefly before starting second Daemon ensures the first starts as leader
        setTimeout(() => {
            exec('cd ./scripts; ./run-daemon.sh bluzelle1.json', {maxBuffer: 1024 * 1024 * 10}, (error, stdout, stderr) => {
                if (error && error.code !== 130) {
                    throw new Error(error);
                }
            })
        }, 500);

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
            }, 5000);
            process.env.quiet ||
                console.log('\x1b[36m%s\x1b[0m', 'I am leader logged')
        } catch (error) {
            process.env.quiet ||
                console.log('\x1b[36m%s\x1b[0m', 'Failed to read leader log');
        }

        logNames.forEach(logName => setupUtils.swarm.logs.push(logName));
    },

    killSwarm: async () => {
        exec('pkill -2 swarm');

        setupUtils.swarm.logs = [];

        await new Promise(resolve => {
            setTimeout(() => {
                resolve()
            }, 200)
        })
    },

    createState: async (key, value) => {
        await setupUtils.startSwarm();
        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        await api.create(key, value);
        await setupUtils.killSwarm();
    },

    swarm: {list: {'daemon0': 50000, 'daemon1': 50001, 'daemon2': 50002}, logs: []},

    spawnSwarm: async () => {

        execSync('cd ./daemon-build/output/; rm -rf .state');

        editFile({filename: 'bluzelle0.json', changes: {log_to_stdout: true}});

        Object.keys(setupUtils.swarm.list).forEach((daemon, i) => {

            setupUtils.swarm[daemon] = spawn('./run-daemon.sh', [`bluzelle${i}.json`], {cwd: './scripts'});

            setupUtils.swarm[daemon].stdout.on('data', data => {
                if (data.toString().includes('RAFT State: Leader')) {
                    setupUtils.swarm.leader = daemon;
                }
            });
        });

        try {
            await waitUntil(() => setupUtils.swarm.leader, 3000);
        } catch (err) {
            console.log(`Failed to declare leader`)
        }
    },

    despawnSwarm: () => {

        execSync('pkill -2 swarm');

        setupUtils.swarm.daemon0, setupUtils.swarm.daemon1, setupUtils.swarm.daemon2, setupUtils.swarm.leader = undefined;
    }
};

const difference = (arr1, arr2) => {
    return arr1
        .filter(item => !arr2.includes(item))
        .concat(arr2.filter(item => !arr1.includes(item)));
};

module.exports = setupUtils;
