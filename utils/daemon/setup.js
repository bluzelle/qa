const exec = require('child_process').exec;
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');

const api = require('../../bluzelle-js/src/api');
const {fileMoved, fileExists} = require('./logs');

let logFileName;

const setupUtils = {
    startSwarm: async function (flag = false) {
        if (!flag) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            exec('cd ./daemon-build/output/; rm -rf .state');
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
    }
};

module.exports = setupUtils;
