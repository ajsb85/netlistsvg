# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-06-16

### Added
- **Hierarchical netlists.** Submodules can now be expanded to show their inner
  schematic inline instead of being drawn as opaque boxes (ports of #92 from
  upstream `nturley/netlistsvg`).
- **Configuration file** (`--config`, `lib/config.json`, `ConfigModel`) controlling:
  - `hierarchy.enable`: `off` | `all` | `level` | `modules`
  - `hierarchy.expandLevel` and `hierarchy.expandModules` (by type or instance id)
  - `top.enable` / `top.module` to override which module is treated as the top.
- `render()` gains an optional `configData` argument (backwards compatible; the
  default configuration keeps hierarchy off).
- `sub_odd` / `sub_even` skin templates in `default.svg` and `horizontal.svg`.
- Interactive demo: a **Hierarchy (Submodule)** example, a **HIERARCHY** selector,
  and a forced dark theme so the schematic matches the dashboard (exported SVGs
  stay theme-neutral and still adapt to the host's light/dark preference).
- Example `examples/hierarchy.v` + `examples/config/config.json` and a
  `test/digital/hierarchy.json` fixture.

### Changed
- ELK cell/port/edge ids are namespaced by module name so repeated module
  instances no longer collide; edges use `source`/`sourcePort`.
- Yosys `$paramod\<module>\…` type names are displayed as the base module name.
- `bin/netlist2svg.js` `main()` returns a promise; `test/test-all.js` renders
  sequentially (renders share global skin state).
- `build-demo` also copies `index.css` and `favicon.ico` to the served root.

### Fixed
- Intermittent render crash caused by concurrent renders sharing global skin
  state.
- Submodule boxes now follow the dark theme instead of staying light.

[1.2.0]: https://github.com/ajsb85/netlist2svg/releases/tag/v1.2.0
