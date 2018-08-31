const fs = require('fs');
const fsPromises = require('fs').promises;

const uuids = require('./uuids');

module.exports = {
    editFile: ({filename, changes, remove, deleteKey}) => {
        changes = {...changes};

        if (deleteKey) {
            deleteKey = [...deleteKey];
        }

        let fileContent = JSON.parse(fs.readFileSync(`./daemon-build/output/${filename}`, 'utf8'));

        if (remove) {
            removeValues(fileContent, remove);
        } else if (deleteKey) {
            delKey(fileContent, deleteKey);
        } else {
            setValues(fileContent, changes);
        }

        fs.writeFileSync(`./daemon-build/output/${filename}`, JSON.stringify(fileContent), 'utf8');

        return fileContent
    },

    generateConfigs: async (numOfConfigs) => {

        const template = readTemplate('./configs/template.json');

        let configsWithIndex = [...Array(numOfConfigs).keys()].map(() => {
            let currentIndex = configCounter();

            if (currentIndex > uuids.length - 1) {
                throw new Error('Ran out of UUIDs to generate configs with')
            }

            return {
                content: new Config(template,
                    {
                        listener_port: template.listener_port + currentIndex,
                        http_port: template.http_port + currentIndex,
                        uuid: uuids[currentIndex]
                    }),
                index: currentIndex
            }
        });

        await Promise.all(configsWithIndex.map((obj) =>
            fsPromises.writeFile(`./daemon-build/output/bluzelle${obj.index}.json`, JSON.stringify(obj.content))));
    }
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
