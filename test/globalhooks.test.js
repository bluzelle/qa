const {generateJsonsAndSetState, clearSwarmObj} = require('../utils/daemon/configs');
const {clearConfigs} = require('../utils/daemon/setup');

before('generate configs', async () => {
    await generateJsonsAndSetState(4)
});

after('clear jsons and swarmObj', () => {
    clearConfigs();
    clearSwarmObj();
});
