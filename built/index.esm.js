var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// lib/index.ts
import ELK from "elkjs";

// lib/Skin.ts
var onml = __require("onml");
var Skin;
((Skin2) => {
  Skin2.skin = null;
  function getAttributes(element) {
    return Array.isArray(element) && element[0] === "g" && element[1] ? element[1] : {};
  }
  function filterPortPids(template, predicate) {
    return template.filter((element) => {
      const attrs = getAttributes(element);
      return attrs["s:pid"] !== void 0 && predicate(attrs);
    }).map((element) => element[1]["s:pid"]);
  }
  function getPortsWithPrefix(template, prefix) {
    return template.filter((element) => {
      const attrs = getAttributes(element);
      return typeof attrs["s:pid"] === "string" && attrs["s:pid"].startsWith(prefix);
    });
  }
  Skin2.getPortsWithPrefix = getPortsWithPrefix;
  function getInputPids(template) {
    return filterPortPids(template, (attrs) => attrs["s:dir"] === "in" || attrs["s:position"] === "top");
  }
  Skin2.getInputPids = getInputPids;
  function getOutputPids(template) {
    return filterPortPids(template, (attrs) => attrs["s:dir"] === "out" || attrs["s:position"] === "bottom");
  }
  Skin2.getOutputPids = getOutputPids;
  function getLateralPortPids(template) {
    return filterPortPids(
      template,
      (attrs) => attrs["s:dir"] === "lateral" || ["left", "right"].includes(attrs["s:position"])
    );
  }
  Skin2.getLateralPortPids = getLateralPortPids;
  function findSkinType(type, depth = null) {
    if (!Skin2.skin) {
      return null;
    }
    let foundNode = void 0;
    onml.traverse(Skin2.skin, {
      enter: (node, parent) => {
        if (node.name === "s:alias" && node.attr.val === type) {
          foundNode = parent;
          return true;
        }
      }
    });
    if (!foundNode) {
      const fallbackType = depth == null ? "generic" : ["sub_odd", "sub_even"][depth % 2];
      onml.traverse(Skin2.skin, {
        enter: (node) => {
          if (node.attr["s:type"] === fallbackType) {
            foundNode = node;
            return true;
          }
        }
      });
    }
    return foundNode ? foundNode.full : null;
  }
  Skin2.findSkinType = findSkinType;
  function getLowPriorityAliases() {
    const aliases = [];
    if (!Skin2.skin) {
      return aliases;
    }
    onml.traverse(Skin2.skin, {
      enter: (node) => {
        if (node.name === "s:low_priority_alias" && typeof node.attr.value === "string") {
          aliases.push(node.attr.value);
        }
      }
    });
    return aliases;
  }
  Skin2.getLowPriorityAliases = getLowPriorityAliases;
  function getProperties() {
    const properties = {};
    if (!Skin2.skin) {
      properties.layoutEngine = {};
      return properties;
    }
    onml.traverse(Skin2.skin, {
      enter: (node) => {
        if (node.name === "s:properties") {
          for (const [key, val] of Object.entries(node.attr)) {
            const strVal = String(val);
            if (!isNaN(Number(strVal))) {
              properties[key] = Number(strVal);
            } else if (strVal === "true") {
              properties[key] = true;
            } else if (strVal === "false") {
              properties[key] = false;
            } else {
              properties[key] = strVal;
            }
          }
        } else if (node.name === "s:layoutEngine") {
          properties.layoutEngine = node.attr;
        }
      }
    });
    if (!properties.layoutEngine) {
      properties.layoutEngine = {};
    }
    return properties;
  }
  Skin2.getProperties = getProperties;
})(Skin || (Skin = {}));
var Skin_default = Skin;

// lib/YosysModel.ts
var Yosys;
((Yosys2) => {
  let ConstantVal;
  ((ConstantVal2) => {
    ConstantVal2["Zero"] = "0";
    ConstantVal2["One"] = "1";
    ConstantVal2["X"] = "x";
    ConstantVal2["Z"] = "z";
  })(ConstantVal = Yosys2.ConstantVal || (Yosys2.ConstantVal = {}));
  let Direction;
  ((Direction2) => {
    Direction2["Input"] = "input";
    Direction2["Output"] = "output";
    Direction2["Inout"] = "inout";
  })(Direction = Yosys2.Direction || (Yosys2.Direction = {}));
  let HideName;
  ((HideName2) => {
    HideName2[HideName2["Hide"] = 0] = "Hide";
    HideName2[HideName2["NoHide"] = 1] = "NoHide";
  })(HideName = Yosys2.HideName || (Yosys2.HideName = {}));
  Yosys2.getInputPortPids = (cell) => Object.entries(cell.port_directions || {}).filter(([, dir]) => dir === "input" /* Input */).map(([name]) => name);
  Yosys2.getOutputPortPids = (cell) => Object.entries(cell.port_directions || {}).filter(([, dir]) => dir === "output" /* Output */).map(([name]) => name);
})(Yosys || (Yosys = {}));
var YosysModel_default = Yosys;

