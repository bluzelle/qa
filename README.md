# Javascript QA for SwarmDB

## Quick Start

1. Clone repo
2. Install dependencies, initialize and update submodules, and compile `bluzelle-js` client code
```javascript
$ yarn
$ yarn setup-bluzelle-js
$ yarn link-daemon <relative/path/to/daemon/build/directory>
// run yarn link-daemon for more detailed instructions
```

## System Requirements
- Node > v10.10.0
- OpenSSL > 1.0.2 or LibreSSL > 2.2.7 *required for `peer_validation_enabled`*
- Stable internet connection > 15 Mbps down
