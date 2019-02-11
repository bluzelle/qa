const common = require('./common');
const {startSwarm, initializeClient, teardown, spawnDaemon} = require('../utils/daemon/setup');
const {createDirectories, generateConfigs, generatePeersList} = require('../utils/daemon/configs');
const fsPromises = require('fs').promises;
const waitUntil = require("async-wait-until");
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));


const numOfNodes = harnessConfigs.numOfNodes;

describe('dynamic peering', () => {

    before('stand up swarm and client', async function () {
        this.timeout(30000);
        [this.swarm, peersList] = await startSwarm({numOfNodes: 6});
        this.api = await initializeClient({swarm: this.swarm, setupDB: true});
    });

    afterEach('remove configs and peerslist and clear harness state', function () {
        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
    });

    context('new peer bootstrapped with full peers list', function() {

        before('start new peer', async function () {

            const daemonDirPath = await createDirectories(1, 6);
            const configObj = await generateConfigs({numOfConfigs: 1, pathList: daemonDirPath});
            const data = configObj[0];

            this.swarm[`daemon${data.index}`] =
                {
                    uuid: data.uuid,
                    port: data.content.listener_port,
                    http_port: data.content.http_port,
                    index: data.index
                };

            await fsPromises.writeFile(daemonDirPath[0] + '/peers.json', JSON.stringify(peersList));

            await spawnDaemon(this.swarm, 6);
        });

        it('should send request to join swarm', async function () {

            await new Promise(res => {
                this.swarm.daemon6.stream.stdout.on('data', (data) => {

                    if (data.toString().includes('Sending request to join swarm')) {
                        res();
                    }
                });
            });
        });

        it('should successfully join swarm', async function () {

            await new Promise(res => {
                this.swarm.daemon6.stream.stdout.on('data', (data) => {

                    if (data.toString().includes('Successfully joined the swarm')) {
                        res();
                    }
                });
            });
        });

        it('should increment swarm view number by 1', async function () {

            const res = await this.api.status();

            const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

            console.log(parsedStatusJson.view);

            await waitUntil(() => {

                this.api.status().then(val => {

                    const something = JSON.parse(val.moduleStatusJson).module[0].status;

                    console.log(something.view);

                    return (val.view === 2)
                });

            })
        });

        it('should be included in status response', async function () {

            const res = await this.api.status();

            const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

            parsedStatusJson.peer_index.should.contain.an.item.with.property('uuid', this.swarm.daemon6.uuid)
        });

    });

    context('new peer bootstrapped with one peer', function() {

        before('start new peer', async function () {

            const daemonDirPath = await createDirectories(1, 6);
            const configObj = await generateConfigs({numOfConfigs: 1, pathList: daemonDirPath});
            const data = configObj[0];

            this.swarm[`daemon${data.index}`] =
                {
                    uuid: data.uuid,
                    port: data.content.listener_port,
                    http_port: data.content.http_port,
                    index: data.index
                };

            const singlePeer = [peersList[0]];

            await fsPromises.writeFile(daemonDirPath[0] + '/peers.json', JSON.stringify(singlePeer));

            await spawnDaemon(this.swarm, 6);
        });

        it('should send request to join swarm', async function () {

            await new Promise(res => {
                this.swarm.daemon6.stream.stdout.on('data', (data) => {

                    if (data.toString().includes('Sending request to join swarm')) {
                        res();
                    }
                });
            });
        });

        it('should successfully join swarm', async function () {

            await new Promise(res => {
                this.swarm.daemon6.stream.stdout.on('data', (data) => {

                    if (data.toString().includes('Successfully joined the swarm')) {
                        res();
                    }
                });
            });
        });

        it('should increment swarm view number by 1', async function () {

            const res = await this.api.status();

            const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

            console.log(parsedStatusJson.view);

            await waitUntil(() => {

                this.api.status().then(val => {

                    const something = JSON.parse(val.moduleStatusJson).module[0].status;

                    console.log(something.view);

                    return (val.view === 2)
                });

            })
        });

        it('should be included in status response', async function () {

            const res = await this.api.status();

            const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

            parsedStatusJson.peer_index.should.contain.an.item.with.property('uuid', this.swarm.daemon6.uuid)
        });

    });

    // todo: add test for mixed configs, signing disabled
    //  add test for old clients

});