// lib/Port.ts
var Port = class {
  constructor(key, value) {
    this.key = key;
    this.value = value;
  }
  get Key() {
    return this.key;
  }
  keyIn(pids) {
    return pids.includes(this.key);
  }
  maxVal() {
    return Math.max(...this.value.map(Number));
  }
  valString() {
    return "," + this.value.join() + ",";
  }
  findConstants(sigsByConstantName, maxNum, constantCollector, parent) {
    let constName = "";
    let constNums = [];
    for (let i = 0; i < this.value.length; i++) {
      const portSig = this.value[i];
      if (portSig === "0" || portSig === "1" || portSig === "x") {
        maxNum += 1;
        constName += portSig;
        this.value[i] = maxNum;
        constNums.push(maxNum);
      } else if (constName.length > 0) {
        this.assignConstant(constName, constNums, sigsByConstantName, constantCollector, parent);
        constName = "";
        constNums = [];
      }
    }
    if (constName.length > 0) {
      this.assignConstant(constName, constNums, sigsByConstantName, constantCollector, parent);
    }
    return maxNum;
  }
  getGenericElkPort(index, templatePorts, dir) {
    if (!this.parentNode) {
      throw new Error("Port has no parentNode");
    }
    const nodeKey = `${this.parentNode.parent}.${this.parentNode.Key}`;
    const type = this.parentNode.getTemplate()[1]["s:type"];
    const isSub = type === "sub_odd" || type === "sub_even";
    const x = Number(templatePorts[0][1]["s:x"]);
    const y = Number(templatePorts[0][1]["s:y"]);
    const portId = `${nodeKey}.${this.key}`;
    const portY = index === 0 ? y : index * (Number(templatePorts[1][1]["s:y"]) - y) + y;
    const elkPort = {
      id: portId,
      width: 1,
      height: 1,
      x,
      y: portY
    };
    const needsLabel = type === "generic" || isSub || type === "join" && dir === "in" || type === "split" && dir === "out";
    if (needsLabel) {
      elkPort.labels = [{
        id: `${portId}.label`,
        text: this.key,
        x: Number(templatePorts[0][2][1].x) - 10,
        y: Number(templatePorts[0][2][1].y) - 6,
        width: 6 * this.key.length,
        height: 11
      }];
    }
    if (isSub) {
      elkPort.layoutOptions = {
        "org.eclipse.elk.port.side": dir === "in" ? "WEST" : "EAST"
      };
      delete elkPort.x;
      delete elkPort.y;
    }
    return elkPort;
  }
  assignConstant(name, constants, signalsByConstantName, constantCollector, parent) {
    const reversedName = name.split("").reverse().join("");
    if (signalsByConstantName[reversedName]) {
      const constSigs = signalsByConstantName[reversedName];
      const firstConstIndex = this.value.indexOf(constants[0]);
      if (firstConstIndex >= 0) {
        for (let i = 0; i < constSigs.length; i++) {
          this.value[firstConstIndex + i] = constSigs[i];
        }
      }
    } else {
      constantCollector.push(Cell.fromConstantInfo(reversedName, constants, parent));
      signalsByConstantName[reversedName] = constants;
    }
  }
};

// lib/elkGraph.ts
var ElkModel;
((ElkModel3) => {
  ElkModel3.wireNameLookup = {};
  ElkModel3.dummyNum = 0;
  ElkModel3.edgeIndex = 0;
})(ElkModel || (ElkModel = {}));
function buildElkGraph(module) {
  const moduleName = module.moduleName;
  const children = module.nodes.map((n) => n.buildElkChild());
  ElkModel.edgeIndex = 0;
  ElkModel.dummyNum = 0;
  const edges = [];
  module.wires.forEach((wire) => {
    const numWires = wire.netName.split(",").length - 2;
    const { drivers, riders, laterals } = wire;
    if (drivers.length > 0 && riders.length > 0 && laterals.length === 0) {
      createEdges(drivers, riders, edges, numWires, moduleName);
    } else if (drivers.concat(riders).length > 0 && laterals.length > 0) {
      createEdges(drivers, laterals, edges, numWires, moduleName);
      createEdges(laterals, riders, edges, numWires, moduleName);
    } else if (riders.length === 0 && drivers.length > 1) {
      const dummyId = addDummy(children, moduleName);
      drivers.forEach((driver) => {
        edges.push(createDummyEdge(driver, dummyId, "source", driver.wire.netName, moduleName));
      });
    } else if (riders.length > 1 && drivers.length === 0) {
      const dummyId = addDummy(children, moduleName);
      riders.forEach((rider) => {
        edges.push(createDummyEdge(rider, dummyId, "target", rider.wire.netName, moduleName));
      });
    } else if (laterals.length > 1) {
      const [source, ...otherLaterals] = laterals;
      const sourceParentKey = source.parentNode.Key;
      otherLaterals.forEach((lateral) => {
        const lateralParentKey = lateral.parentNode.Key;
        const id = `${moduleName}.e${ElkModel.edgeIndex++}`;
        edges.push({
          id,
          source: `${moduleName}.${sourceParentKey}`,
          sourcePort: `${moduleName}.${sourceParentKey}.${source.key}`,
          target: `${moduleName}.${lateralParentKey}`,
          targetPort: `${moduleName}.${lateralParentKey}.${lateral.key}`
        });
        ElkModel.wireNameLookup[id] = lateral.wire.netName;
      });
    }
  });
  return {
    id: moduleName,
    children,
    edges
  };
}
function createEdges(sourcePorts, targetPorts, edges, numWires, moduleName) {
  for (const sourcePort of sourcePorts) {
    const sourceParentKey = sourcePort.parentNode.Key;
    const source = `${moduleName}.${sourceParentKey}`;
    const sourceKey = `${source}.${sourcePort.key}`;
    const edgeLabel = numWires > 1 ? [{
      id: `label_${ElkModel.edgeIndex}`,
      text: String(numWires),
      width: 4,
      height: 6,
      x: 0,
      y: 0,
      layoutOptions: { "org.eclipse.elk.edgeLabels.inline": true }
    }] : void 0;
    for (const targetPort of targetPorts) {
      const targetParentKey = targetPort.parentNode.Key;
      const target = `${moduleName}.${targetParentKey}`;
      const targetKey = `${target}.${targetPort.key}`;
      const id = `${moduleName}.e${ElkModel.edgeIndex++}`;
      edges.push({
        id,
        labels: edgeLabel,
        source,
        sourcePort: sourceKey,
        target,
        targetPort: targetKey,
        layoutOptions: {
          "org.eclipse.elk.layered.priority.direction": sourcePort.parentNode.type !== "$dff" ? 10 : void 0,
          "org.eclipse.elk.edge.thickness": numWires > 1 ? 2 : 1
        }
      });
      ElkModel.wireNameLookup[id] = targetPort.wire.netName;
    }
  }
}
function addDummy(children, moduleName) {
  const dummyId = `${moduleName}.$d_${ElkModel.dummyNum++}`;
  children.push({
    id: dummyId,
    width: 0,
    height: 0,
    ports: [{ id: `${dummyId}.p`, width: 0, height: 0 }],
    layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_SIDE" }
  });
  return dummyId;
}
function createDummyEdge(port, dummyId, type, netName, moduleName) {
  const parentKey = `${moduleName}.${port.parentNode.Key}`;
  const id = `${moduleName}.e${ElkModel.edgeIndex++}`;
  const edge = {
    id,
    [type === "source" ? "source" : "target"]: parentKey,
    [type === "source" ? "sourcePort" : "targetPort"]: `${parentKey}.${port.key}`,
    [type === "source" ? "target" : "source"]: dummyId,
    [type === "source" ? "targetPort" : "sourcePort"]: `${dummyId}.p`
  };
  ElkModel.wireNameLookup[id] = netName;
  return edge;
}

