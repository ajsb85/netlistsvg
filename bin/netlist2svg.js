#!/usr/bin/env node
'use strict';

var lib = require('../built'),
    fs = require('fs'),
    path = require('path'),
    json5 = require('json5'),
    yargs = require('yargs'),
    Ajv = require('ajv');

var ajv = new Ajv({allErrors: true, allowUnionTypes: true});
require('ajv-errors')(ajv);

if (require.main === module) {
    var argv = yargs
        .demand(1)
        .usage('usage: $0 input_json_file [-o output_svg_file] [--skin skin_file] [--layout elk_json_file] [--config config_json_file]')
        .argv;
    main(argv._[0], argv.o, argv.skin, argv.layout, argv.config);
}

// Render and write the output file. Returns a promise that resolves once the file
// has been written. Rendering relies on module-global skin state, so callers must
// not run two renders concurrently (await this before starting another).
function render(skinData, netlist, outputPath, elkData, configData) {
    return new Promise((resolve, reject) => {
        lib.render(skinData, netlist, (err, svgData) => {
            if (err) return reject(err);
            fs.writeFile(outputPath, svgData, 'utf-8', (err) => {
                if (err) return reject(err);
                resolve();
            });
        }, elkData, configData);
    });
}

function parseFiles(skinPath, netlistPath, elkJsonPath, configPath, callback) {
    fs.readFile(skinPath, 'utf-8', (err, skinData) => {
        if (err) throw err;
        fs.readFile(netlistPath, (err, netlistData) => {
            if (err) throw err;
            var elkData;
            var configData;
            if (elkJsonPath) {
                elkData = json5.parse(fs.readFileSync(elkJsonPath));
            }
            if (configPath) {
                configData = json5.parse(fs.readFileSync(configPath));
            }
            callback(skinData, netlistData, elkData, configData);
        });
    });
}

function main(netlistPath, outputPath, skinPath, elkJsonPath, configPath) {
    skinPath = skinPath || path.join(__dirname, '../skin/default.svg');
    configPath = configPath || path.join(__dirname, '../lib/config.json');
    outputPath = outputPath || 'out.svg';
    var schemaPath = path.join(__dirname, '../lib/yosys.schema.json5');
    return new Promise((resolve, reject) => {
        parseFiles(skinPath, netlistPath, elkJsonPath, configPath, (skinData, netlistString, elkData, configData) => {
            try {
                var netlistJson = json5.parse(netlistString);
                var valid = ajv.validate(json5.parse(fs.readFileSync(schemaPath)), netlistJson);
                if (!valid) {
                    throw Error(JSON.stringify(ajv.errors, null, 2));
                }
                render(skinData, netlistJson, outputPath, elkData, configData).then(resolve, reject);
            } catch (e) {
                reject(e);
            }
        });
    });
}

module.exports.main = main;
