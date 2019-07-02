const {localTeardown, localSetup, remoteSetup} = require('../tests/shared/hooks');
const {generateString} = require('../src/utils');
require('../tests/test.configurations');

const RECORDS = process.env.PROFILE_RECORDS || 100;
const SIZE = process.env.PROFILE_SIZE || 50 * 1024; // bytes
const TIMEOUT = process.env.PROFILE_TIMEOUT || 60000;

(async (numberOfDaemons) => {

    numberOfDaemons = isInt(numberOfDaemons) && numberOfDaemons >= 2 ? numberOfDaemons : harnessConfigs.numOfNodes;

    const LOCAL_MESSAGE = `local swarm with ${numberOfDaemons} nodes.`;
    const REMOTE_MESSAGE = `remote swarm at ${harnessConfigs.ethereumRpc} ${harnessConfigs.esrContractAddress}`;

    console.log(`Running calibration with ${harnessConfigs.testRemoteSwarm ? REMOTE_MESSAGE : LOCAL_MESSAGE}`);

    const times = [];

    if (harnessConfigs.testRemoteSwarm) {
        console.log('Connecting client to remote swarm');
        this.api = await remoteSetup();
        console.log('Connected');
    } else {
        console.log('Connecting client to local swarm');
        const {manager: _manager, api: _api} = await localSetup({numOfNodes: numberOfDaemons, log: true, logDetailed: true});
        this.swarmManager = _manager;
        this.api = _api;
        console.log('Connected');
    }

    const boundCreate = this.api.create.bind(this.api);
    const boundRead = this.api.read.bind(this.api);
    const boundUpdate = this.api.update.bind(this.api);
    const boundDelete = this.api.delete.bind(this.api);

    // create
    console.log('Profiling creates');
    for (let i = 0; i < RECORDS; i++) {
        const timeElapsed = await profile(boundCreate, `${Math.random()}`, generateString(SIZE));
        times.push(timeElapsed);
    }

    // read
    console.log('Profiling reads');
    const randomKeyBaseRead = `${Math.random()}`;
    await this.api.create(randomKeyBaseRead, 'world').timeout(TIMEOUT);

    for (let i = 0; i < RECORDS; i++) {
        const timeElapsed = await profile(boundRead, randomKeyBaseRead);
        times.push(timeElapsed);
    }

    // update
    console.log('Profiling updates');
    const randomKey = `${Math.random()}`;
    await this.api.create(randomKey, 'world').timeout(TIMEOUT);
    for (let i = 0; i < RECORDS; i++) {
        const timeElapsed = await profile(boundUpdate, randomKey, generateString(SIZE));
        times.push(timeElapsed);
    }

    // delete
    console.log('Profiling deletes');
    const randomKeyBaseDelete = `${Math.random()}`;

    for (let i = 0; i < RECORDS; i++) {
        await this.api.create(`${randomKeyBaseDelete}-${i}`, generateString(SIZE)).timeout(TIMEOUT);
    }

    for (let i = 0; i < RECORDS; i++) {
        const timeElapsed = await profile(boundDelete, `${randomKeyBaseDelete}-${i}`);
        times.push(timeElapsed);
    }

    if (harnessConfigs.testRemoteSwarm) {

    } else {
        await localTeardown.call(this);
    }
    const average = calculateAverage(times);
    console.log(`Average operation time ${average}`);
    console.log(average) || process.exit(0);


})(process.argv[2] || 'default').catch(err => {
    console.error(err);
    process.exit(1);
});

async function profile(fn, ...args) {
    const startTime = Date.now();
    await fn(...args).timeout(TIMEOUT);
    const endTime = Date.now();
    const timeElapsed = endTime - startTime;
    return timeElapsed;
}

function calculateAverage(arr) {
    return arr.reduce((sum, value) => sum += value, 0) / arr.length;
};

function isInt(value) {
    return !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10));
};
