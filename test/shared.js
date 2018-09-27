const {expect} = require('chai');
const {spawn} = require('child_process');


exports.swarmIsOperational = api => {

    it('should be able to create', async () => {

        await api.create('key', '123');
    });

    it('should be able to read', async () => {

        await api.create('key', 'abc');

        expect(await api.read('key')).to.be.equal('abc');
    });

    it('should be able to update', async () => {

        await api.create('key', '123');

        await api.update('key', 'abc');

        expect(await api.read('key')).to.equal('abc');

    });

    it('should be able to delete', async () => {

        await api.create('key', '123');

        await api.remove('key');

        expect(await api.has('key')).to.be.false;
    })
};

exports.createShouldTimeout = api => {

    it('create should timeout at api level', done => {

        api.create('key', '123')
            .then(() => {
                throw new Error('Create was successful, expected to fail.')
            })
            .catch(e => {
                expect(e.message.toString()).to.include('Timed out after waiting for 5000ms');
                done();
            })
    });
};

exports.daemonShouldSync = (api, cfgName, numOfKeys) => {

    let newPeer;

    beforeEach('disconnect api', api.disconnect);

    beforeEach('start daemon', () => new Promise((res) => {
        newPeer = spawn('script', ['-q', '/dev/null', './run-daemon.sh', `${cfgName}.json`], {cwd: './scripts'})
        newPeer.stdout.on('data', (data) => {
            if (data.toString().includes('Received WS message:')) {
                res();
            }
        });
    }));

    beforeEach('connect to specific daemon', async () =>
        await api.connect(`ws://${process.env.address}:50002`, '71e2cd35-b606-41e6-bb08-f20de30df76c'));

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
