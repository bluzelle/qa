const {execSync} = require('child_process');
const fs = require('fs');
const {pipe, invoke} = require('lodash/fp');

exports.generateKeys = (path) => {

    try {
        execSync(`openssl ecparam -name secp256k1 -genkey -noout -out ${path}/private-key.pem`);
        execSync(`openssl ec -in ${path}/private-key.pem -pubout -out ${path}/public-key.pem > /dev/null 2>&1`);
    } catch (err) {
        throw new Error(`Error generating Daemon keys \n${err}`)
    }

    const getKey = pipe(
        type => `${path}/${type}-key.pem`,
        fs.readFileSync,
        invoke('toString'),
        stripHeaderAndFooter
    );

    return [getKey('public'), getKey('private')];
};

const stripHeaderAndFooter = (str) => str.split('\n').filter((line) => !line.includes('-----')).join('');
