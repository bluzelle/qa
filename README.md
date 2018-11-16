# Javascript QA for SwarmDB

## Quick Start

1. Clone repo
2. Install dependencies, initialize and update submodules, and compile `bluzelle-js` client code
```javascript
$ yarn
$ yarn setup-bluzelle-js
$ yarn link-daemon <path/to/daemon/build/directory>
```

##### Raft security testing:
To test `peer_validation_enabled` configuration on the daemon. Bluzelle's private-key and accompanying password is required 

Configure the following:
* qa/test.configurations.js: `sign_uuid: true`
* qa/test.configurations.js: `pathToKeyFile: './path/to/key/file/.pem'` 
* and set the password to that .pem file as an env variable: PRIVATE_KEY_PASSWORD

## System Requirements
- Node > v10.10.0
- OpenSSL > 1.0.2 or LibreSSL > 2.2.7 *required for `peer_validation_enabled`*
- Stable internet connection > 15 Mbps down
