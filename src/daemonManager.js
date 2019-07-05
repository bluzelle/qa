const {times, invoke, pipe, curry, pick, last, take, find} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');
const {spawn} = require('child_process');
const {resolve: resolvePath} = require('path');
const pRetry = require('p-retry');
const daemonConstants = require('../resources/daemonConstants');
const swarmRegistry = require('./swarmRegistryAdapter');
const {useState, wrappedError} = require('./utils');
const {log} = require('./logger');
const split2 = require('split2');

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

    try {
        await swarmRegistry.addSwarm(wrapPeersObject(), esrInstance);
    } catch (err) {
        throw wrappedError(err, 'Failed to add swarm to ESR');
    }

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
        addDaemon: ({addToRegistry} = {}) => generateAndSetNewDaemon({addToRegistry}),
        getSwarmId: () => swarmId,
        getDaemons,
        getPrimary,
        setPrimary: (publicKey) => setPrimary(find(daemon => daemon.publicKey === publicKey, getDaemons())),
        getPeersList
    };

    function wrapPeersObject() {
        return {swarm_id: swarmId, peers: getPeersList()}
    };

    async function generateAndSetNewDaemon({addToRegistry}) {
        const newNode = generateSwarmConfig({esrContractAddress, swarmId, daemonCounter})
        setDaemonConfigs([...getDaemonConfigs(), newNode]);
        writePeersList(swarmId, [last(getDaemonConfigs())], getPeersList());
        setDaemons([...getDaemons(), generateDaemon(swarmId, last(getDaemonConfigs()))]);
        copyDaemonBinary(swarmId, last(getDaemonConfigs()));

        if (addToRegistry) {
            await swarmRegistry.addNode(convertPeerInfoForESR(newNode), esrInstance);
        }
    };

    function convertPeerInfoForESR(nodeSwarmConfig) {
        return {
            swarm_id: nodeSwarmConfig.swarm_id,
            host: '127.0.0.1',
            name: `nodeSwarmConfig-${nodeSwarmConfig.listener_port}`,
            port: nodeSwarmConfig.listener_port,
            uuid: nodeSwarmConfig.publicKey
        };
    }

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
        log.info(`Starting daemon ${daemonConfig.listener_port}`);

        setDaemonProcess(spawn('./swarm', ['-c', `bluzelle-${daemonConfig.listener_port}.json`], {cwd: getDaemonOutputDir(swarmId, daemonConfig)}));

        getDaemonProcess().stderr
            .pipe(split2())
            .on('data', line => {

            if (line.includes('Warning:')) {
                log.warn(`Daemon stderr ${line}`);
            } else {
                log.crit(`Daemon stderr ${line}`);
            }
        });

        await pRetry(async () => {
            await new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error(`Daemon-${daemonConfig.listener_port} failed to start in ${harnessConfigs.daemonStartTimeout}ms.`)), harnessConfigs.daemonStartTimeout);

                getDaemonProcess().stdout
                    .pipe(split2())
                    .on('data', line => {
                    line.includes(daemonConstants.startSuccessful) && (log.info(`Successfully started daemon ${daemonConfig.listener_port}`) || (setRunning(true) && resolve()));
                });
            });
        }, {
            onFailedAttempt: err => {
                invoke('kill', getDaemonProcess());
                log.warn(`${err.message} Attempt ${err.attemptNumber} failed, ${err.retriesLeft} retries left.`);
            },
            retries: 3
        });

        getDaemonProcess().on('close', (code) => {
            log.info(`Daemon ${daemonConfig.listener_port} stopped`);

            setRunning(false);
            if (code !== 0) {
                log.crit(`Daemon-${daemonConfig.listener_port} exited with ${code}`);
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

const createDaemonConfigObject = curry(({listener_port, swarm_info_esr_address, swarm_id}, template) => ({
    ...template,
    listener_port,
    swarm_info_esr_address: swarm_info_esr_address.substr(2), // swarmDB option does not accept 0x prepended address
    swarm_id
}));

const getDaemonConfigTemplate = () => IO.of(require('../resources/config-template'));
