const {times, invoke, pipe, curry, pick, last, take, find} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');
const {spawn} = require('child_process');
const {resolve: resolvePath} = require('path');
const daemonConstants = require('../resources/daemonConstants');
const swarmRegistry = require('./swarmRegistryAdapter');
const {useState, wrappedError} = require('./utils');
const {log} = require('./logger');
const split2 = require('split2');

exports.generateSwarm = async ({esrContractAddress, esrInstance, numberOfDaemons, swarmCounter, daemonCounter, configOptions = {}}) => {
    const [getDaemonConfigs, setDaemonConfigs] = useState();
    const [getDaemons, setDaemons] = useState();
    const [getPrimary, setPrimary] = useState();
    const [getPeersList, setPeersList] = useState();
    const [getConfigOptions, setConfigOptions] = useState();
    const swarmId = `swarm${swarmCounter()}`;

    setConfigOptions(configOptions);
    setDaemonConfigs(times(() => generateSwarmConfig({esrContractAddress, swarmId, daemonCounter, configOptions}), numberOfDaemons));
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
        restart: () => Promise.all(getDaemons().map(invoke('restart'))),
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
        const newNode = generateSwarmConfig({esrContractAddress, swarmId, daemonCounter, configOptions: getConfigOptions()});
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

        log.info(`Daemon ${daemonConfig.listener_port} started with PID ${getDaemonProcess().pid}`);

        getDaemonProcess().on('error', (err) => {
            log.crit(`Process error with daemon-${daemonConfig.listener_port}: ${err}`);
            throw err;
        });

        getDaemonProcess().stderr
            .pipe(split2())
            .on('data', line => {
                if (line.includes('Warning:')) {
                    log.warn(`Daemon stderr ${line}`);
                } else {
                    log.crit(`Daemon stderr ${line}`);
                }
            });

        getDaemonProcess().on('exit', (code, sgnl) => {
            setRunning(false);
            if (sgnl) {
                if (sgnl === "SIGTERM") {
                    log.warn(`Daemon-${daemonConfig.listener_port} terminated`);
                } else {
                    log.crit(`Daemon-${daemonConfig.listener_port} exited with signal "${sgnl}"`);
                }
            } else if (code !== 0) {
                log.crit(`Daemon-${daemonConfig.listener_port} exited with code "${code}"`);
            } else {
                log.info(`Daemon-${daemonConfig.listener_port} exited normally`);
            }
        });

        const startupTimeout = new Promise((_, reject) => {
            setTimeout(
                () => reject(new Error(`Daemon-${daemonConfig.listener_port} failed to start in ${harnessConfigs.daemonStartTimeout}ms.`)),
                harnessConfigs.daemonStartTimeout
            );
        });
        const startupSuccess = new Promise((resolve) => {
            getDaemonProcess().stdout
                .pipe(split2())
                .on('data', line => {
                    line.includes(daemonConstants.startSuccessful) && (setRunning(true) && resolve());
                });
        });

        await Promise.race([startupSuccess, startupTimeout])
            .catch(err => {
                getDaemonProcess().kill();
                throw err;
            });

        return getDaemonProcess;
    }
};


const copyDaemonBinary = (swarmId, daemonConfig) => copyToDaemonDir(swarmId, daemonConfig, resolvePath(__dirname, '../daemon-build/swarm'), 'swarm').run();

const generateSwarmConfig = ({esrContractAddress, swarmId, daemonCounter, configOptions}) => {

    return pipe(
        () => writeDaemonConfigObject({
            listener_port: harnessConfigs.initialDaemonListenerPort,
            swarm_id: swarmId,
            swarm_info_esr_address: esrContractAddress
        }, swarmId, daemonCounter, configOptions),

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

const writeDaemonConfigObject = (baseConfig, swarmId, daemonCounter, options) => {
    const currentDaemonCount = daemonCounter();

    const config = getDaemonConfigTemplate()
        .map(createDaemonConfigObject(baseConfig))
        .map(overrideOptions(options))
        .map(config => {
            config.listener_port += currentDaemonCount;
            return config})
        .run();

    // responsible for creating swarmX and daemon-XXXXXX directories in path if they do not already exist
    writeDaemonFile(config, swarmId, `bluzelle-${config.listener_port}.json`, config).run();

    return config;
};

const createDaemonConfigObject = curry(({listener_port, swarm_info_esr_address, swarm_id}, template) => ({
    ...template,
    listener_port,
    swarm_info_esr_address,
    swarm_id
}));

const getDaemonConfigTemplate = () => IO.of(require('../resources/config-template'));

const overrideOptions = curry((options, template) => ({...template, ...options}));