// lib/drawModule.ts
var onml2 = __require("onml");
function getWireDirection(start, end) {
  if (end.x === start.x && end.y === start.y) {
    throw new Error("Points cannot be identical");
  }
  if (end.x !== start.x && end.y !== start.y) {
    throw new Error("Points must be orthogonal");
  }
  if (end.x > start.x) return 3 /* Right */;
  if (end.x < start.x) return 2 /* Left */;
  if (end.y > start.y) return 1 /* Down */;
  return 0 /* Up */;
}
function findNearestBend(edges, dummyIsSource, dummyLocation) {
  const candidates = edges.map((edge) => {
    const bends = edge.sections[0].bendPoints || [];
    return dummyIsSource ? bends[0] : bends[bends.length - 1];
  }).filter((p) => p !== void 0);
  if (candidates.length === 0) return void 0;
  return candidates.reduce((closest, current) => {
    const closestDist = (closest.x - dummyLocation.x) ** 2 + (closest.y - dummyLocation.y) ** 2;
    const currentDist = (current.x - dummyLocation.x) ** 2 + (current.y - dummyLocation.y) ** 2;
    return currentDist < closestDist ? current : closest;
  });
}
function isJunctionDummy(id) {
  return typeof id === "string" && /\$d_\d+$/.test(id);
}
function removeDummyEdges(graph) {
  const edges = graph.edges || [];
  const dummyIds = [];
  for (const e of edges) {
    for (const endpoint of [e.source, e.target]) {
      if (isJunctionDummy(endpoint) && !dummyIds.includes(endpoint)) {
        dummyIds.push(endpoint);
      }
    }
  }
  for (const dummyId of dummyIds) {
    const edgesWithDummy = edges.filter((e) => e.source === dummyId || e.target === dummyId);
    if (edgesWithDummy.length === 0) continue;
    const firstEdge = edgesWithDummy[0];
    const dummyIsSource = firstEdge.source === dummyId;
    const dummyLocation = dummyIsSource ? firstEdge.sections[0].startPoint : firstEdge.sections[0].endPoint;
    const newEndpoint = findNearestBend(edgesWithDummy, dummyIsSource, dummyLocation);
    if (!newEndpoint) {
      continue;
    }
    for (const edge of edgesWithDummy) {
      const section = edge.sections[0];
      if (dummyIsSource) {
        section.startPoint = newEndpoint;
        section.bendPoints?.shift();
      } else {
        section.endPoint = newEndpoint;
        section.bendPoints?.pop();
      }
    }
    const directions = new Set(edgesWithDummy.map((edge) => {
      const section = edge.sections[0];
      const point = dummyIsSource ? section.bendPoints?.[0] || section.endPoint : section.bendPoints?.[section.bendPoints.length - 1] || section.startPoint;
      return getWireDirection(newEndpoint, point);
    }));
    if (directions.size < 3) {
      for (const edge of edgesWithDummy) {
        edge.junctionPoints = (edge.junctionPoints || []).filter(
          (junction) => !(junction.x === newEndpoint.x && junction.y === newEndpoint.y)
        );
      }
    }
  }
}
function drawModule(graph, module) {
  const nodes = module.nodes.map((node) => {
    const matchedChild = graph.children.find((child) => child.id === node.parent + "." + node.Key);
    return node.render(matchedChild);
  });
  removeDummyEdges(graph);
  const lines = renderWireLines(graph.edges);
  const labels = renderWireLabels(graph.edges);
  if (labels.length > 0) {
    lines.push(...labels);
  }
  const svgAttributes = { ...Skin_default.skin[1] };
  svgAttributes.width = String(graph.width);
  svgAttributes.height = String(graph.height);
  const styles = ["style", {}, ""];
  onml2.traverse(Skin_default.skin, {
    enter: (node) => {
      if (node.name === "style") {
        styles[2] += node.full[2];
      }
    }
  });
  const svgElement = ["svg", svgAttributes, styles, ...nodes, ...lines];
  return onml2.s(svgElement);
}
function drawSubModule(cell, subModule) {
  const nodes = [];
  subModule.nodes.forEach((node) => {
    const matchedChild = (cell.children || []).find((child) => child.id === node.parent + "." + node.Key);
    if (matchedChild) {
      nodes.push(node.render(matchedChild));
    }
  });
  removeDummyEdges(cell);
  const lines = renderWireLines(cell.edges || []);
  const svgAttributes = { ...Skin_default.skin[1] };
  svgAttributes.width = String(cell.width);
  svgAttributes.height = String(cell.height);
  return ["svg", svgAttributes, ...nodes, ...lines];
}
function renderWireLines(edges) {
  return edges.flatMap((edge) => {
    const netId = ElkModel.wireNameLookup[edge.id];
    const numWires = netId.split(",").length - 2;
    const lineWidth = numWires > 1 ? 2 : 1;
    const netClass = `net_${netId.slice(1, -1)} width_${numWires}`;
    return (edge.sections || []).flatMap((section) => {
      let currentPoint = section.startPoint;
      const wireSegments = [];
      const bendPoints = section.bendPoints || [];
      bendPoints.forEach((bendPoint) => {
        wireSegments.push(["line", {
          x1: currentPoint.x,
          y1: currentPoint.y,
          x2: bendPoint.x,
          y2: bendPoint.y,
          class: netClass,
          style: `stroke-width: ${lineWidth}`
        }]);
        currentPoint = bendPoint;
      });
      const junctions = (edge.junctionPoints || []).map(
        (junction) => ["circle", {
          cx: junction.x,
          cy: junction.y,
          r: numWires > 1 ? 3 : 2,
          class: `${netClass} junction`
        }]
      );
      wireSegments.push(["line", {
        x1: currentPoint.x,
        y1: currentPoint.y,
        x2: section.endPoint.x,
        y2: section.endPoint.y,
        class: netClass,
        style: `stroke-width: ${lineWidth}`
      }]);
      return [...wireSegments, ...junctions];
    });
  });
}
function renderWireLabels(edges) {
  return edges.flatMap((edge) => {
    if (!edge.labels?.[0]?.text) return [];
    const label = edge.labels[0];
    const netId = ElkModel.wireNameLookup[edge.id];
    const numWires = netId.split(",").length - 2;
    const labelClass = `net_${netId.slice(1, -1)} width_${numWires} busLabel_${numWires}`;
    return [
      // Label background
      ["rect", {
        x: label.x + 1,
        y: label.y - 1,
        width: (label.text.length + 2) * 6 - 2,
        height: 9,
        class: `${labelClass} labelBackground`
      }],
      // Label text
      ["text", {
        x: label.x,
        y: label.y + 7,
        class: labelClass
      }, `/${label.text}/`]
    ];
  });
}

