const lib = require('../built');
const json5 = require('json5');
const Ajv = require('ajv');
var ajv = new Ajv({allErrors: true, allowUnionTypes: true});
require('ajv-errors')(ajv);

const digital = require('../skin/default.svg');
const analog = require('../skin/default.svg');
const exampleDigitalJson = require('../test/digital/up3down5.json');
const exampleAnalogJson = require('../test/analog/and.json');
const schema = require('../lib/yosys.schema.json5');

function render(skinData, netlistData, cb) {
    var valid = ajv.validate(json5.parse(schema), netlistData);
    if (!valid) {
        throw Error(JSON.stringify(ajv.errors, null, 2));
    }
    return lib.render(skinData, netlistData, cb);
}

module.exports = {
    render: render,
    digitalSkin: digital,
    analogSkin: analog,
    exampleDigital: exampleDigitalJson,
    exampleAnalog: exampleAnalogJson
};
