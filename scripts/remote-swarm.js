const {swarmManager} = require('../src/swarmManager');
require('../tests/test.configurations');

(async () => {

    const manager = await swarmManager();
    const swarm = await manager.generateSwarm({numberOfDaemons: 4});

    console.log('Local "remote" swarm contract address: ', manager.getEsrContractAddress());
    await manager.startAll();
    console.log('Swarm started')

})()
    .catch(err => console.log(err))
