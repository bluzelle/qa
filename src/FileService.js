const {outputJsonSync, readJsonSync, removeSync, copySync, readdirSync, statSync} = require('fs-extra');
const {resolve: resolvePath} = require('path');
const {IO} = require('monet');
const {curry} = require('lodash/fp');


const getDaemonOutputDir = exports.getDaemonOutputDir = (swarmId, daemonConfig) => resolvePath(__dirname, `../tmp/output/${swarmId}/daemon-${daemonConfig.listener_port}`);

exports.writeDaemonFile = curry((daemonConfig, swarmId, filename, data) =>
    IO(() => outputJsonSync(`${getDaemonOutputDir(swarmId, daemonConfig)}/${filename}`, data)));

exports.copyToDaemonDir = (swarmId, daemonConfig, source, destination) =>
    IO(() => copySync(source, `${getDaemonOutputDir(swarmId, daemonConfig)}/${destination}`));

exports.readDaemonFile = (swarmId, daemonConfig, filename) =>
    IO(() => readJsonSync(`${getDaemonOutputDir(swarmId, daemonConfig)}/${filename}`));

exports.readDaemonFileSize = (swarmId, daemonConfig, dirName, filename) =>
    IO(() => statSync(`${getDaemonOutputDir(swarmId, daemonConfig)}${dirName}/${filename}`));

exports.readDaemonDirectory = (swarmId, filename) =>
    IO(() => readdirSync(resolvePath(__dirname, `../tmp/output/${swarmId}/${filename}`)));

exports.removeDaemonDirectory = () =>
    IO(() => removeSync(resolvePath(__dirname, '../tmp/output')));
