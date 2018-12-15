const {execSync} = require('child_process');
const fs = require('fs');

exports.generateKey = (path) => {

    if (path === undefined) {
        throw new Error('Provide path to directory')
    };

    try {
        execSync(`openssl ecparam -name secp256k1 -genkey -noout -out ${path}/private-key.pem`);
        execSync(`openssl ec -in ${path}/private-key.pem -pubout -out ${path}/public-key.pem > /dev/null 2>&1`);

        let pubKey = (fs.readFileSync(`${path}/public-key.pem`)).toString();

        pubKey = stripHeaderAndFooter(pubKey);

        return pubKey;
    } catch (err) {
        throw new Error(`Error generating Daemon keys \n${err}`)
    };
};

const stripHeaderAndFooter = (str) => str.split('\n').filter((line) => !line.includes('-----')).join('');
