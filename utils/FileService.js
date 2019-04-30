const {outputJsonSync, readJsonSync, removeSync, copySync, readdirSync, statSync} = require('fs-extra');
const {resolve: resolvePath} = require('path');
const {IO} = require('monet');
const {curry} = require('lodash/fp');


const getDaemonOutputDir = exports.getDaemonOutputDir = (daemonConfig) => resolvePath(__dirname, `./output/daemon-${daemonConfig.listener_port}`);

exports.writeDaemonFile = curry((daemonConfig, filename, data) =>
    IO(() => outputJsonSync(`${getDaemonOutputDir(daemonConfig)}/${filename}`, data)));

exports.readDaemonFile = (daemonConfig, filename) =>
    IO(() => readJsonSync(`${getDaemonOutputDir(daemonConfig)}/${filename}`));

exports.readDaemonFileSize = (daemonConfig, dirName, filename) =>
    IO(() => statSync(`${getDaemonOutputDir(daemonConfig)}${dirName}/${filename}`));

exports.readDaemonDirectory = (filename) =>
    IO(() => readdirSync(resolvePath(`${__dirname}/output/${filename}`)));

exports.removeDaemonDirectory = () =>
    IO(() => removeSync(resolvePath(__dirname, './output')));

exports.copyToDaemonDir = (daemonConfig, source, destination) =>
    IO(() => copySync(source, `${getDaemonOutputDir(daemonConfig)}/${destination}`));
