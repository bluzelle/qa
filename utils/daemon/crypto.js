const {exec} = require('child_process');
const fs = require('fs');

exports.addSignaturesToConfigObject = async (configsObject) => {

    let signatures = await Promise.all(configsObject.map((obj) => generateSignature(obj.content.uuid)));

    signatures = signatures.map((str) => removeNewLineChar(str));

    return signatures.reduce((acc, curr, idx) => {
        acc[idx].content['signed_key'] = curr;
        return acc;
    }, configsObject);
};

const generateSignature = (uuid) => new Promise((resolve, reject) => {

    /*
    * Signs uuid with system installed openssl/libressl using sha256 and loaded private.pem and accompanying password.
    * @params {uuid} String. UUID to be signed.
    * @resolves with base64 encoded signature
    * */

    if (!process.env.PRIVATE_KEY_PASSWORD) {
        reject(new Error('env PRIVATE_KEY_PASSWORD not set'))
    }

    if (!fs.existsSync(harnessConfigs.pathToKeyFile)) {
        reject(new Error('Private key not found, please configure path in test.configurations.js'))
    }

    exec(`echo '${uuid}' | openssl dgst -sha256 -sign ${harnessConfigs.pathToKeyFile} -passin pass:${process.env.PRIVATE_KEY_PASSWORD} | openssl base64`, (err, stdout, stderr) => {
        if (err) {
            reject(err)
        }
        if (stderr) {
            reject(new Error(stderr))
        }
        if (stdout.includes('Error')) {
            reject(new Error(stdout))
        }
        resolve(stdout)
    });
});

const removeNewLineChar = (str) => str.replace(/\r?\n|\r/g, '');
