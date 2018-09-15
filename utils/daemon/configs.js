const fs = require('fs');
const fsPromises = require('fs').promises;

const uuids = require('./uuids');

let swarm = {};

const configUtils = {
    editFile: ({filename, changes, remove, deleteKey}) => {
        changes = {...changes};

        if (deleteKey) {
            deleteKey = [...deleteKey];
        }

        let fileContent;

        try {
            fileContent = JSON.parse(fs.readFileSync(`./daemon-build/output/${filename}`, 'utf8'));
        } catch (e) {
            throw new Error('Read and parse as JSON failed.')
        }


        if (remove) {
            removeValues(fileContent, remove);
        } else if (deleteKey) {
            delKey(fileContent, deleteKey);
        } else {
            setValues(fileContent, changes);
        }

        try {
            fs.writeFileSync(`./daemon-build/output/${filename}`, JSON.stringify(fileContent), 'utf8');
        } catch (e) {
            throw new Error('Writing changes failed.')
        }

        return fileContent
    },

    generateJsonsAndSetState: async (numOfConfigs) => {

        const configsWithIndex = await generateConfigs(numOfConfigs);

        setSwarmData(configsWithIndex);

        const peersList = generatePeersList();

        return [swarm, peersList]
    },

    getSwarmObj: () => swarm,

    clearSwarmObj: () => {

        swarm = {};
    }
};

module.exports = configUtils;


const setSwarmData = (configsWithIndex) => {

    configsWithIndex.forEach(data => {

        swarm[`daemon${data.index}`] =
            {
                uuid: data.content.uuid,
                port: data.content.listener_port,
                http_port: data.content.http_port,
                index: data.index
            }
    });
};

const generateConfigs = async (numOfConfigs) => {

    const template = readTemplate('./configs/template.json');

    let uuidsList = uuids.generate(numOfConfigs);

    let configsWithIndex = [...Array(numOfConfigs).keys()].map(() => {

        let currentIndex = configCounter();

        return {
            content: new Config(template,
                {
                    listener_port: template.listener_port + currentIndex,
                    http_port: template.http_port + currentIndex,
                    uuid: uuidsList[currentIndex]
                }),
            index: currentIndex
        }
    });

    await Promise.all(configsWithIndex.map((obj) =>
        fsPromises.writeFile(`./daemon-build/output/bluzelle${obj.index}.json`, JSON.stringify(obj.content))));

    return Promise.resolve(configsWithIndex);
};

const generatePeersList = () => {

    let peers = [];

    Object.keys(swarm).forEach(daemon => peers.push(
        {
            name: daemon,
            host: '127.0.0.1',
            port: swarm[daemon].port,
            uuid: swarm[daemon].uuid,
            http_port: swarm[daemon].http_port
        }));

    try {
        fs.writeFileSync(`./daemon-build/output/peers.json`, JSON.stringify(peers), 'utf8');
    } catch (e) {
        throw new Error('Peers list write failed.')
    }

    return peers
};

const configCounter = (() => {
    let counter = -1;
    return () => counter += 1;
})();

function Config(keys, edits) {
    Object.entries(keys).forEach((key) => this[key[0]] = key[1]);

    if (edits) {
        Object.entries(edits).forEach(key => this[key[0]] = key[1])
    }
};

const readTemplate = path => JSON.parse(fs.readFileSync(path).toString());

const setValues = (fileContent, changes) => {
    for (let key in changes) {

        if (key === 'index') {
            continue;
        }

        if (changes.index || changes.index === 0) {

            fileContent[changes.index][key] = changes[key]
        }

        fileContent[key] = changes[key]
    }
};

const removeValues = (fileContent, remove) =>
    fileContent.splice(remove.index, 1);

const delKey = (fileContent, deleteKey) =>
    Object.values(deleteKey).forEach(key =>
        delete fileContent[key]);
