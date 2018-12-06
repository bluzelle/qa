const WebSocket = require('ws');
const expect = require('chai').expect;

const {spawnSwarm, despawnSwarm, deleteConfigs} = require('../utils/daemon/setup');
const {editFile, generateSwarmJsonsAndSetState, resetHarnessState} = require('../utils/daemon/configs');
const SwarmState = require('../utils/daemon/swarm');

let socket;

const ENCODED_CMDS = {
    // stringified protobuf serial output embedded in JSON
    create: '{"bzn-api":"database","msg":"UjUSJgokNzFlMmNkMzUtYjYwNi00MWU2LWJiMDgtZjIwZGUzMGRmNzZjUgsSA2tleRoEATEyMw=="}', // create('key', 123)
    read: '{"bzn-api":"database","msg":"Ui8SJgokNzFlMmNkMzUtYjYwNi00MWU2LWJiMDgtZjIwZGUzMGRmNzZjWgUSA2tleQ=="}' // read('key')
};

let swarm;
let numOfNodes = harnessConfigs.numOfNodes;

describe('web sockets interface', () => {

    describe('connected', () => {

        beforeEach('generate configs and set harness state', async () => {
            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            swarm = new SwarmState(configsObject);
        });

        beforeEach('spawn swarm', async function () {
            this.timeout(20000);
            await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
        });

        beforeEach('open ws connection', done => {
            socket = new WebSocket(`ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`);
            socket.on('open', done);
        });

        afterEach('despawn swarm', despawnSwarm);

        afterEach('remove configs and peerslist and clear harness state', () => {
            deleteConfigs();
            resetHarnessState();
        });

        it('should be responsive', async () => {
            const messagePromise = new Promise(resolve =>
                socket.on('message', message => resolve(message)));

            socket.send(ENCODED_CMDS.read);

            const message = await messagePromise;
            expect(message).to.not.be.empty;
        });
    });

    // ws idle timeout disabled for pub / sub
    describe.skip('connection', () => {

        let startTime, timeElapsed;

        beforeEach('generate configs and set harness state', async () => {
            let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
            swarm = new SwarmState(configsObject);
        });

        beforeEach('spawn swarm', async function () {
            this.timeout(20000);
            await spawnSwarm(swarm, {consensusAlgorithm: 'raft'})
        });

        beforeEach(() =>
            editFile({filename: 'bluzelle0.json', changes: { ws_idle_timeout: 1}}));


        beforeEach('ws connection', done => {
            startTime = Date.now();

            socket = new WebSocket(`ws://${harnessConfigs.address}:${harnessConfigs.port}`);
            socket.on('open', done);
        });

        afterEach('despawn swarm', despawnSwarm);


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
