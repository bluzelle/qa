const fs = require('fs');

module.exports = {
    editConfigFile: (fileName, index, value) => {

        let contents = fs.readFileSync(`./daemon-build/output/${fileName}`, 'utf8').split(',');

        contents[index] = value;

        fs.writeFileSync(`./daemon-build/output/${fileName}`, contents, 'utf8');
    }
};
