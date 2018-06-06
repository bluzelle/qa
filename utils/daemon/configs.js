const fs = require('fs');

let originalContents;

module.exports = {
    editConfigFile: (fileName, index, value) => {

        let contents = fs.readFileSync(`./daemon-build/output/${fileName}`, 'utf8').split(',');

        originalContents = contents.slice();

        contents[index] = value;

        fs.writeFileSync(`./daemon-build/output/${fileName}`, contents, 'utf8');
    },
    spliceConfigFile: (fileName, index, value) => {

        let contents = fs.readFileSync(`./daemon-build/output/${fileName}`, 'utf8').split(',');

        originalContents = contents.slice();

        contents.splice(index, 0, value);

        fs.writeFileSync(`./daemon-build/output/${fileName}`, contents, 'utf8');

    },
    resetConfigFile: (fileName) =>
        fs.writeFileSync(`./daemon-build/output/${fileName}`, originalContents, 'utf8')
};
