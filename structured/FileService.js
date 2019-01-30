const {outputJsonSync, readJsonSync, removeSync} = require('fs-extra');
const {resolve: resolvePath} = require('path');
const {IO} = require('monet');
const {curry} = require('lodash/fp');

const getDaemonOutputDir = exports.getDaemonOuputDir = (listener_port) => `./output/daemon-${listener_port}`;

exports.writeDaemonFile = curry((daemon, filename, data) =>
    IO(() => outputJsonSync(`${getDaemonOutputDir(daemon.listener_port)}/${filename}`, data)));

exports.readDaemonFile = (daemon, filename) =>
    IO(() => readJsonSync(`${getDaemonOutputDir(daemon.listener_port)}/${filename}`));

exports.removeDaemonDirectory = () =>
    IO(() => removeSync('./output'));