// lib/Cell.ts
var clone = __require("clone");
var onml3 = __require("onml");
var Cell = class _Cell {
  /**
   * creates a Cell from a Yosys Port
   * @param yPort the Yosys Port with our port data
   * @param name the name of the port
   */
  static fromPort(yPort, name, parent = "") {
    const isInput = yPort.direction === YosysModel_default.Direction.Input;
    if (isInput) {
      return new _Cell(name, "$_inputExt_", [], [new Port("Y", yPort.bits)], {}, parent);
    }
    return new _Cell(name, "$_outputExt_", [new Port("A", yPort.bits)], [], {}, parent);
  }
  static fromYosysCell(yCell, name, parent = "") {
    this.setAlternateCellType(yCell);
    const template = Skin_default.findSkinType(yCell.type) || [];
    const templateInputPids = Skin_default.getInputPids(template);
    const templateOutputPids = Skin_default.getOutputPids(template);
    const ports = Object.entries(yCell.connections).map(
      ([portName, conn]) => new Port(portName, conn)
    );
    let inputPorts = ports.filter((port) => port.keyIn(templateInputPids));
    let outputPorts = ports.filter((port) => port.keyIn(templateOutputPids));
    if (inputPorts.length + outputPorts.length !== ports.length) {
      const inputPids = YosysModel_default.getInputPortPids(yCell);
      const outputPids = YosysModel_default.getOutputPortPids(yCell);
      inputPorts = ports.filter((port) => port.keyIn(inputPids));
      outputPorts = ports.filter((port) => port.keyIn(outputPids));
    }
    return new _Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes || {}, parent);
  }
  /**
   * creates a Cell that represents an expanded submodule. The inner module is
   * flattened recursively into its own FlatModule (one level deeper) so it can be
   * rendered as a nested schematic inside this cell.
   */
  static createSubModule(yCell, name, parent, subModule, depth) {
    const template = Skin_default.findSkinType(yCell.type) || [];
    const templateInputPids = Skin_default.getInputPids(template);
    const templateOutputPids = Skin_default.getOutputPids(template);
    const ports = Object.entries(yCell.connections).map(
      ([portName, conn]) => new Port(portName, conn)
    );
    let inputPorts = ports.filter((port) => port.keyIn(templateInputPids));
    let outputPorts = ports.filter((port) => port.keyIn(templateOutputPids));
    if (inputPorts.length + outputPorts.length !== ports.length) {
      const inputPids = YosysModel_default.getInputPortPids(yCell);
      const outputPids = YosysModel_default.getOutputPortPids(yCell);
      inputPorts = ports.filter((port) => port.keyIn(inputPids));
      outputPorts = ports.filter((port) => port.keyIn(outputPids));
    }
    const mod = new FlatModule(subModule, name, depth + 1, parent);
    return new _Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes || {}, parent, mod, depth);
  }
  static fromConstantInfo(name, constants, parent = "") {
    return new _Cell(name, "$_constant_", [], [new Port("Y", constants)], {}, parent);
  }
  /**
   * creates a join cell
   * @param target string name of net (starts and ends with and delimited by commas)
   * @param sources list of index strings (one number, or two numbers separated by a colon)
   */
  static fromJoinInfo(target, sources, parent = "") {
    const signalStrs = target.slice(1, -1).split(",");
    const signals = signalStrs.map((ss) => Number(ss));
    const joinOutPorts = [new Port("Y", signals)];
    const inPorts = sources.map((name) => {
      return new Port(name, getBits(signals, name));
    });
    return new _Cell("$join$" + target, "$_join_", inPorts, joinOutPorts, {}, parent);
  }
  /**
   * creates a split cell
   * @param source string name of net (starts and ends with and delimited by commas)
   * @param targets list of index strings (one number, or two numbers separated by a colon)
   */
  static fromSplitInfo(source, targets, parent = "") {
    const sigStrs = source.slice(1, -1).split(",");
    const signals = sigStrs.map((s) => Number(s));
    const inPorts = [new Port("A", signals)];
    const splitOutPorts = targets.map((name) => {
      const sigs = getBits(signals, name);
      return new Port(name, sigs);
    });
    return new _Cell("$split$" + source, "$_split_", inPorts, splitOutPorts, {}, parent);
  }
  // Set cells to alternate types/tags based on their parameters
  static setAlternateCellType(yCell) {
    if ("parameters" in yCell) {
      if (yCell.parameters && "WIDTH" in yCell.parameters && yCell.parameters.WIDTH > 1 && !("ADDR" in yCell.parameters)) {
        yCell.type = yCell.type + "-bus";
      }
    }
  }
  constructor(key, type, inputPorts, outputPorts, attributes, parent = "", subModule = null, depth = null) {
    this.key = key;
    this.type = type;
    this.inputPorts = inputPorts;
    this.outputPorts = outputPorts;
    this.attributes = attributes || {};
    this.parent = parent;
    this.subModule = subModule;
    this.depth = depth;
    inputPorts.forEach((ip) => {
      ip.parentNode = this;
    });
    outputPorts.forEach((op) => {
      op.parentNode = this;
    });
  }
  get Type() {
    return this.type;
  }
  get Key() {
    return this.key;
  }
  get InputPorts() {
    return this.inputPorts;
  }
  get OutputPorts() {
    return this.outputPorts;
  }
  maxOutVal(atLeast) {
    const maxVal = Math.max(...this.outputPorts.map((op) => op.maxVal()), 0);
    return Math.max(maxVal, atLeast);
  }
  findConstants(sigsByConstantName, maxNum, constantCollector) {
    this.inputPorts.forEach((ip) => {
      maxNum = ip.findConstants(sigsByConstantName, maxNum, constantCollector, this.parent);
    });
    return maxNum;
  }
  inputPortVals() {
    return this.inputPorts.map((port) => port.valString());
  }
  outputPortVals() {
    return this.outputPorts.map((port) => port.valString());
  }
  collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, genericsLaterals) {
    const template = Skin_default.findSkinType(this.type);
    const lateralPids = template ? Skin_default.getLateralPortPids(template) : [];
    this.inputPorts.forEach((port) => {
      const isLateral = port.keyIn(lateralPids);
      const isGeneric = template && template[1] && template[1]["s:type"] === "generic";
      if (isLateral || isGeneric && genericsLaterals) {
        addToCollection(lateralsByNet, port.valString(), port);
      } else {
        addToCollection(ridersByNet, port.valString(), port);
      }
    });
    this.outputPorts.forEach((port) => {
      const isLateral = port.keyIn(lateralPids);
      const isGeneric = template && template[1] && template[1]["s:type"] === "generic";
      if (isLateral || isGeneric && genericsLaterals) {
        addToCollection(lateralsByNet, port.valString(), port);
      } else {
        addToCollection(driversByNet, port.valString(), port);
      }
    });
  }
  getValueAttribute() {
    if (this.attributes && this.attributes.value) {
      return this.attributes.value;
    }
    return "";
  }
  getTemplate() {
    return Skin_default.findSkinType(this.type, this.depth);
  }
  buildElkChild() {
    const template = this.getTemplate();
    const type = template[1]["s:type"];
    const layoutAttrs = { "org.eclipse.elk.portConstraints": "FIXED_POS" };
    let fixedPosX = null;
    let fixedPosY = null;
    for (const attr in this.attributes) {
      if (attr.startsWith("org.eclipse.elk")) {
        if (attr === "org.eclipse.elk.x") {
          fixedPosX = this.attributes[attr];
          continue;
        }
        if (attr === "org.eclipse.elk.y") {
          fixedPosY = this.attributes[attr];
          continue;
        }
        layoutAttrs[attr] = this.attributes[attr];
      }
    }
    if (type === "join" || type === "split" || type === "generic") {
      const inTemplates = Skin_default.getPortsWithPrefix(template, "in");
      const outTemplates = Skin_default.getPortsWithPrefix(template, "out");
      const inPorts = this.inputPorts.map((ip, i) => ip.getGenericElkPort(i, inTemplates, "in"));
      const outPorts = this.outputPorts.map((op, i) => op.getGenericElkPort(i, outTemplates, "out"));
      const cell = {
        id: this.parent + "." + this.key,
        width: Number(template[1]["s:width"]),
        height: Number(this.getGenericHeight()),
        ports: inPorts.concat(outPorts),
        layoutOptions: layoutAttrs,
        labels: []
      };
      if (type === "split") {
        cell.ports[0].y = cell.height / 2;
      }
      if (type === "join") {
        cell.ports[cell.ports.length - 1].y = cell.height / 2;
      }
      if (fixedPosX) {
        cell.x = fixedPosX;
      }
      if (fixedPosY) {
        cell.y = fixedPosY;
      }
      this.addLabels(template, cell);
      return cell;
    }
    if (type === "sub_odd" || type === "sub_even") {
      return this.buildElkSubModule(template, fixedPosX, fixedPosY);
    }
    const ports = Skin_default.getPortsWithPrefix(template, "").map((tp) => {
      return {
        id: this.parent + "." + this.key + "." + tp[1]["s:pid"],
        width: 0,
        height: 0,
        x: Number(tp[1]["s:x"]),
        y: Number(tp[1]["s:y"])
      };
    });
    const nodeWidth = Number(template[1]["s:width"]);
    const ret = {
      id: this.parent + "." + this.key,
      width: nodeWidth,
      height: Number(template[1]["s:height"]),
      ports,
      layoutOptions: layoutAttrs,
      labels: []
    };
    if (fixedPosX) {
      ret.x = fixedPosX;
    }
    if (fixedPosY) {
      ret.y = fixedPosY;
    }
    this.addLabels(template, ret);
    return ret;
  }
  /**
   * Builds an ELK node for an expanded submodule. The inner module is laid out as
   * a nested ELK graph (children + edges), and the submodule's own external-port
   * cells are folded into this node's ports so wires connect through.
   */
  buildElkSubModule(template, fixedPosX, fixedPosY) {
    const subModule = this.subModule;
    const inTemplates = Skin_default.getPortsWithPrefix(template, "in");
    const outTemplates = Skin_default.getPortsWithPrefix(template, "out");
    const inPorts = this.inputPorts.map((ip, i) => ip.getGenericElkPort(i, inTemplates, "in"));
    const outPorts = this.outputPorts.map((op, i) => op.getGenericElkPort(i, outTemplates, "out"));
    const elk2 = buildElkGraph(subModule);
    const cell = {
      id: this.parent + "." + this.key,
      layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_SIDE" },
      labels: [],
      ports: inPorts.concat(outPorts),
      children: [],
      edges: []
    };
    elk2.children.forEach((child) => {
      const isPort = cell.ports.some((port) => this.parent + "." + child.id === port.id);
      if (!isPort) {
        cell.children.push(child);
      }
    });
    elk2.edges.forEach((edge) => {
      cell.ports.forEach((port) => {
        if (inPorts.indexOf(port) !== -1) {
          if (edge.sourcePort === port.id.slice(this.parent.length + 1) + ".Y") {
            const source = port.id.split(".");
            source.pop();
            edge.source = source.join(".");
            edge.sourcePort = port.id;
          }
        } else {
          if (edge.targetPort === port.id.slice(this.parent.length + 1) + ".A") {
            const target = port.id.split(".");
            target.pop();
            edge.target = target.join(".");
            edge.targetPort = port.id;
          }
        }
      });
      if (edge.source === edge.target) {
        const dummyId = subModule.moduleName + ".$d_" + edge.sourcePort + "_" + edge.targetPort;
        const dummy = {
          id: dummyId,
          width: 0,
          height: 0,
          ports: [
            { id: dummyId + ".pin", width: 0, height: 0 },
            { id: dummyId + ".pout", width: 0, height: 0 }
          ],
          layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_SIDE" }
        };
        const edgeId = edge.id;
        const edgeCopy = { ...edge };
        edge.target = dummyId;
        edge.targetPort = dummyId + ".pin";
        edge.id = subModule.moduleName + ".e_" + edge.sourcePort + "_" + edge.targetPort;
        ElkModel.wireNameLookup[edge.id] = ElkModel.wireNameLookup[edgeId];
        edgeCopy.source = dummyId;
        edgeCopy.sourcePort = dummyId + ".pout";
        edgeCopy.id = subModule.moduleName + ".e_" + edgeCopy.sourcePort + "_" + edgeCopy.targetPort;
        ElkModel.wireNameLookup[edgeCopy.id] = ElkModel.wireNameLookup[edgeId];
        cell.edges.push(edge, edgeCopy);
        cell.children.push(dummy);
      } else {
        cell.edges.push(edge);
      }
    });
    if (fixedPosX) {
      cell.x = fixedPosX;
    }
    if (fixedPosY) {
      cell.y = fixedPosY;
    }
    this.addLabels(template, cell);
    return cell;
  }
  render(cell) {
    const template = this.getTemplate();
    const tempclone = clone(template);
    for (const label of cell.labels || []) {
      const labelIDSplit = label.id.split(".");
      const attrName = labelIDSplit[labelIDSplit.length - 1];
      setTextAttribute(tempclone, attrName, label.text);
    }
    for (let i = 2; i < tempclone.length; i++) {
      const node = tempclone[i];
      if (node[0] === "text" && node[1]["s:attribute"]) {
        const attrib = node[1]["s:attribute"];
        if (!(attrib in this.attributes)) {
          node[2] = "";
        }
      }
    }
    tempclone[1].id = "cell_" + this.key;
    tempclone[1].transform = "translate(" + cell.x + "," + cell.y + ")";
    if (this.type === "$_split_") {
      setGenericSize(tempclone, Number(this.getGenericHeight()));
      const outPorts = Skin_default.getPortsWithPrefix(template, "out");
      const gap = Number(outPorts[1][1]["s:y"]) - Number(outPorts[0][1]["s:y"]);
      const startY = Number(outPorts[0][1]["s:y"]);
      tempclone.pop();
      tempclone.pop();
      this.outputPorts.forEach((op, i) => {
        const portClone = clone(outPorts[0]);
        portClone[portClone.length - 1][2] = op.Key;
        portClone[1].transform = "translate(" + outPorts[1][1]["s:x"] + "," + (startY + i * gap) + ")";
        tempclone.push(portClone);
      });
    } else if (this.type === "$_join_") {
      setGenericSize(tempclone, Number(this.getGenericHeight()));
      const inPorts = Skin_default.getPortsWithPrefix(template, "in");
      const gap = Number(inPorts[1][1]["s:y"]) - Number(inPorts[0][1]["s:y"]);
      const startY = Number(inPorts[0][1]["s:y"]);
      tempclone.pop();
      tempclone.pop();
      this.inputPorts.forEach((port, i) => {
        const portClone = clone(inPorts[0]);
        portClone[portClone.length - 1][2] = port.Key;
        portClone[1].transform = "translate(" + inPorts[1][1]["s:x"] + "," + (startY + i * gap) + ")";
        tempclone.push(portClone);
      });
    } else if (template[1]["s:type"] === "generic") {
      setGenericSize(tempclone, Number(this.getGenericHeight()));
      const inPorts = Skin_default.getPortsWithPrefix(template, "in");
      const ingap = Number(inPorts[1][1]["s:y"]) - Number(inPorts[0][1]["s:y"]);
      const instartY = Number(inPorts[0][1]["s:y"]);
      const outPorts = Skin_default.getPortsWithPrefix(template, "out");
      const outgap = Number(outPorts[1][1]["s:y"]) - Number(outPorts[0][1]["s:y"]);
      const outstartY = Number(outPorts[0][1]["s:y"]);
      tempclone.pop();
      tempclone.pop();
      tempclone.pop();
      tempclone.pop();
      this.inputPorts.forEach((port, i) => {
        const portClone = clone(inPorts[0]);
        portClone[portClone.length - 1][2] = port.Key;
        portClone[1].transform = "translate(" + inPorts[1][1]["s:x"] + "," + (instartY + i * ingap) + ")";
        portClone[1].id = "port_" + port.parentNode.Key + "~" + port.Key;
        tempclone.push(portClone);
      });
      this.outputPorts.forEach((port, i) => {
        const portClone = clone(outPorts[0]);
        portClone[portClone.length - 1][2] = port.Key;
        portClone[1].transform = "translate(" + outPorts[1][1]["s:x"] + "," + (outstartY + i * outgap) + ")";
        portClone[1].id = "port_" + port.parentNode.Key + "~" + port.Key;
        tempclone.push(portClone);
      });
      tempclone[2][2] = cleanType(this.type);
    } else if (template[1]["s:type"] === "sub_odd" || template[1]["s:type"] === "sub_even") {
      const subModuleSvg = drawSubModule(cell, this.subModule);
      tempclone[3][1].width = subModuleSvg[1].width;
      tempclone[3][1].height = subModuleSvg[1].height;
      tempclone[2][1].x = Number(tempclone[3][1].width) / 2;
      tempclone[2][2] = cleanType(this.type);
      tempclone.pop();
      tempclone.pop();
      tempclone.pop();
      tempclone.pop();
      subModuleSvg.shift();
      subModuleSvg.shift();
      subModuleSvg.forEach((child) => tempclone.push(child));
      const inPorts = Skin_default.getPortsWithPrefix(template, "in");
      const outPorts = Skin_default.getPortsWithPrefix(template, "out");
      this.inputPorts.forEach((port) => {
        const portElk = cell.ports.find((p) => p.id === cell.id + "." + port.Key);
        const portClone = clone(inPorts[0]);
        portClone[portClone.length - 1][2] = port.Key;
        portClone[1].transform = "translate(" + portElk.x + "," + portElk.y + ")";
        portClone[1].id = "port_" + port.parentNode.Key + "~" + port.Key;
        tempclone.push(portClone);
      });
      this.outputPorts.forEach((port) => {
        const portElk = cell.ports.find((p) => p.id === cell.id + "." + port.Key);
        const portClone = clone(outPorts[0]);
        portClone[portClone.length - 1][2] = port.Key;
        portClone[1].transform = "translate(" + portElk.x + "," + portElk.y + ")";
        portClone[1].id = "port_" + port.parentNode.Key + "~" + port.Key;
        tempclone.push(portClone);
      });
    }
    setClass(tempclone, "$cell_id", "cell_" + this.key);
    return tempclone;
  }
  addLabels(template, cell) {
    onml3.traverse(template, {
      enter: (node) => {
        if (node.name === "text" && node.attr["s:attribute"]) {
          const attrName = String(node.attr["s:attribute"]);
          let newString;
          if (attrName === "ref" || attrName === "id") {
            if (this.type === "$_constant_" && this.key.length > 3) {
              const num = parseInt(this.key, 2);
              newString = "0x" + num.toString(16);
            } else {
              newString = this.key;
            }
            this.attributes[attrName] = this.key;
          } else if (attrName in this.attributes) {
            newString = this.attributes[attrName];
          } else {
            return;
          }
          (cell.labels ??= []).push({
            id: this.key + ".label." + attrName,
            text: newString,
            x: Number(node.attr.x),
            y: Number(node.attr.y) - 6,
            height: 11,
            width: 6 * newString.length
          });
        }
      }
    });
  }
  getGenericHeight() {
    const template = this.getTemplate();
    const inPorts = Skin_default.getPortsWithPrefix(template, "in");
    const outPorts = Skin_default.getPortsWithPrefix(template, "out");
    if (this.inputPorts.length > this.outputPorts.length) {
      const gap = Number(inPorts[1][1]["s:y"]) - Number(inPorts[0][1]["s:y"]);
      return Number(template[1]["s:height"]) + gap * (this.inputPorts.length - 2);
    }
    if (outPorts.length > 1) {
      const gap = Number(outPorts[1][1]["s:y"]) - Number(outPorts[0][1]["s:y"]);
      return Number(template[1]["s:height"]) + gap * (this.outputPorts.length - 2);
    }
    return Number(template[1]["s:height"]);
  }
};
function setGenericSize(tempclone, height) {
  onml3.traverse(tempclone, {
    enter: (node) => {
      if (node.name === "rect" && node.attr["s:generic"] === "body") {
        node.attr.height = height;
      }
    }
  });
}
function setTextAttribute(tempclone, attribute, value) {
  onml3.traverse(tempclone, {
    enter: (node) => {
      if (node.name === "text" && node.attr["s:attribute"] === attribute) {
        node.full[2] = value;
      }
    }
  });
}
function setClass(tempclone, searchKey, className) {
  onml3.traverse(tempclone, {
    enter: (node) => {
      const currentClass = String(node.attr.class || "");
      if (currentClass && currentClass.includes(searchKey)) {
        node.attr.class = currentClass.replace(searchKey, className);
      }
    }
  });
}
function cleanType(type) {
  if (typeof type === "string" && type.startsWith("$paramod")) {
    const named = type.match(/^\$paramod\\([^\\]+)/);
    if (named) {
      return named[1];
    }
    const hashed = type.match(/^\$paramod\$[^\\]+\\([^\\]+)/);
    if (hashed) {
      return hashed[1];
    }
  }
  return type;
}
function getBits(signals, indicesString) {
  const index = indicesString.indexOf(":");
  if (index === -1) {
    return [signals[Number(indicesString)]];
  } else {
    const start = indicesString.slice(0, index);
    const end = indicesString.slice(index + 1);
    const slice = signals.slice(Number(start), Number(end) + 1);
    return slice;
  }
}

