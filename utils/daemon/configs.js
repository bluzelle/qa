const fs = require('fs');
const fsPromises = require('fs').promises;
const {execSync} = require('child_process');
const assert = require('assert');

const crypto = require('./crypto');

let swarm = {};

const configUtils = {

    generateSwarmJsonsAndSetState: async (numOfConfigs) => {
        /*
        * Main function to setup required configs for daemons in swarm. Each daemon's jsons, logs, and state are in a
        * separate directory at ./daemon-build/output/daemon*
        */

        numOfConfigs = typeof numOfConfigs === 'number' ? numOfConfigs : parseInt(numOfConfigs);

        configUtils.resetDaemonConfigCounter();

        const pathList = createDirectories(numOfConfigs);

        const configsObject = await configUtils.generateConfigs({numOfConfigs, pathList});

        const peersList = await configUtils.generatePeersList({configsObject, pathList});

        configUtils.setHarnessState(configsObject);

        return {configsObject, peersList}
    },

    generateConfigs: async ({numOfConfigs, pathList}) => {
        /*
        * Generates config files used for Daemon and writes them to file through daemon-build symlink
        * @params {numOfConfigs} Integer. Number of configs to generate and write
        * @params {pathList} Array. Array of paths to each Daemon's directory
        * @returns object containing configs and index numbers
        * */

        const template = readTemplate('./configs/pbft-template.json');

        const keyPairs = pathList.map((path) => crypto.generateKey(path));

        const pubKeys = keyPairs.reduce((results, keys) => {
            results.push(keys[0]);
            return results;
        }, []);

        const configsObject = buildConfigsObject(template, numOfConfigs, pubKeys);

        await writeConfigsToFile(configsObject, pathList);

        return configsObject;
    },

    generatePeersList: async ({configsObject, pathList}) => {

        /*
        * Generates peers list for Daemon and writes to file through daemon-build symlink to each
        * @params {configsObject} Object. Iterates over configsObject from buildConfigsObject() to generate peers list
        * @params {pathList} Array. List of paths created from createDirectories()
        * @returns object contain peers
        * [{
             "name": "daemon0",
             "host": "127.0.0.1",
             "port": 50000,
             "http_port": 8080
         }, {
             "name": "daemon1",
             "host": "127.0.0.1",
             "port": 50001,
             "http_port": 8081
         },
         {...}]
        */

        const peers = [];

        configsObject.forEach(data => {
            peers.push(
                {
                    name: `daemon${data.index}`,
                    host: '127.0.0.1',
                    port: data.content.listener_port,
                    http_port: data.content.http_port,
                    uuid: data.uuid
                }
            )
        });

        await writePeersListToFile(peers, pathList);

        return peers
    },

    setHarnessState: (configsObject) => {

        configsObject.forEach(data => {

            swarm[`daemon${data.index}`] =
                {
                    uuid: data.uuid,
                    port: data.content.listener_port,
                    http_port: data.content.http_port,
                    index: data.index
                }
        });

        return swarm
    },

    resetDaemonConfigCounter: () => {
        configCounter.reset();
    },

    editFile: ({filepath, changes, remove, deleteKey, push}) => {
        changes = {...changes};

        if (deleteKey) {
            deleteKey = [...deleteKey];
        }

        let fileContent;

        try {
            fileContent = JSON.parse(fs.readFileSync(`./daemon-build/output/${filepath}`, 'utf8'));
        } catch (e) {
            throw new Error('Read and parse as JSON failed.')
        }


        if (remove) {
            removeValues(fileContent, remove);
        } else if (deleteKey) {
            delKey(fileContent, deleteKey);
        } else if (push) {
            fileContent.push(push)
        } else {
            setValues(fileContent, changes);
        }

        try {
            fs.writeFileSync(`./daemon-build/output/${filepath}`, JSON.stringify(fileContent), 'utf8');
        } catch (e) {
            throw new Error('Writing changes failed.')
        }

        return fileContent
    }
};

module.exports = configUtils;

const createDirectories = (numOfDirectories) => {

    const BASE_DIR_NAME = 'daemon';

    const pathList = [];

    for (let i = 0; i < parseInt(numOfDirectories); i++) {

        const path = './daemon-build/output/' + BASE_DIR_NAME + i;
        pathList.push(path);

        try {
            fs.mkdirSync(path);
        } catch (err) {
            if (err.message.includes('EEXIST: file already exists')) {
                // do nothing
            } else {
                throw err;
            }
        }
    };

    pathList.map((path) => execSync(`cp ./daemon-build/output/swarm ${path}/swarm`));

    return pathList;
};



const configCounter = {
    counter: -1,
    increment() { return this.counter += 1 },
    reset() { this.counter = -1 }
};

function Config(keys, edits) {
    Object.entries(keys).forEach((key) => this[key[0]] = key[1]);

    if (edits) {
        Object.entries(edits).forEach(key => this[key[0]] = key[1])
    }
};

const buildConfigsObject = (template, _numOfConfigsToGenerate, pubKeysList) => {
    /*
    * Returns an array of objects containing daemon configs written to file and the index of each daemon and its pubKey
      [{ content:
           Config {
             listener_address: '127.0.0.1',
             listener_port: 50000,
             http_port: 8080,
             ethereum: '0xddbd2b932c763ba5b1b7ae3b362eac3e8d40121a',
             ethereum_io_api_token: '*****************************',
             ...
           },
         index: 0,
         pubKey: MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEyHNTEuErBs02qMIf42G77TF7g7tYoylcw79gUqNRBHixoulWwZ6o0f2n8ynhLZn5zel9UWpCJ1EVqDjTVQ/WDA==},
       { content:
           Config {
             ...
           },
         index: 1,
         pubKey: ...},
       {...}]
     */

    return [...Array(_numOfConfigsToGenerate).keys()].map((internalIndex) => {

        let currentIndex = configCounter.increment();

        return {
            content: new Config(template,
                {
                    listener_port: template.listener_port + currentIndex,
                    http_port: template.http_port + currentIndex
                }),
            index: currentIndex,
            uuid: pubKeysList[internalIndex]
        }
    });
};

const writeConfigsToFile = (configsObject, pathList) => Promise.all(configsObject.map((obj, idx) =>
    fsPromises.writeFile(`${pathList[idx]}/bluzelle${obj.index}.json`, JSON.stringify(obj.content))));

const writePeersListToFile = (peers, pathList,) => Promise.all(pathList.map((path) =>
    fsPromises.writeFile(`${path}/peers.json`, JSON.stringify(peers))));

const readTemplate = path => JSON.parse(fs.readFileSync(path).toString());

const setValues = (fileContent, changes) => {

    // if editing an array like peers list file, pass in an index value to target changes

    for (let key in changes) {

        if (key === 'index') {
            continue;
        }

        if (changes.index || changes.index === 0) {

            fileContent[changes.index][key] = changes[key]
        } else {

            fileContent[key] = changes[key]
        }

    }
};

const removeValues = (fileContent, remove) =>
    fileContent.splice(remove.index, 1);

const delKey = (fileContent, deleteKey) =>
    Object.values(deleteKey).forEach(key =>
        delete fileContent[key]);
