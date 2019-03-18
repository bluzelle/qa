const common = require('../common');
const {startSwarm, initializeClient, teardown, spawnDaemon, createKeys} = require('../../utils/daemon/setup');
const {createDirectories, generateConfigs, generatePeersList} = require('../../utils/daemon/configs');
const fsPromises = require('fs').promises;
const PollUntil = require('poll-until-promise');

const clientsObj = {};
const numOfNodes = harnessConfigs.numOfNodes;


describe('dynamic peering', () => {

    [{
        name: 'add peer with no state',
        numOfKeys: 0,
        hookTimeout: 30000
    }, {
        name: 'add peer with 50 keys loaded',
        numOfKeys: 50,
        hookTimeout: 30000
    }, {
        name: 'add peer with 100 keys loaded',
        numOfKeys: 100,
        hookTimeout: 30000
    }, {
        name: 'add peer with 500 keys loaded',
        numOfKeys: 500,
        hookTimeout: 100000
    }].forEach((ctx) => {

        context(ctx.name, function () {
            [{
                name: 'new peer bootstrapped with full peers list',
                numOfNodesToBootstrap: numOfNodes
            }, {
                name: 'new peer bootstrapped with one peer',
                numOfNodesToBootstrap: 1
            }].forEach((test) => {

                context(test.name, function () {

                    before('stand up swarm and client', async function () {
                        this.timeout(ctx.hookTimeout);

                        [this.swarm, peersList] = await startSwarm({numOfNodes});
                        this.api = await initializeClient({swarm: this.swarm, setupDB: true, log: false});
                        clientsObj.api = this.api;

                        if (ctx.numOfKeys > 0) {
                            await createKeys(clientsObj, ctx.numOfKeys)
                        }

                        // Add new peer to harness and swarm todo: refactor into swarm class after swarm class refactor
                        const {daemonDirPath, data} = await generateNewPeer(numOfNodes);
                        this.newPeerIdx = data.index;
                        addPeerToSwarmObj(this.swarm, data);
                        const culledPeersList = peersList.slice(0, test.numOfNodesToBootstrap);
                        await writePeersList(culledPeersList, test.numOfNodesToBootstrap, daemonDirPath);
                        await spawnDaemon(this.swarm, this.newPeerIdx);

                        // Ensure daemons don't get stuck in invalid local state
                        const failures = [
                            ['Dropping message because local view is invalid', 5],
                        ];
                        this.swarm.addMultipleFailureListeners(failures);
                    });

                    after('remove configs and peerslist and clear harness state', function () {
                        teardown.call(this.currentTest, true, true);
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

                        await pollView
                            .stopAfter(60000)
                            .tryEvery(2000)
                            .execute(() => new Promise((res, rej) => {

                                this.api.status().then(val => {

                                    const response = JSON.parse(val.moduleStatusJson).module[0].status;

                                    if (response.view === 2) {
                                        return res(true)
                                    } else {
                                        rej(false)
                                    }
                                });
                            }))

                    });

                    it('should be included in status response', async function () {

                        const res = await this.api.status();

                        const parsedStatusJson = JSON.parse(res.moduleStatusJson).module[0].status;

                        parsedStatusJson.peer_index.should.contain.an.item.with.property('uuid', this.swarm[`daemon${this.newPeerIdx}`].uuid)
                    });

                    if (ctx.numOfKeys > 0) {

                        it('should be able to fetch full keys list', async function () {
                            expect((await clientsObj.api.keys()).length).to.be.equal(ctx.numOfKeys);
                        });

                        it('should be able to read last key before pre-primary failure', async function () {
                            expect(await clientsObj.api.read(`batch${ctx.numOfKeys - 1}`)).to.be.equal('value')
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

function addPeerToSwarmObj(swarm, data) {
    swarm[`daemon${data.index}`] =
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
