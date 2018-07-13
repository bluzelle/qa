const {exec, spawn} = require('child_process');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');

const api = require('../../bluzelle-js/src/api');
const {fileMoved, fileExists} = require('./logs');
const {editConfigFile, resetConfigFile} = require('./configs');


let logFileName;

const setupUtils = {
    startSwarm: async function (flag = false) {
        if (!flag) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            // log file may remain if Daemon not exited gracefully
            exec('cd ./daemon-build/output/; rm -rf .state; rm *.log');
        }

        exec('cd ./scripts; ./run-daemon.sh bluzelle0.json');

        // Waiting briefly before starting second Daemon ensures the first starts as leader
        setTimeout(() => {
            exec('cd ./scripts; ./run-daemon.sh bluzelle1.json')
        }, 2000);

        try {
            await waitUntil(() => logFileName = fileExists());
            process.env.quiet ||
                console.log('Log file created')
        } catch (error) {
            process.env.quiet ||
                console.log('Log file not found')
        }

        process.env.quiet ||
            console.log(`******** logFileName: ${logFileName} *******`);

        try {

            await waitUntil(() => {

                let contents = fs.readFileSync('./daemon-build/output/' + logFileName, 'utf8');

                return includes(contents, 'RAFT State: Leader');
            }, 10000);
            process.env.quiet ||
                console.log('I am leader logged')
        } catch (error) {
            process.env.quiet ||
                console.log('Failed to read leader log');
        }
    },
    killSwarm: async (fileName = logFileName) => {
        exec('pkill -2 swarm');

        try {
            await waitUntil(() => fileMoved(fileName));
            process.env.quiet ||
                console.log('Log file successfully moved to logs directory')
        } catch (error) {
            process.env.quiet ||
                console.log('Log file not found in logs directory')
        }
    },
    createState: async (key, value) => {
        await setupUtils.startSwarm();
        api.connect(`ws://${process.env.address}:${process.env.port}`, '71e2cd35-b606-41e6-bb08-f20de30df76c');
        await api.create(key, value);
        await setupUtils.killSwarm();
    },
    swarm: {list: {'daemon0': 50000, 'daemon1': 50001, 'daemon2': 50002}},
    spawnSwarm: async () => {

        exec('cd ./daemon-build/output/; rm -rf .state');

        editConfigFile('bluzelle0.json', 7, '\n  "log_to_stdout" : true \n }');


        Object.keys(setupUtils.swarm.list).forEach((daemon, i) => {

            setupUtils.swarm[daemon] = spawn('./run-daemon.sh', [`bluzelle${i}.json`], {cwd: './scripts'});

            setupUtils.swarm[daemon].stdout.on('data', data => {
                if (data.toString().includes('RAFT State: Leader')) {
                    setupUtils.swarm.leader = daemon;
                }
            });
        });

        try {
            await waitUntil(() => setupUtils.swarm.leader, 7000);
        } catch (err) {
            console.log(`Failed to declare leader`)
        }
    },
    despawnSwarm: () => {

        resetConfigFile('bluzelle0.json');

        exec('pkill -2 swarm');

        setupUtils.swarm.daemon0, setupUtils.swarm.daemon1, setupUtils.swarm.daemon2, setupUtils.swarm.leader = undefined;
    }
};

module.exports = setupUtils;
