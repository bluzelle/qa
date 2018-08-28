const {expect} = require('chai');
const waitUntil = require("async-wait-until");

const {execDaemon} = require('../utils/daemon/setup');
const {readFile, readDir, compareData} = require('../utils/daemon/logs');


exports.swarmIsOperational = api => {

    it('should be able to create', async () => {

        await api.create('key', '123');
    });

    it('should be able to read', async () => {

        await api.create('key', 'abc');

        expect(await api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        await api.create('key', '123');

        await api.update('key', 'abc');

        expect(await api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        await api.create('key', '123');

        await api.remove('key');

        expect(await api.has('key')).to.be.false;
    })
};

exports.createShouldTimeout = api => {

    it('create should timeout at api level', done => {

        api.create('key', '123')
            .then(() => {
                throw new Error('Create was successful, expected to fail.')
            })
            .catch(e => {
                expect(e.toString()).to.include('Error: Bluzelle poll timeout - command not commited to swarm.');
                done();
            })
    });
};

exports.daemonShouldSync = (cfgName, uuid) => {

    it('should fully replicate .state file of peers', async () => {

        execDaemon(cfgName);

        let daemonData = {};

        let DAEMON_STORAGE_LOG_NAMES;

        try {
            await waitUntil(() => {
                DAEMON_STORAGE_LOG_NAMES = readDir('output/.state').filter(file => file.endsWith('.dat'));

                return (DAEMON_STORAGE_LOG_NAMES.length === 3);
            });
        } catch (e) {
            throw new Error('.state dir does not have expected amount of .dat files')
        }

        try {
            await waitUntil(() => {
                return (readFile('output/.state/', `${uuid}.dat`).split('\n').length >= parseInt(process.env.numOfKeys))
            }, 10000)
        } catch (e) {
            throw new Error('daemon .dat did not reach expected length')
        }

        try {
            await waitUntil(() => {
                DAEMON_STORAGE_LOG_NAMES.forEach(filename =>
                    daemonData[filename] = readFile('/output/.state/', filename));

                if (compareData(daemonData, {removeFirstLine: true})){
                    return true
                };
            });
        } catch (e) {
            throw new Error('.dat files are inconsistent')
        }
    });
};
