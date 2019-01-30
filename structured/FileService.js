const {outputJsonSync, readJsonSync} = require('fs-extra');
const {resolve: resolvePath} = require('path');
const {IO} = require('monet');
const {curry} = require('lodash/fp');

exports.writeDaemonFile = curry((daemon, filename, data) =>
    IO(() => outputJsonSync(`./output/daemon-${daemon.listener_port}/${filename}`, data)))

exports.readDaemonFile = (daemon, filename) =>
    IO(() => readJsonSync(`./output/daemon-${daemon.listener_port}/${filename}`));