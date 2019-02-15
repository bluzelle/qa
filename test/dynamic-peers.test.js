const common = require('./common');
const {startSwarm, initializeClient, teardown, spawnDaemon} = require('../utils/daemon/setup');
const {createDirectories, generateConfigs, generatePeersList} = require('../utils/daemon/configs');
const fsPromises = require('fs').promises;
const PollUntil = require('poll-until-promise');
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

const clientsObj = {};
const numOfNodes = harnessConfigs.numOfNodes;


describe('dynamic peering', () => {

    [{name: 'new peer bootstrapped with full peers list', numOfNodesToBootstrap: numOfNodes}, {name: 'new peer bootstrapped with one peer', numOfNodesToBootstrap: 1}].forEach((test) => {

        context.only(test.name, function() {

            before('stand up swarm and client', async function () {
                this.timeout(30000);
                await setup.call(this, numOfNodes, test.numOfNodesToBootstrap);
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
                this.timeout(40000);

                const pollView = new PollUntil();

                await new Promise((resolve, reject) => {
                    pollView
                        .stopAfter(40000)
                        .tryEvery(2000)
                        .execute(() => new Promise((res, rej) => {

                            this.api.status().then(val => {

                                const something = JSON.parse(val.moduleStatusJson).module[0].status;

                                if (something.view === 2) {
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

            common.crudFunctionalityTests(clientsObj);

            common.crudFunctionalityTests(clientsObj);

        });

    });

    // todo: add test for mixed configs, signing disabled
    //  add test for old clients

});

async function setup(numOfNodes, numOfNodesToIncludeInPeersList) {
    [this.swarm, peersList] = await startSwarm({numOfNodes});
    this.api = await initializeClient({swarm: this.swarm, setupDB: true});

    clientsObj.api = this.api;

    const {daemonDirPath, data} = await generateNewPeer(numOfNodes);

    this.newPeerIdx = data.index;

    addPeerToSwarmObj.call(this, data);

    const culledPeersList = peersList.slice(0, numOfNodesToIncludeInPeersList);

    await writePeersList(culledPeersList, numOfNodesToIncludeInPeersList, daemonDirPath);

    await spawnDaemon(this.swarm, this.newPeerIdx);
}

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
