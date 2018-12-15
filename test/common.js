const {expect} = require('chai');
const {execSync} = require('child_process');
const assert = require('assert');
const {writeFileSync} = require('fs');

const {bluzelle} = require('../bluzelle-js/lib/bluzelle-node');
const {spawnSwarm, despawnSwarm, clearDaemonStateAndConfigs, spawnDaemon} = require('../utils/daemon/setup');
const SwarmState = require('../utils/daemon/swarm');
const {generateSwarmJsonsAndSetState} = require('../utils/daemon/configs');


exports.crudFunctionalityTests = clientsObj => {

    it('should be able to create', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }
    });

    it('should be able to read', async () => {

        try {
            await clientsObj.api.create('key', 'abc');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        expect(await clientsObj.api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.update('key', 'abc');
        } catch (err) {
            throw new Error(`Failed to update \n ${err}`);
        }

        expect(await clientsObj.api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        try {
            await clientsObj.api.create('key', '123');
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            await clientsObj.api.delete('key');
        } catch (err) {
            throw new Error(`Failed to remove \n ${err}`);
        }

        expect(await clientsObj.api.has('key')).to.be.false;
    })
};

exports.miscFunctionalityTests = clientsObj => {

    it('should be able to "has"', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.has('key');
        } catch (err) {
            throw new Error(`Failed to "has" \n ${err}`);
        }

        assert(result);
    });


    it('should be able to get keys', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.keys()
        } catch (err) {
            throw new Error(`Failed to "keys"\n ${err}`);
        }

        assert(result.length > 0);
    });

    it('should be able to get size', async () => {

        let result;

        try {
            await clientsObj.api.create('key', '123')
        } catch (err) {
            throw new Error(`Failed to create \n ${err}`);
        }

        try {
            result = await clientsObj.api.size();
        } catch (err) {
            throw new Error(`Failed to get size \n ${err}`);
        }

        assert(result > 0);
    });

};

exports.createShouldTimeout = clientsObj => {

    it('create should timeout at api level', () => {

        return clientsObj.api.create('key', '123')
            .then(() => {
                throw new Error('Create was successful, expected to fail.')
            })
            .catch(err => {
                if (err.message.includes('Timed out after waiting for 5000ms')) {
                    return Promise.resolve()
                } else {
                    throw (err);
                }
            })
    });
};

exports.daemonShouldSync = (cfgIndexObj, numOfKeys, uuid) => {

    let api;

    beforeEach('spawn new daemon', async () => {
       await spawnDaemon(cfgIndexObj.index);
    });

    beforeEach('initialize client', () => {

        api = new BluzelleClient(
            `ws://${harnessConfigs.address}:${harnessConfigs.port + parseInt(cfgIndexObj.index)}`,
            uuid,
            false
        );
    });

    beforeEach('connect client', async () =>
        await api.connect());

    it('should sync and return full keylist', async () => new Promise((res, rej) => {

        const startTime = new Date();

        const timeId = setInterval(() => {
            let timeElapsed = () => (new Date) - startTime;

            api.keys().then((keys) => {

                if (keys.length === numOfKeys) {
                    clearInterval(timeId);
                    res();
                } else if (timeElapsed() >= 8000) {
                    clearInterval(timeId);
                    rej(new Error(`Daemon returned ${keys.length}, expected ${numOfKeys} keys`))
                }
            });

            if (timeElapsed() >= 9000) {
                clearInterval(timeId);
                rej(new Error(`Daemon failed to return keys.`))
            }
        }, 500);

    }));
};

exports.startSwarm = async ({numOfNodes}) => {

    let [configsObject] = await generateSwarmJsonsAndSetState(numOfNodes);
    const swarm = new SwarmState(configsObject);

    await spawnSwarm(swarm, {consensusAlgorithm: 'pbft'});

    return swarm;
};

exports.initializeClient = async ({uuid = '4982e0b0-0b2f-4c3a-b39f-26878e2ac814', pem = 'MHQCAQEEIFH0TCvEu585ygDovjHE9SxW5KztFhbm4iCVOC67h0tEoAcGBSuBBAAKoUQDQgAE9Icrml+X41VC6HTX21HulbJo+pV1mtWn4+evJAi8ZeeLEJp4xg++JHoDm8rQbGWfVM84eqnb/RVuIXqoz6F9Bg==', swarm, setupDB} = {}) => {

    const api = bluzelle({
        entry: `ws://${harnessConfigs.address}:${swarm[swarm.primary].port}`,
        uuid: uuid,
        private_pem: pem
    });

    if (setupDB) {
        try {
            await api.createDB();
        } catch (err) {
            console.log('Failed to createDB()')
        }
    }

    return api;
};

exports.teardown = function (logFailures) {

    if (logFailures && this.state === 'failed') {
        exportDaemonAndHarnessState.call(this);
    };

    despawnSwarm();

    clearDaemonStateAndConfigs();
};

function exportDaemonAndHarnessState() {
    const {ctx, parent, ...culledState} = this;
    const testTitle = replaceSpacesWithDashes(culledState);
    const pathToDump = `./daemon-build/output/failure_dumps/${testTitle}`;

    execSync(`mkdir -p ${pathToDump}`);
    execSync(`cp -a ./daemon-build/output/daemon[0-9] ${pathToDump}`);

    writeFileSync(`${pathToDump}/mocha-error.json`, JSON.stringify(culledState));
    console.log(`Test failed, dumping logs and state to ${pathToDump}`);
}

const replaceSpacesWithDashes = (culledState) => {
    const testTitle = culledState.title.replace(/\s+/g, '-');
    return testTitle;
};
