# Javascript QA for SwarmDB

## Quick Start

1. Clone repo.
2. Install dependencies, initialize and update submodules, and compile `bluzelle-js` client code, and compile `bluzelleESR` solidity contract.
3. Run tests.
```
npm install
npm run setup-bluzelle-js
npm run setup-bluzelleESR
npm run link-daemon <relative/path/to/swarmDB/binary> // run npm run link-daemon for more detailed instructions
npm run deploy-ganache
npm test
```

### Remote swarm testing

```
# Set 3 environment variables:
TEST_REMOTE_SWARM=true
ETHEREUM_RPC=https://ropsten.infura.io
ESR_CONTRACT_ADDRESS=0xf039E760a4E97b1E50689ea6572DD74a46359aD9

# Now functional tests will be ran against the specified remote swarm
npm run test-functional
```

### Spawning a standalone swarm for "remote" testing
```
# defaults to numOfNodes set in test.configurations.js, can override with a positional argument
npm run spawn-swarm

# npm run spawn-swarm 5
```


### Network performance testing

The performance of the swarm can vary a lot depending on the host(s). A profiling script is used to test the average swarm response time. It can also be ran against a remote swarm. Follow instructions above.
```
# defaults to spin up 4 local nodes, can adjust number of nodes with an argument
npm run profile

# npm run profile 8  
```

### Test swarm speed and run tests

Automatically run the above profile script, and use the average latency to adjust the timing of the test timeouts by setting environment variable `KEY_CREATION_TIMEOUT_MULTIPLIER`. 
```
# defaults to run the whole test suite
npm run calibrate-and-run 
 
# npm run calibrate-and-run test-functional
# npm run calibrate-and-run test-integration
```

#### Debugging
Log levels can be set via environment variable

```
# info, warn, crit
LOG_LEVEL=info
```

## System Requirements
- Node > v10.10.0
- OpenSSL > 1.0.2 or LibreSSL > 2.2.7
- Stable internet connection > 15 Mbps down
