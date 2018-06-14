const exec = require('child_process').exec;
const waitUntil = require('async-wait-until');
const {includes} = require('lodash');
const fs = require('fs');
const WebSocket = require('ws');

const {logFileMoved, logFileExists} = require('./logs');

let logFileName;

const setupUtils = {
    startSwarm: async function (flag = false) {
        if (!flag) {
            // Daemon state is persisted in .state directory, wipe it to ensure clean slate
            exec('cd ./daemon-build/output/; rm -rf .state');
        }

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
            await waitUntil(() => logFileMoved(fileName));
            process.env.quiet ||
                console.log('Log file successfully moved to logs directory')
        } catch (error) {
            process.env.quiet ||
                console.log('Log file not found in logs directory')
        }
    },
    createState: async () => {
        await setupUtils.startSwarm();
        socket = new WebSocket('ws://127.0.0.1:50000');

        await new Promise((resolve, reject) => {
            socket.on('open', () => {

                socket.send('{"bzn-api" : "crud","cmd" : "create","data" :{"key" : "key1","value" : "hi"},"db-uuid" : "80174b53-2dda-49f1-9d6a-6a780d4cceca","request-id" : 85746}')

                // wait for cmd to propagate in Daemon
                setTimeout(() => {
                    resolve();
                }, 1000)
            });
        });

        socket.close();
        await setupUtils.killSwarm();
    }
};

module.exports = setupUtils;
