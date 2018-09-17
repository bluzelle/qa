const fs = require('fs');

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
    }
};

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