// lib/FlatModule.ts
function contains(needle, haystack) {
  return haystack.includes(needle);
}
function findIndexContaining(needle, haystack) {
  return haystack.findIndex((item) => item.includes(needle));
}
function addToCollection(collection, key, value) {
  (collection[key] ??= []).push(value);
}
function getIndicesString(bitstring, query, start) {
  const splitStart = Math.max(bitstring.indexOf(query), start);
  const startIndex = bitstring.substring(0, splitStart).split(",").length - 1;
  const endIndex = startIndex + query.split(",").length - 3;
  return startIndex === endIndex ? String(startIndex) : `${startIndex}:${endIndex}`;
}
function processSplitsAndJoins(inputs, outputs, targetSignal, start, end, splits, joins) {
  const outputIndex = outputs.indexOf(targetSignal);
  if (outputIndex !== -1) {
    outputs.splice(outputIndex, 1);
  }
  if (start >= targetSignal.length || end - start < 2) {
    return;
  }
  const signalSegment = targetSignal.slice(start, end);
  if (contains(signalSegment, inputs)) {
    if (signalSegment !== targetSignal) {
      addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
    }
    processSplitsAndJoins(inputs, outputs, targetSignal, end - 1, targetSignal.length, splits, joins);
    return;
  }
  const partialMatchIndex = findIndexContaining(signalSegment, inputs);
  if (partialMatchIndex !== -1) {
    if (signalSegment !== targetSignal) {
      addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
    }
    addToCollection(splits, inputs[partialMatchIndex], getIndicesString(inputs[partialMatchIndex], signalSegment, 0));
    inputs.push(signalSegment);
    processSplitsAndJoins(inputs, outputs, targetSignal, end - 1, targetSignal.length, splits, joins);
    return;
  }
  if (findIndexContaining(signalSegment, outputs) !== -1) {
    if (signalSegment !== targetSignal) {
      addToCollection(joins, targetSignal, getIndicesString(targetSignal, signalSegment, start));
    }
    processSplitsAndJoins(inputs, [], signalSegment, 0, signalSegment.length, splits, joins);
    inputs.push(signalSegment);
    return;
  }
  const newEnd = targetSignal.substring(0, end - 1).lastIndexOf(",") + 1;
  processSplitsAndJoins(inputs, outputs, targetSignal, start, newEnd, splits, joins);
}
var FlatModule = class _FlatModule {
  /**
   * Entry point for building a (possibly hierarchical) FlatModule from a Yosys
   * netlist and a configuration. Selects the top module, then recursively flattens
   * it according to the hierarchy settings in the config.
   */
  static fromNetlist(netlist, config) {
    this.layoutProps = Skin_default.getProperties();
    this.modNames = Object.keys(netlist.modules);
    this.netlist = netlist;
    this.config = config;
    let topName = null;
    if (config.top.enable) {
      topName = config.top.module;
      if (!this.modNames.includes(topName)) {
        throw new Error("Top module in config file not defined in input json file.");
      }
    } else {
      Object.entries(netlist.modules).forEach(([name, mod]) => {
        if (mod.attributes && Number(mod.attributes.top) === 1) {
          topName = name;
        }
      });
      if (topName == null) {
        topName = this.modNames[0];
      }
    }
    const top = netlist.modules[topName];
    return new _FlatModule(top, topName, 0);
  }
  /**
   * Create a FlatModule for a single module. `depth` is the hierarchy depth
   * (0 for the top module) and `parent` is the name of the enclosing module.
   */
  constructor(mod, name, depth, parent = null) {
    this.parent = parent;
    this.moduleName = name;
    const ports = Object.entries(mod.ports).map(([portName, portData]) => Cell.fromPort(portData, portName, this.moduleName));
    const cells = Object.entries(mod.cells).map(([key, c]) => this.buildCell(c, key, depth));
    this.nodes = cells.concat(ports);
    this.wires = [];
    if (_FlatModule.layoutProps.constants !== false) {
      this.addConstants();
    }
    if (_FlatModule.layoutProps.splitsAndJoins !== false) {
      this.addSplitsJoins();
    }
    this.createWires();
  }
  /**
   * Decide whether a child cell should be rendered as an expanded submodule or as
   * an opaque box, based on the hierarchy configuration and current depth.
   */
  buildCell(c, key, depth) {
    const cfg = _FlatModule.config.hierarchy;
    const isModule = _FlatModule.modNames.includes(c.type);
    const expand = () => Cell.createSubModule(
      c,
      key,
      this.moduleName,
      _FlatModule.netlist.modules[c.type],
      depth
    );
    const box = () => Cell.fromYosysCell(c, key, this.moduleName);
    switch (cfg.enable) {
      case "level":
        return cfg.expandLevel > depth && isModule ? expand() : box();
      case "all":
        return isModule ? expand() : box();
      case "modules":
        if (cfg.expandModules.types.includes(c.type) || cfg.expandModules.ids.includes(key)) {
          if (!isModule) {
            throw new Error("Submodule in config file not defined in input json file.");
          }
          return expand();
        }
        return box();
      default:
        return box();
    }
  }
  /**
   * Add constant value nodes to the module
   */
  addConstants() {
    let maxNum = this.nodes.reduce((acc, node) => node.maxOutVal(acc), -1);
    const signalsByConstantName = {};
    const newCells = [];
    this.nodes.forEach((node) => {
      maxNum = node.findConstants(signalsByConstantName, maxNum, newCells);
    });
    this.nodes.push(...newCells);
  }
  /**
   * Add split and join nodes to the module
   */
  addSplitsJoins() {
    const allInputs = this.nodes.flatMap((node) => node.inputPortVals());
    const allOutputs = this.nodes.flatMap((node) => node.outputPortVals());
    const inputsCopy = allInputs.slice();
    const splits = {};
    const joins = {};
    for (const input of allInputs) {
      processSplitsAndJoins(allOutputs, inputsCopy, input, 0, input.length, splits, joins);
    }
    const joinCells = Object.entries(joins).map(
      ([joinInput, joinOutputs]) => Cell.fromJoinInfo(joinInput, joinOutputs, this.moduleName)
    );
    const splitCells = Object.entries(splits).map(
      ([splitInput, splitOutputs]) => Cell.fromSplitInfo(splitInput, splitOutputs, this.moduleName)
    );
    this.nodes.push(...joinCells, ...splitCells);
  }
  /**
   * Create wire connections between nodes
   */
  createWires() {
    const layoutProps = Skin_default.getProperties();
    const ridersByNet = {};
    const driversByNet = {};
    const lateralsByNet = {};
    this.nodes.forEach(
      (node) => node.collectPortsByDirection(
        ridersByNet,
        driversByNet,
        lateralsByNet,
        layoutProps.genericsLaterals
      )
    );
    const allNetNames = [
      ...Object.keys(ridersByNet),
      ...Object.keys(driversByNet),
      ...Object.keys(lateralsByNet)
    ];
    const uniqueNets = [...new Set(allNetNames)];
    this.wires = uniqueNets.map((netName) => {
      const drivers = driversByNet[netName] || [];
      const riders = ridersByNet[netName] || [];
      const laterals = lateralsByNet[netName] || [];
      const wire = { netName, drivers, riders, laterals };
      [...drivers, ...riders, ...laterals].forEach((port) => {
        port.wire = wire;
      });
      return wire;
    });
  }
};

