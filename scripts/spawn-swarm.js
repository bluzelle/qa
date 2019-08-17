const {swarmManager} = require('../src/swarmManager');
require('../tests/test.configurations');

(async () => {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: process.argv[2] || harnessConfigs.numOfNodes});
    console.log(`Deployed ESR Contract to: ${manager.getEsrContractAddress()}`);
    await manager.startAll();
    console.log('Swarm started')

})().catch(err => console.trace(err));
