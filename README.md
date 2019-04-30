# Javascript QA for SwarmDB

## Quick Start

1. Clone repo.
2. Install dependencies, initialize and update submodules, and compile `bluzelle-js` client code.
3. Run tests.
```javascript
$ npm install
$ npm run setup-bluzelle-js
$ npm run link-daemon <relative/path/to/swarmDB/binary>
// run npm run link-daemon for more detailed instructions
$ npm run test

```

## System Requirements
- Node > v10.10.0
- OpenSSL > 1.0.2 or LibreSSL > 2.2.7
- Stable internet connection > 15 Mbps down
