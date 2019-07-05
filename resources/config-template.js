module.exports = {
    "listener_address" : "127.0.0.1",
    "listener_port" : 50000,
    "stack" : "local-swarm",
    "bootstrap_file" : "./peers.json",
    "debug_logging" : true,
    "log_to_stdout" : true,
    "public_key_file" : "./public-key.pem",
    "private_key_file" : "./private-key.pem",
    "crypto_enabled_outgoing" : true,
    "crypto_enabled_incoming" : true,
    "chaos_testing_enabled" : false,
    "logfile_rotation_size" : "5MB",
    "logfile_max_size" : "20MB",
    "swarm_info_esr_url" : "http://127.0.0.1:8545"
};
