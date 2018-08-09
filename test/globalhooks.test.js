const {execSync} = require('child_process');

beforeEach('reset config files', () => {
    execSync('cp -R ./configs/. ./daemon-build/output/')
});
