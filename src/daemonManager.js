const {times, invoke, pipe, curry, pick, last, take, find} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');
const {spawn} = require('child_process');
const {resolve: resolvePath} = require('path');
const pRetry = require('p-retry');
const daemonConstants = require('../resources/daemonConstants');
const swarmRegistry = require('./swarmRegistryAdapter');
const {useState} = require('./utils');

exports.generateSwarm = async ({esrContractAddress, esrInstance, numberOfDaemons, swarmCounter, daemonCounter}) => {
    const [getDaemonConfigs, setDaemonConfigs] = useState();
    const [getDaemons, setDaemons] = useState();
    const [getPrimary, setPrimary] = useState();
    const [getPeersList, setPeersList] = useState();
    const swarmId = `swarm${swarmCounter()}`;

    setDaemonConfigs(times(() => generateSwarmConfig({esrContractAddress, swarmId, daemonCounter}), numberOfDaemons));
    setPeersList(generatePeersList(getDaemonConfigs()));
    writePeersList(swarmId, getDaemonConfigs(), getPeersList());
    getDaemonConfigs().forEach(daemonConfig => copyDaemonBinary(swarmId, daemonConfig));
    setDaemons(getDaemonConfigs().map(daemonConfig => generateDaemon(swarmId, daemonConfig)));

    await swarmRegistry.addSwarm(wrapPeersObject(), esrInstance);

    return {
        start: () => Promise.all(getDaemons().map(invoke('start'))),
        stop: () => Promise.all(getDaemons().map(invoke('stop'))),
        startPartial: (numberOfDaemonsToStart) =>
            Promise.all(take(numberOfDaemonsToStart, getDaemons())
                .map(invoke('start'))
            ),
        startUnstarted: () =>
            Promise.all(getDaemons()
                .filter(isNotRunning)
                .map(invoke('start'))
            ),
        addDaemon: generateAndSetNewDaemon,
        getSwarmId: () => swarmId,
        getDaemons,
        getPrimary,
        setPrimary: (publicKey) => setPrimary(find(daemon => daemon.publicKey === publicKey, getDaemons())),
        getPeersList
    };

    function wrapPeersObject() {
        return {swarm_id: swarmId, peers: getPeersList()}
    };

    function generateAndSetNewDaemon() {
        setDaemonConfigs([...getDaemonConfigs(), generateSwarmConfig({esrContractAddress, swarmId, daemonCounter})]);
        writePeersList(swarmId, [last(getDaemonConfigs())], getPeersList());
        setDaemons([...getDaemons(), generateDaemon(swarmId, last(getDaemonConfigs()))]);
        copyDaemonBinary(swarmId, last(getDaemonConfigs()));
    };

    function isNotRunning(daemon) { return !daemon.isRunning() };
};

const generateDaemon = (swarmId, daemonConfig) => {
    const [isRunning, setRunning] = useState(false);
    const [getDaemonProcess, setDaemonProcess] = useState();

    return {
        ...daemonConfig,
        isRunning,
        start: async () => await spawnDaemon(),
        stop: stopDaemon,
        restart: async () => {
            await stopDaemon();
            await spawnDaemon();
        },
        getProcess: getDaemonProcess
    };

    async function stopDaemon() {
        invoke('kill', getDaemonProcess());
        setDaemonProcess(undefined);
        await waitForDaemonToDie();
    }

    function waitForDaemonToDie() {
        return new Promise(resolve => {
            (function waiter() {
                isRunning() === true ? setTimeout(waiter, 100) : resolve();
            }())
        });
    }

    async function spawnDaemon() {

        setDaemonProcess(spawn('./swarm', ['-c', `bluzelle-${daemonConfig.listener_port}.json`], {cwd: getDaemonOutputDir(swarmId, daemonConfig)}));

        await pRetry(async () => {
            await new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error(`Daemon-${daemonConfig.listener_port} failed to start in ${harnessConfigs.daemonStartTimeout}ms.`)), harnessConfigs.daemonStartTimeout);

                getDaemonProcess().stdout.on('data', (buf) => {
                    const out = buf.toString();
                    out.includes(daemonConstants.startSuccessful) && (setRunning(true) && resolve());
                });
            });
        }, {
            onFailedAttempt: err => {
                invoke('kill', getDaemonProcess());
                console.log(`${err.message} Attempt ${err.attemptNumber} failed, ${err.retriesLeft} retries left.`)
            },
            retries: 3
        });


        getDaemonProcess().on('close', (code) => {
            setRunning(false);
            if (code !== 0) {
                console.log(`Daemon-${daemonConfig.listener_port} exited with ${code}`)
            }
        });

        return getDaemonProcess;
    }
};


const copyDaemonBinary = (swarmId, daemonConfig) => copyToDaemonDir(swarmId, daemonConfig, resolvePath(__dirname, '../daemon-build/swarm'), 'swarm').run();

const generateSwarmConfig = ({esrContractAddress, swarmId, daemonCounter}) => {
    const currentDaemonCount = daemonCounter();

    return pipe(
        () => writeDaemonConfigObject({
            listener_port: harnessConfigs.initialDaemonListenerPort + currentDaemonCount,
            http_port: harnessConfigs.initialDaemonHttpPort + currentDaemonCount,
            swarm_id: swarmId,
            swarm_info_esr_address: esrContractAddress
        }, swarmId),

        daemonConfig => ({
            ...daemonConfig,
            publicKey: generateKeys(getDaemonOutputDir(swarmId, daemonConfig))[0]
        })
    )()
};

const generatePeersList = (daemonConfigs) => {
    return daemonConfigs.map(config => ({
        name: `daemon${config.listener_port}`,
        host: '127.0.0.1',
        port: config.listener_port,
        http_port: config.http_port,
        uuid: config.publicKey
    }));
};

const writePeersList = (swarmId, daemonConfigs, peersList) => {
    daemonConfigs.forEach(daemonConfig => writeDaemonFile(daemonConfig, swarmId, 'peers.json', peersList).run());
};

const writeDaemonConfigObject = (config, swarmId) => {
    getDaemonConfigTemplate()
        .map(createDaemonConfigObject(config))
        .flatMap(writeDaemonFile(config, swarmId, `bluzelle-${config.listener_port}.json`))
        .run();
    return config;
};

const createDaemonConfigObject = curry(({listener_port, http_port, swarm_info_esr_address, swarm_id}, template) => ({
    ...template,
    listener_port,
    http_port,
    swarm_info_esr_address: swarm_info_esr_address.substr(2), // swarmDB option does not accept 0x prepended address
    swarm_id
}));

const getDaemonConfigTemplate = () => IO.of(require('../resources/config-template'));
