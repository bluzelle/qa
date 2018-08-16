# Javascript QA for SwarmDB

## Quick Start

1. Install dependencies. 

```javascript
$ yarn 
```

2. Init bluzelle-js submodule, update, and compile JS.
```javascript
$ yarn setup-bluzelle-js  
````

3. Update `daemon-build` symlink to point to your compiled Daemon's build directory

If your swarmDB and qa repos are under the same parent directory:
```bash

$ ln -s ../swarmDB/build/ daemon-build
```
