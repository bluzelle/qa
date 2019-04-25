const {times, invoke, pipe, curry, pick, last, take} = require('lodash/fp');
const {writeDaemonFile, writeJsonFile, removeDaemonDirectory, getDaemonOutputDir, copyToDaemonDir} = require('./FileService');
const {generateKeys} = require('./crypto');
const {IO} = require('monet');
const {spawn} = require('child_process');
const {resolve: resolvePath} = require('path');

exports.generateSwarm = ({numberOfDaemons}) => {
    const [getDaemonConfigs, setDaemonConfigs] = useState();
    const [getDaemons, setDaemons] = useState();
    const daemonCounter = counter({start: numberOfDaemons});
    setDaemonConfigs(generateSwarmConfig({numberOfDaemons}));
    const peersList = generatePeersList(getDaemonConfigs());

    writePeersList(getDaemonConfigs(), peersList);
    getDaemonConfigs().forEach(copyDaemonBinary);
    setDaemons(getDaemonConfigs().map(generateDaemon));

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
        removeSwarmState: () => removeDaemonDirectory().run(),
        getDaemons: getDaemons
    };

    function generateAndSetNewDaemon() {
        setDaemonConfigs([...getDaemonConfigs(), ...generateSwarmConfig({
            numberOfDaemons: 1,
            nextConfigCount: daemonCounter()
        })]);

        writePeersList([last(getDaemonConfigs())], peersList);
        setDaemons([...getDaemons(), generateDaemon(last(getDaemonConfigs()))]);
        copyDaemonBinary(last(getDaemonConfigs()));
    };

    function isNotRunning(daemon) { return !daemon.isRunning() };
};

const generateDaemon = daemonConfig => {
    const [isRunning, setRunning] = useState(false);
    const [getDaemon, setDaemon] = useState();

    return {
        ...daemonConfig,
        isRunning,
        start: async () => await spawnDaemon(),
        stop: stopDaemon,
        restart: async () => {
            await stopDaemon();
            await spawnDaemon();
        }
    };

    async function stopDaemon() {
        invoke('kill', getDaemon());
        setDaemon(undefined);
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
        setDaemon(spawn('./swarm', ['-c', `bluzelle-${daemonConfig.listener_port}.json`], {cwd: getDaemonOutputDir(daemonConfig)}));

        await new Promise(resolve => {
            getDaemon().stdout.on('data', (buf) => {
                const out = buf.toString();
                out.includes('Running node with ID') && (setRunning(true) && resolve());
            });
        });

        getDaemon().on('close', (code) => {
            setRunning(false);
            if (code !== 0) {
                console.log(`Daemon-${daemonConfig.listener_port} exited with ${code}`)
            }
        });
    }
};

const useState = (initialValue) => {
    let value = initialValue;
    return [
        () => value,
        (newValue) => value = newValue
    ]
};

const copyDaemonBinary = (daemonConfig) => copyToDaemonDir(daemonConfig, resolvePath(__dirname, '../daemon-build/output/swarm'), 'swarm').run();

const generateSwarmConfig = ({numberOfDaemons, nextConfigCount = 0}) => {
    const assignListenerPort = counter({start: 50000 + nextConfigCount});
    const assignHttpPort = counter({start: 8080 + nextConfigCount});

    const daemonConfigs = times(pipe(
        () => writeDaemonConfigObject({
            listener_port: assignListenerPort(),
            http_port: assignHttpPort()
        }),

        daemonConfig => ({
            ...daemonConfig,
            publicKey: generateKeys(getDaemonOutputDir(daemonConfig))[0]
        })
    ), numberOfDaemons);

    return daemonConfigs;
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

const writePeersList = (daemonConfigs, peersList) => {
    daemonConfigs.forEach(daemonConfig => writeDaemonFile(daemonConfig, 'peers.json', peersList).run());
};

const writeDaemonConfigObject = (config) => {
    getDaemonConfigTemplate()
        .map(createDaemonConfigObject(config))
        .flatMap(writeDaemonFile(config, `bluzelle-${config.listener_port}.json`))
        .run();
    return config;
};

const createDaemonConfigObject = curry(({listener_port, http_port}, template) => ({
    ...template,
    listener_port,
    http_port
}));

const getDaemonConfigTemplate = () => IO.of(require('./config-template'));

const counter = ({start, step = 1}) => {
    let count = start - 1;
    return () => count += step
};