// lib/index.ts
var onml4 = __require("onml");
var elk = new ELK();
var defaultConfig = {
  hierarchy: {
    enable: "off",
    expandLevel: 0,
    expandModules: { types: [], ids: [] }
  },
  top: { enable: false, module: "" }
};
function createFlatModule(skinData, yosysNetlist, configData) {
  Skin_default.skin = onml4.p(skinData);
  const config = configData || defaultConfig;
  return FlatModule.fromNetlist(yosysNetlist, config);
}
async function dumpLayout(skinData, yosysNetlist, prelayout, done) {
  try {
    const flatModule = createFlatModule(skinData, yosysNetlist);
    const kgraph = buildElkGraph(flatModule);
    if (prelayout) {
      done(null, JSON.stringify(kgraph, null, 2));
      return;
    }
    const layoutProps = Skin_default.getProperties();
    const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
    done(null, JSON.stringify(graph, null, 2));
  } catch (error) {
    done(error instanceof Error ? error : new Error(String(error)));
  }
}
function render(skinData, yosysNetlist, done, elkData, configData) {
  const flatModule = createFlatModule(skinData, yosysNetlist, configData);
  const kgraph = buildElkGraph(flatModule);
  const layoutProps = Skin_default.getProperties();
  const renderPromise = (async () => {
    if (elkData) {
      return drawModule(elkData, flatModule);
    }
    try {
      const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
      return drawModule(graph, flatModule);
    } catch (error) {
      console.error(error);
      throw error;
    }
  })();
  if (done) {
    renderPromise.then((output) => done(null, output)).catch((error) => done(error instanceof Error ? error : new Error(String(error))));
  }
  return renderPromise;
}
export {
  dumpLayout,
  render
};
