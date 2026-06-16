var path = require('path'),
    bin = require('../bin/netlist2svg');

var digital_tests = ['generics', 'ports_splitjoin', 'up3down5', 'mux4', 'hyperedges', 'pc'];
var analog_tests = ['and', 'common_emitter_full', 'mcu', 'resistor_divider', 'vcc_and_gnd']

// Rendering uses module-global skin state, so renders must run one at a time.
async function main() {
    for (const test of digital_tests) {
        await bin.main(
            path.join('test', 'digital', test + '.json'),
            path.join('test', 'digital', test + '.svg'),
            path.join('skin', 'default.svg')
        );
    }
    for (const test of analog_tests) {
        await bin.main(
            path.join('test', 'analog', test + '.json'),
            path.join('test', 'analog', test + '.svg'),
            path.join('skin', 'analog.svg')
        );
    }
    // hierarchical example: expand the "foo" submodule (see examples/config/config.json)
    await bin.main(
        path.join('test', 'digital', 'hierarchy.json'),
        path.join('test', 'digital', 'hierarchy.svg'),
        path.join('skin', 'default.svg'),
        null,
        path.join('examples', 'config', 'config.json')
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
