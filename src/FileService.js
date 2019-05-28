const {outputJsonSync, readJsonSync, removeSync, copySync, readdirSync, statSync} = require('fs-extra');
const {resolve: resolvePath} = require('path');
const {IO} = require('monet');
const {curry} = require('lodash/fp');


const getDaemonOutputDir = exports.getDaemonOutputDir = (swarmId, daemonConfig) => resolvePath(__dirname, `../tmp/output/${swarmId}/daemon-${daemonConfig.listener_port}`);

exports.writeDaemonFile = curry((daemonConfig, swarmId, filename, data) =>
    IO(() => outputJsonSync(`${getDaemonOutputDir(swarmId, daemonConfig)}/${filename}`, data)));

exports.copyToDaemonDir = (swarmId, daemonConfig, source, destination) =>
    IO(() => copySync(source, `${getDaemonOutputDir(swarmId, daemonConfig)}/${destination}`));

// above functions only refactored for daemonManager calls, not refactored in tests

exports.readDaemonFile = (daemonConfig, filename) =>
    IO(() => readJsonSync(`${getDaemonOutputDir(daemonConfig)}/${filename}`));

exports.readDaemonFileSize = (daemonConfig, dirName, filename) =>
    IO(() => statSync(`${getDaemonOutputDir(daemonConfig)}${dirName}/${filename}`));

exports.readDaemonDirectory = (filename) =>
    IO(() => readdirSync(resolvePath(__dirname, `../tmp/output/${filename}`)));

exports.removeDaemonDirectory = () =>
    IO(() => removeSync(resolvePath(__dirname, '../tmp/output')));
