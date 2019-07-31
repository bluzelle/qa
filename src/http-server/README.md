# HTTP Wrapper for JS Swarm Manager

REST API for managing swarms of Bluzelle nodes.

## API Endpoints

```
GET /api/routes/                                      // Show all routes
GET /api/swarms/                                      // Get swarms info
POST /api/swarms/?numberOfDaemons=                    // Generate new swarm
GET /api/swarms/start                                 // Start all daemons
GET /api/swarms/stop                                  // Stop all daemons
GET /api/swarms/removeState                           // Reset swarms states
```

#### Swarm specific

```
GET /api/swarms/:id/                                  // Get swarm info
GET /api/swarms/:id/start                             // Start specific swarm
GET /api/swarms/:id/stop                              // Stop specific swarm
// Add new daemon to swarmRegistry
GET /api/swarms/:id/addDaemon?addToRegistry=bool      // Add daemon to swarm, addToRegistry defaults to true

GET /api/swarms/:id/startPartial?numberOfDaemons=     // Start subset of daemons
GET /api/swarms/:id/startUnstarted                    // Start all unstarted daemons
GET /api/swarms/:id/primary                           // Get primary info
// Pass in public key or port number of node
PUT /api/swarms/:id/                                  // Set primary with identified with payload
{identifier: public key or port number}
GET /api/swarms/:id/streams?identifier=               // Retrieve stream of node stdout if exists
GET /api/swarms/:id/logs/                             // Packages logs and streams results
```
