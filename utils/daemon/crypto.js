const {exec} = require('child_process');

exports.addSignaturesToConfigObject = async (configsWithIndex) => {

    let signatures = await Promise.all(configsWithIndex.map((obj) => generateSignature(obj.content.uuid)));

    signatures = signatures.map((str) => removeNewLineChar(str));

    return signatures.reduce((acc, curr, idx) => {
        acc[idx].content['signed_key'] = curr;
        return acc;
    }, configsWithIndex);
};

const generateSignature = (uuid) => new Promise((resolve, reject) => {

    exec(`echo '${uuid}' | openssl dgst -sha256 -sign ${harnessConfigs.pathToKeyFile} -passin pass:${process.env.privateKeyPassword} | openssl base64`, (err, stdout, stderr) => {
        if (err) {
            reject(err)
        }
        if (stderr) {
            reject(stderr)
        }
        if (stdout.includes('Error')) {
            reject(new Error(stdout))
        }
        resolve(stdout)
    });
});

const removeNewLineChar = (str) => str.replace(/\r?\n|\r/g, '');
