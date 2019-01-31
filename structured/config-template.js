
module.exports = {
    "listener_address" : "127.0.0.1",
    "listener_port" : 50000,
    "http_port" : 8080,
    "ethereum" : "0xddbd2b932c763ba5b1b7ae3b362eac3e8d40121a",
    "ethereum_io_api_token" : "*****************************",
    "bootstrap_file" : "./peers.json",
    "debug_logging" : true,
    "log_to_stdout" : true,
    "use_pbft" : true,
    "public_key_file" : "./public-key.pem",
    "private_key_file" : "./private-key.pem",
    "crypto_enabled_outgoing" : true,
    "crypto_enabled_incoming" : true,
    "chaos_testing_enabled" : false,
    "logfile_rotation_size" : "5MB",
    "logfile_max_size" : "20MB"
}