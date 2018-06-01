const exec = require('child_process').exec;
const {logFileMoved, logFileExists} = require('./daemonLogHandlers');
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');

let logFileName;

module.exports = {
    startSwarm: async function () {
        exec('cd ./scripts; ./run-daemon.sh bluzelle.json');

        // Waiting briefly before starting second Daemon ensures the first starts as leader
        setTimeout(() => {
            exec('cd ./scripts; ./run-daemon.sh bluzelle2.json')
        }, 2000);

        try {
            await waitUntil(() => logFileName = logFileExists());
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

                // raft.cpp:601 stdouts 'I AM LEADER'
                return includes(contents, 'raft.cpp:601');
            }, 6000);
            process.env.quiet ||
                console.log('I am leader logged')
        } catch (error) {
            process.env.quiet ||
                console.log('Failed to read leader log');
        }
    },
    killSwarm: async () => {
        exec('pkill -2 swarm');
        await waitUntil(() => logFileMoved(logFileName));
    }
};
