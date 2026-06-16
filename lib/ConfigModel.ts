// Configuration model controlling hierarchical rendering and top-module selection.
interface Config {
    hierarchy: Hierarchy;
    top: Top;
}

interface Hierarchy {
    // 'off'     -> render the top module only, submodules shown as boxes
    // 'all'     -> expand every submodule that is defined in the netlist
    // 'level'   -> expand submodules up to `expandLevel` levels deep
    // 'modules' -> expand only the submodules listed in `expandModules`
    enable: 'off' | 'level' | 'all' | 'modules';
    expandLevel: number;
    expandModules: ExpandModules;
    // optional background colours per hierarchy depth (also configurable via the skin)
    colour?: string[];
}

interface ExpandModules {
    types: string[];
    ids: string[];
}

interface Top {
    // when enabled, render `module` as the top module instead of the netlist's top
    enable: boolean;
    module: string;
}

export default Config;
