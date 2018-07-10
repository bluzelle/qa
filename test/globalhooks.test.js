const {execSync} = require('child_process');

beforeEach('reset config files', async () => {
    await execSync('cp -R ./configs/. ./daemon-build/output/')
});
