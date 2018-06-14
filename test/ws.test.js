const WebSocket = require('ws');
const expect = require('chai').expect;

const {startSwarm, killSwarm} = require('../utils/daemon/setup');
const {spliceConfigFile, resetConfigFile} = require('../utils/daemon/configs');

let socket;

const ENCODED_CMDS = {
    // stringified protobuf serial output embedded in JSON
    create: '{"bzn-api":"database","msg":"UjUSJgokNzFlMmNkMzUtYjYwNi00MWU2LWJiMDgtZjIwZGUzMGRmNzZjUgsSA2tleRoEATEyMw=="}', // create('key', 123)
    read: '{"bzn-api":"database","msg":"Ui8SJgokNzFlMmNkMzUtYjYwNi00MWU2LWJiMDgtZjIwZGUzMGRmNzZjWgUSA2tleQ=="}' // read('key')
};

describe('web sockets interface', () => {

    describe('connected', () => {

        beforeEach(startSwarm);
        beforeEach('open ws connection', done => {
            socket = new WebSocket('ws://127.0.0.1:50000');
            socket.on('open', done);
        });

        afterEach( async () => {
            await killSwarm();
        });

        it('should be responsive', async () => {
            const messagePromise = new Promise(resolve =>
                socket.on('message', message => resolve(message)));

            socket.send(ENCODED_CMDS.read);

            const message = await messagePromise;
            expect(message).to.not.be.empty;
        })
    });

    describe('connection', () => {

        let startTime, timeElapsed;

        beforeEach(() => spliceConfigFile('bluzelle0.json', 2, '\n  "ws_idle_timeout" : 1'));

        beforeEach(startSwarm);

        beforeEach('ws connection', done => {
            startTime = Date.now();

            socket = new WebSocket(`ws://${process.env.address}:${process.env.port}`);
            socket.on('open', done);
        });

        afterEach(killSwarm);

        afterEach(() => resetConfigFile('bluzelle0.json'));


        it('should close after an idle period', async function () {

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1000) {
                        resolve();
                    } else {
                        reject();
                    }
                });

            });
        });

        it('write should extend idle period before close', async function () {

            setTimeout(() => {
                socket.send(ENCODED_CMDS.create)
            }, 500);

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1500) {
                        resolve();
                    } else {
                        reject(`Socket closed in: ${timeElapsed}`);
                    }
                });
            });

        });

        it('read should extend idle period before close', async function () {

            setTimeout(() => {
                socket.send(ENCODED_CMDS.read)
            }, 500);

            await new Promise((resolve, reject) => {

                socket.on('close', () => {
                    timeElapsed = Date.now() - startTime;

                    if (timeElapsed > 1500) {
                        resolve();
                    } else {
                        reject(`Socket closed in: ${timeElapsed}`);
                    }
                });
            });
        });

    });
});
