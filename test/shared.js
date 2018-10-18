const {expect} = require('chai');
const {spawn} = require('child_process');
const {BluzelleClient} = require('../bluzelle-js/lib/bluzelle-node');


exports.swarmIsOperational = clientsObj => {

    it('should be able to create', async () => {

        await clientsObj.api.create('key', '123');
    });

    it('should be able to read', async () => {

        await clientsObj.api.create('key', 'abc');

        expect(await clientsObj.api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        await clientsObj.api.create('key', '123');

        await clientsObj.api.update('key', 'abc');

        expect(await clientsObj.api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        await clientsObj.api.create('key', '123');

        await clientsObj.api.remove('key');

        expect(await clientsObj.api.has('key')).to.be.false;
    })
};

exports.createShouldTimeout = clientsObj => {

    it('create should timeout at api level', done => {

        clientsObj.api.create('key', '123')
            .then(() => {
                throw new Error('Create was successful, expected to fail.')
            })
            .catch(e => {
                if (e.message.toString().includes('Timed out after waiting for 5000ms')) {
                    done();
                }
            })
    });
};

exports.daemonShouldSync = (cfgIndexObj, numOfKeys) => {

    let newPeer, api;

    beforeEach('start daemon', () => new Promise((res) => {
        newPeer = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `bluzelle${cfgIndexObj.index}.json`], {cwd: './scripts'})
        newPeer.stdout.on('data', (data) => {
            if (data.toString().includes('Received WS message:')) {
                res();
            }
        });
    }));

    beforeEach('initialize client', () => {

        api = new BluzelleClient(
            `ws://${process.env.address}:${50000 + parseInt(cfgIndexObj.index)}`,
            '71e2cd35-b606-41e6-bb08-f20de30df76c',
            false
        );
    });

    beforeEach('connect client', async () =>
        await api.connect());

    it('should sync and return full keylist', async () => new Promise((res, rej) => {

        const startTime = new Date();

        const timeId = setInterval(() => {
            let timeElapsed = () => (new Date) - startTime;

            api.keys().then((keys) => {

                if (keys.length === numOfKeys) {
                    clearInterval(timeId);
                    res();
                } else if (timeElapsed() >= 6000){
                    rej(new Error(`Daemon returned ${keys.length}, expected ${numOfKeys} keys`))
                }
            })
        }, 500);

    }));
};
