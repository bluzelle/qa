const assert = require('assert');
const common = require('./common');
const {startSwarm, initializeClient, teardown, spawnDaemon, createKeys} = require('../utils/daemon/setup');
const {createDirectories, generateConfigs, generatePeersList} = require('../utils/daemon/configs');
const fsPromises = require('fs').promises;
const PollUntil = require('poll-until-promise');
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

const clientsObj = {};
const numOfNodes = harnessConfigs.numOfNodes;


describe.only('dynamic peering', () => {

    [{
        name: 'add peer with no state',
        numOfKeys: 0
    }, {
        name: 'add peer with loaded db',
        numOfKeys: 50
    }].forEach((ctx) => {

        context(ctx.name, function() {
            [{
                name: 'new peer bootstrapped with full peers list',
                numOfNodesToBootstrap: numOfNodes
            }, {
                name: 'new peer bootstrapped with one peer',
                numOfNodesToBootstrap: 1
            }].forEach((test) => {

                context(test.name, function() {

                    before('stand up swarm and client', async function () {
                        this.timeout(30000);

                        [this.swarm, peersList] = await startSwarm({numOfNodes});

                        this.api = await initializeClient({swarm: this.swarm, setupDB: true, log: false});

                        clientsObj.api = this.api;

                        if (ctx.numOfKeys > 0) {
                            await createKeys(clientsObj, ctx.numOfKeys)
                        }

                        const {daemonDirPath, data} = await generateNewPeer(numOfNodes);

                        this.newPeerIdx = data.index;

                        addPeerToSwarmObj.call(this, data);

                        const culledPeersList = peersList.slice(0, test.numOfNodesToBootstrap);

                        await writePeersList(culledPeersList, test.numOfNodesToBootstrap, daemonDirPath);

                        await spawnDaemon(this.swarm, this.newPeerIdx);
                    });

                    after('remove configs and peerslist and clear harness state', function () {
                        teardown.call(this.currentTest, process.env.DEBUG_FAILS);
                    });

                    it('should successfully join swarm', async function () {

                        await new Promise(res => {
                            this.swarm[`daemon${this.newPeerIdx}`].stream.stdout.on('data', (data) => {

                                if (data.toString().includes('Successfully joined the swarm')) {
                                    res();
                                }
                            });
                        });
                    });

                    it('should increment swarm view number by 1', async function () {
                        this.timeout(60000);

                        const pollView = new PollUntil();

                        await new Promise((resolve, reject) => {
                            pollView
                                .stopAfter(60000)
                                .tryEvery(2000)
                                .execute(() => new Promise((res, rej) => {

                                    this.api.status().then(val => {

                                        const response = JSON.parse(val.moduleStatusJson).module[0].status;

                                        console.log(response.view);

                                        if (response.view === 2) {
                                            return res(true)
                                        } else {
                                            return rej()
                                        }
                                    });
                                }))
                                .then(() => resolve())
                                .catch(err => console.log(err) || reject(''))

                        });
                    });

                    it('should be included in status response', async function () {

                        const res = await this.api.status();

                        const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                        parsedStatusJson.peer_index.should.contain.an.item.with.property('uuid', this.swarm[`daemon${this.newPeerIdx}`].uuid)
                    });

                    it('daemons should not log rejected message', async function () {


                    });

                    if (ctx.numOfKeys > 0) {

                        it('should be able to fetch full keys list', async function () {
                            assert((await clientsObj.api.keys()).length === ctx.numOfKeys);
                        });

                        it('should be able to read last key before pre-primary failure', async function () {
                            assert((await clientsObj.api.read(`batch${ctx.numOfKeys - 1}`)) === 'value')
                        })
                    }

                    common.crudFunctionalityTests(clientsObj);

                    common.miscFunctionalityTests(clientsObj);

                });

            });
        });

    })

    // todo: add test for mixed configs, signing disabled
    //  add test for old clients

});

async function generateNewPeer(numOfExistingPeers) {
    const daemonDirPath = await createDirectories(1, numOfExistingPeers);
    const configObj = await generateConfigs({numOfConfigs: 1, pathList: daemonDirPath});
    const data = configObj[0];
    return {daemonDirPath, data};
}

function addPeerToSwarmObj(data) {
    this.swarm[`daemon${data.index}`] =
        {
            uuid: data.uuid,
            port: data.content.listener_port,
            http_port: data.content.http_port,
            index: data.index
        };
}

async function writePeersList(peersList, numOfNodesToIncludeInPeersList, daemonDirPath) {
    await fsPromises.writeFile(daemonDirPath[0] + '/peers.json', JSON.stringify(peersList));
}
