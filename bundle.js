const require = (name) => name === 'elkjs' ? window.ELK : undefined;
"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };

  // node_modules/component-emitter/index.js
  var require_component_emitter = __commonJS({
    "node_modules/component-emitter/index.js"(exports, module) {
      if (typeof module !== "undefined") {
        module.exports = Emitter;
      }
      function Emitter(obj) {
        if (obj) return mixin(obj);
      }
      function mixin(obj) {
        for (var key in Emitter.prototype) {
          obj[key] = Emitter.prototype[key];
        }
        return obj;
      }
      Emitter.prototype.on = Emitter.prototype.addEventListener = function(event, fn) {
        this._callbacks = this._callbacks || {};
        (this._callbacks["$" + event] = this._callbacks["$" + event] || []).push(fn);
        return this;
      };
      Emitter.prototype.once = function(event, fn) {
        function on() {
          this.off(event, on);
          fn.apply(this, arguments);
        }
        on.fn = fn;
        this.on(event, on);
        return this;
      };
      Emitter.prototype.off = Emitter.prototype.removeListener = Emitter.prototype.removeAllListeners = Emitter.prototype.removeEventListener = function(event, fn) {
        this._callbacks = this._callbacks || {};
        if (0 == arguments.length) {
          this._callbacks = {};
          return this;
        }
        var callbacks = this._callbacks["$" + event];
        if (!callbacks) return this;
        if (1 == arguments.length) {
          delete this._callbacks["$" + event];
          return this;
        }
        var cb;
        for (var i = 0; i < callbacks.length; i++) {
          cb = callbacks[i];
          if (cb === fn || cb.fn === fn) {
            callbacks.splice(i, 1);
            break;
          }
        }
        if (callbacks.length === 0) {
          delete this._callbacks["$" + event];
        }
        return this;
      };
      Emitter.prototype.emit = function(event) {
        this._callbacks = this._callbacks || {};
        var args = new Array(arguments.length - 1), callbacks = this._callbacks["$" + event];
        for (var i = 1; i < arguments.length; i++) {
          args[i - 1] = arguments[i];
        }
        if (callbacks) {
          callbacks = callbacks.slice(0);
          for (var i = 0, len = callbacks.length; i < len; ++i) {
            callbacks[i].apply(this, args);
          }
        }
        return this;
      };
      Emitter.prototype.listeners = function(event) {
        this._callbacks = this._callbacks || {};
        return this._callbacks["$" + event] || [];
      };
      Emitter.prototype.hasListeners = function(event) {
        return !!this.listeners(event).length;
      };
    }
  });

  // node_modules/fast-safe-stringify/index.js
  var require_fast_safe_stringify = __commonJS({
    "node_modules/fast-safe-stringify/index.js"(exports, module) {
      module.exports = stringify;
      stringify.default = stringify;
      stringify.stable = deterministicStringify;
      stringify.stableStringify = deterministicStringify;
      var LIMIT_REPLACE_NODE = "[...]";
      var CIRCULAR_REPLACE_NODE = "[Circular]";
      var arr = [];
      var replacerStack = [];
      function defaultOptions() {
        return {
          depthLimit: Number.MAX_SAFE_INTEGER,
          edgesLimit: Number.MAX_SAFE_INTEGER
        };
      }
      function stringify(obj, replacer, spacer, options) {
        if (typeof options === "undefined") {
          options = defaultOptions();
        }
        decirc(obj, "", 0, [], void 0, 0, options);
        var res;
        try {
          if (replacerStack.length === 0) {
            res = JSON.stringify(obj, replacer, spacer);
          } else {
            res = JSON.stringify(obj, replaceGetterValues(replacer), spacer);
          }
        } catch (_) {
          return JSON.stringify("[unable to serialize, circular reference is too complex to analyze]");
        } finally {
          while (arr.length !== 0) {
            var part = arr.pop();
            if (part.length === 4) {
              Object.defineProperty(part[0], part[1], part[3]);
            } else {
              part[0][part[1]] = part[2];
            }
          }
        }
        return res;
      }
      function setReplace(replace, val, k, parent) {
        var propertyDescriptor = Object.getOwnPropertyDescriptor(parent, k);
        if (propertyDescriptor.get !== void 0) {
          if (propertyDescriptor.configurable) {
            Object.defineProperty(parent, k, { value: replace });
            arr.push([parent, k, val, propertyDescriptor]);
          } else {
            replacerStack.push([val, k, replace]);
          }
        } else {
          parent[k] = replace;
          arr.push([parent, k, val]);
        }
      }
      function decirc(val, k, edgeIndex, stack, parent, depth, options) {
        depth += 1;
        var i;
        if (typeof val === "object" && val !== null) {
          for (i = 0; i < stack.length; i++) {
            if (stack[i] === val) {
              setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
              return;
            }
          }
          if (typeof options.depthLimit !== "undefined" && depth > options.depthLimit) {
            setReplace(LIMIT_REPLACE_NODE, val, k, parent);
            return;
          }
          if (typeof options.edgesLimit !== "undefined" && edgeIndex + 1 > options.edgesLimit) {
            setReplace(LIMIT_REPLACE_NODE, val, k, parent);
            return;
          }
          stack.push(val);
          if (Array.isArray(val)) {
            for (i = 0; i < val.length; i++) {
              decirc(val[i], i, i, stack, val, depth, options);
            }
          } else {
            var keys = Object.keys(val);
            for (i = 0; i < keys.length; i++) {
              var key = keys[i];
              decirc(val[key], key, i, stack, val, depth, options);
            }
          }
          stack.pop();
        }
      }
      function compareFunction(a, b) {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      }
      function deterministicStringify(obj, replacer, spacer, options) {
        if (typeof options === "undefined") {
          options = defaultOptions();
        }
        var tmp = deterministicDecirc(obj, "", 0, [], void 0, 0, options) || obj;
        var res;
        try {
          if (replacerStack.length === 0) {
            res = JSON.stringify(tmp, replacer, spacer);
          } else {
            res = JSON.stringify(tmp, replaceGetterValues(replacer), spacer);
          }
        } catch (_) {
          return JSON.stringify("[unable to serialize, circular reference is too complex to analyze]");
        } finally {
          while (arr.length !== 0) {
            var part = arr.pop();
            if (part.length === 4) {
              Object.defineProperty(part[0], part[1], part[3]);
            } else {
              part[0][part[1]] = part[2];
            }
          }
        }
        return res;
      }
      function deterministicDecirc(val, k, edgeIndex, stack, parent, depth, options) {
        depth += 1;
        var i;
        if (typeof val === "object" && val !== null) {
          for (i = 0; i < stack.length; i++) {
            if (stack[i] === val) {
              setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
              return;
            }
          }
          try {
            if (typeof val.toJSON === "function") {
              return;
            }
          } catch (_) {
            return;
          }
          if (typeof options.depthLimit !== "undefined" && depth > options.depthLimit) {
            setReplace(LIMIT_REPLACE_NODE, val, k, parent);
            return;
          }
          if (typeof options.edgesLimit !== "undefined" && edgeIndex + 1 > options.edgesLimit) {
            setReplace(LIMIT_REPLACE_NODE, val, k, parent);
            return;
          }
          stack.push(val);
          if (Array.isArray(val)) {
            for (i = 0; i < val.length; i++) {
              deterministicDecirc(val[i], i, i, stack, val, depth, options);
            }
          } else {
            var tmp = {};
            var keys = Object.keys(val).sort(compareFunction);
            for (i = 0; i < keys.length; i++) {
              var key = keys[i];
              deterministicDecirc(val[key], key, i, stack, val, depth, options);
              tmp[key] = val[key];
            }
            if (typeof parent !== "undefined") {
              arr.push([parent, k, val]);
              parent[k] = tmp;
            } else {
              return tmp;
            }
          }
          stack.pop();
        }
      }
      function replaceGetterValues(replacer) {
        replacer = typeof replacer !== "undefined" ? replacer : function(k, v) {
          return v;
        };
        return function(key, val) {
          if (replacerStack.length > 0) {
            for (var i = 0; i < replacerStack.length; i++) {
              var part = replacerStack[i];
              if (part[1] === key && part[0] === val) {
                val = part[2];
                replacerStack.splice(i, 1);
                break;
              }
            }
          }
          return replacer.call(this, key, val);
        };
      }
    }
  });

  // node_modules/es-errors/type.js
  var require_type = __commonJS({
    "node_modules/es-errors/type.js"(exports, module) {
      "use strict";
      module.exports = TypeError;
    }
  });

  // (disabled):node_modules/object-inspect/util.inspect
  var require_util = __commonJS({
    "(disabled):node_modules/object-inspect/util.inspect"() {
    }
  });

  // node_modules/object-inspect/index.js
  var require_object_inspect = __commonJS({
    "node_modules/object-inspect/index.js"(exports, module) {
      var hasMap = typeof Map === "function" && Map.prototype;
      var mapSizeDescriptor = Object.getOwnPropertyDescriptor && hasMap ? Object.getOwnPropertyDescriptor(Map.prototype, "size") : null;
      var mapSize = hasMap && mapSizeDescriptor && typeof mapSizeDescriptor.get === "function" ? mapSizeDescriptor.get : null;
      var mapForEach = hasMap && Map.prototype.forEach;
      var hasSet = typeof Set === "function" && Set.prototype;
      var setSizeDescriptor = Object.getOwnPropertyDescriptor && hasSet ? Object.getOwnPropertyDescriptor(Set.prototype, "size") : null;
      var setSize = hasSet && setSizeDescriptor && typeof setSizeDescriptor.get === "function" ? setSizeDescriptor.get : null;
      var setForEach = hasSet && Set.prototype.forEach;
      var hasWeakMap = typeof WeakMap === "function" && WeakMap.prototype;
      var weakMapHas = hasWeakMap ? WeakMap.prototype.has : null;
      var hasWeakSet = typeof WeakSet === "function" && WeakSet.prototype;
      var weakSetHas = hasWeakSet ? WeakSet.prototype.has : null;
      var hasWeakRef = typeof WeakRef === "function" && WeakRef.prototype;
      var weakRefDeref = hasWeakRef ? WeakRef.prototype.deref : null;
      var booleanValueOf = Boolean.prototype.valueOf;
      var objectToString = Object.prototype.toString;
      var functionToString = Function.prototype.toString;
      var $match = String.prototype.match;
      var $slice = String.prototype.slice;
      var $replace = String.prototype.replace;
      var $toUpperCase = String.prototype.toUpperCase;
      var $toLowerCase = String.prototype.toLowerCase;
      var $test = RegExp.prototype.test;
      var $concat = Array.prototype.concat;
      var $join = Array.prototype.join;
      var $arrSlice = Array.prototype.slice;
      var $floor = Math.floor;
      var bigIntValueOf = typeof BigInt === "function" ? BigInt.prototype.valueOf : null;
      var gOPS = Object.getOwnPropertySymbols;
      var symToString = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? Symbol.prototype.toString : null;
      var hasShammedSymbols = typeof Symbol === "function" && typeof Symbol.iterator === "object";
      var toStringTag = typeof Symbol === "function" && Symbol.toStringTag && (typeof Symbol.toStringTag === hasShammedSymbols ? "object" : "symbol") ? Symbol.toStringTag : null;
      var isEnumerable = Object.prototype.propertyIsEnumerable;
      var gPO = (typeof Reflect === "function" ? Reflect.getPrototypeOf : Object.getPrototypeOf) || ([].__proto__ === Array.prototype ? function(O) {
        return O.__proto__;
      } : null);
      function addNumericSeparator(num, str) {
        if (num === Infinity || num === -Infinity || num !== num || num && num > -1e3 && num < 1e3 || $test.call(/e/, str)) {
          return str;
        }
        var sepRegex = /[0-9](?=(?:[0-9]{3})+(?![0-9]))/g;
        if (typeof num === "number") {
          var int = num < 0 ? -$floor(-num) : $floor(num);
          if (int !== num) {
            var intStr = String(int);
            var dec = $slice.call(str, intStr.length + 1);
            return $replace.call(intStr, sepRegex, "$&_") + "." + $replace.call($replace.call(dec, /([0-9]{3})/g, "$&_"), /_$/, "");
          }
        }
        return $replace.call(str, sepRegex, "$&_");
      }
      var utilInspect = require_util();
      var inspectCustom = utilInspect.custom;
      var inspectSymbol = isSymbol(inspectCustom) ? inspectCustom : null;
      var quotes = {
        __proto__: null,
        "double": '"',
        single: "'"
      };
      var quoteREs = {
        __proto__: null,
        "double": /(["\\])/g,
        single: /(['\\])/g
      };
      module.exports = function inspect_(obj, options, depth, seen) {
        var opts = options || {};
        if (has(opts, "quoteStyle") && !has(quotes, opts.quoteStyle)) {
          throw new TypeError('option "quoteStyle" must be "single" or "double"');
        }
        if (has(opts, "maxStringLength") && (typeof opts.maxStringLength === "number" ? opts.maxStringLength < 0 && opts.maxStringLength !== Infinity : opts.maxStringLength !== null)) {
          throw new TypeError('option "maxStringLength", if provided, must be a positive integer, Infinity, or `null`');
        }
        var customInspect = has(opts, "customInspect") ? opts.customInspect : true;
        if (typeof customInspect !== "boolean" && customInspect !== "symbol") {
          throw new TypeError("option \"customInspect\", if provided, must be `true`, `false`, or `'symbol'`");
        }
        if (has(opts, "indent") && opts.indent !== null && opts.indent !== "	" && !(parseInt(opts.indent, 10) === opts.indent && opts.indent > 0)) {
          throw new TypeError('option "indent" must be "\\t", an integer > 0, or `null`');
        }
        if (has(opts, "numericSeparator") && typeof opts.numericSeparator !== "boolean") {
          throw new TypeError('option "numericSeparator", if provided, must be `true` or `false`');
        }
        var numericSeparator = opts.numericSeparator;
        if (typeof obj === "undefined") {
          return "undefined";
        }
        if (obj === null) {
          return "null";
        }
        if (typeof obj === "boolean") {
          return obj ? "true" : "false";
        }
        if (typeof obj === "string") {
          return inspectString(obj, opts);
        }
        if (typeof obj === "number") {
          if (obj === 0) {
            return Infinity / obj > 0 ? "0" : "-0";
          }
          var str = String(obj);
          return numericSeparator ? addNumericSeparator(obj, str) : str;
        }
        if (typeof obj === "bigint") {
          var bigIntStr = String(obj) + "n";
          return numericSeparator ? addNumericSeparator(obj, bigIntStr) : bigIntStr;
        }
        var maxDepth = typeof opts.depth === "undefined" ? 5 : opts.depth;
        if (typeof depth === "undefined") {
          depth = 0;
        }
        if (depth >= maxDepth && maxDepth > 0 && typeof obj === "object") {
          return isArray(obj) ? "[Array]" : "[Object]";
        }
        var indent = getIndent(opts, depth);
        if (typeof seen === "undefined") {
          seen = [];
        } else if (indexOf(seen, obj) >= 0) {
          return "[Circular]";
        }
        function inspect(value, from, noIndent) {
          if (from) {
            seen = $arrSlice.call(seen);
            seen.push(from);
          }
          if (noIndent) {
            var newOpts = {
              depth: opts.depth
            };
            if (has(opts, "quoteStyle")) {
              newOpts.quoteStyle = opts.quoteStyle;
            }
            return inspect_(value, newOpts, depth + 1, seen);
          }
          return inspect_(value, opts, depth + 1, seen);
        }
        if (typeof obj === "function" && !isRegExp(obj)) {
          var name = nameOf(obj);
          var keys = arrObjKeys(obj, inspect);
          return "[Function" + (name ? ": " + name : " (anonymous)") + "]" + (keys.length > 0 ? " { " + $join.call(keys, ", ") + " }" : "");
        }
        if (isSymbol(obj)) {
          var symString = hasShammedSymbols ? $replace.call(String(obj), /^(Symbol\(.*\))_[^)]*$/, "$1") : symToString.call(obj);
          return typeof obj === "object" && !hasShammedSymbols ? markBoxed(symString) : symString;
        }
        if (isElement(obj)) {
          var s = "<" + $toLowerCase.call(String(obj.nodeName));
          var attrs = obj.attributes || [];
          for (var i = 0; i < attrs.length; i++) {
            s += " " + attrs[i].name + "=" + wrapQuotes(quote(attrs[i].value), "double", opts);
          }
          s += ">";
          if (obj.childNodes && obj.childNodes.length) {
            s += "...";
          }
          s += "</" + $toLowerCase.call(String(obj.nodeName)) + ">";
          return s;
        }
        if (isArray(obj)) {
          if (obj.length === 0) {
            return "[]";
          }
          var xs = arrObjKeys(obj, inspect);
          if (indent && !singleLineValues(xs)) {
            return "[" + indentedJoin(xs, indent) + "]";
          }
          return "[ " + $join.call(xs, ", ") + " ]";
        }
        if (isError(obj)) {
          var parts = arrObjKeys(obj, inspect);
          if (!("cause" in Error.prototype) && "cause" in obj && !isEnumerable.call(obj, "cause")) {
            return "{ [" + String(obj) + "] " + $join.call($concat.call("[cause]: " + inspect(obj.cause), parts), ", ") + " }";
          }
          if (parts.length === 0) {
            return "[" + String(obj) + "]";
          }
          return "{ [" + String(obj) + "] " + $join.call(parts, ", ") + " }";
        }
        if (typeof obj === "object" && customInspect) {
          if (inspectSymbol && typeof obj[inspectSymbol] === "function" && utilInspect) {
            return utilInspect(obj, { depth: maxDepth - depth });
          } else if (customInspect !== "symbol" && typeof obj.inspect === "function") {
            return obj.inspect();
          }
        }
        if (isMap(obj)) {
          var mapParts = [];
          if (mapForEach) {
            mapForEach.call(obj, function(value, key) {
              mapParts.push(inspect(key, obj, true) + " => " + inspect(value, obj));
            });
          }
          return collectionOf("Map", mapSize.call(obj), mapParts, indent);
        }
        if (isSet(obj)) {
          var setParts = [];
          if (setForEach) {
            setForEach.call(obj, function(value) {
              setParts.push(inspect(value, obj));
            });
          }
          return collectionOf("Set", setSize.call(obj), setParts, indent);
        }
        if (isWeakMap(obj)) {
          return weakCollectionOf("WeakMap");
        }
        if (isWeakSet(obj)) {
          return weakCollectionOf("WeakSet");
        }
        if (isWeakRef(obj)) {
          return weakCollectionOf("WeakRef");
        }
        if (isNumber(obj)) {
          return markBoxed(inspect(Number(obj)));
        }
        if (isBigInt(obj)) {
          return markBoxed(inspect(bigIntValueOf.call(obj)));
        }
        if (isBoolean(obj)) {
          return markBoxed(booleanValueOf.call(obj));
        }
        if (isString(obj)) {
          return markBoxed(inspect(String(obj)));
        }
        if (typeof window !== "undefined" && obj === window) {
          return "{ [object Window] }";
        }
        if (typeof globalThis !== "undefined" && obj === globalThis || typeof global !== "undefined" && obj === global) {
          return "{ [object globalThis] }";
        }
        if (!isDate(obj) && !isRegExp(obj)) {
          var ys = arrObjKeys(obj, inspect);
          var isPlainObject = gPO ? gPO(obj) === Object.prototype : obj instanceof Object || obj.constructor === Object;
          var protoTag = obj instanceof Object ? "" : "null prototype";
          var stringTag = !isPlainObject && toStringTag && Object(obj) === obj && toStringTag in obj ? $slice.call(toStr(obj), 8, -1) : protoTag ? "Object" : "";
          var constructorTag = isPlainObject || typeof obj.constructor !== "function" ? "" : obj.constructor.name ? obj.constructor.name + " " : "";
          var tag = constructorTag + (stringTag || protoTag ? "[" + $join.call($concat.call([], stringTag || [], protoTag || []), ": ") + "] " : "");
          if (ys.length === 0) {
            return tag + "{}";
          }
          if (indent) {
            return tag + "{" + indentedJoin(ys, indent) + "}";
          }
          return tag + "{ " + $join.call(ys, ", ") + " }";
        }
        return String(obj);
      };
      function wrapQuotes(s, defaultStyle, opts) {
        var style = opts.quoteStyle || defaultStyle;
        var quoteChar = quotes[style];
        return quoteChar + s + quoteChar;
      }
      function quote(s) {
        return $replace.call(String(s), /"/g, "&quot;");
      }
      function canTrustToString(obj) {
        return !toStringTag || !(typeof obj === "object" && (toStringTag in obj || typeof obj[toStringTag] !== "undefined"));
      }
      function isArray(obj) {
        return toStr(obj) === "[object Array]" && canTrustToString(obj);
      }
      function isDate(obj) {
        return toStr(obj) === "[object Date]" && canTrustToString(obj);
      }
      function isRegExp(obj) {
        return toStr(obj) === "[object RegExp]" && canTrustToString(obj);
      }
      function isError(obj) {
        return toStr(obj) === "[object Error]" && canTrustToString(obj);
      }
      function isString(obj) {
        return toStr(obj) === "[object String]" && canTrustToString(obj);
      }
      function isNumber(obj) {
        return toStr(obj) === "[object Number]" && canTrustToString(obj);
      }
      function isBoolean(obj) {
        return toStr(obj) === "[object Boolean]" && canTrustToString(obj);
      }
      function isSymbol(obj) {
        if (hasShammedSymbols) {
          return obj && typeof obj === "object" && obj instanceof Symbol;
        }
        if (typeof obj === "symbol") {
          return true;
        }
        if (!obj || typeof obj !== "object" || !symToString) {
          return false;
        }
        try {
          symToString.call(obj);
          return true;
        } catch (e) {
        }
        return false;
      }
      function isBigInt(obj) {
        if (!obj || typeof obj !== "object" || !bigIntValueOf) {
          return false;
        }
        try {
          bigIntValueOf.call(obj);
          return true;
        } catch (e) {
        }
        return false;
      }
      var hasOwn = Object.prototype.hasOwnProperty || function(key) {
        return key in this;
      };
      function has(obj, key) {
        return hasOwn.call(obj, key);
      }
      function toStr(obj) {
        return objectToString.call(obj);
      }
      function nameOf(f) {
        if (f.name) {
          return f.name;
        }
        var m = $match.call(functionToString.call(f), /^function\s*([\w$]+)/);
        if (m) {
          return m[1];
        }
        return null;
      }
      function indexOf(xs, x) {
        if (xs.indexOf) {
          return xs.indexOf(x);
        }
        for (var i = 0, l = xs.length; i < l; i++) {
          if (xs[i] === x) {
            return i;
          }
        }
        return -1;
      }
      function isMap(x) {
        if (!mapSize || !x || typeof x !== "object") {
          return false;
        }
        try {
          mapSize.call(x);
          try {
            setSize.call(x);
          } catch (s) {
            return true;
          }
          return x instanceof Map;
        } catch (e) {
        }
        return false;
      }
      function isWeakMap(x) {
        if (!weakMapHas || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakMapHas.call(x, weakMapHas);
          try {
            weakSetHas.call(x, weakSetHas);
          } catch (s) {
            return true;
          }
          return x instanceof WeakMap;
        } catch (e) {
        }
        return false;
      }
      function isWeakRef(x) {
        if (!weakRefDeref || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakRefDeref.call(x);
          return true;
        } catch (e) {
        }
        return false;
      }
      function isSet(x) {
        if (!setSize || !x || typeof x !== "object") {
          return false;
        }
        try {
          setSize.call(x);
          try {
            mapSize.call(x);
          } catch (m) {
            return true;
          }
          return x instanceof Set;
        } catch (e) {
        }
        return false;
      }
      function isWeakSet(x) {
        if (!weakSetHas || !x || typeof x !== "object") {
          return false;
        }
        try {
          weakSetHas.call(x, weakSetHas);
          try {
            weakMapHas.call(x, weakMapHas);
          } catch (s) {
            return true;
          }
          return x instanceof WeakSet;
        } catch (e) {
        }
        return false;
      }
      function isElement(x) {
        if (!x || typeof x !== "object") {
          return false;
        }
        if (typeof HTMLElement !== "undefined" && x instanceof HTMLElement) {
          return true;
        }
        return typeof x.nodeName === "string" && typeof x.getAttribute === "function";
      }
      function inspectString(str, opts) {
        if (str.length > opts.maxStringLength) {
          var remaining = str.length - opts.maxStringLength;
          var trailer = "... " + remaining + " more character" + (remaining > 1 ? "s" : "");
          return inspectString($slice.call(str, 0, opts.maxStringLength), opts) + trailer;
        }
        var quoteRE = quoteREs[opts.quoteStyle || "single"];
        quoteRE.lastIndex = 0;
        var s = $replace.call($replace.call(str, quoteRE, "\\$1"), /[\x00-\x1f]/g, lowbyte);
        return wrapQuotes(s, "single", opts);
      }
      function lowbyte(c) {
        var n = c.charCodeAt(0);
        var x = {
          8: "b",
          9: "t",
          10: "n",
          12: "f",
          13: "r"
        }[n];
        if (x) {
          return "\\" + x;
        }
        return "\\x" + (n < 16 ? "0" : "") + $toUpperCase.call(n.toString(16));
      }
      function markBoxed(str) {
        return "Object(" + str + ")";
      }
      function weakCollectionOf(type) {
        return type + " { ? }";
      }
      function collectionOf(type, size, entries, indent) {
        var joinedEntries = indent ? indentedJoin(entries, indent) : $join.call(entries, ", ");
        return type + " (" + size + ") {" + joinedEntries + "}";
      }
      function singleLineValues(xs) {
        for (var i = 0; i < xs.length; i++) {
          if (indexOf(xs[i], "\n") >= 0) {
            return false;
          }
        }
        return true;
      }
      function getIndent(opts, depth) {
        var baseIndent;
        if (opts.indent === "	") {
          baseIndent = "	";
        } else if (typeof opts.indent === "number" && opts.indent > 0) {
          baseIndent = $join.call(Array(opts.indent + 1), " ");
        } else {
          return null;
        }
        return {
          base: baseIndent,
          prev: $join.call(Array(depth + 1), baseIndent)
        };
      }
      function indentedJoin(xs, indent) {
        if (xs.length === 0) {
          return "";
        }
        var lineJoiner = "\n" + indent.prev + indent.base;
        return lineJoiner + $join.call(xs, "," + lineJoiner) + "\n" + indent.prev;
      }
      function arrObjKeys(obj, inspect) {
        var isArr = isArray(obj);
        var xs = [];
        if (isArr) {
          xs.length = obj.length;
          for (var i = 0; i < obj.length; i++) {
            xs[i] = has(obj, i) ? inspect(obj[i], obj) : "";
          }
        }
        var syms = typeof gOPS === "function" ? gOPS(obj) : [];
        var symMap;
        if (hasShammedSymbols) {
          symMap = {};
          for (var k = 0; k < syms.length; k++) {
            symMap["$" + syms[k]] = syms[k];
          }
        }
        for (var key in obj) {
          if (!has(obj, key)) {
            continue;
          }
          if (isArr && String(Number(key)) === key && key < obj.length) {
            continue;
          }
          if (hasShammedSymbols && symMap["$" + key] instanceof Symbol) {
            continue;
          } else if ($test.call(/[^\w$]/, key)) {
            xs.push(inspect(key, obj) + ": " + inspect(obj[key], obj));
          } else {
            xs.push(key + ": " + inspect(obj[key], obj));
          }
        }
        if (typeof gOPS === "function") {
          for (var j = 0; j < syms.length; j++) {
            if (isEnumerable.call(obj, syms[j])) {
              xs.push("[" + inspect(syms[j]) + "]: " + inspect(obj[syms[j]], obj));
            }
          }
        }
        return xs;
      }
    }
  });

  // node_modules/side-channel-list/index.js
  var require_side_channel_list = __commonJS({
    "node_modules/side-channel-list/index.js"(exports, module) {
      "use strict";
      var inspect = require_object_inspect();
      var $TypeError = require_type();
      var listGetNode = function(list, key, isDelete) {
        var prev = list;
        var curr;
        for (; (curr = prev.next) != null; prev = curr) {
          if (curr.key === key) {
            prev.next = curr.next;
            if (!isDelete) {
              curr.next = /** @type {NonNullable<typeof list.next>} */
              list.next;
              list.next = curr;
            }
            return curr;
          }
        }
      };
      var listGet = function(objects, key) {
        if (!objects) {
          return void 0;
        }
        var node = listGetNode(objects, key);
        return node && node.value;
      };
      var listSet = function(objects, key, value) {
        var node = listGetNode(objects, key);
        if (node) {
          node.value = value;
        } else {
          objects.next = /** @type {import('./list.d.ts').ListNode<typeof value, typeof key>} */
          {
            // eslint-disable-line no-param-reassign, no-extra-parens
            key,
            next: objects.next,
            value
          };
        }
      };
      var listHas = function(objects, key) {
        if (!objects) {
          return false;
        }
        return !!listGetNode(objects, key);
      };
      var listDelete = function(objects, key) {
        if (objects) {
          return listGetNode(objects, key, true);
        }
      };
      module.exports = function getSideChannelList() {
        var $o;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              throw new $TypeError("Side channel does not contain " + inspect(key));
            }
          },
          "delete": function(key) {
            var deletedNode = listDelete($o, key);
            if (deletedNode && $o && !$o.next) {
              $o = void 0;
            }
            return !!deletedNode;
          },
          get: function(key) {
            return listGet($o, key);
          },
          has: function(key) {
            return listHas($o, key);
          },
          set: function(key, value) {
            if (!$o) {
              $o = {
                next: void 0
              };
            }
            listSet(
              /** @type {NonNullable<typeof $o>} */
              $o,
              key,
              value
            );
          }
        };
        return channel;
      };
    }
  });

  // node_modules/es-object-atoms/index.js
  var require_es_object_atoms = __commonJS({
    "node_modules/es-object-atoms/index.js"(exports, module) {
      "use strict";
      module.exports = Object;
    }
  });

  // node_modules/es-errors/index.js
  var require_es_errors = __commonJS({
    "node_modules/es-errors/index.js"(exports, module) {
      "use strict";
      module.exports = Error;
    }
  });

  // node_modules/es-errors/eval.js
  var require_eval = __commonJS({
    "node_modules/es-errors/eval.js"(exports, module) {
      "use strict";
      module.exports = EvalError;
    }
  });

  // node_modules/es-errors/range.js
  var require_range = __commonJS({
    "node_modules/es-errors/range.js"(exports, module) {
      "use strict";
      module.exports = RangeError;
    }
  });

  // node_modules/es-errors/ref.js
  var require_ref = __commonJS({
    "node_modules/es-errors/ref.js"(exports, module) {
      "use strict";
      module.exports = ReferenceError;
    }
  });

  // node_modules/es-errors/syntax.js
  var require_syntax = __commonJS({
    "node_modules/es-errors/syntax.js"(exports, module) {
      "use strict";
      module.exports = SyntaxError;
    }
  });

  // node_modules/es-errors/uri.js
  var require_uri = __commonJS({
    "node_modules/es-errors/uri.js"(exports, module) {
      "use strict";
      module.exports = URIError;
    }
  });

  // node_modules/math-intrinsics/abs.js
  var require_abs = __commonJS({
    "node_modules/math-intrinsics/abs.js"(exports, module) {
      "use strict";
      module.exports = Math.abs;
    }
  });

  // node_modules/math-intrinsics/floor.js
  var require_floor = __commonJS({
    "node_modules/math-intrinsics/floor.js"(exports, module) {
      "use strict";
      module.exports = Math.floor;
    }
  });

  // node_modules/math-intrinsics/max.js
  var require_max = __commonJS({
    "node_modules/math-intrinsics/max.js"(exports, module) {
      "use strict";
      module.exports = Math.max;
    }
  });

  // node_modules/math-intrinsics/min.js
  var require_min = __commonJS({
    "node_modules/math-intrinsics/min.js"(exports, module) {
      "use strict";
      module.exports = Math.min;
    }
  });

  // node_modules/math-intrinsics/pow.js
  var require_pow = __commonJS({
    "node_modules/math-intrinsics/pow.js"(exports, module) {
      "use strict";
      module.exports = Math.pow;
    }
  });

  // node_modules/math-intrinsics/round.js
  var require_round = __commonJS({
    "node_modules/math-intrinsics/round.js"(exports, module) {
      "use strict";
      module.exports = Math.round;
    }
  });

  // node_modules/math-intrinsics/isNaN.js
  var require_isNaN = __commonJS({
    "node_modules/math-intrinsics/isNaN.js"(exports, module) {
      "use strict";
      module.exports = Number.isNaN || function isNaN2(a) {
        return a !== a;
      };
    }
  });

  // node_modules/math-intrinsics/sign.js
  var require_sign = __commonJS({
    "node_modules/math-intrinsics/sign.js"(exports, module) {
      "use strict";
      var $isNaN = require_isNaN();
      module.exports = function sign(number) {
        if ($isNaN(number) || number === 0) {
          return number;
        }
        return number < 0 ? -1 : 1;
      };
    }
  });

  // node_modules/gopd/gOPD.js
  var require_gOPD = __commonJS({
    "node_modules/gopd/gOPD.js"(exports, module) {
      "use strict";
      module.exports = Object.getOwnPropertyDescriptor;
    }
  });

  // node_modules/gopd/index.js
  var require_gopd = __commonJS({
    "node_modules/gopd/index.js"(exports, module) {
      "use strict";
      var $gOPD = require_gOPD();
      if ($gOPD) {
        try {
          $gOPD([], "length");
        } catch (e) {
          $gOPD = null;
        }
      }
      module.exports = $gOPD;
    }
  });

  // node_modules/es-define-property/index.js
  var require_es_define_property = __commonJS({
    "node_modules/es-define-property/index.js"(exports, module) {
      "use strict";
      var $defineProperty = Object.defineProperty || false;
      if ($defineProperty) {
        try {
          $defineProperty({}, "a", { value: 1 });
        } catch (e) {
          $defineProperty = false;
        }
      }
      module.exports = $defineProperty;
    }
  });

  // node_modules/has-symbols/shams.js
  var require_shams = __commonJS({
    "node_modules/has-symbols/shams.js"(exports, module) {
      "use strict";
      module.exports = function hasSymbols() {
        if (typeof Symbol !== "function" || typeof Object.getOwnPropertySymbols !== "function") {
          return false;
        }
        if (typeof Symbol.iterator === "symbol") {
          return true;
        }
        var obj = {};
        var sym = /* @__PURE__ */ Symbol("test");
        var symObj = Object(sym);
        if (typeof sym === "string") {
          return false;
        }
        if (Object.prototype.toString.call(sym) !== "[object Symbol]") {
          return false;
        }
        if (Object.prototype.toString.call(symObj) !== "[object Symbol]") {
          return false;
        }
        var symVal = 42;
        obj[sym] = symVal;
        for (var _ in obj) {
          return false;
        }
        if (typeof Object.keys === "function" && Object.keys(obj).length !== 0) {
          return false;
        }
        if (typeof Object.getOwnPropertyNames === "function" && Object.getOwnPropertyNames(obj).length !== 0) {
          return false;
        }
        var syms = Object.getOwnPropertySymbols(obj);
        if (syms.length !== 1 || syms[0] !== sym) {
          return false;
        }
        if (!Object.prototype.propertyIsEnumerable.call(obj, sym)) {
          return false;
        }
        if (typeof Object.getOwnPropertyDescriptor === "function") {
          var descriptor = (
            /** @type {PropertyDescriptor} */
            Object.getOwnPropertyDescriptor(obj, sym)
          );
          if (descriptor.value !== symVal || descriptor.enumerable !== true) {
            return false;
          }
        }
        return true;
      };
    }
  });

  // node_modules/has-symbols/index.js
  var require_has_symbols = __commonJS({
    "node_modules/has-symbols/index.js"(exports, module) {
      "use strict";
      var origSymbol = typeof Symbol !== "undefined" && Symbol;
      var hasSymbolSham = require_shams();
      module.exports = function hasNativeSymbols() {
        if (typeof origSymbol !== "function") {
          return false;
        }
        if (typeof Symbol !== "function") {
          return false;
        }
        if (typeof origSymbol("foo") !== "symbol") {
          return false;
        }
        if (typeof /* @__PURE__ */ Symbol("bar") !== "symbol") {
          return false;
        }
        return hasSymbolSham();
      };
    }
  });

  // node_modules/get-proto/Reflect.getPrototypeOf.js
  var require_Reflect_getPrototypeOf = __commonJS({
    "node_modules/get-proto/Reflect.getPrototypeOf.js"(exports, module) {
      "use strict";
      module.exports = typeof Reflect !== "undefined" && Reflect.getPrototypeOf || null;
    }
  });

  // node_modules/get-proto/Object.getPrototypeOf.js
  var require_Object_getPrototypeOf = __commonJS({
    "node_modules/get-proto/Object.getPrototypeOf.js"(exports, module) {
      "use strict";
      var $Object = require_es_object_atoms();
      module.exports = $Object.getPrototypeOf || null;
    }
  });

  // node_modules/function-bind/implementation.js
  var require_implementation = __commonJS({
    "node_modules/function-bind/implementation.js"(exports, module) {
      "use strict";
      var ERROR_MESSAGE = "Function.prototype.bind called on incompatible ";
      var toStr = Object.prototype.toString;
      var max = Math.max;
      var funcType = "[object Function]";
      var concatty = function concatty2(a, b) {
        var arr = [];
        for (var i = 0; i < a.length; i += 1) {
          arr[i] = a[i];
        }
        for (var j = 0; j < b.length; j += 1) {
          arr[j + a.length] = b[j];
        }
        return arr;
      };
      var slicy = function slicy2(arrLike, offset) {
        var arr = [];
        for (var i = offset || 0, j = 0; i < arrLike.length; i += 1, j += 1) {
          arr[j] = arrLike[i];
        }
        return arr;
      };
      var joiny = function(arr, joiner) {
        var str = "";
        for (var i = 0; i < arr.length; i += 1) {
          str += arr[i];
          if (i + 1 < arr.length) {
            str += joiner;
          }
        }
        return str;
      };
      module.exports = function bind(that) {
        var target = this;
        if (typeof target !== "function" || toStr.apply(target) !== funcType) {
          throw new TypeError(ERROR_MESSAGE + target);
        }
        var args = slicy(arguments, 1);
        var bound;
        var binder = function() {
          if (this instanceof bound) {
            var result = target.apply(
              this,
              concatty(args, arguments)
            );
            if (Object(result) === result) {
              return result;
            }
            return this;
          }
          return target.apply(
            that,
            concatty(args, arguments)
          );
        };
        var boundLength = max(0, target.length - args.length);
        var boundArgs = [];
        for (var i = 0; i < boundLength; i++) {
          boundArgs[i] = "$" + i;
        }
        bound = Function("binder", "return function (" + joiny(boundArgs, ",") + "){ return binder.apply(this,arguments); }")(binder);
        if (target.prototype) {
          var Empty = function Empty2() {
          };
          Empty.prototype = target.prototype;
          bound.prototype = new Empty();
          Empty.prototype = null;
        }
        return bound;
      };
    }
  });

  // node_modules/function-bind/index.js
  var require_function_bind = __commonJS({
    "node_modules/function-bind/index.js"(exports, module) {
      "use strict";
      var implementation = require_implementation();
      module.exports = Function.prototype.bind || implementation;
    }
  });

  // node_modules/call-bind-apply-helpers/functionCall.js
  var require_functionCall = __commonJS({
    "node_modules/call-bind-apply-helpers/functionCall.js"(exports, module) {
      "use strict";
      module.exports = Function.prototype.call;
    }
  });

  // node_modules/call-bind-apply-helpers/functionApply.js
  var require_functionApply = __commonJS({
    "node_modules/call-bind-apply-helpers/functionApply.js"(exports, module) {
      "use strict";
      module.exports = Function.prototype.apply;
    }
  });

  // node_modules/call-bind-apply-helpers/reflectApply.js
  var require_reflectApply = __commonJS({
    "node_modules/call-bind-apply-helpers/reflectApply.js"(exports, module) {
      "use strict";
      module.exports = typeof Reflect !== "undefined" && Reflect && Reflect.apply;
    }
  });

  // node_modules/call-bind-apply-helpers/actualApply.js
  var require_actualApply = __commonJS({
    "node_modules/call-bind-apply-helpers/actualApply.js"(exports, module) {
      "use strict";
      var bind = require_function_bind();
      var $apply = require_functionApply();
      var $call = require_functionCall();
      var $reflectApply = require_reflectApply();
      module.exports = $reflectApply || bind.call($call, $apply);
    }
  });

  // node_modules/call-bind-apply-helpers/index.js
  var require_call_bind_apply_helpers = __commonJS({
    "node_modules/call-bind-apply-helpers/index.js"(exports, module) {
      "use strict";
      var bind = require_function_bind();
      var $TypeError = require_type();
      var $call = require_functionCall();
      var $actualApply = require_actualApply();
      module.exports = function callBindBasic(args) {
        if (args.length < 1 || typeof args[0] !== "function") {
          throw new $TypeError("a function is required");
        }
        return $actualApply(bind, $call, args);
      };
    }
  });

  // node_modules/dunder-proto/get.js
  var require_get = __commonJS({
    "node_modules/dunder-proto/get.js"(exports, module) {
      "use strict";
      var callBind = require_call_bind_apply_helpers();
      var gOPD = require_gopd();
      var hasProtoAccessor;
      try {
        hasProtoAccessor = /** @type {{ __proto__?: typeof Array.prototype }} */
        [].__proto__ === Array.prototype;
      } catch (e) {
        if (!e || typeof e !== "object" || !("code" in e) || e.code !== "ERR_PROTO_ACCESS") {
          throw e;
        }
      }
      var desc = !!hasProtoAccessor && gOPD && gOPD(
        Object.prototype,
        /** @type {keyof typeof Object.prototype} */
        "__proto__"
      );
      var $Object = Object;
      var $getPrototypeOf = $Object.getPrototypeOf;
      module.exports = desc && typeof desc.get === "function" ? callBind([desc.get]) : typeof $getPrototypeOf === "function" ? (
        /** @type {import('./get')} */
        function getDunder(value) {
          return $getPrototypeOf(value == null ? value : $Object(value));
        }
      ) : false;
    }
  });

  // node_modules/get-proto/index.js
  var require_get_proto = __commonJS({
    "node_modules/get-proto/index.js"(exports, module) {
      "use strict";
      var reflectGetProto = require_Reflect_getPrototypeOf();
      var originalGetProto = require_Object_getPrototypeOf();
      var getDunderProto = require_get();
      module.exports = reflectGetProto ? function getProto(O) {
        return reflectGetProto(O);
      } : originalGetProto ? function getProto(O) {
        if (!O || typeof O !== "object" && typeof O !== "function") {
          throw new TypeError("getProto: not an object");
        }
        return originalGetProto(O);
      } : getDunderProto ? function getProto(O) {
        return getDunderProto(O);
      } : null;
    }
  });

  // node_modules/hasown/index.js
  var require_hasown = __commonJS({
    "node_modules/hasown/index.js"(exports, module) {
      "use strict";
      var call = Function.prototype.call;
      var $hasOwn = Object.prototype.hasOwnProperty;
      var bind = require_function_bind();
      module.exports = bind.call(call, $hasOwn);
    }
  });

  // node_modules/get-intrinsic/index.js
  var require_get_intrinsic = __commonJS({
    "node_modules/get-intrinsic/index.js"(exports, module) {
      "use strict";
      var undefined2;
      var $Object = require_es_object_atoms();
      var $Error = require_es_errors();
      var $EvalError = require_eval();
      var $RangeError = require_range();
      var $ReferenceError = require_ref();
      var $SyntaxError = require_syntax();
      var $TypeError = require_type();
      var $URIError = require_uri();
      var abs = require_abs();
      var floor = require_floor();
      var max = require_max();
      var min = require_min();
      var pow = require_pow();
      var round = require_round();
      var sign = require_sign();
      var $Function = Function;
      var getEvalledConstructor = function(expressionSyntax) {
        try {
          return $Function('"use strict"; return (' + expressionSyntax + ").constructor;")();
        } catch (e) {
        }
      };
      var $gOPD = require_gopd();
      var $defineProperty = require_es_define_property();
      var throwTypeError = function() {
        throw new $TypeError();
      };
      var ThrowTypeError = $gOPD ? (function() {
        try {
          arguments.callee;
          return throwTypeError;
        } catch (calleeThrows) {
          try {
            return $gOPD(arguments, "callee").get;
          } catch (gOPDthrows) {
            return throwTypeError;
          }
        }
      })() : throwTypeError;
      var hasSymbols = require_has_symbols()();
      var getProto = require_get_proto();
      var $ObjectGPO = require_Object_getPrototypeOf();
      var $ReflectGPO = require_Reflect_getPrototypeOf();
      var $apply = require_functionApply();
      var $call = require_functionCall();
      var needsEval = {};
      var TypedArray = typeof Uint8Array === "undefined" || !getProto ? undefined2 : getProto(Uint8Array);
      var INTRINSICS = {
        __proto__: null,
        "%AggregateError%": typeof AggregateError === "undefined" ? undefined2 : AggregateError,
        "%Array%": Array,
        "%ArrayBuffer%": typeof ArrayBuffer === "undefined" ? undefined2 : ArrayBuffer,
        "%ArrayIteratorPrototype%": hasSymbols && getProto ? getProto([][Symbol.iterator]()) : undefined2,
        "%AsyncFromSyncIteratorPrototype%": undefined2,
        "%AsyncFunction%": needsEval,
        "%AsyncGenerator%": needsEval,
        "%AsyncGeneratorFunction%": needsEval,
        "%AsyncIteratorPrototype%": needsEval,
        "%Atomics%": typeof Atomics === "undefined" ? undefined2 : Atomics,
        "%BigInt%": typeof BigInt === "undefined" ? undefined2 : BigInt,
        "%BigInt64Array%": typeof BigInt64Array === "undefined" ? undefined2 : BigInt64Array,
        "%BigUint64Array%": typeof BigUint64Array === "undefined" ? undefined2 : BigUint64Array,
        "%Boolean%": Boolean,
        "%DataView%": typeof DataView === "undefined" ? undefined2 : DataView,
        "%Date%": Date,
        "%decodeURI%": decodeURI,
        "%decodeURIComponent%": decodeURIComponent,
        "%encodeURI%": encodeURI,
        "%encodeURIComponent%": encodeURIComponent,
        "%Error%": $Error,
        "%eval%": eval,
        // eslint-disable-line no-eval
        "%EvalError%": $EvalError,
        "%Float16Array%": typeof Float16Array === "undefined" ? undefined2 : Float16Array,
        "%Float32Array%": typeof Float32Array === "undefined" ? undefined2 : Float32Array,
        "%Float64Array%": typeof Float64Array === "undefined" ? undefined2 : Float64Array,
        "%FinalizationRegistry%": typeof FinalizationRegistry === "undefined" ? undefined2 : FinalizationRegistry,
        "%Function%": $Function,
        "%GeneratorFunction%": needsEval,
        "%Int8Array%": typeof Int8Array === "undefined" ? undefined2 : Int8Array,
        "%Int16Array%": typeof Int16Array === "undefined" ? undefined2 : Int16Array,
        "%Int32Array%": typeof Int32Array === "undefined" ? undefined2 : Int32Array,
        "%isFinite%": isFinite,
        "%isNaN%": isNaN,
        "%IteratorPrototype%": hasSymbols && getProto ? getProto(getProto([][Symbol.iterator]())) : undefined2,
        "%JSON%": typeof JSON === "object" ? JSON : undefined2,
        "%Map%": typeof Map === "undefined" ? undefined2 : Map,
        "%MapIteratorPrototype%": typeof Map === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Map())[Symbol.iterator]()),
        "%Math%": Math,
        "%Number%": Number,
        "%Object%": $Object,
        "%Object.getOwnPropertyDescriptor%": $gOPD,
        "%parseFloat%": parseFloat,
        "%parseInt%": parseInt,
        "%Promise%": typeof Promise === "undefined" ? undefined2 : Promise,
        "%Proxy%": typeof Proxy === "undefined" ? undefined2 : Proxy,
        "%RangeError%": $RangeError,
        "%ReferenceError%": $ReferenceError,
        "%Reflect%": typeof Reflect === "undefined" ? undefined2 : Reflect,
        "%RegExp%": RegExp,
        "%Set%": typeof Set === "undefined" ? undefined2 : Set,
        "%SetIteratorPrototype%": typeof Set === "undefined" || !hasSymbols || !getProto ? undefined2 : getProto((/* @__PURE__ */ new Set())[Symbol.iterator]()),
        "%SharedArrayBuffer%": typeof SharedArrayBuffer === "undefined" ? undefined2 : SharedArrayBuffer,
        "%String%": String,
        "%StringIteratorPrototype%": hasSymbols && getProto ? getProto(""[Symbol.iterator]()) : undefined2,
        "%Symbol%": hasSymbols ? Symbol : undefined2,
        "%SyntaxError%": $SyntaxError,
        "%ThrowTypeError%": ThrowTypeError,
        "%TypedArray%": TypedArray,
        "%TypeError%": $TypeError,
        "%Uint8Array%": typeof Uint8Array === "undefined" ? undefined2 : Uint8Array,
        "%Uint8ClampedArray%": typeof Uint8ClampedArray === "undefined" ? undefined2 : Uint8ClampedArray,
        "%Uint16Array%": typeof Uint16Array === "undefined" ? undefined2 : Uint16Array,
        "%Uint32Array%": typeof Uint32Array === "undefined" ? undefined2 : Uint32Array,
        "%URIError%": $URIError,
        "%WeakMap%": typeof WeakMap === "undefined" ? undefined2 : WeakMap,
        "%WeakRef%": typeof WeakRef === "undefined" ? undefined2 : WeakRef,
        "%WeakSet%": typeof WeakSet === "undefined" ? undefined2 : WeakSet,
        "%Function.prototype.call%": $call,
        "%Function.prototype.apply%": $apply,
        "%Object.defineProperty%": $defineProperty,
        "%Object.getPrototypeOf%": $ObjectGPO,
        "%Math.abs%": abs,
        "%Math.floor%": floor,
        "%Math.max%": max,
        "%Math.min%": min,
        "%Math.pow%": pow,
        "%Math.round%": round,
        "%Math.sign%": sign,
        "%Reflect.getPrototypeOf%": $ReflectGPO
      };
      if (getProto) {
        try {
          null.error;
        } catch (e) {
          errorProto = getProto(getProto(e));
          INTRINSICS["%Error.prototype%"] = errorProto;
        }
      }
      var errorProto;
      var doEval = function doEval2(name) {
        var value;
        if (name === "%AsyncFunction%") {
          value = getEvalledConstructor("async function () {}");
        } else if (name === "%GeneratorFunction%") {
          value = getEvalledConstructor("function* () {}");
        } else if (name === "%AsyncGeneratorFunction%") {
          value = getEvalledConstructor("async function* () {}");
        } else if (name === "%AsyncGenerator%") {
          var fn = doEval2("%AsyncGeneratorFunction%");
          if (fn) {
            value = fn.prototype;
          }
        } else if (name === "%AsyncIteratorPrototype%") {
          var gen = doEval2("%AsyncGenerator%");
          if (gen && getProto) {
            value = getProto(gen.prototype);
          }
        }
        INTRINSICS[name] = value;
        return value;
      };
      var LEGACY_ALIASES = {
        __proto__: null,
        "%ArrayBufferPrototype%": ["ArrayBuffer", "prototype"],
        "%ArrayPrototype%": ["Array", "prototype"],
        "%ArrayProto_entries%": ["Array", "prototype", "entries"],
        "%ArrayProto_forEach%": ["Array", "prototype", "forEach"],
        "%ArrayProto_keys%": ["Array", "prototype", "keys"],
        "%ArrayProto_values%": ["Array", "prototype", "values"],
        "%AsyncFunctionPrototype%": ["AsyncFunction", "prototype"],
        "%AsyncGenerator%": ["AsyncGeneratorFunction", "prototype"],
        "%AsyncGeneratorPrototype%": ["AsyncGeneratorFunction", "prototype", "prototype"],
        "%BooleanPrototype%": ["Boolean", "prototype"],
        "%DataViewPrototype%": ["DataView", "prototype"],
        "%DatePrototype%": ["Date", "prototype"],
        "%ErrorPrototype%": ["Error", "prototype"],
        "%EvalErrorPrototype%": ["EvalError", "prototype"],
        "%Float32ArrayPrototype%": ["Float32Array", "prototype"],
        "%Float64ArrayPrototype%": ["Float64Array", "prototype"],
        "%FunctionPrototype%": ["Function", "prototype"],
        "%Generator%": ["GeneratorFunction", "prototype"],
        "%GeneratorPrototype%": ["GeneratorFunction", "prototype", "prototype"],
        "%Int8ArrayPrototype%": ["Int8Array", "prototype"],
        "%Int16ArrayPrototype%": ["Int16Array", "prototype"],
        "%Int32ArrayPrototype%": ["Int32Array", "prototype"],
        "%JSONParse%": ["JSON", "parse"],
        "%JSONStringify%": ["JSON", "stringify"],
        "%MapPrototype%": ["Map", "prototype"],
        "%NumberPrototype%": ["Number", "prototype"],
        "%ObjectPrototype%": ["Object", "prototype"],
        "%ObjProto_toString%": ["Object", "prototype", "toString"],
        "%ObjProto_valueOf%": ["Object", "prototype", "valueOf"],
        "%PromisePrototype%": ["Promise", "prototype"],
        "%PromiseProto_then%": ["Promise", "prototype", "then"],
        "%Promise_all%": ["Promise", "all"],
        "%Promise_reject%": ["Promise", "reject"],
        "%Promise_resolve%": ["Promise", "resolve"],
        "%RangeErrorPrototype%": ["RangeError", "prototype"],
        "%ReferenceErrorPrototype%": ["ReferenceError", "prototype"],
        "%RegExpPrototype%": ["RegExp", "prototype"],
        "%SetPrototype%": ["Set", "prototype"],
        "%SharedArrayBufferPrototype%": ["SharedArrayBuffer", "prototype"],
        "%StringPrototype%": ["String", "prototype"],
        "%SymbolPrototype%": ["Symbol", "prototype"],
        "%SyntaxErrorPrototype%": ["SyntaxError", "prototype"],
        "%TypedArrayPrototype%": ["TypedArray", "prototype"],
        "%TypeErrorPrototype%": ["TypeError", "prototype"],
        "%Uint8ArrayPrototype%": ["Uint8Array", "prototype"],
        "%Uint8ClampedArrayPrototype%": ["Uint8ClampedArray", "prototype"],
        "%Uint16ArrayPrototype%": ["Uint16Array", "prototype"],
        "%Uint32ArrayPrototype%": ["Uint32Array", "prototype"],
        "%URIErrorPrototype%": ["URIError", "prototype"],
        "%WeakMapPrototype%": ["WeakMap", "prototype"],
        "%WeakSetPrototype%": ["WeakSet", "prototype"]
      };
      var bind = require_function_bind();
      var hasOwn = require_hasown();
      var $concat = bind.call($call, Array.prototype.concat);
      var $spliceApply = bind.call($apply, Array.prototype.splice);
      var $replace = bind.call($call, String.prototype.replace);
      var $strSlice = bind.call($call, String.prototype.slice);
      var $exec = bind.call($call, RegExp.prototype.exec);
      var rePropName = /[^%.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|%$))/g;
      var reEscapeChar = /\\(\\)?/g;
      var stringToPath = function stringToPath2(string) {
        var first = $strSlice(string, 0, 1);
        var last = $strSlice(string, -1);
        if (first === "%" && last !== "%") {
          throw new $SyntaxError("invalid intrinsic syntax, expected closing `%`");
        } else if (last === "%" && first !== "%") {
          throw new $SyntaxError("invalid intrinsic syntax, expected opening `%`");
        }
        var result = [];
        $replace(string, rePropName, function(match, number, quote, subString) {
          result[result.length] = quote ? $replace(subString, reEscapeChar, "$1") : number || match;
        });
        return result;
      };
      var getBaseIntrinsic = function getBaseIntrinsic2(name, allowMissing) {
        var intrinsicName = name;
        var alias;
        if (hasOwn(LEGACY_ALIASES, intrinsicName)) {
          alias = LEGACY_ALIASES[intrinsicName];
          intrinsicName = "%" + alias[0] + "%";
        }
        if (hasOwn(INTRINSICS, intrinsicName)) {
          var value = INTRINSICS[intrinsicName];
          if (value === needsEval) {
            value = doEval(intrinsicName);
          }
          if (typeof value === "undefined" && !allowMissing) {
            throw new $TypeError("intrinsic " + name + " exists, but is not available. Please file an issue!");
          }
          return {
            alias,
            name: intrinsicName,
            value
          };
        }
        throw new $SyntaxError("intrinsic " + name + " does not exist!");
      };
      module.exports = function GetIntrinsic(name, allowMissing) {
        if (typeof name !== "string" || name.length === 0) {
          throw new $TypeError("intrinsic name must be a non-empty string");
        }
        if (arguments.length > 1 && typeof allowMissing !== "boolean") {
          throw new $TypeError('"allowMissing" argument must be a boolean');
        }
        if ($exec(/^%?[^%]*%?$/, name) === null) {
          throw new $SyntaxError("`%` may not be present anywhere but at the beginning and end of the intrinsic name");
        }
        var parts = stringToPath(name);
        var intrinsicBaseName = parts.length > 0 ? parts[0] : "";
        var intrinsic = getBaseIntrinsic("%" + intrinsicBaseName + "%", allowMissing);
        var intrinsicRealName = intrinsic.name;
        var value = intrinsic.value;
        var skipFurtherCaching = false;
        var alias = intrinsic.alias;
        if (alias) {
          intrinsicBaseName = alias[0];
          $spliceApply(parts, $concat([0, 1], alias));
        }
        for (var i = 1, isOwn = true; i < parts.length; i += 1) {
          var part = parts[i];
          var first = $strSlice(part, 0, 1);
          var last = $strSlice(part, -1);
          if ((first === '"' || first === "'" || first === "`" || (last === '"' || last === "'" || last === "`")) && first !== last) {
            throw new $SyntaxError("property names with quotes must have matching quotes");
          }
          if (part === "constructor" || !isOwn) {
            skipFurtherCaching = true;
          }
          intrinsicBaseName += "." + part;
          intrinsicRealName = "%" + intrinsicBaseName + "%";
          if (hasOwn(INTRINSICS, intrinsicRealName)) {
            value = INTRINSICS[intrinsicRealName];
          } else if (value != null) {
            if (!(part in value)) {
              if (!allowMissing) {
                throw new $TypeError("base intrinsic for " + name + " exists, but the property is not available.");
              }
              return void undefined2;
            }
            if ($gOPD && i + 1 >= parts.length) {
              var desc = $gOPD(value, part);
              isOwn = !!desc;
              if (isOwn && "get" in desc && !("originalValue" in desc.get)) {
                value = desc.get;
              } else {
                value = value[part];
              }
            } else {
              isOwn = hasOwn(value, part);
              value = value[part];
            }
            if (isOwn && !skipFurtherCaching) {
              INTRINSICS[intrinsicRealName] = value;
            }
          }
        }
        return value;
      };
    }
  });

  // node_modules/call-bound/index.js
  var require_call_bound = __commonJS({
    "node_modules/call-bound/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBindBasic = require_call_bind_apply_helpers();
      var $indexOf = callBindBasic([GetIntrinsic("%String.prototype.indexOf%")]);
      module.exports = function callBoundIntrinsic(name, allowMissing) {
        var intrinsic = (
          /** @type {(this: unknown, ...args: unknown[]) => unknown} */
          GetIntrinsic(name, !!allowMissing)
        );
        if (typeof intrinsic === "function" && $indexOf(name, ".prototype.") > -1) {
          return callBindBasic(
            /** @type {const} */
            [intrinsic]
          );
        }
        return intrinsic;
      };
    }
  });

  // node_modules/side-channel-map/index.js
  var require_side_channel_map = __commonJS({
    "node_modules/side-channel-map/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBound = require_call_bound();
      var inspect = require_object_inspect();
      var $TypeError = require_type();
      var $Map = GetIntrinsic("%Map%", true);
      var $mapGet = callBound("Map.prototype.get", true);
      var $mapSet = callBound("Map.prototype.set", true);
      var $mapHas = callBound("Map.prototype.has", true);
      var $mapDelete = callBound("Map.prototype.delete", true);
      var $mapSize = callBound("Map.prototype.size", true);
      module.exports = !!$Map && /** @type {Exclude<import('.'), false>} */
      function getSideChannelMap() {
        var $m;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              throw new $TypeError("Side channel does not contain " + inspect(key));
            }
          },
          "delete": function(key) {
            if ($m) {
              var result = $mapDelete($m, key);
              if ($mapSize($m) === 0) {
                $m = void 0;
              }
              return result;
            }
            return false;
          },
          get: function(key) {
            if ($m) {
              return $mapGet($m, key);
            }
          },
          has: function(key) {
            if ($m) {
              return $mapHas($m, key);
            }
            return false;
          },
          set: function(key, value) {
            if (!$m) {
              $m = new $Map();
            }
            $mapSet($m, key, value);
          }
        };
        return channel;
      };
    }
  });

  // node_modules/side-channel-weakmap/index.js
  var require_side_channel_weakmap = __commonJS({
    "node_modules/side-channel-weakmap/index.js"(exports, module) {
      "use strict";
      var GetIntrinsic = require_get_intrinsic();
      var callBound = require_call_bound();
      var inspect = require_object_inspect();
      var getSideChannelMap = require_side_channel_map();
      var $TypeError = require_type();
      var $WeakMap = GetIntrinsic("%WeakMap%", true);
      var $weakMapGet = callBound("WeakMap.prototype.get", true);
      var $weakMapSet = callBound("WeakMap.prototype.set", true);
      var $weakMapHas = callBound("WeakMap.prototype.has", true);
      var $weakMapDelete = callBound("WeakMap.prototype.delete", true);
      module.exports = $WeakMap ? (
        /** @type {Exclude<import('.'), false>} */
        function getSideChannelWeakMap() {
          var $wm;
          var $m;
          var channel = {
            assert: function(key) {
              if (!channel.has(key)) {
                throw new $TypeError("Side channel does not contain " + inspect(key));
              }
            },
            "delete": function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapDelete($wm, key);
                }
              } else if (getSideChannelMap) {
                if ($m) {
                  return $m["delete"](key);
                }
              }
              return false;
            },
            get: function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapGet($wm, key);
                }
              }
              return $m && $m.get(key);
            },
            has: function(key) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if ($wm) {
                  return $weakMapHas($wm, key);
                }
              }
              return !!$m && $m.has(key);
            },
            set: function(key, value) {
              if ($WeakMap && key && (typeof key === "object" || typeof key === "function")) {
                if (!$wm) {
                  $wm = new $WeakMap();
                }
                $weakMapSet($wm, key, value);
              } else if (getSideChannelMap) {
                if (!$m) {
                  $m = getSideChannelMap();
                }
                $m.set(key, value);
              }
            }
          };
          return channel;
        }
      ) : getSideChannelMap;
    }
  });

  // node_modules/side-channel/index.js
  var require_side_channel = __commonJS({
    "node_modules/side-channel/index.js"(exports, module) {
      "use strict";
      var $TypeError = require_type();
      var inspect = require_object_inspect();
      var getSideChannelList = require_side_channel_list();
      var getSideChannelMap = require_side_channel_map();
      var getSideChannelWeakMap = require_side_channel_weakmap();
      var makeChannel = getSideChannelWeakMap || getSideChannelMap || getSideChannelList;
      module.exports = function getSideChannel() {
        var $channelData;
        var channel = {
          assert: function(key) {
            if (!channel.has(key)) {
              var keyDesc = key && Object(key) === key ? "the given object key" : inspect(key);
              throw new $TypeError("Side channel does not contain " + keyDesc);
            }
          },
          "delete": function(key) {
            return !!$channelData && $channelData["delete"](key);
          },
          get: function(key) {
            return $channelData && $channelData.get(key);
          },
          has: function(key) {
            return !!$channelData && $channelData.has(key);
          },
          set: function(key, value) {
            if (!$channelData) {
              $channelData = makeChannel();
            }
            $channelData.set(key, value);
          }
        };
        return channel;
      };
    }
  });

  // node_modules/qs/lib/formats.js
  var require_formats = __commonJS({
    "node_modules/qs/lib/formats.js"(exports, module) {
      "use strict";
      var replace = String.prototype.replace;
      var percentTwenties = /%20/g;
      var Format = {
        RFC1738: "RFC1738",
        RFC3986: "RFC3986"
      };
      module.exports = {
        "default": Format.RFC3986,
        formatters: {
          RFC1738: function(value) {
            return replace.call(value, percentTwenties, "+");
          },
          RFC3986: function(value) {
            return String(value);
          }
        },
        RFC1738: Format.RFC1738,
        RFC3986: Format.RFC3986
      };
    }
  });

  // node_modules/qs/lib/utils.js
  var require_utils = __commonJS({
    "node_modules/qs/lib/utils.js"(exports, module) {
      "use strict";
      var formats = require_formats();
      var getSideChannel = require_side_channel();
      var has = Object.prototype.hasOwnProperty;
      var isArray = Array.isArray;
      var overflowChannel = getSideChannel();
      var markOverflow = function markOverflow2(obj, maxIndex) {
        overflowChannel.set(obj, maxIndex);
        return obj;
      };
      var isOverflow = function isOverflow2(obj) {
        return overflowChannel.has(obj);
      };
      var getMaxIndex = function getMaxIndex2(obj) {
        return overflowChannel.get(obj);
      };
      var setMaxIndex = function setMaxIndex2(obj, maxIndex) {
        overflowChannel.set(obj, maxIndex);
      };
      var hexTable = (function() {
        var array = [];
        for (var i = 0; i < 256; ++i) {
          array[array.length] = "%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase();
        }
        return array;
      })();
      var compactQueue = function compactQueue2(queue) {
        while (queue.length > 1) {
          var item = queue.pop();
          var obj = item.obj[item.prop];
          if (isArray(obj)) {
            var compacted = [];
            for (var j = 0; j < obj.length; ++j) {
              if (typeof obj[j] !== "undefined") {
                compacted[compacted.length] = obj[j];
              }
            }
            item.obj[item.prop] = compacted;
          }
        }
      };
      var arrayToObject = function arrayToObject2(source, options) {
        var obj = options && options.plainObjects ? { __proto__: null } : {};
        for (var i = 0; i < source.length; ++i) {
          if (typeof source[i] !== "undefined") {
            obj[i] = source[i];
          }
        }
        return obj;
      };
      var merge = function merge2(target, source, options) {
        if (!source) {
          return target;
        }
        if (typeof source !== "object" && typeof source !== "function") {
          if (isArray(target)) {
            var nextIndex = target.length;
            if (options && typeof options.arrayLimit === "number" && nextIndex > options.arrayLimit) {
              return markOverflow(arrayToObject(target.concat(source), options), nextIndex);
            }
            target[nextIndex] = source;
          } else if (target && typeof target === "object") {
            if (isOverflow(target)) {
              var newIndex = getMaxIndex(target) + 1;
              target[newIndex] = source;
              setMaxIndex(target, newIndex);
            } else if (options && options.strictMerge) {
              return [target, source];
            } else if (options && (options.plainObjects || options.allowPrototypes) || !has.call(Object.prototype, source)) {
              target[source] = true;
            }
          } else {
            return [target, source];
          }
          return target;
        }
        if (!target || typeof target !== "object") {
          if (isOverflow(source)) {
            var sourceKeys = Object.keys(source);
            var result = options && options.plainObjects ? { __proto__: null, 0: target } : { 0: target };
            for (var m = 0; m < sourceKeys.length; m++) {
              var oldKey = parseInt(sourceKeys[m], 10);
              result[oldKey + 1] = source[sourceKeys[m]];
            }
            return markOverflow(result, getMaxIndex(source) + 1);
          }
          var combined = [target].concat(source);
          if (options && typeof options.arrayLimit === "number" && combined.length > options.arrayLimit) {
            return markOverflow(arrayToObject(combined, options), combined.length - 1);
          }
          return combined;
        }
        var mergeTarget = target;
        if (isArray(target) && !isArray(source)) {
          mergeTarget = arrayToObject(target, options);
        }
        if (isArray(target) && isArray(source)) {
          source.forEach(function(item, i) {
            if (has.call(target, i)) {
              var targetItem = target[i];
              if (targetItem && typeof targetItem === "object" && item && typeof item === "object") {
                target[i] = merge2(targetItem, item, options);
              } else {
                target[target.length] = item;
              }
            } else {
              target[i] = item;
            }
          });
          return target;
        }
        return Object.keys(source).reduce(function(acc, key) {
          var value = source[key];
          if (has.call(acc, key)) {
            acc[key] = merge2(acc[key], value, options);
          } else {
            acc[key] = value;
          }
          if (isOverflow(source) && !isOverflow(acc)) {
            markOverflow(acc, getMaxIndex(source));
          }
          if (isOverflow(acc)) {
            var keyNum = parseInt(key, 10);
            if (String(keyNum) === key && keyNum >= 0 && keyNum > getMaxIndex(acc)) {
              setMaxIndex(acc, keyNum);
            }
          }
          return acc;
        }, mergeTarget);
      };
      var assign = function assignSingleSource(target, source) {
        return Object.keys(source).reduce(function(acc, key) {
          acc[key] = source[key];
          return acc;
        }, target);
      };
      var decode = function(str, defaultDecoder, charset) {
        var strWithoutPlus = str.replace(/\+/g, " ");
        if (charset === "iso-8859-1") {
          return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
        }
        try {
          return decodeURIComponent(strWithoutPlus);
        } catch (e) {
          return strWithoutPlus;
        }
      };
      var limit = 1024;
      var encode = function encode2(str, defaultEncoder, charset, kind, format2) {
        if (str.length === 0) {
          return str;
        }
        var string = str;
        if (typeof str === "symbol") {
          string = Symbol.prototype.toString.call(str);
        } else if (typeof str !== "string") {
          string = String(str);
        }
        if (charset === "iso-8859-1") {
          return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
            return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
          });
        }
        var out = "";
        for (var j = 0; j < string.length; j += limit) {
          var segment = string.length >= limit ? string.slice(j, j + limit) : string;
          var arr = [];
          for (var i = 0; i < segment.length; ++i) {
            var c = segment.charCodeAt(i);
            if (c === 45 || c === 46 || c === 95 || c === 126 || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || format2 === formats.RFC1738 && (c === 40 || c === 41)) {
              arr[arr.length] = segment.charAt(i);
              continue;
            }
            if (c < 128) {
              arr[arr.length] = hexTable[c];
              continue;
            }
            if (c < 2048) {
              arr[arr.length] = hexTable[192 | c >> 6] + hexTable[128 | c & 63];
              continue;
            }
            if (c < 55296 || c >= 57344) {
              arr[arr.length] = hexTable[224 | c >> 12] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
              continue;
            }
            i += 1;
            c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
            arr[arr.length] = hexTable[240 | c >> 18] + hexTable[128 | c >> 12 & 63] + hexTable[128 | c >> 6 & 63] + hexTable[128 | c & 63];
          }
          out += arr.join("");
        }
        return out;
      };
      var compact = function compact2(value) {
        var queue = [{ obj: { o: value }, prop: "o" }];
        var refs = [];
        for (var i = 0; i < queue.length; ++i) {
          var item = queue[i];
          var obj = item.obj[item.prop];
          var keys = Object.keys(obj);
          for (var j = 0; j < keys.length; ++j) {
            var key = keys[j];
            var val = obj[key];
            if (typeof val === "object" && val !== null && refs.indexOf(val) === -1) {
              queue[queue.length] = { obj, prop: key };
              refs[refs.length] = val;
            }
          }
        }
        compactQueue(queue);
        return value;
      };
      var isRegExp = function isRegExp2(obj) {
        return Object.prototype.toString.call(obj) === "[object RegExp]";
      };
      var isBuffer = function isBuffer2(obj) {
        if (!obj || typeof obj !== "object") {
          return false;
        }
        return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
      };
      var combine = function combine2(a, b, arrayLimit, plainObjects) {
        if (isOverflow(a)) {
          var newIndex = getMaxIndex(a) + 1;
          a[newIndex] = b;
          setMaxIndex(a, newIndex);
          return a;
        }
        var result = [].concat(a, b);
        if (result.length > arrayLimit) {
          return markOverflow(arrayToObject(result, { plainObjects }), result.length - 1);
        }
        return result;
      };
      var maybeMap = function maybeMap2(val, fn) {
        if (isArray(val)) {
          var mapped = [];
          for (var i = 0; i < val.length; i += 1) {
            mapped[mapped.length] = fn(val[i]);
          }
          return mapped;
        }
        return fn(val);
      };
      module.exports = {
        arrayToObject,
        assign,
        combine,
        compact,
        decode,
        encode,
        isBuffer,
        isOverflow,
        isRegExp,
        markOverflow,
        maybeMap,
        merge
      };
    }
  });

  // node_modules/qs/lib/stringify.js
  var require_stringify = __commonJS({
    "node_modules/qs/lib/stringify.js"(exports, module) {
      "use strict";
      var getSideChannel = require_side_channel();
      var utils = require_utils();
      var formats = require_formats();
      var has = Object.prototype.hasOwnProperty;
      var arrayPrefixGenerators = {
        brackets: function brackets(prefix) {
          return prefix + "[]";
        },
        comma: "comma",
        indices: function indices(prefix, key) {
          return prefix + "[" + key + "]";
        },
        repeat: function repeat(prefix) {
          return prefix;
        }
      };
      var isArray = Array.isArray;
      var push = Array.prototype.push;
      var pushToArray = function(arr, valueOrArray) {
        push.apply(arr, isArray(valueOrArray) ? valueOrArray : [valueOrArray]);
      };
      var toISO = Date.prototype.toISOString;
      var defaultFormat = formats["default"];
      var defaults = {
        addQueryPrefix: false,
        allowDots: false,
        allowEmptyArrays: false,
        arrayFormat: "indices",
        charset: "utf-8",
        charsetSentinel: false,
        commaRoundTrip: false,
        delimiter: "&",
        encode: true,
        encodeDotInKeys: false,
        encoder: utils.encode,
        encodeValuesOnly: false,
        filter: void 0,
        format: defaultFormat,
        formatter: formats.formatters[defaultFormat],
        // deprecated
        indices: false,
        serializeDate: function serializeDate(date) {
          return toISO.call(date);
        },
        skipNulls: false,
        strictNullHandling: false
      };
      var isNonNullishPrimitive = function isNonNullishPrimitive2(v) {
        return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
      };
      var sentinel = {};
      var stringify = function stringify2(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format2, formatter, encodeValuesOnly, charset, sideChannel) {
        var obj = object;
        var tmpSc = sideChannel;
        var step = 0;
        var findFlag = false;
        while ((tmpSc = tmpSc.get(sentinel)) !== void 0 && !findFlag) {
          var pos = tmpSc.get(object);
          step += 1;
          if (typeof pos !== "undefined") {
            if (pos === step) {
              throw new RangeError("Cyclic object value");
            } else {
              findFlag = true;
            }
          }
          if (typeof tmpSc.get(sentinel) === "undefined") {
            step = 0;
          }
        }
        if (typeof filter === "function") {
          obj = filter(prefix, obj);
        } else if (obj instanceof Date) {
          obj = serializeDate(obj);
        } else if (generateArrayPrefix === "comma" && isArray(obj)) {
          obj = utils.maybeMap(obj, function(value2) {
            if (value2 instanceof Date) {
              return serializeDate(value2);
            }
            return value2;
          });
        }
        if (obj === null) {
          if (strictNullHandling) {
            return formatter(encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, "key", format2) : prefix);
          }
          obj = "";
        }
        if (isNonNullishPrimitive(obj) || utils.isBuffer(obj)) {
          if (encoder) {
            var keyValue = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format2);
            return [formatter(keyValue) + "=" + formatter(encoder(obj, defaults.encoder, charset, "value", format2))];
          }
          return [formatter(prefix) + "=" + formatter(String(obj))];
        }
        var values = [];
        if (typeof obj === "undefined") {
          return values;
        }
        var objKeys;
        if (generateArrayPrefix === "comma" && isArray(obj)) {
          if (encodeValuesOnly && encoder) {
            obj = utils.maybeMap(obj, function(v) {
              return v == null ? v : encoder(v);
            });
          }
          objKeys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
        } else if (isArray(filter)) {
          objKeys = filter;
        } else {
          var keys = Object.keys(obj);
          objKeys = sort ? keys.sort(sort) : keys;
        }
        var encodedPrefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
        var adjustedPrefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encodedPrefix + "[]" : encodedPrefix;
        if (allowEmptyArrays && isArray(obj) && obj.length === 0) {
          return adjustedPrefix + "[]";
        }
        for (var j = 0; j < objKeys.length; ++j) {
          var key = objKeys[j];
          var value = typeof key === "object" && key && typeof key.value !== "undefined" ? key.value : obj[key];
          if (skipNulls && value === null) {
            continue;
          }
          var encodedKey = allowDots && encodeDotInKeys ? String(key).replace(/\./g, "%2E") : String(key);
          var keyPrefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjustedPrefix, encodedKey) : adjustedPrefix : adjustedPrefix + (allowDots ? "." + encodedKey : "[" + encodedKey + "]");
          sideChannel.set(object, step);
          var valueSideChannel = getSideChannel();
          valueSideChannel.set(sentinel, sideChannel);
          pushToArray(values, stringify2(
            value,
            keyPrefix,
            generateArrayPrefix,
            commaRoundTrip,
            allowEmptyArrays,
            strictNullHandling,
            skipNulls,
            encodeDotInKeys,
            generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder,
            filter,
            sort,
            allowDots,
            serializeDate,
            format2,
            formatter,
            encodeValuesOnly,
            charset,
            valueSideChannel
          ));
        }
        return values;
      };
      var normalizeStringifyOptions = function normalizeStringifyOptions2(opts) {
        if (!opts) {
          return defaults;
        }
        if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
          throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
        }
        if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") {
          throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
        }
        if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") {
          throw new TypeError("Encoder has to be a function.");
        }
        var charset = opts.charset || defaults.charset;
        if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
          throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
        }
        var format2 = formats["default"];
        if (typeof opts.format !== "undefined") {
          if (!has.call(formats.formatters, opts.format)) {
            throw new TypeError("Unknown format option provided.");
          }
          format2 = opts.format;
        }
        var formatter = formats.formatters[format2];
        var filter = defaults.filter;
        if (typeof opts.filter === "function" || isArray(opts.filter)) {
          filter = opts.filter;
        }
        var arrayFormat;
        if (opts.arrayFormat in arrayPrefixGenerators) {
          arrayFormat = opts.arrayFormat;
        } else if ("indices" in opts) {
          arrayFormat = opts.indices ? "indices" : "repeat";
        } else {
          arrayFormat = defaults.arrayFormat;
        }
        if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") {
          throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
        }
        var allowDots = typeof opts.allowDots === "undefined" ? opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
        return {
          addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
          allowDots,
          allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
          arrayFormat,
          charset,
          charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
          commaRoundTrip: !!opts.commaRoundTrip,
          delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
          encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
          encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
          encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
          encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
          filter,
          format: format2,
          formatter,
          serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
          skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
          sort: typeof opts.sort === "function" ? opts.sort : null,
          strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
        };
      };
      module.exports = function(object, opts) {
        var obj = object;
        var options = normalizeStringifyOptions(opts);
        var objKeys;
        var filter;
        if (typeof options.filter === "function") {
          filter = options.filter;
          obj = filter("", obj);
        } else if (isArray(options.filter)) {
          filter = options.filter;
          objKeys = filter;
        }
        var keys = [];
        if (typeof obj !== "object" || obj === null) {
          return "";
        }
        var generateArrayPrefix = arrayPrefixGenerators[options.arrayFormat];
        var commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
        if (!objKeys) {
          objKeys = Object.keys(obj);
        }
        if (options.sort) {
          objKeys.sort(options.sort);
        }
        var sideChannel = getSideChannel();
        for (var i = 0; i < objKeys.length; ++i) {
          var key = objKeys[i];
          if (typeof key === "undefined" || key === null) {
            continue;
          }
          var value = obj[key];
          if (options.skipNulls && value === null) {
            continue;
          }
          pushToArray(keys, stringify(
            value,
            key,
            generateArrayPrefix,
            commaRoundTrip,
            options.allowEmptyArrays,
            options.strictNullHandling,
            options.skipNulls,
            options.encodeDotInKeys,
            options.encode ? options.encoder : null,
            options.filter,
            options.sort,
            options.allowDots,
            options.serializeDate,
            options.format,
            options.formatter,
            options.encodeValuesOnly,
            options.charset,
            sideChannel
          ));
        }
        var joined = keys.join(options.delimiter);
        var prefix = options.addQueryPrefix === true ? "?" : "";
        if (options.charsetSentinel) {
          if (options.charset === "iso-8859-1") {
            prefix += "utf8=%26%2310003%3B" + options.delimiter;
          } else {
            prefix += "utf8=%E2%9C%93" + options.delimiter;
          }
        }
        return joined.length > 0 ? prefix + joined : "";
      };
    }
  });

  // node_modules/qs/lib/parse.js
  var require_parse = __commonJS({
    "node_modules/qs/lib/parse.js"(exports, module) {
      "use strict";
      var utils = require_utils();
      var has = Object.prototype.hasOwnProperty;
      var isArray = Array.isArray;
      var defaults = {
        allowDots: false,
        allowEmptyArrays: false,
        allowPrototypes: false,
        allowSparse: false,
        arrayLimit: 20,
        charset: "utf-8",
        charsetSentinel: false,
        comma: false,
        decodeDotInKeys: false,
        decoder: utils.decode,
        delimiter: "&",
        depth: 5,
        duplicates: "combine",
        ignoreQueryPrefix: false,
        interpretNumericEntities: false,
        parameterLimit: 1e3,
        parseArrays: true,
        plainObjects: false,
        strictDepth: false,
        strictMerge: true,
        strictNullHandling: false,
        throwOnLimitExceeded: false
      };
      var interpretNumericEntities = function(str) {
        return str.replace(/&#(\d+);/g, function($0, numberStr) {
          return String.fromCharCode(parseInt(numberStr, 10));
        });
      };
      var parseArrayValue = function(val, options, currentArrayLength) {
        if (val && typeof val === "string" && options.comma && val.indexOf(",") > -1) {
          return val.split(",");
        }
        if (options.throwOnLimitExceeded && currentArrayLength >= options.arrayLimit) {
          throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
        }
        return val;
      };
      var isoSentinel = "utf8=%26%2310003%3B";
      var charsetSentinel = "utf8=%E2%9C%93";
      var parseValues = function parseQueryStringValues(str, options) {
        var obj = { __proto__: null };
        var cleanStr = options.ignoreQueryPrefix ? str.replace(/^\?/, "") : str;
        cleanStr = cleanStr.replace(/%5B/gi, "[").replace(/%5D/gi, "]");
        var limit = options.parameterLimit === Infinity ? void 0 : options.parameterLimit;
        var parts = cleanStr.split(
          options.delimiter,
          options.throwOnLimitExceeded && typeof limit !== "undefined" ? limit + 1 : limit
        );
        if (options.throwOnLimitExceeded && typeof limit !== "undefined" && parts.length > limit) {
          throw new RangeError("Parameter limit exceeded. Only " + limit + " parameter" + (limit === 1 ? "" : "s") + " allowed.");
        }
        var skipIndex = -1;
        var i;
        var charset = options.charset;
        if (options.charsetSentinel) {
          for (i = 0; i < parts.length; ++i) {
            if (parts[i].indexOf("utf8=") === 0) {
              if (parts[i] === charsetSentinel) {
                charset = "utf-8";
              } else if (parts[i] === isoSentinel) {
                charset = "iso-8859-1";
              }
              skipIndex = i;
              i = parts.length;
            }
          }
        }
        for (i = 0; i < parts.length; ++i) {
          if (i === skipIndex) {
            continue;
          }
          var part = parts[i];
          var bracketEqualsPos = part.indexOf("]=");
          var pos = bracketEqualsPos === -1 ? part.indexOf("=") : bracketEqualsPos + 1;
          var key;
          var val;
          if (pos === -1) {
            key = options.decoder(part, defaults.decoder, charset, "key");
            val = options.strictNullHandling ? null : "";
          } else {
            key = options.decoder(part.slice(0, pos), defaults.decoder, charset, "key");
            if (key !== null) {
              val = utils.maybeMap(
                parseArrayValue(
                  part.slice(pos + 1),
                  options,
                  isArray(obj[key]) ? obj[key].length : 0
                ),
                function(encodedVal) {
                  return options.decoder(encodedVal, defaults.decoder, charset, "value");
                }
              );
            }
          }
          if (val && options.interpretNumericEntities && charset === "iso-8859-1") {
            val = interpretNumericEntities(String(val));
          }
          if (part.indexOf("[]=") > -1) {
            val = isArray(val) ? [val] : val;
          }
          if (options.comma && isArray(val) && val.length > options.arrayLimit) {
            if (options.throwOnLimitExceeded) {
              throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            }
            val = utils.combine([], val, options.arrayLimit, options.plainObjects);
          }
          if (key !== null) {
            var existing = has.call(obj, key);
            if (existing && (options.duplicates === "combine" || part.indexOf("[]=") > -1)) {
              obj[key] = utils.combine(
                obj[key],
                val,
                options.arrayLimit,
                options.plainObjects
              );
            } else if (!existing || options.duplicates === "last") {
              obj[key] = val;
            }
          }
        }
        return obj;
      };
      var parseObject = function(chain, val, options, valuesParsed) {
        var currentArrayLength = 0;
        if (chain.length > 0 && chain[chain.length - 1] === "[]") {
          var parentKey = chain.slice(0, -1).join("");
          currentArrayLength = Array.isArray(val) && val[parentKey] ? val[parentKey].length : 0;
        }
        var leaf = valuesParsed ? val : parseArrayValue(val, options, currentArrayLength);
        for (var i = chain.length - 1; i >= 0; --i) {
          var obj;
          var root = chain[i];
          if (root === "[]" && options.parseArrays) {
            if (utils.isOverflow(leaf)) {
              obj = leaf;
            } else {
              obj = options.allowEmptyArrays && (leaf === "" || options.strictNullHandling && leaf === null) ? [] : utils.combine(
                [],
                leaf,
                options.arrayLimit,
                options.plainObjects
              );
            }
          } else {
            obj = options.plainObjects ? { __proto__: null } : {};
            var cleanRoot = root.charAt(0) === "[" && root.charAt(root.length - 1) === "]" ? root.slice(1, -1) : root;
            var decodedRoot = options.decodeDotInKeys ? cleanRoot.replace(/%2E/g, ".") : cleanRoot;
            var index = parseInt(decodedRoot, 10);
            var isValidArrayIndex = !isNaN(index) && root !== decodedRoot && String(index) === decodedRoot && index >= 0 && options.parseArrays;
            if (!options.parseArrays && decodedRoot === "") {
              obj = { 0: leaf };
            } else if (isValidArrayIndex && index < options.arrayLimit) {
              obj = [];
              obj[index] = leaf;
            } else if (isValidArrayIndex && options.throwOnLimitExceeded) {
              throw new RangeError("Array limit exceeded. Only " + options.arrayLimit + " element" + (options.arrayLimit === 1 ? "" : "s") + " allowed in an array.");
            } else if (isValidArrayIndex) {
              obj[index] = leaf;
              utils.markOverflow(obj, index);
            } else if (decodedRoot !== "__proto__") {
              obj[decodedRoot] = leaf;
            }
          }
          leaf = obj;
        }
        return leaf;
      };
      var splitKeyIntoSegments = function splitKeyIntoSegments2(originalKey, options) {
        var key = options.allowDots ? originalKey.replace(/\.([^.[]+)/g, "[$1]") : originalKey;
        if (options.depth <= 0) {
          if (!options.plainObjects && has.call(Object.prototype, key)) {
            if (!options.allowPrototypes) {
              return;
            }
          }
          return [key];
        }
        var segments = [];
        var first = key.indexOf("[");
        var parent = first >= 0 ? key.slice(0, first) : key;
        if (parent) {
          if (!options.plainObjects && has.call(Object.prototype, parent)) {
            if (!options.allowPrototypes) {
              return;
            }
          }
          segments[segments.length] = parent;
        }
        var n = key.length;
        var open = first;
        var collected = 0;
        while (open >= 0 && collected < options.depth) {
          var level = 1;
          var i = open + 1;
          var close = -1;
          while (i < n && close < 0) {
            var cu = key.charCodeAt(i);
            if (cu === 91) {
              level += 1;
            } else if (cu === 93) {
              level -= 1;
              if (level === 0) {
                close = i;
              }
            }
            i += 1;
          }
          if (close < 0) {
            segments[segments.length] = "[" + key.slice(open) + "]";
            return segments;
          }
          var seg = key.slice(open, close + 1);
          var content = seg.slice(1, -1);
          if (!options.plainObjects && has.call(Object.prototype, content) && !options.allowPrototypes) {
            return;
          }
          segments[segments.length] = seg;
          collected += 1;
          open = key.indexOf("[", close + 1);
        }
        if (open >= 0) {
          if (options.strictDepth === true) {
            throw new RangeError("Input depth exceeded depth option of " + options.depth + " and strictDepth is true");
          }
          segments[segments.length] = "[" + key.slice(open) + "]";
        }
        return segments;
      };
      var parseKeys = function parseQueryStringKeys(givenKey, val, options, valuesParsed) {
        if (!givenKey) {
          return;
        }
        var keys = splitKeyIntoSegments(givenKey, options);
        if (!keys) {
          return;
        }
        return parseObject(keys, val, options, valuesParsed);
      };
      var normalizeParseOptions = function normalizeParseOptions2(opts) {
        if (!opts) {
          return defaults;
        }
        if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") {
          throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
        }
        if (typeof opts.decodeDotInKeys !== "undefined" && typeof opts.decodeDotInKeys !== "boolean") {
          throw new TypeError("`decodeDotInKeys` option can only be `true` or `false`, when provided");
        }
        if (opts.decoder !== null && typeof opts.decoder !== "undefined" && typeof opts.decoder !== "function") {
          throw new TypeError("Decoder has to be a function.");
        }
        if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") {
          throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
        }
        if (typeof opts.throwOnLimitExceeded !== "undefined" && typeof opts.throwOnLimitExceeded !== "boolean") {
          throw new TypeError("`throwOnLimitExceeded` option must be a boolean");
        }
        var charset = typeof opts.charset === "undefined" ? defaults.charset : opts.charset;
        var duplicates = typeof opts.duplicates === "undefined" ? defaults.duplicates : opts.duplicates;
        if (duplicates !== "combine" && duplicates !== "first" && duplicates !== "last") {
          throw new TypeError("The duplicates option must be either combine, first, or last");
        }
        var allowDots = typeof opts.allowDots === "undefined" ? opts.decodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
        return {
          allowDots,
          allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
          allowPrototypes: typeof opts.allowPrototypes === "boolean" ? opts.allowPrototypes : defaults.allowPrototypes,
          allowSparse: typeof opts.allowSparse === "boolean" ? opts.allowSparse : defaults.allowSparse,
          arrayLimit: typeof opts.arrayLimit === "number" ? opts.arrayLimit : defaults.arrayLimit,
          charset,
          charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
          comma: typeof opts.comma === "boolean" ? opts.comma : defaults.comma,
          decodeDotInKeys: typeof opts.decodeDotInKeys === "boolean" ? opts.decodeDotInKeys : defaults.decodeDotInKeys,
          decoder: typeof opts.decoder === "function" ? opts.decoder : defaults.decoder,
          delimiter: typeof opts.delimiter === "string" || utils.isRegExp(opts.delimiter) ? opts.delimiter : defaults.delimiter,
          // eslint-disable-next-line no-implicit-coercion, no-extra-parens
          depth: typeof opts.depth === "number" || opts.depth === false ? +opts.depth : defaults.depth,
          duplicates,
          ignoreQueryPrefix: opts.ignoreQueryPrefix === true,
          interpretNumericEntities: typeof opts.interpretNumericEntities === "boolean" ? opts.interpretNumericEntities : defaults.interpretNumericEntities,
          parameterLimit: typeof opts.parameterLimit === "number" ? opts.parameterLimit : defaults.parameterLimit,
          parseArrays: opts.parseArrays !== false,
          plainObjects: typeof opts.plainObjects === "boolean" ? opts.plainObjects : defaults.plainObjects,
          strictDepth: typeof opts.strictDepth === "boolean" ? !!opts.strictDepth : defaults.strictDepth,
          strictMerge: typeof opts.strictMerge === "boolean" ? !!opts.strictMerge : defaults.strictMerge,
          strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling,
          throwOnLimitExceeded: typeof opts.throwOnLimitExceeded === "boolean" ? opts.throwOnLimitExceeded : false
        };
      };
      module.exports = function(str, opts) {
        var options = normalizeParseOptions(opts);
        if (str === "" || str === null || typeof str === "undefined") {
          return options.plainObjects ? { __proto__: null } : {};
        }
        var tempObj = typeof str === "string" ? parseValues(str, options) : str;
        var obj = options.plainObjects ? { __proto__: null } : {};
        var keys = Object.keys(tempObj);
        for (var i = 0; i < keys.length; ++i) {
          var key = keys[i];
          var newObj = parseKeys(key, tempObj[key], options, typeof str === "string");
          obj = utils.merge(obj, newObj, options);
        }
        if (options.allowSparse === true) {
          return obj;
        }
        return utils.compact(obj);
      };
    }
  });

  // node_modules/qs/lib/index.js
  var require_lib = __commonJS({
    "node_modules/qs/lib/index.js"(exports, module) {
      "use strict";
      var stringify = require_stringify();
      var parse = require_parse();
      var formats = require_formats();
      module.exports = {
        formats,
        parse,
        stringify
      };
    }
  });

  // node_modules/superagent/lib/utils.js
  var require_utils2 = __commonJS({
    "node_modules/superagent/lib/utils.js"(exports) {
      "use strict";
      exports.type = (string_) => string_.split(/ *; */).shift();
      exports.params = (value) => {
        const object = {};
        for (const string_ of value.split(/ *; */)) {
          const parts = string_.split(/ *= */);
          const key = parts.shift();
          const value2 = parts.shift();
          if (key && value2) object[key] = value2;
        }
        return object;
      };
      exports.parseLinks = (value) => {
        const object = {};
        for (const string_ of value.split(/ *, */)) {
          const parts = string_.split(/ *; */);
          const url = parts[0].slice(1, -1);
          const rel = parts[1].split(/ *= */)[1].slice(1, -1);
          object[rel] = url;
        }
        return object;
      };
      exports.cleanHeader = (header, changesOrigin) => {
        delete header["content-type"];
        delete header["content-length"];
        delete header["transfer-encoding"];
        delete header.host;
        if (changesOrigin) {
          delete header.authorization;
          delete header.cookie;
        }
        return header;
      };
      exports.normalizeHostname = (hostname) => {
        const [, normalized] = hostname.match(/^\[([^\]]+)\]$/) || [];
        return normalized || hostname;
      };
      exports.isObject = (object) => {
        return object !== null && typeof object === "object";
      };
      exports.hasOwn = Object.hasOwn || function(object, property) {
        if (object == null) {
          throw new TypeError("Cannot convert undefined or null to object");
        }
        return Object.prototype.hasOwnProperty.call(new Object(object), property);
      };
      exports.mixin = (target, source) => {
        for (const key in source) {
          if (exports.hasOwn(source, key)) {
            target[key] = source[key];
          }
        }
      };
      exports.isGzipOrDeflateEncoding = (res) => {
        return new RegExp(/^\s*(?:deflate|gzip)\s*$/).test(res.headers["content-encoding"]);
      };
      exports.isBrotliEncoding = (res) => {
        return new RegExp(/^\s*(?:br)\s*$/).test(res.headers["content-encoding"]);
      };
    }
  });

  // node_modules/superagent/lib/request-base.js
  var require_request_base = __commonJS({
    "node_modules/superagent/lib/request-base.js"(exports, module) {
      "use strict";
      var {
        isObject,
        hasOwn
      } = require_utils2();
      module.exports = RequestBase;
      function RequestBase() {
      }
      RequestBase.prototype.clearTimeout = function() {
        clearTimeout(this._timer);
        clearTimeout(this._responseTimeoutTimer);
        clearTimeout(this._uploadTimeoutTimer);
        delete this._timer;
        delete this._responseTimeoutTimer;
        delete this._uploadTimeoutTimer;
        return this;
      };
      RequestBase.prototype.parse = function(fn) {
        this._parser = fn;
        return this;
      };
      RequestBase.prototype.responseType = function(value) {
        this._responseType = value;
        return this;
      };
      RequestBase.prototype.serialize = function(fn) {
        this._serializer = fn;
        return this;
      };
      RequestBase.prototype.timeout = function(options) {
        if (!options || typeof options !== "object") {
          this._timeout = options;
          this._responseTimeout = 0;
          this._uploadTimeout = 0;
          return this;
        }
        for (const option in options) {
          if (hasOwn(options, option)) {
            switch (option) {
              case "deadline":
                this._timeout = options.deadline;
                break;
              case "response":
                this._responseTimeout = options.response;
                break;
              case "upload":
                this._uploadTimeout = options.upload;
                break;
              default:
                console.warn("Unknown timeout option", option);
            }
          }
        }
        return this;
      };
      RequestBase.prototype.retry = function(count, fn) {
        if (arguments.length === 0 || count === true) count = 1;
        if (count <= 0) count = 0;
        this._maxRetries = count;
        this._retries = 0;
        this._retryCallback = fn;
        return this;
      };
      var ERROR_CODES = /* @__PURE__ */ new Set(["ETIMEDOUT", "ECONNRESET", "EADDRINUSE", "ECONNREFUSED", "EPIPE", "ENOTFOUND", "ENETUNREACH", "EAI_AGAIN"]);
      var STATUS_CODES = /* @__PURE__ */ new Set([408, 413, 429, 500, 502, 503, 504, 521, 522, 524]);
      RequestBase.prototype._shouldRetry = function(error, res) {
        if (!this._maxRetries || this._retries++ >= this._maxRetries) {
          return false;
        }
        if (this._retryCallback) {
          try {
            const override = this._retryCallback(error, res);
            if (override === true) return true;
            if (override === false) return false;
          } catch (err) {
            console.error(err);
          }
        }
        if (res && res.status && STATUS_CODES.has(res.status)) return true;
        if (error) {
          if (error.code && ERROR_CODES.has(error.code)) return true;
          if (error.timeout && error.code === "ECONNABORTED") return true;
          if (error.crossDomain) return true;
        }
        return false;
      };
      RequestBase.prototype._retry = function() {
        this.clearTimeout();
        if (this.req) {
          this.req = null;
          this.req = this.request();
        }
        this._aborted = false;
        this.timedout = false;
        this.timedoutError = null;
        return this._end();
      };
      RequestBase.prototype.then = function(resolve, reject) {
        if (!this._fullfilledPromise) {
          const self2 = this;
          if (this._endCalled) {
            console.warn("Warning: superagent request was sent twice, because both .end() and .then() were called. Never call .end() if you use promises");
          }
          this._fullfilledPromise = new Promise((resolve2, reject2) => {
            self2.on("abort", () => {
              if (this._maxRetries && this._maxRetries > this._retries) {
                return;
              }
              if (this.timedout && this.timedoutError) {
                reject2(this.timedoutError);
                return;
              }
              const error = new Error("Aborted");
              error.code = "ABORTED";
              error.status = this.status;
              error.method = this.method;
              error.url = this.url;
              reject2(error);
            });
            self2.end((error, res) => {
              if (error) reject2(error);
              else resolve2(res);
            });
          });
        }
        return this._fullfilledPromise.then(resolve, reject);
      };
      RequestBase.prototype.catch = function(callback) {
        return this.then(void 0, callback);
      };
      RequestBase.prototype.use = function(fn) {
        fn(this);
        return this;
      };
      RequestBase.prototype.ok = function(callback) {
        if (typeof callback !== "function") throw new Error("Callback required");
        this._okCallback = callback;
        return this;
      };
      RequestBase.prototype._isResponseOK = function(res) {
        if (!res) {
          return false;
        }
        if (this._okCallback) {
          return this._okCallback(res);
        }
        return res.status >= 200 && res.status < 300;
      };
      RequestBase.prototype.get = function(field) {
        return this._header[field.toLowerCase()];
      };
      RequestBase.prototype.getHeader = RequestBase.prototype.get;
      RequestBase.prototype.set = function(field, value) {
        if (isObject(field)) {
          for (const key in field) {
            if (hasOwn(field, key)) this.set(key, field[key]);
          }
          return this;
        }
        this._header[field.toLowerCase()] = value;
        this.header[field] = value;
        return this;
      };
      RequestBase.prototype.unset = function(field) {
        delete this._header[field.toLowerCase()];
        delete this.header[field];
        return this;
      };
      RequestBase.prototype.field = function(name, value, options) {
        if (name === null || void 0 === name) {
          throw new Error(".field(name, val) name can not be empty");
        }
        if (this._data) {
          throw new Error(".field() can't be used if .send() is used. Please use only .send() or only .field() & .attach()");
        }
        if (isObject(name)) {
          for (const key in name) {
            if (hasOwn(name, key)) this.field(key, name[key]);
          }
          return this;
        }
        if (Array.isArray(value)) {
          for (const i in value) {
            if (hasOwn(value, i)) this.field(name, value[i]);
          }
          return this;
        }
        if (value === null || void 0 === value) {
          throw new Error(".field(name, val) val can not be empty");
        }
        if (typeof value === "boolean") {
          value = String(value);
        }
        if (options) this._getFormData().append(name, value, options);
        else this._getFormData().append(name, value);
        return this;
      };
      RequestBase.prototype.abort = function() {
        if (this._aborted) {
          return this;
        }
        this._aborted = true;
        if (this.xhr) this.xhr.abort();
        if (this.req) {
          this.req.abort();
        }
        this.clearTimeout();
        this.emit("abort");
        return this;
      };
      RequestBase.prototype._auth = function(user, pass, options, base64Encoder) {
        switch (options.type) {
          case "basic":
            this.set("Authorization", `Basic ${base64Encoder(`${user}:${pass}`)}`);
            break;
          case "auto":
            this.username = user;
            this.password = pass;
            break;
          case "bearer":
            this.set("Authorization", `Bearer ${user}`);
            break;
          default:
            break;
        }
        return this;
      };
      RequestBase.prototype.withCredentials = function(on) {
        if (on === void 0) on = true;
        this._withCredentials = on;
        return this;
      };
      RequestBase.prototype.redirects = function(n) {
        this._maxRedirects = n;
        return this;
      };
      RequestBase.prototype.maxResponseSize = function(n) {
        if (typeof n !== "number") {
          throw new TypeError("Invalid argument");
        }
        this._maxResponseSize = n;
        return this;
      };
      RequestBase.prototype.toJSON = function() {
        return {
          method: this.method,
          url: this.url,
          data: this._data,
          headers: this._header
        };
      };
      RequestBase.prototype.send = function(data) {
        const isObject_ = isObject(data);
        let type = this._header["content-type"];
        if (this._formData) {
          throw new Error(".send() can't be used if .attach() or .field() is used. Please use only .send() or only .field() & .attach()");
        }
        if (isObject_ && !this._data) {
          if (Array.isArray(data)) {
            this._data = [];
          } else if (!this._isHost(data)) {
            this._data = {};
          }
        } else if (data && this._data && this._isHost(this._data)) {
          throw new Error("Can't merge these send calls");
        }
        if (isObject_ && isObject(this._data)) {
          for (const key in data) {
            if (typeof data[key] == "bigint" && !data[key].toJSON) throw new Error("Cannot serialize BigInt value to json");
            if (hasOwn(data, key)) this._data[key] = data[key];
          }
        } else if (typeof data === "bigint") throw new Error("Cannot send value of type BigInt");
        else if (typeof data === "string") {
          if (!type) this.type("form");
          type = this._header["content-type"];
          if (type) type = type.toLowerCase().trim();
          if (type === "application/x-www-form-urlencoded") {
            this._data = this._data ? `${this._data}&${data}` : data;
          } else {
            this._data = (this._data || "") + data;
          }
        } else {
          this._data = data;
        }
        if (!isObject_ || this._isHost(data)) {
          return this;
        }
        if (!type) this.type("json");
        return this;
      };
      RequestBase.prototype.sortQuery = function(sort) {
        this._sort = typeof sort === "undefined" ? true : sort;
        return this;
      };
      RequestBase.prototype._finalizeQueryString = function() {
        const query = this._query.join("&");
        if (query) {
          this.url += (this.url.includes("?") ? "&" : "?") + query;
        }
        this._query.length = 0;
        if (this._sort) {
          const index = this.url.indexOf("?");
          if (index >= 0) {
            const queryArray = this.url.slice(index + 1).split("&");
            if (typeof this._sort === "function") {
              queryArray.sort(this._sort);
            } else {
              queryArray.sort();
            }
            this.url = this.url.slice(0, index) + "?" + queryArray.join("&");
          }
        }
      };
      RequestBase.prototype._appendQueryString = () => {
        console.warn("Unsupported");
      };
      RequestBase.prototype._timeoutError = function(reason, timeout, errno) {
        if (this._aborted) {
          return;
        }
        const error = new Error(`${reason + timeout}ms exceeded`);
        error.timeout = timeout;
        error.code = "ECONNABORTED";
        error.errno = errno;
        this.timedout = true;
        this.timedoutError = error;
        this.abort();
        this.callback(error);
      };
      RequestBase.prototype._setTimeouts = function() {
        const self2 = this;
        if (this._timeout && !this._timer) {
          this._timer = setTimeout(() => {
            self2._timeoutError("Timeout of ", self2._timeout, "ETIME");
          }, this._timeout);
        }
        if (this._responseTimeout && !this._responseTimeoutTimer) {
          this._responseTimeoutTimer = setTimeout(() => {
            self2._timeoutError("Response timeout of ", self2._responseTimeout, "ETIMEDOUT");
          }, this._responseTimeout);
        }
      };
    }
  });

  // node_modules/superagent/lib/response-base.js
  var require_response_base = __commonJS({
    "node_modules/superagent/lib/response-base.js"(exports, module) {
      "use strict";
      var utils = require_utils2();
      module.exports = ResponseBase;
      function ResponseBase() {
      }
      ResponseBase.prototype.get = function(field) {
        return this.header[field.toLowerCase()];
      };
      ResponseBase.prototype._setHeaderProperties = function(header) {
        const ct = header["content-type"] || "";
        this.type = utils.type(ct);
        const parameters = utils.params(ct);
        for (const key in parameters) {
          if (Object.prototype.hasOwnProperty.call(parameters, key)) this[key] = parameters[key];
        }
        this.links = {};
        try {
          if (header.link) {
            this.links = utils.parseLinks(header.link);
          }
        } catch (err) {
        }
      };
      ResponseBase.prototype._setStatusProperties = function(status) {
        const type = Math.trunc(status / 100);
        this.statusCode = status;
        this.status = this.statusCode;
        this.statusType = type;
        this.info = type === 1;
        this.ok = type === 2;
        this.redirect = type === 3;
        this.clientError = type === 4;
        this.serverError = type === 5;
        this.error = type === 4 || type === 5 ? this.toError() : false;
        this.created = status === 201;
        this.accepted = status === 202;
        this.noContent = status === 204;
        this.badRequest = status === 400;
        this.unauthorized = status === 401;
        this.notAcceptable = status === 406;
        this.forbidden = status === 403;
        this.notFound = status === 404;
        this.unprocessableEntity = status === 422;
      };
    }
  });

  // node_modules/superagent/lib/agent-base.js
  var require_agent_base = __commonJS({
    "node_modules/superagent/lib/agent-base.js"(exports, module) {
      "use strict";
      var defaults = ["use", "on", "once", "set", "query", "type", "accept", "auth", "withCredentials", "sortQuery", "retry", "ok", "redirects", "timeout", "buffer", "serialize", "parse", "ca", "key", "pfx", "cert", "disableTLSCerts"];
      var Agent = class {
        constructor() {
          this._defaults = [];
        }
        _setDefaults(request) {
          for (const def of this._defaults) {
            request[def.fn](...def.args);
          }
        }
      };
      for (const fn of defaults) {
        Agent.prototype[fn] = function(...args) {
          this._defaults.push({
            fn,
            args
          });
          return this;
        };
      }
      module.exports = Agent;
    }
  });

  // node_modules/superagent/lib/client.js
  var require_client = __commonJS({
    "node_modules/superagent/lib/client.js"(exports, module) {
      "use strict";
      var root;
      if (typeof window !== "undefined") {
        root = window;
      } else if (typeof self === "undefined") {
        console.warn("Using browser-only version of superagent in non-browser environment");
        root = void 0;
      } else {
        root = self;
      }
      var Emitter = require_component_emitter();
      var safeStringify = require_fast_safe_stringify();
      var qs = require_lib();
      var RequestBase = require_request_base();
      var {
        isObject,
        mixin,
        hasOwn
      } = require_utils2();
      var ResponseBase = require_response_base();
      var Agent = require_agent_base();
      function noop() {
      }
      module.exports = function(method, url) {
        if (typeof url === "function") {
          return new exports.Request("GET", method).end(url);
        }
        if (arguments.length === 1) {
          return new exports.Request("GET", method);
        }
        return new exports.Request(method, url);
      };
      exports = module.exports;
      var request = exports;
      exports.Request = Request;
      request.getXHR = () => {
        if (root.XMLHttpRequest) {
          return new root.XMLHttpRequest();
        }
        throw new Error("Browser-only version of superagent could not find XHR");
      };
      var trim = "".trim ? (s) => s.trim() : (s) => s.replace(/(^\s*|\s*$)/g, "");
      function serialize(object) {
        if (!isObject(object)) return object;
        const pairs = [];
        for (const key in object) {
          if (hasOwn(object, key)) pushEncodedKeyValuePair(pairs, key, object[key]);
        }
        return pairs.join("&");
      }
      function pushEncodedKeyValuePair(pairs, key, value) {
        if (value === void 0) return;
        if (value === null) {
          pairs.push(encodeURI(key));
          return;
        }
        if (Array.isArray(value)) {
          for (const v of value) {
            pushEncodedKeyValuePair(pairs, key, v);
          }
        } else if (isObject(value)) {
          for (const subkey in value) {
            if (hasOwn(value, subkey)) pushEncodedKeyValuePair(pairs, `${key}[${subkey}]`, value[subkey]);
          }
        } else {
          pairs.push(encodeURI(key) + "=" + encodeURIComponent(value));
        }
      }
      request.serializeObject = serialize;
      function parseString(string_) {
        const object = {};
        const pairs = string_.split("&");
        let pair;
        let pos;
        for (let i = 0, length_ = pairs.length; i < length_; ++i) {
          pair = pairs[i];
          pos = pair.indexOf("=");
          if (pos === -1) {
            object[decodeURIComponent(pair)] = "";
          } else {
            object[decodeURIComponent(pair.slice(0, pos))] = decodeURIComponent(pair.slice(pos + 1));
          }
        }
        return object;
      }
      request.parseString = parseString;
      request.types = {
        html: "text/html",
        json: "application/json",
        xml: "text/xml",
        urlencoded: "application/x-www-form-urlencoded",
        form: "application/x-www-form-urlencoded",
        "form-data": "application/x-www-form-urlencoded"
      };
      request.serialize = {
        "application/x-www-form-urlencoded": (obj) => {
          return qs.stringify(obj, {
            indices: false,
            strictNullHandling: true
          });
        },
        "application/json": safeStringify
      };
      request.parse = {
        "application/x-www-form-urlencoded": parseString,
        "application/json": JSON.parse
      };
      function parseHeader(string_) {
        const lines = string_.split(/\r?\n/);
        const fields = {};
        let index;
        let line;
        let field;
        let value;
        for (let i = 0, length_ = lines.length; i < length_; ++i) {
          line = lines[i];
          index = line.indexOf(":");
          if (index === -1) {
            continue;
          }
          field = line.slice(0, index).toLowerCase();
          value = trim(line.slice(index + 1));
          fields[field] = value;
        }
        return fields;
      }
      function isJSON(mime) {
        return /[/+]json($|[^-\w])/i.test(mime);
      }
      function Response(request_) {
        this.req = request_;
        this.xhr = this.req.xhr;
        this.text = this.req.method !== "HEAD" && (this.xhr.responseType === "" || this.xhr.responseType === "text") || typeof this.xhr.responseType === "undefined" ? this.xhr.responseText : null;
        this.statusText = this.req.xhr.statusText;
        let {
          status
        } = this.xhr;
        if (status === 1223) {
          status = 204;
        }
        this._setStatusProperties(status);
        this.headers = parseHeader(this.xhr.getAllResponseHeaders());
        this.header = this.headers;
        this.header["content-type"] = this.xhr.getResponseHeader("content-type");
        this._setHeaderProperties(this.header);
        if (this.text === null && request_._responseType) {
          this.body = this.xhr.response;
        } else {
          this.body = this.req.method === "HEAD" ? null : this._parseBody(this.text ? this.text : this.xhr.response);
        }
      }
      mixin(Response.prototype, ResponseBase.prototype);
      Response.prototype._parseBody = function(string_) {
        let parse = request.parse[this.type];
        if (this.req._parser) {
          return this.req._parser(this, string_);
        }
        if (!parse && isJSON(this.type)) {
          parse = request.parse["application/json"];
        }
        return parse && string_ && (string_.length > 0 || string_ instanceof Object) ? parse(string_) : null;
      };
      Response.prototype.toError = function() {
        const {
          req
        } = this;
        const {
          method
        } = req;
        const {
          url
        } = req;
        const message = `cannot ${method} ${url} (${this.status})`;
        const error = new Error(message);
        error.status = this.status;
        error.method = method;
        error.url = url;
        return error;
      };
      request.Response = Response;
      function Request(method, url) {
        const self2 = this;
        this._query = this._query || [];
        this.method = method;
        this.url = url;
        this.header = {};
        this._header = {};
        this.on("end", () => {
          let error = null;
          let res = null;
          try {
            res = new Response(self2);
          } catch (err) {
            error = new Error("Parser is unable to parse the response");
            error.parse = true;
            error.original = err;
            if (self2.xhr) {
              error.rawResponse = typeof self2.xhr.responseType === "undefined" ? self2.xhr.responseText : self2.xhr.response;
              error.status = self2.xhr.status ? self2.xhr.status : null;
              error.statusCode = error.status;
            } else {
              error.rawResponse = null;
              error.status = null;
            }
            return self2.callback(error);
          }
          self2.emit("response", res);
          let new_error;
          try {
            if (!self2._isResponseOK(res)) {
              new_error = new Error(res.statusText || res.text || "Unsuccessful HTTP response");
            }
          } catch (err) {
            new_error = err;
          }
          if (new_error) {
            new_error.original = error;
            new_error.response = res;
            new_error.status = new_error.status || res.status;
            self2.callback(new_error, res);
          } else {
            self2.callback(null, res);
          }
        });
      }
      Emitter(Request.prototype);
      mixin(Request.prototype, RequestBase.prototype);
      Request.prototype.type = function(type) {
        this.set("Content-Type", request.types[type] || type);
        return this;
      };
      Request.prototype.accept = function(type) {
        this.set("Accept", request.types[type] || type);
        return this;
      };
      Request.prototype.auth = function(user, pass, options) {
        if (arguments.length === 1) pass = "";
        if (typeof pass === "object" && pass !== null) {
          options = pass;
          pass = "";
        }
        if (!options) {
          options = {
            type: typeof btoa === "function" ? "basic" : "auto"
          };
        }
        const encoder = options.encoder ? options.encoder : (string) => {
          if (typeof btoa === "function") {
            return btoa(string);
          }
          throw new Error("Cannot use basic auth, btoa is not a function");
        };
        return this._auth(user, pass, options, encoder);
      };
      Request.prototype.query = function(value) {
        if (typeof value !== "string") value = serialize(value);
        if (value) this._query.push(value);
        return this;
      };
      Request.prototype.attach = function(field, file, options) {
        if (file) {
          if (this._data) {
            throw new Error("superagent can't mix .send() and .attach()");
          }
          this._getFormData().append(field, file, options || file.name);
        }
        return this;
      };
      Request.prototype._getFormData = function() {
        if (!this._formData) {
          this._formData = new root.FormData();
        }
        return this._formData;
      };
      Request.prototype.callback = function(error, res) {
        if (this._shouldRetry(error, res)) {
          return this._retry();
        }
        const fn = this._callback;
        this.clearTimeout();
        if (error) {
          if (this._maxRetries) error.retries = this._retries - 1;
          this.emit("error", error);
        }
        fn(error, res);
      };
      Request.prototype.crossDomainError = function() {
        const error = new Error("Request has been terminated\nPossible causes: the network is offline, Origin is not allowed by Access-Control-Allow-Origin, the page is being unloaded, etc.");
        error.crossDomain = true;
        error.status = this.status;
        error.method = this.method;
        error.url = this.url;
        this.callback(error);
      };
      Request.prototype.agent = function() {
        console.warn("This is not supported in browser version of superagent");
        return this;
      };
      Request.prototype.ca = Request.prototype.agent;
      Request.prototype.buffer = Request.prototype.ca;
      Request.prototype.write = () => {
        throw new Error("Streaming is not supported in browser version of superagent");
      };
      Request.prototype.pipe = Request.prototype.write;
      Request.prototype._isHost = function(object) {
        return object && typeof object === "object" && !Array.isArray(object) && Object.prototype.toString.call(object) !== "[object Object]";
      };
      Request.prototype.end = function(fn) {
        if (this._endCalled) {
          console.warn("Warning: .end() was called twice. This is not supported in superagent");
        }
        this._endCalled = true;
        this._callback = fn || noop;
        this._finalizeQueryString();
        this._end();
      };
      Request.prototype._setUploadTimeout = function() {
        const self2 = this;
        if (this._uploadTimeout && !this._uploadTimeoutTimer) {
          this._uploadTimeoutTimer = setTimeout(() => {
            self2._timeoutError("Upload timeout of ", self2._uploadTimeout, "ETIMEDOUT");
          }, this._uploadTimeout);
        }
      };
      Request.prototype._end = function() {
        if (this._aborted) return this.callback(new Error("The request has been aborted even before .end() was called"));
        const self2 = this;
        this.xhr = request.getXHR();
        const {
          xhr
        } = this;
        let data = this._formData || this._data;
        this._setTimeouts();
        xhr.addEventListener("readystatechange", () => {
          const {
            readyState
          } = xhr;
          if (readyState >= 2 && self2._responseTimeoutTimer) {
            clearTimeout(self2._responseTimeoutTimer);
          }
          if (readyState !== 4) {
            return;
          }
          let status;
          try {
            status = xhr.status;
          } catch (err) {
            status = 0;
          }
          if (!status) {
            if (self2.timedout || self2._aborted) return;
            return self2.crossDomainError();
          }
          self2.emit("end");
        });
        const handleProgress = (direction, e) => {
          if (e.total > 0) {
            e.percent = e.loaded / e.total * 100;
            if (e.percent === 100) {
              clearTimeout(self2._uploadTimeoutTimer);
            }
          }
          e.direction = direction;
          self2.emit("progress", e);
        };
        if (this.hasListeners("progress")) {
          try {
            xhr.addEventListener("progress", handleProgress.bind(null, "download"));
            if (xhr.upload) {
              xhr.upload.addEventListener("progress", handleProgress.bind(null, "upload"));
            }
          } catch (err) {
          }
        }
        if (xhr.upload) {
          this._setUploadTimeout();
        }
        try {
          if (this.username && this.password) {
            xhr.open(this.method, this.url, true, this.username, this.password);
          } else {
            xhr.open(this.method, this.url, true);
          }
        } catch (err) {
          return this.callback(err);
        }
        if (this._withCredentials) xhr.withCredentials = true;
        if (!this._formData && this.method !== "GET" && this.method !== "HEAD" && typeof data !== "string" && !this._isHost(data)) {
          const contentType = this._header["content-type"];
          let serialize2 = this._serializer || request.serialize[contentType ? contentType.split(";")[0] : ""];
          if (!serialize2 && isJSON(contentType)) {
            serialize2 = request.serialize["application/json"];
          }
          if (serialize2) data = serialize2(data);
        }
        for (const field in this.header) {
          if (this.header[field] === null) continue;
          if (hasOwn(this.header, field)) xhr.setRequestHeader(field, this.header[field]);
        }
        if (this._responseType) {
          xhr.responseType = this._responseType;
        }
        this.emit("request", this);
        xhr.send(typeof data === "undefined" ? null : data);
      };
      var proxyAgent = new Proxy(Agent, {
        apply(target, thisArg, argumentsList) {
          return new target(...argumentsList);
        }
      });
      request.agent = proxyAgent;
      for (const method of ["GET", "POST", "OPTIONS", "PATCH", "PUT", "DELETE"]) {
        Agent.prototype[method.toLowerCase()] = function(url, fn) {
          const request_ = new request.Request(method, url);
          this._setDefaults(request_);
          if (fn) {
            request_.end(fn);
          }
          return request_;
        };
      }
      Agent.prototype.del = Agent.prototype.delete;
      request.get = (url, data, fn) => {
        const request_ = request("GET", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.query(data);
        if (fn) request_.end(fn);
        return request_;
      };
      request.head = (url, data, fn) => {
        const request_ = request("HEAD", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.query(data);
        if (fn) request_.end(fn);
        return request_;
      };
      request.options = (url, data, fn) => {
        const request_ = request("OPTIONS", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.send(data);
        if (fn) request_.end(fn);
        return request_;
      };
      function del(url, data, fn) {
        const request_ = request("DELETE", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.send(data);
        if (fn) request_.end(fn);
        return request_;
      }
      request.del = del;
      request.delete = del;
      request.patch = (url, data, fn) => {
        const request_ = request("PATCH", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.send(data);
        if (fn) request_.end(fn);
        return request_;
      };
      request.post = (url, data, fn) => {
        const request_ = request("POST", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.send(data);
        if (fn) request_.end(fn);
        return request_;
      };
      request.put = (url, data, fn) => {
        const request_ = request("PUT", url);
        if (typeof data === "function") {
          fn = data;
          data = null;
        }
        if (data) request_.send(data);
        if (fn) request_.end(fn);
        return request_;
      };
    }
  });

  // node_modules/json5/dist/index.js
  var require_dist = __commonJS({
    "node_modules/json5/dist/index.js"(exports, module) {
      (function(global2, factory) {
        typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : global2.JSON5 = factory();
      })(exports, (function() {
        "use strict";
        function createCommonjsModule(fn, module2) {
          return module2 = { exports: {} }, fn(module2, module2.exports), module2.exports;
        }
        var _global = createCommonjsModule(function(module2) {
          var global2 = module2.exports = typeof window != "undefined" && window.Math == Math ? window : typeof self != "undefined" && self.Math == Math ? self : Function("return this")();
          if (typeof __g == "number") {
            __g = global2;
          }
        });
        var _core = createCommonjsModule(function(module2) {
          var core = module2.exports = { version: "2.6.5" };
          if (typeof __e == "number") {
            __e = core;
          }
        });
        var _core_1 = _core.version;
        var _isObject = function(it) {
          return typeof it === "object" ? it !== null : typeof it === "function";
        };
        var _anObject = function(it) {
          if (!_isObject(it)) {
            throw TypeError(it + " is not an object!");
          }
          return it;
        };
        var _fails = function(exec) {
          try {
            return !!exec();
          } catch (e) {
            return true;
          }
        };
        var _descriptors = !_fails(function() {
          return Object.defineProperty({}, "a", { get: function() {
            return 7;
          } }).a != 7;
        });
        var document2 = _global.document;
        var is = _isObject(document2) && _isObject(document2.createElement);
        var _domCreate = function(it) {
          return is ? document2.createElement(it) : {};
        };
        var _ie8DomDefine = !_descriptors && !_fails(function() {
          return Object.defineProperty(_domCreate("div"), "a", { get: function() {
            return 7;
          } }).a != 7;
        });
        var _toPrimitive = function(it, S) {
          if (!_isObject(it)) {
            return it;
          }
          var fn, val;
          if (S && typeof (fn = it.toString) == "function" && !_isObject(val = fn.call(it))) {
            return val;
          }
          if (typeof (fn = it.valueOf) == "function" && !_isObject(val = fn.call(it))) {
            return val;
          }
          if (!S && typeof (fn = it.toString) == "function" && !_isObject(val = fn.call(it))) {
            return val;
          }
          throw TypeError("Can't convert object to primitive value");
        };
        var dP = Object.defineProperty;
        var f = _descriptors ? Object.defineProperty : function defineProperty(O, P, Attributes) {
          _anObject(O);
          P = _toPrimitive(P, true);
          _anObject(Attributes);
          if (_ie8DomDefine) {
            try {
              return dP(O, P, Attributes);
            } catch (e) {
            }
          }
          if ("get" in Attributes || "set" in Attributes) {
            throw TypeError("Accessors not supported!");
          }
          if ("value" in Attributes) {
            O[P] = Attributes.value;
          }
          return O;
        };
        var _objectDp = {
          f
        };
        var _propertyDesc = function(bitmap, value) {
          return {
            enumerable: !(bitmap & 1),
            configurable: !(bitmap & 2),
            writable: !(bitmap & 4),
            value
          };
        };
        var _hide = _descriptors ? function(object, key2, value) {
          return _objectDp.f(object, key2, _propertyDesc(1, value));
        } : function(object, key2, value) {
          object[key2] = value;
          return object;
        };
        var hasOwnProperty = {}.hasOwnProperty;
        var _has = function(it, key2) {
          return hasOwnProperty.call(it, key2);
        };
        var id = 0;
        var px = Math.random();
        var _uid = function(key2) {
          return "Symbol(".concat(key2 === void 0 ? "" : key2, ")_", (++id + px).toString(36));
        };
        var _library = false;
        var _shared = createCommonjsModule(function(module2) {
          var SHARED = "__core-js_shared__";
          var store = _global[SHARED] || (_global[SHARED] = {});
          (module2.exports = function(key2, value) {
            return store[key2] || (store[key2] = value !== void 0 ? value : {});
          })("versions", []).push({
            version: _core.version,
            mode: _library ? "pure" : "global",
            copyright: "\xA9 2019 Denis Pushkarev (zloirock.ru)"
          });
        });
        var _functionToString = _shared("native-function-to-string", Function.toString);
        var _redefine = createCommonjsModule(function(module2) {
          var SRC = _uid("src");
          var TO_STRING = "toString";
          var TPL = ("" + _functionToString).split(TO_STRING);
          _core.inspectSource = function(it) {
            return _functionToString.call(it);
          };
          (module2.exports = function(O, key2, val, safe) {
            var isFunction = typeof val == "function";
            if (isFunction) {
              _has(val, "name") || _hide(val, "name", key2);
            }
            if (O[key2] === val) {
              return;
            }
            if (isFunction) {
              _has(val, SRC) || _hide(val, SRC, O[key2] ? "" + O[key2] : TPL.join(String(key2)));
            }
            if (O === _global) {
              O[key2] = val;
            } else if (!safe) {
              delete O[key2];
              _hide(O, key2, val);
            } else if (O[key2]) {
              O[key2] = val;
            } else {
              _hide(O, key2, val);
            }
          })(Function.prototype, TO_STRING, function toString() {
            return typeof this == "function" && this[SRC] || _functionToString.call(this);
          });
        });
        var _aFunction = function(it) {
          if (typeof it != "function") {
            throw TypeError(it + " is not a function!");
          }
          return it;
        };
        var _ctx = function(fn, that, length) {
          _aFunction(fn);
          if (that === void 0) {
            return fn;
          }
          switch (length) {
            case 1:
              return function(a) {
                return fn.call(that, a);
              };
            case 2:
              return function(a, b) {
                return fn.call(that, a, b);
              };
            case 3:
              return function(a, b, c2) {
                return fn.call(that, a, b, c2);
              };
          }
          return function() {
            return fn.apply(that, arguments);
          };
        };
        var PROTOTYPE = "prototype";
        var $export = function(type, name, source2) {
          var IS_FORCED = type & $export.F;
          var IS_GLOBAL = type & $export.G;
          var IS_STATIC = type & $export.S;
          var IS_PROTO = type & $export.P;
          var IS_BIND = type & $export.B;
          var target = IS_GLOBAL ? _global : IS_STATIC ? _global[name] || (_global[name] = {}) : (_global[name] || {})[PROTOTYPE];
          var exports2 = IS_GLOBAL ? _core : _core[name] || (_core[name] = {});
          var expProto = exports2[PROTOTYPE] || (exports2[PROTOTYPE] = {});
          var key2, own, out, exp;
          if (IS_GLOBAL) {
            source2 = name;
          }
          for (key2 in source2) {
            own = !IS_FORCED && target && target[key2] !== void 0;
            out = (own ? target : source2)[key2];
            exp = IS_BIND && own ? _ctx(out, _global) : IS_PROTO && typeof out == "function" ? _ctx(Function.call, out) : out;
            if (target) {
              _redefine(target, key2, out, type & $export.U);
            }
            if (exports2[key2] != out) {
              _hide(exports2, key2, exp);
            }
            if (IS_PROTO && expProto[key2] != out) {
              expProto[key2] = out;
            }
          }
        };
        _global.core = _core;
        $export.F = 1;
        $export.G = 2;
        $export.S = 4;
        $export.P = 8;
        $export.B = 16;
        $export.W = 32;
        $export.U = 64;
        $export.R = 128;
        var _export = $export;
        var ceil = Math.ceil;
        var floor = Math.floor;
        var _toInteger = function(it) {
          return isNaN(it = +it) ? 0 : (it > 0 ? floor : ceil)(it);
        };
        var _defined = function(it) {
          if (it == void 0) {
            throw TypeError("Can't call method on  " + it);
          }
          return it;
        };
        var _stringAt = function(TO_STRING) {
          return function(that, pos2) {
            var s = String(_defined(that));
            var i = _toInteger(pos2);
            var l = s.length;
            var a, b;
            if (i < 0 || i >= l) {
              return TO_STRING ? "" : void 0;
            }
            a = s.charCodeAt(i);
            return a < 55296 || a > 56319 || i + 1 === l || (b = s.charCodeAt(i + 1)) < 56320 || b > 57343 ? TO_STRING ? s.charAt(i) : a : TO_STRING ? s.slice(i, i + 2) : (a - 55296 << 10) + (b - 56320) + 65536;
          };
        };
        var $at = _stringAt(false);
        _export(_export.P, "String", {
          // 21.1.3.3 String.prototype.codePointAt(pos)
          codePointAt: function codePointAt2(pos2) {
            return $at(this, pos2);
          }
        });
        var codePointAt = _core.String.codePointAt;
        var max = Math.max;
        var min = Math.min;
        var _toAbsoluteIndex = function(index, length) {
          index = _toInteger(index);
          return index < 0 ? max(index + length, 0) : min(index, length);
        };
        var fromCharCode = String.fromCharCode;
        var $fromCodePoint = String.fromCodePoint;
        _export(_export.S + _export.F * (!!$fromCodePoint && $fromCodePoint.length != 1), "String", {
          // 21.1.2.2 String.fromCodePoint(...codePoints)
          fromCodePoint: function fromCodePoint2(x) {
            var arguments$1 = arguments;
            var res = [];
            var aLen = arguments.length;
            var i = 0;
            var code;
            while (aLen > i) {
              code = +arguments$1[i++];
              if (_toAbsoluteIndex(code, 1114111) !== code) {
                throw RangeError(code + " is not a valid code point");
              }
              res.push(
                code < 65536 ? fromCharCode(code) : fromCharCode(((code -= 65536) >> 10) + 55296, code % 1024 + 56320)
              );
            }
            return res.join("");
          }
        });
        var fromCodePoint = _core.String.fromCodePoint;
        var Space_Separator = /[\u1680\u2000-\u200A\u202F\u205F\u3000]/;
        var ID_Start = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u09FC\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C80\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D54-\u0D56\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u1884\u1887-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1C80-\u1C88\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF75\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE4\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD50-\uDD72\uDD76\uDD83-\uDDB2\uDDC1-\uDDC4\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE2B\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEDE\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3D\uDF50\uDF5D-\uDF61]|\uD805[\uDC00-\uDC34\uDC47-\uDC4A\uDC80-\uDCAF\uDCC4\uDCC5\uDCC7\uDD80-\uDDAE\uDDD8-\uDDDB\uDE00-\uDE2F\uDE44\uDE80-\uDEAA\uDF00-\uDF19]|\uD806[\uDCA0-\uDCDF\uDCFF\uDE00\uDE0B-\uDE32\uDE3A\uDE50\uDE5C-\uDE83\uDE86-\uDE89\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC2E\uDC40\uDC72-\uDC8F\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD30\uDD46]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDED0-\uDEED\uDF00-\uDF2F\uDF40-\uDF43\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50\uDF93-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB]|\uD83A[\uDC00-\uDCC4\uDD00-\uDD43]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]/;
        var ID_Continue = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u0860-\u086A\u08A0-\u08B4\u08B6-\u08BD\u08D4-\u08E1\u08E3-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u09FC\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0AF9-\u0AFF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58-\u0C5A\u0C60-\u0C63\u0C66-\u0C6F\u0C80-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D00-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D54-\u0D57\u0D5F-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1C80-\u1C88\u1CD0-\u1CD2\u1CD4-\u1CF9\u1D00-\u1DF9\u1DFB-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312E\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FEA\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AE\uA7B0-\uA7B7\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C5\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA8FD\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2F\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDD40-\uDD74\uDDFD\uDE80-\uDE9C\uDEA0-\uDED0\uDEE0\uDF00-\uDF1F\uDF2D-\uDF4A\uDF50-\uDF7A\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF\uDFD1-\uDFD5]|\uD801[\uDC00-\uDC9D\uDCA0-\uDCA9\uDCB0-\uDCD3\uDCD8-\uDCFB\uDD00-\uDD27\uDD30-\uDD63\uDE00-\uDF36\uDF40-\uDF55\uDF60-\uDF67]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDC60-\uDC76\uDC80-\uDC9E\uDCE0-\uDCF2\uDCF4\uDCF5\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00-\uDE03\uDE05\uDE06\uDE0C-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE38-\uDE3A\uDE3F\uDE60-\uDE7C\uDE80-\uDE9C\uDEC0-\uDEC7\uDEC9-\uDEE6\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72\uDF80-\uDF91]|\uD803[\uDC00-\uDC48\uDC80-\uDCB2\uDCC0-\uDCF2]|\uD804[\uDC00-\uDC46\uDC66-\uDC6F\uDC7F-\uDCBA\uDCD0-\uDCE8\uDCF0-\uDCF9\uDD00-\uDD34\uDD36-\uDD3F\uDD50-\uDD73\uDD76\uDD80-\uDDC4\uDDCA-\uDDCC\uDDD0-\uDDDA\uDDDC\uDE00-\uDE11\uDE13-\uDE37\uDE3E\uDE80-\uDE86\uDE88\uDE8A-\uDE8D\uDE8F-\uDE9D\uDE9F-\uDEA8\uDEB0-\uDEEA\uDEF0-\uDEF9\uDF00-\uDF03\uDF05-\uDF0C\uDF0F\uDF10\uDF13-\uDF28\uDF2A-\uDF30\uDF32\uDF33\uDF35-\uDF39\uDF3C-\uDF44\uDF47\uDF48\uDF4B-\uDF4D\uDF50\uDF57\uDF5D-\uDF63\uDF66-\uDF6C\uDF70-\uDF74]|\uD805[\uDC00-\uDC4A\uDC50-\uDC59\uDC80-\uDCC5\uDCC7\uDCD0-\uDCD9\uDD80-\uDDB5\uDDB8-\uDDC0\uDDD8-\uDDDD\uDE00-\uDE40\uDE44\uDE50-\uDE59\uDE80-\uDEB7\uDEC0-\uDEC9\uDF00-\uDF19\uDF1D-\uDF2B\uDF30-\uDF39]|\uD806[\uDCA0-\uDCE9\uDCFF\uDE00-\uDE3E\uDE47\uDE50-\uDE83\uDE86-\uDE99\uDEC0-\uDEF8]|\uD807[\uDC00-\uDC08\uDC0A-\uDC36\uDC38-\uDC40\uDC50-\uDC59\uDC72-\uDC8F\uDC92-\uDCA7\uDCA9-\uDCB6\uDD00-\uDD06\uDD08\uDD09\uDD0B-\uDD36\uDD3A\uDD3C\uDD3D\uDD3F-\uDD47\uDD50-\uDD59]|\uD808[\uDC00-\uDF99]|\uD809[\uDC00-\uDC6E\uDC80-\uDD43]|[\uD80C\uD81C-\uD820\uD840-\uD868\uD86A-\uD86C\uD86F-\uD872\uD874-\uD879][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD811[\uDC00-\uDE46]|\uD81A[\uDC00-\uDE38\uDE40-\uDE5E\uDE60-\uDE69\uDED0-\uDEED\uDEF0-\uDEF4\uDF00-\uDF36\uDF40-\uDF43\uDF50-\uDF59\uDF63-\uDF77\uDF7D-\uDF8F]|\uD81B[\uDF00-\uDF44\uDF50-\uDF7E\uDF8F-\uDF9F\uDFE0\uDFE1]|\uD821[\uDC00-\uDFEC]|\uD822[\uDC00-\uDEF2]|\uD82C[\uDC00-\uDD1E\uDD70-\uDEFB]|\uD82F[\uDC00-\uDC6A\uDC70-\uDC7C\uDC80-\uDC88\uDC90-\uDC99\uDC9D\uDC9E]|\uD834[\uDD65-\uDD69\uDD6D-\uDD72\uDD7B-\uDD82\uDD85-\uDD8B\uDDAA-\uDDAD\uDE42-\uDE44]|\uD835[\uDC00-\uDC54\uDC56-\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDEA5\uDEA8-\uDEC0\uDEC2-\uDEDA\uDEDC-\uDEFA\uDEFC-\uDF14\uDF16-\uDF34\uDF36-\uDF4E\uDF50-\uDF6E\uDF70-\uDF88\uDF8A-\uDFA8\uDFAA-\uDFC2\uDFC4-\uDFCB\uDFCE-\uDFFF]|\uD836[\uDE00-\uDE36\uDE3B-\uDE6C\uDE75\uDE84\uDE9B-\uDE9F\uDEA1-\uDEAF]|\uD838[\uDC00-\uDC06\uDC08-\uDC18\uDC1B-\uDC21\uDC23\uDC24\uDC26-\uDC2A]|\uD83A[\uDC00-\uDCC4\uDCD0-\uDCD6\uDD00-\uDD4A\uDD50-\uDD59]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D\uDC20-\uDFFF]|\uD873[\uDC00-\uDEA1\uDEB0-\uDFFF]|\uD87A[\uDC00-\uDFE0]|\uD87E[\uDC00-\uDE1D]|\uDB40[\uDD00-\uDDEF]/;
        var unicode = {
          Space_Separator,
          ID_Start,
          ID_Continue
        };
        var util = {
          isSpaceSeparator: function isSpaceSeparator(c2) {
            return typeof c2 === "string" && unicode.Space_Separator.test(c2);
          },
          isIdStartChar: function isIdStartChar(c2) {
            return typeof c2 === "string" && (c2 >= "a" && c2 <= "z" || c2 >= "A" && c2 <= "Z" || c2 === "$" || c2 === "_" || unicode.ID_Start.test(c2));
          },
          isIdContinueChar: function isIdContinueChar(c2) {
            return typeof c2 === "string" && (c2 >= "a" && c2 <= "z" || c2 >= "A" && c2 <= "Z" || c2 >= "0" && c2 <= "9" || c2 === "$" || c2 === "_" || c2 === "\u200C" || c2 === "\u200D" || unicode.ID_Continue.test(c2));
          },
          isDigit: function isDigit(c2) {
            return typeof c2 === "string" && /[0-9]/.test(c2);
          },
          isHexDigit: function isHexDigit(c2) {
            return typeof c2 === "string" && /[0-9A-Fa-f]/.test(c2);
          }
        };
        var source;
        var parseState;
        var stack;
        var pos;
        var line;
        var column;
        var token;
        var key;
        var root;
        var parse = function parse2(text, reviver) {
          source = String(text);
          parseState = "start";
          stack = [];
          pos = 0;
          line = 1;
          column = 0;
          token = void 0;
          key = void 0;
          root = void 0;
          do {
            token = lex();
            parseStates[parseState]();
          } while (token.type !== "eof");
          if (typeof reviver === "function") {
            return internalize({ "": root }, "", reviver);
          }
          return root;
        };
        function internalize(holder, name, reviver) {
          var value = holder[name];
          if (value != null && typeof value === "object") {
            if (Array.isArray(value)) {
              for (var i = 0; i < value.length; i++) {
                var key2 = String(i);
                var replacement = internalize(value, key2, reviver);
                if (replacement === void 0) {
                  delete value[key2];
                } else {
                  Object.defineProperty(value, key2, {
                    value: replacement,
                    writable: true,
                    enumerable: true,
                    configurable: true
                  });
                }
              }
            } else {
              for (var key$1 in value) {
                var replacement$1 = internalize(value, key$1, reviver);
                if (replacement$1 === void 0) {
                  delete value[key$1];
                } else {
                  Object.defineProperty(value, key$1, {
                    value: replacement$1,
                    writable: true,
                    enumerable: true,
                    configurable: true
                  });
                }
              }
            }
          }
          return reviver.call(holder, name, value);
        }
        var lexState;
        var buffer;
        var doubleQuote;
        var sign;
        var c;
        function lex() {
          lexState = "default";
          buffer = "";
          doubleQuote = false;
          sign = 1;
          for (; ; ) {
            c = peek();
            var token2 = lexStates[lexState]();
            if (token2) {
              return token2;
            }
          }
        }
        function peek() {
          if (source[pos]) {
            return String.fromCodePoint(source.codePointAt(pos));
          }
        }
        function read() {
          var c2 = peek();
          if (c2 === "\n") {
            line++;
            column = 0;
          } else if (c2) {
            column += c2.length;
          } else {
            column++;
          }
          if (c2) {
            pos += c2.length;
          }
          return c2;
        }
        var lexStates = {
          default: function default$1() {
            switch (c) {
              case "	":
              case "\v":
              case "\f":
              case " ":
              case "\xA0":
              case "\uFEFF":
              case "\n":
              case "\r":
              case "\u2028":
              case "\u2029":
                read();
                return;
              case "/":
                read();
                lexState = "comment";
                return;
              case void 0:
                read();
                return newToken("eof");
            }
            if (util.isSpaceSeparator(c)) {
              read();
              return;
            }
            return lexStates[parseState]();
          },
          comment: function comment() {
            switch (c) {
              case "*":
                read();
                lexState = "multiLineComment";
                return;
              case "/":
                read();
                lexState = "singleLineComment";
                return;
            }
            throw invalidChar(read());
          },
          multiLineComment: function multiLineComment() {
            switch (c) {
              case "*":
                read();
                lexState = "multiLineCommentAsterisk";
                return;
              case void 0:
                throw invalidChar(read());
            }
            read();
          },
          multiLineCommentAsterisk: function multiLineCommentAsterisk() {
            switch (c) {
              case "*":
                read();
                return;
              case "/":
                read();
                lexState = "default";
                return;
              case void 0:
                throw invalidChar(read());
            }
            read();
            lexState = "multiLineComment";
          },
          singleLineComment: function singleLineComment() {
            switch (c) {
              case "\n":
              case "\r":
              case "\u2028":
              case "\u2029":
                read();
                lexState = "default";
                return;
              case void 0:
                read();
                return newToken("eof");
            }
            read();
          },
          value: function value() {
            switch (c) {
              case "{":
              case "[":
                return newToken("punctuator", read());
              case "n":
                read();
                literal("ull");
                return newToken("null", null);
              case "t":
                read();
                literal("rue");
                return newToken("boolean", true);
              case "f":
                read();
                literal("alse");
                return newToken("boolean", false);
              case "-":
              case "+":
                if (read() === "-") {
                  sign = -1;
                }
                lexState = "sign";
                return;
              case ".":
                buffer = read();
                lexState = "decimalPointLeading";
                return;
              case "0":
                buffer = read();
                lexState = "zero";
                return;
              case "1":
              case "2":
              case "3":
              case "4":
              case "5":
              case "6":
              case "7":
              case "8":
              case "9":
                buffer = read();
                lexState = "decimalInteger";
                return;
              case "I":
                read();
                literal("nfinity");
                return newToken("numeric", Infinity);
              case "N":
                read();
                literal("aN");
                return newToken("numeric", NaN);
              case '"':
              case "'":
                doubleQuote = read() === '"';
                buffer = "";
                lexState = "string";
                return;
            }
            throw invalidChar(read());
          },
          identifierNameStartEscape: function identifierNameStartEscape() {
            if (c !== "u") {
              throw invalidChar(read());
            }
            read();
            var u = unicodeEscape();
            switch (u) {
              case "$":
              case "_":
                break;
              default:
                if (!util.isIdStartChar(u)) {
                  throw invalidIdentifier();
                }
                break;
            }
            buffer += u;
            lexState = "identifierName";
          },
          identifierName: function identifierName() {
            switch (c) {
              case "$":
              case "_":
              case "\u200C":
              case "\u200D":
                buffer += read();
                return;
              case "\\":
                read();
                lexState = "identifierNameEscape";
                return;
            }
            if (util.isIdContinueChar(c)) {
              buffer += read();
              return;
            }
            return newToken("identifier", buffer);
          },
          identifierNameEscape: function identifierNameEscape() {
            if (c !== "u") {
              throw invalidChar(read());
            }
            read();
            var u = unicodeEscape();
            switch (u) {
              case "$":
              case "_":
              case "\u200C":
              case "\u200D":
                break;
              default:
                if (!util.isIdContinueChar(u)) {
                  throw invalidIdentifier();
                }
                break;
            }
            buffer += u;
            lexState = "identifierName";
          },
          sign: function sign$1() {
            switch (c) {
              case ".":
                buffer = read();
                lexState = "decimalPointLeading";
                return;
              case "0":
                buffer = read();
                lexState = "zero";
                return;
              case "1":
              case "2":
              case "3":
              case "4":
              case "5":
              case "6":
              case "7":
              case "8":
              case "9":
                buffer = read();
                lexState = "decimalInteger";
                return;
              case "I":
                read();
                literal("nfinity");
                return newToken("numeric", sign * Infinity);
              case "N":
                read();
                literal("aN");
                return newToken("numeric", NaN);
            }
            throw invalidChar(read());
          },
          zero: function zero() {
            switch (c) {
              case ".":
                buffer += read();
                lexState = "decimalPoint";
                return;
              case "e":
              case "E":
                buffer += read();
                lexState = "decimalExponent";
                return;
              case "x":
              case "X":
                buffer += read();
                lexState = "hexadecimal";
                return;
            }
            return newToken("numeric", sign * 0);
          },
          decimalInteger: function decimalInteger() {
            switch (c) {
              case ".":
                buffer += read();
                lexState = "decimalPoint";
                return;
              case "e":
              case "E":
                buffer += read();
                lexState = "decimalExponent";
                return;
            }
            if (util.isDigit(c)) {
              buffer += read();
              return;
            }
            return newToken("numeric", sign * Number(buffer));
          },
          decimalPointLeading: function decimalPointLeading() {
            if (util.isDigit(c)) {
              buffer += read();
              lexState = "decimalFraction";
              return;
            }
            throw invalidChar(read());
          },
          decimalPoint: function decimalPoint() {
            switch (c) {
              case "e":
              case "E":
                buffer += read();
                lexState = "decimalExponent";
                return;
            }
            if (util.isDigit(c)) {
              buffer += read();
              lexState = "decimalFraction";
              return;
            }
            return newToken("numeric", sign * Number(buffer));
          },
          decimalFraction: function decimalFraction() {
            switch (c) {
              case "e":
              case "E":
                buffer += read();
                lexState = "decimalExponent";
                return;
            }
            if (util.isDigit(c)) {
              buffer += read();
              return;
            }
            return newToken("numeric", sign * Number(buffer));
          },
          decimalExponent: function decimalExponent() {
            switch (c) {
              case "+":
              case "-":
                buffer += read();
                lexState = "decimalExponentSign";
                return;
            }
            if (util.isDigit(c)) {
              buffer += read();
              lexState = "decimalExponentInteger";
              return;
            }
            throw invalidChar(read());
          },
          decimalExponentSign: function decimalExponentSign() {
            if (util.isDigit(c)) {
              buffer += read();
              lexState = "decimalExponentInteger";
              return;
            }
            throw invalidChar(read());
          },
          decimalExponentInteger: function decimalExponentInteger() {
            if (util.isDigit(c)) {
              buffer += read();
              return;
            }
            return newToken("numeric", sign * Number(buffer));
          },
          hexadecimal: function hexadecimal() {
            if (util.isHexDigit(c)) {
              buffer += read();
              lexState = "hexadecimalInteger";
              return;
            }
            throw invalidChar(read());
          },
          hexadecimalInteger: function hexadecimalInteger() {
            if (util.isHexDigit(c)) {
              buffer += read();
              return;
            }
            return newToken("numeric", sign * Number(buffer));
          },
          string: function string() {
            switch (c) {
              case "\\":
                read();
                buffer += escape2();
                return;
              case '"':
                if (doubleQuote) {
                  read();
                  return newToken("string", buffer);
                }
                buffer += read();
                return;
              case "'":
                if (!doubleQuote) {
                  read();
                  return newToken("string", buffer);
                }
                buffer += read();
                return;
              case "\n":
              case "\r":
                throw invalidChar(read());
              case "\u2028":
              case "\u2029":
                separatorChar(c);
                break;
              case void 0:
                throw invalidChar(read());
            }
            buffer += read();
          },
          start: function start() {
            switch (c) {
              case "{":
              case "[":
                return newToken("punctuator", read());
            }
            lexState = "value";
          },
          beforePropertyName: function beforePropertyName() {
            switch (c) {
              case "$":
              case "_":
                buffer = read();
                lexState = "identifierName";
                return;
              case "\\":
                read();
                lexState = "identifierNameStartEscape";
                return;
              case "}":
                return newToken("punctuator", read());
              case '"':
              case "'":
                doubleQuote = read() === '"';
                lexState = "string";
                return;
            }
            if (util.isIdStartChar(c)) {
              buffer += read();
              lexState = "identifierName";
              return;
            }
            throw invalidChar(read());
          },
          afterPropertyName: function afterPropertyName() {
            if (c === ":") {
              return newToken("punctuator", read());
            }
            throw invalidChar(read());
          },
          beforePropertyValue: function beforePropertyValue() {
            lexState = "value";
          },
          afterPropertyValue: function afterPropertyValue() {
            switch (c) {
              case ",":
              case "}":
                return newToken("punctuator", read());
            }
            throw invalidChar(read());
          },
          beforeArrayValue: function beforeArrayValue() {
            if (c === "]") {
              return newToken("punctuator", read());
            }
            lexState = "value";
          },
          afterArrayValue: function afterArrayValue() {
            switch (c) {
              case ",":
              case "]":
                return newToken("punctuator", read());
            }
            throw invalidChar(read());
          },
          end: function end() {
            throw invalidChar(read());
          }
        };
        function newToken(type, value) {
          return {
            type,
            value,
            line,
            column
          };
        }
        function literal(s) {
          for (var i = 0, list = s; i < list.length; i += 1) {
            var c2 = list[i];
            var p = peek();
            if (p !== c2) {
              throw invalidChar(read());
            }
            read();
          }
        }
        function escape2() {
          var c2 = peek();
          switch (c2) {
            case "b":
              read();
              return "\b";
            case "f":
              read();
              return "\f";
            case "n":
              read();
              return "\n";
            case "r":
              read();
              return "\r";
            case "t":
              read();
              return "	";
            case "v":
              read();
              return "\v";
            case "0":
              read();
              if (util.isDigit(peek())) {
                throw invalidChar(read());
              }
              return "\0";
            case "x":
              read();
              return hexEscape();
            case "u":
              read();
              return unicodeEscape();
            case "\n":
            case "\u2028":
            case "\u2029":
              read();
              return "";
            case "\r":
              read();
              if (peek() === "\n") {
                read();
              }
              return "";
            case "1":
            case "2":
            case "3":
            case "4":
            case "5":
            case "6":
            case "7":
            case "8":
            case "9":
              throw invalidChar(read());
            case void 0:
              throw invalidChar(read());
          }
          return read();
        }
        function hexEscape() {
          var buffer2 = "";
          var c2 = peek();
          if (!util.isHexDigit(c2)) {
            throw invalidChar(read());
          }
          buffer2 += read();
          c2 = peek();
          if (!util.isHexDigit(c2)) {
            throw invalidChar(read());
          }
          buffer2 += read();
          return String.fromCodePoint(parseInt(buffer2, 16));
        }
        function unicodeEscape() {
          var buffer2 = "";
          var count = 4;
          while (count-- > 0) {
            var c2 = peek();
            if (!util.isHexDigit(c2)) {
              throw invalidChar(read());
            }
            buffer2 += read();
          }
          return String.fromCodePoint(parseInt(buffer2, 16));
        }
        var parseStates = {
          start: function start() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            push();
          },
          beforePropertyName: function beforePropertyName() {
            switch (token.type) {
              case "identifier":
              case "string":
                key = token.value;
                parseState = "afterPropertyName";
                return;
              case "punctuator":
                pop();
                return;
              case "eof":
                throw invalidEOF();
            }
          },
          afterPropertyName: function afterPropertyName() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            parseState = "beforePropertyValue";
          },
          beforePropertyValue: function beforePropertyValue() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            push();
          },
          beforeArrayValue: function beforeArrayValue() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            if (token.type === "punctuator" && token.value === "]") {
              pop();
              return;
            }
            push();
          },
          afterPropertyValue: function afterPropertyValue() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            switch (token.value) {
              case ",":
                parseState = "beforePropertyName";
                return;
              case "}":
                pop();
            }
          },
          afterArrayValue: function afterArrayValue() {
            if (token.type === "eof") {
              throw invalidEOF();
            }
            switch (token.value) {
              case ",":
                parseState = "beforeArrayValue";
                return;
              case "]":
                pop();
            }
          },
          end: function end() {
          }
        };
        function push() {
          var value;
          switch (token.type) {
            case "punctuator":
              switch (token.value) {
                case "{":
                  value = {};
                  break;
                case "[":
                  value = [];
                  break;
              }
              break;
            case "null":
            case "boolean":
            case "numeric":
            case "string":
              value = token.value;
              break;
          }
          if (root === void 0) {
            root = value;
          } else {
            var parent = stack[stack.length - 1];
            if (Array.isArray(parent)) {
              parent.push(value);
            } else {
              Object.defineProperty(parent, key, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
          if (value !== null && typeof value === "object") {
            stack.push(value);
            if (Array.isArray(value)) {
              parseState = "beforeArrayValue";
            } else {
              parseState = "beforePropertyName";
            }
          } else {
            var current = stack[stack.length - 1];
            if (current == null) {
              parseState = "end";
            } else if (Array.isArray(current)) {
              parseState = "afterArrayValue";
            } else {
              parseState = "afterPropertyValue";
            }
          }
        }
        function pop() {
          stack.pop();
          var current = stack[stack.length - 1];
          if (current == null) {
            parseState = "end";
          } else if (Array.isArray(current)) {
            parseState = "afterArrayValue";
          } else {
            parseState = "afterPropertyValue";
          }
        }
        function invalidChar(c2) {
          if (c2 === void 0) {
            return syntaxError("JSON5: invalid end of input at " + line + ":" + column);
          }
          return syntaxError("JSON5: invalid character '" + formatChar(c2) + "' at " + line + ":" + column);
        }
        function invalidEOF() {
          return syntaxError("JSON5: invalid end of input at " + line + ":" + column);
        }
        function invalidIdentifier() {
          column -= 5;
          return syntaxError("JSON5: invalid identifier character at " + line + ":" + column);
        }
        function separatorChar(c2) {
          console.warn("JSON5: '" + formatChar(c2) + "' in strings is not valid ECMAScript; consider escaping");
        }
        function formatChar(c2) {
          var replacements = {
            "'": "\\'",
            '"': '\\"',
            "\\": "\\\\",
            "\b": "\\b",
            "\f": "\\f",
            "\n": "\\n",
            "\r": "\\r",
            "	": "\\t",
            "\v": "\\v",
            "\0": "\\0",
            "\u2028": "\\u2028",
            "\u2029": "\\u2029"
          };
          if (replacements[c2]) {
            return replacements[c2];
          }
          if (c2 < " ") {
            var hexString = c2.charCodeAt(0).toString(16);
            return "\\x" + ("00" + hexString).substring(hexString.length);
          }
          return c2;
        }
        function syntaxError(message) {
          var err = new SyntaxError(message);
          err.lineNumber = line;
          err.columnNumber = column;
          return err;
        }
        var stringify = function stringify2(value, replacer, space) {
          var stack2 = [];
          var indent = "";
          var propertyList;
          var replacerFunc;
          var gap = "";
          var quote;
          if (replacer != null && typeof replacer === "object" && !Array.isArray(replacer)) {
            space = replacer.space;
            quote = replacer.quote;
            replacer = replacer.replacer;
          }
          if (typeof replacer === "function") {
            replacerFunc = replacer;
          } else if (Array.isArray(replacer)) {
            propertyList = [];
            for (var i = 0, list = replacer; i < list.length; i += 1) {
              var v = list[i];
              var item = void 0;
              if (typeof v === "string") {
                item = v;
              } else if (typeof v === "number" || v instanceof String || v instanceof Number) {
                item = String(v);
              }
              if (item !== void 0 && propertyList.indexOf(item) < 0) {
                propertyList.push(item);
              }
            }
          }
          if (space instanceof Number) {
            space = Number(space);
          } else if (space instanceof String) {
            space = String(space);
          }
          if (typeof space === "number") {
            if (space > 0) {
              space = Math.min(10, Math.floor(space));
              gap = "          ".substr(0, space);
            }
          } else if (typeof space === "string") {
            gap = space.substr(0, 10);
          }
          return serializeProperty("", { "": value });
          function serializeProperty(key2, holder) {
            var value2 = holder[key2];
            if (value2 != null) {
              if (typeof value2.toJSON5 === "function") {
                value2 = value2.toJSON5(key2);
              } else if (typeof value2.toJSON === "function") {
                value2 = value2.toJSON(key2);
              }
            }
            if (replacerFunc) {
              value2 = replacerFunc.call(holder, key2, value2);
            }
            if (value2 instanceof Number) {
              value2 = Number(value2);
            } else if (value2 instanceof String) {
              value2 = String(value2);
            } else if (value2 instanceof Boolean) {
              value2 = value2.valueOf();
            }
            switch (value2) {
              case null:
                return "null";
              case true:
                return "true";
              case false:
                return "false";
            }
            if (typeof value2 === "string") {
              return quoteString(value2, false);
            }
            if (typeof value2 === "number") {
              return String(value2);
            }
            if (typeof value2 === "object") {
              return Array.isArray(value2) ? serializeArray(value2) : serializeObject(value2);
            }
            return void 0;
          }
          function quoteString(value2) {
            var quotes = {
              "'": 0.1,
              '"': 0.2
            };
            var replacements = {
              "'": "\\'",
              '"': '\\"',
              "\\": "\\\\",
              "\b": "\\b",
              "\f": "\\f",
              "\n": "\\n",
              "\r": "\\r",
              "	": "\\t",
              "\v": "\\v",
              "\0": "\\0",
              "\u2028": "\\u2028",
              "\u2029": "\\u2029"
            };
            var product = "";
            for (var i2 = 0; i2 < value2.length; i2++) {
              var c2 = value2[i2];
              switch (c2) {
                case "'":
                case '"':
                  quotes[c2]++;
                  product += c2;
                  continue;
                case "\0":
                  if (util.isDigit(value2[i2 + 1])) {
                    product += "\\x00";
                    continue;
                  }
              }
              if (replacements[c2]) {
                product += replacements[c2];
                continue;
              }
              if (c2 < " ") {
                var hexString = c2.charCodeAt(0).toString(16);
                product += "\\x" + ("00" + hexString).substring(hexString.length);
                continue;
              }
              product += c2;
            }
            var quoteChar = quote || Object.keys(quotes).reduce(function(a, b) {
              return quotes[a] < quotes[b] ? a : b;
            });
            product = product.replace(new RegExp(quoteChar, "g"), replacements[quoteChar]);
            return quoteChar + product + quoteChar;
          }
          function serializeObject(value2) {
            if (stack2.indexOf(value2) >= 0) {
              throw TypeError("Converting circular structure to JSON5");
            }
            stack2.push(value2);
            var stepback = indent;
            indent = indent + gap;
            var keys = propertyList || Object.keys(value2);
            var partial = [];
            for (var i2 = 0, list2 = keys; i2 < list2.length; i2 += 1) {
              var key2 = list2[i2];
              var propertyString = serializeProperty(key2, value2);
              if (propertyString !== void 0) {
                var member = serializeKey(key2) + ":";
                if (gap !== "") {
                  member += " ";
                }
                member += propertyString;
                partial.push(member);
              }
            }
            var final;
            if (partial.length === 0) {
              final = "{}";
            } else {
              var properties;
              if (gap === "") {
                properties = partial.join(",");
                final = "{" + properties + "}";
              } else {
                var separator = ",\n" + indent;
                properties = partial.join(separator);
                final = "{\n" + indent + properties + ",\n" + stepback + "}";
              }
            }
            stack2.pop();
            indent = stepback;
            return final;
          }
          function serializeKey(key2) {
            if (key2.length === 0) {
              return quoteString(key2, true);
            }
            var firstChar = String.fromCodePoint(key2.codePointAt(0));
            if (!util.isIdStartChar(firstChar)) {
              return quoteString(key2, true);
            }
            for (var i2 = firstChar.length; i2 < key2.length; i2++) {
              if (!util.isIdContinueChar(String.fromCodePoint(key2.codePointAt(i2)))) {
                return quoteString(key2, true);
              }
            }
            return key2;
          }
          function serializeArray(value2) {
            if (stack2.indexOf(value2) >= 0) {
              throw TypeError("Converting circular structure to JSON5");
            }
            stack2.push(value2);
            var stepback = indent;
            indent = indent + gap;
            var partial = [];
            for (var i2 = 0; i2 < value2.length; i2++) {
              var propertyString = serializeProperty(String(i2), value2);
              partial.push(propertyString !== void 0 ? propertyString : "null");
            }
            var final;
            if (partial.length === 0) {
              final = "[]";
            } else {
              if (gap === "") {
                var properties = partial.join(",");
                final = "[" + properties + "]";
              } else {
                var separator = ",\n" + indent;
                var properties$1 = partial.join(separator);
                final = "[\n" + indent + properties$1 + ",\n" + stepback + "]";
              }
            }
            stack2.pop();
            indent = stepback;
            return final;
          }
        };
        var JSON52 = {
          parse,
          stringify
        };
        var lib = JSON52;
        var es5 = lib;
        return es5;
      }));
    }
  });

  // node_modules/sax/lib/sax.js
  var require_sax = __commonJS({
    "node_modules/sax/lib/sax.js"(exports) {
      (function(sax) {
        sax.parser = function(strict, opt) {
          return new SAXParser(strict, opt);
        };
        sax.SAXParser = SAXParser;
        sax.SAXStream = SAXStream;
        sax.createStream = createStream;
        sax.MAX_BUFFER_LENGTH = 64 * 1024;
        var buffers = [
          "comment",
          "sgmlDecl",
          "textNode",
          "tagName",
          "doctype",
          "procInstName",
          "procInstBody",
          "entity",
          "attribName",
          "attribValue",
          "cdata",
          "script"
        ];
        sax.EVENTS = [
          "text",
          "processinginstruction",
          "sgmldeclaration",
          "doctype",
          "comment",
          "opentagstart",
          "attribute",
          "opentag",
          "closetag",
          "opencdata",
          "cdata",
          "closecdata",
          "error",
          "end",
          "ready",
          "script",
          "opennamespace",
          "closenamespace"
        ];
        function SAXParser(strict, opt) {
          if (!(this instanceof SAXParser)) {
            return new SAXParser(strict, opt);
          }
          var parser = this;
          clearBuffers(parser);
          parser.q = parser.c = "";
          parser.bufferCheckPosition = sax.MAX_BUFFER_LENGTH;
          parser.encoding = null;
          parser.opt = opt || {};
          parser.opt.lowercase = parser.opt.lowercase || parser.opt.lowercasetags;
          parser.looseCase = parser.opt.lowercase ? "toLowerCase" : "toUpperCase";
          parser.opt.maxEntityCount = parser.opt.maxEntityCount || 512;
          parser.opt.maxEntityDepth = parser.opt.maxEntityDepth || 4;
          parser.entityCount = parser.entityDepth = 0;
          parser.tags = [];
          parser.closed = parser.closedRoot = parser.sawRoot = false;
          parser.tag = parser.error = null;
          parser.strict = !!strict;
          parser.noscript = !!(strict || parser.opt.noscript);
          parser.state = S.BEGIN;
          parser.strictEntities = parser.opt.strictEntities;
          parser.ENTITIES = parser.strictEntities ? Object.create(sax.XML_ENTITIES) : Object.create(sax.ENTITIES);
          parser.attribList = [];
          if (parser.opt.xmlns) {
            parser.ns = Object.create(rootNS);
          }
          if (parser.opt.unquotedAttributeValues === void 0) {
            parser.opt.unquotedAttributeValues = !strict;
          }
          parser.trackPosition = parser.opt.position !== false;
          if (parser.trackPosition) {
            parser.position = parser.line = parser.column = 0;
          }
          emit(parser, "onready");
        }
        if (!Object.create) {
          Object.create = function(o) {
            function F() {
            }
            F.prototype = o;
            var newf = new F();
            return newf;
          };
        }
        if (!Object.keys) {
          Object.keys = function(o) {
            var a = [];
            for (var i in o) if (o.hasOwnProperty(i)) a.push(i);
            return a;
          };
        }
        function checkBufferLength(parser) {
          var maxAllowed = Math.max(sax.MAX_BUFFER_LENGTH, 10);
          var maxActual = 0;
          for (var i = 0, l = buffers.length; i < l; i++) {
            var len = parser[buffers[i]].length;
            if (len > maxAllowed) {
              switch (buffers[i]) {
                case "textNode":
                  closeText(parser);
                  break;
                case "cdata":
                  emitNode(parser, "oncdata", parser.cdata);
                  parser.cdata = "";
                  break;
                case "script":
                  emitNode(parser, "onscript", parser.script);
                  parser.script = "";
                  break;
                default:
                  error(parser, "Max buffer length exceeded: " + buffers[i]);
              }
            }
            maxActual = Math.max(maxActual, len);
          }
          var m = sax.MAX_BUFFER_LENGTH - maxActual;
          parser.bufferCheckPosition = m + parser.position;
        }
        function clearBuffers(parser) {
          for (var i = 0, l = buffers.length; i < l; i++) {
            parser[buffers[i]] = "";
          }
        }
        function flushBuffers(parser) {
          closeText(parser);
          if (parser.cdata !== "") {
            emitNode(parser, "oncdata", parser.cdata);
            parser.cdata = "";
          }
          if (parser.script !== "") {
            emitNode(parser, "onscript", parser.script);
            parser.script = "";
          }
        }
        SAXParser.prototype = {
          end: function() {
            end(this);
          },
          write,
          resume: function() {
            this.error = null;
            return this;
          },
          close: function() {
            return this.write(null);
          },
          flush: function() {
            flushBuffers(this);
          }
        };
        var Stream;
        try {
          Stream = __require("stream").Stream;
        } catch (ex) {
          Stream = function() {
          };
        }
        if (!Stream) Stream = function() {
        };
        var streamWraps = sax.EVENTS.filter(function(ev) {
          return ev !== "error" && ev !== "end";
        });
        function createStream(strict, opt) {
          return new SAXStream(strict, opt);
        }
        function determineBufferEncoding(data, isEnd) {
          if (data.length >= 2) {
            if (data[0] === 255 && data[1] === 254) {
              return "utf-16le";
            }
            if (data[0] === 254 && data[1] === 255) {
              return "utf-16be";
            }
          }
          if (data.length >= 3 && data[0] === 239 && data[1] === 187 && data[2] === 191) {
            return "utf8";
          }
          if (data.length >= 4) {
            if (data[0] === 60 && data[1] === 0 && data[2] === 63 && data[3] === 0) {
              return "utf-16le";
            }
            if (data[0] === 0 && data[1] === 60 && data[2] === 0 && data[3] === 63) {
              return "utf-16be";
            }
            return "utf8";
          }
          return isEnd ? "utf8" : null;
        }
        function SAXStream(strict, opt) {
          if (!(this instanceof SAXStream)) {
            return new SAXStream(strict, opt);
          }
          Stream.apply(this);
          this._parser = new SAXParser(strict, opt);
          this.writable = true;
          this.readable = true;
          var me = this;
          this._parser.onend = function() {
            me.emit("end");
          };
          this._parser.onerror = function(er) {
            me.emit("error", er);
            me._parser.error = null;
          };
          this._decoder = null;
          this._decoderBuffer = null;
          streamWraps.forEach(function(ev) {
            Object.defineProperty(me, "on" + ev, {
              get: function() {
                return me._parser["on" + ev];
              },
              set: function(h) {
                if (!h) {
                  me.removeAllListeners(ev);
                  me._parser["on" + ev] = h;
                  return h;
                }
                me.on(ev, h);
              },
              enumerable: true,
              configurable: false
            });
          });
        }
        SAXStream.prototype = Object.create(Stream.prototype, {
          constructor: {
            value: SAXStream
          }
        });
        SAXStream.prototype._decodeBuffer = function(data, isEnd) {
          if (this._decoderBuffer) {
            data = Buffer.concat([this._decoderBuffer, data]);
            this._decoderBuffer = null;
          }
          if (!this._decoder) {
            var encoding = determineBufferEncoding(data, isEnd);
            if (!encoding) {
              this._decoderBuffer = data;
              return "";
            }
            this._parser.encoding = encoding;
            this._decoder = new TextDecoder(encoding);
          }
          return this._decoder.decode(data, { stream: !isEnd });
        };
        SAXStream.prototype.write = function(data) {
          if (typeof Buffer === "function" && typeof Buffer.isBuffer === "function" && Buffer.isBuffer(data)) {
            data = this._decodeBuffer(data, false);
          } else if (this._decoderBuffer) {
            var remaining = this._decodeBuffer(Buffer.alloc(0), true);
            if (remaining) {
              this._parser.write(remaining);
              this.emit("data", remaining);
            }
          }
          this._parser.write(data.toString());
          this.emit("data", data);
          return true;
        };
        SAXStream.prototype.end = function(chunk) {
          if (chunk && chunk.length) {
            this.write(chunk);
          }
          if (this._decoderBuffer) {
            var finalChunk = this._decodeBuffer(Buffer.alloc(0), true);
            if (finalChunk) {
              this._parser.write(finalChunk);
              this.emit("data", finalChunk);
            }
          } else if (this._decoder) {
            var remaining = this._decoder.decode();
            if (remaining) {
              this._parser.write(remaining);
              this.emit("data", remaining);
            }
          }
          this._parser.end();
          return true;
        };
        SAXStream.prototype.on = function(ev, handler) {
          var me = this;
          if (!me._parser["on" + ev] && streamWraps.indexOf(ev) !== -1) {
            me._parser["on" + ev] = function() {
              var args = arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments);
              args.splice(0, 0, ev);
              me.emit.apply(me, args);
            };
          }
          return Stream.prototype.on.call(me, ev, handler);
        };
        var CDATA = "[CDATA[";
        var DOCTYPE = "DOCTYPE";
        var XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
        var XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
        var rootNS = { xml: XML_NAMESPACE, xmlns: XMLNS_NAMESPACE };
        var nameStart = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
        var nameBody = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
        var entityStart = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;
        var entityBody = /[#:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/;
        function isWhitespace(c) {
          return c === " " || c === "\n" || c === "\r" || c === "	";
        }
        function isQuote(c) {
          return c === '"' || c === "'";
        }
        function isAttribEnd(c) {
          return c === ">" || isWhitespace(c);
        }
        function isMatch(regex, c) {
          return regex.test(c);
        }
        function notMatch(regex, c) {
          return !isMatch(regex, c);
        }
        var S = 0;
        sax.STATE = {
          BEGIN: S++,
          // leading byte order mark or whitespace
          BEGIN_WHITESPACE: S++,
          // leading whitespace
          TEXT: S++,
          // general stuff
          TEXT_ENTITY: S++,
          // &amp and such.
          OPEN_WAKA: S++,
          // <
          SGML_DECL: S++,
          // <!BLARG
          SGML_DECL_QUOTED: S++,
          // <!BLARG foo "bar
          DOCTYPE: S++,
          // <!DOCTYPE
          DOCTYPE_QUOTED: S++,
          // <!DOCTYPE "//blah
          DOCTYPE_DTD: S++,
          // <!DOCTYPE "//blah" [ ...
          DOCTYPE_DTD_QUOTED: S++,
          // <!DOCTYPE "//blah" [ "foo
          COMMENT_STARTING: S++,
          // <!-
          COMMENT: S++,
          // <!--
          COMMENT_ENDING: S++,
          // <!-- blah -
          COMMENT_ENDED: S++,
          // <!-- blah --
          CDATA: S++,
          // <![CDATA[ something
          CDATA_ENDING: S++,
          // ]
          CDATA_ENDING_2: S++,
          // ]]
          PROC_INST: S++,
          // <?hi
          PROC_INST_BODY: S++,
          // <?hi there
          PROC_INST_ENDING: S++,
          // <?hi "there" ?
          OPEN_TAG: S++,
          // <strong
          OPEN_TAG_SLASH: S++,
          // <strong /
          ATTRIB: S++,
          // <a
          ATTRIB_NAME: S++,
          // <a foo
          ATTRIB_NAME_SAW_WHITE: S++,
          // <a foo _
          ATTRIB_VALUE: S++,
          // <a foo=
          ATTRIB_VALUE_QUOTED: S++,
          // <a foo="bar
          ATTRIB_VALUE_CLOSED: S++,
          // <a foo="bar"
          ATTRIB_VALUE_UNQUOTED: S++,
          // <a foo=bar
          ATTRIB_VALUE_ENTITY_Q: S++,
          // <foo bar="&quot;"
          ATTRIB_VALUE_ENTITY_U: S++,
          // <foo bar=&quot
          CLOSE_TAG: S++,
          // </a
          CLOSE_TAG_SAW_WHITE: S++,
          // </a   >
          SCRIPT: S++,
          // <script> ...
          SCRIPT_ENDING: S++
          // <script> ... <
        };
        sax.XML_ENTITIES = {
          amp: "&",
          gt: ">",
          lt: "<",
          quot: '"',
          apos: "'"
        };
        sax.ENTITIES = {
          amp: "&",
          gt: ">",
          lt: "<",
          quot: '"',
          apos: "'",
          AElig: 198,
          Aacute: 193,
          Acirc: 194,
          Agrave: 192,
          Aring: 197,
          Atilde: 195,
          Auml: 196,
          Ccedil: 199,
          ETH: 208,
          Eacute: 201,
          Ecirc: 202,
          Egrave: 200,
          Euml: 203,
          Iacute: 205,
          Icirc: 206,
          Igrave: 204,
          Iuml: 207,
          Ntilde: 209,
          Oacute: 211,
          Ocirc: 212,
          Ograve: 210,
          Oslash: 216,
          Otilde: 213,
          Ouml: 214,
          THORN: 222,
          Uacute: 218,
          Ucirc: 219,
          Ugrave: 217,
          Uuml: 220,
          Yacute: 221,
          aacute: 225,
          acirc: 226,
          aelig: 230,
          agrave: 224,
          aring: 229,
          atilde: 227,
          auml: 228,
          ccedil: 231,
          eacute: 233,
          ecirc: 234,
          egrave: 232,
          eth: 240,
          euml: 235,
          iacute: 237,
          icirc: 238,
          igrave: 236,
          iuml: 239,
          ntilde: 241,
          oacute: 243,
          ocirc: 244,
          ograve: 242,
          oslash: 248,
          otilde: 245,
          ouml: 246,
          szlig: 223,
          thorn: 254,
          uacute: 250,
          ucirc: 251,
          ugrave: 249,
          uuml: 252,
          yacute: 253,
          yuml: 255,
          copy: 169,
          reg: 174,
          nbsp: 160,
          iexcl: 161,
          cent: 162,
          pound: 163,
          curren: 164,
          yen: 165,
          brvbar: 166,
          sect: 167,
          uml: 168,
          ordf: 170,
          laquo: 171,
          not: 172,
          shy: 173,
          macr: 175,
          deg: 176,
          plusmn: 177,
          sup1: 185,
          sup2: 178,
          sup3: 179,
          acute: 180,
          micro: 181,
          para: 182,
          middot: 183,
          cedil: 184,
          ordm: 186,
          raquo: 187,
          frac14: 188,
          frac12: 189,
          frac34: 190,
          iquest: 191,
          times: 215,
          divide: 247,
          OElig: 338,
          oelig: 339,
          Scaron: 352,
          scaron: 353,
          Yuml: 376,
          fnof: 402,
          circ: 710,
          tilde: 732,
          Alpha: 913,
          Beta: 914,
          Gamma: 915,
          Delta: 916,
          Epsilon: 917,
          Zeta: 918,
          Eta: 919,
          Theta: 920,
          Iota: 921,
          Kappa: 922,
          Lambda: 923,
          Mu: 924,
          Nu: 925,
          Xi: 926,
          Omicron: 927,
          Pi: 928,
          Rho: 929,
          Sigma: 931,
          Tau: 932,
          Upsilon: 933,
          Phi: 934,
          Chi: 935,
          Psi: 936,
          Omega: 937,
          alpha: 945,
          beta: 946,
          gamma: 947,
          delta: 948,
          epsilon: 949,
          zeta: 950,
          eta: 951,
          theta: 952,
          iota: 953,
          kappa: 954,
          lambda: 955,
          mu: 956,
          nu: 957,
          xi: 958,
          omicron: 959,
          pi: 960,
          rho: 961,
          sigmaf: 962,
          sigma: 963,
          tau: 964,
          upsilon: 965,
          phi: 966,
          chi: 967,
          psi: 968,
          omega: 969,
          thetasym: 977,
          upsih: 978,
          piv: 982,
          ensp: 8194,
          emsp: 8195,
          thinsp: 8201,
          zwnj: 8204,
          zwj: 8205,
          lrm: 8206,
          rlm: 8207,
          ndash: 8211,
          mdash: 8212,
          lsquo: 8216,
          rsquo: 8217,
          sbquo: 8218,
          ldquo: 8220,
          rdquo: 8221,
          bdquo: 8222,
          dagger: 8224,
          Dagger: 8225,
          bull: 8226,
          hellip: 8230,
          permil: 8240,
          prime: 8242,
          Prime: 8243,
          lsaquo: 8249,
          rsaquo: 8250,
          oline: 8254,
          frasl: 8260,
          euro: 8364,
          image: 8465,
          weierp: 8472,
          real: 8476,
          trade: 8482,
          alefsym: 8501,
          larr: 8592,
          uarr: 8593,
          rarr: 8594,
          darr: 8595,
          harr: 8596,
          crarr: 8629,
          lArr: 8656,
          uArr: 8657,
          rArr: 8658,
          dArr: 8659,
          hArr: 8660,
          forall: 8704,
          part: 8706,
          exist: 8707,
          empty: 8709,
          nabla: 8711,
          isin: 8712,
          notin: 8713,
          ni: 8715,
          prod: 8719,
          sum: 8721,
          minus: 8722,
          lowast: 8727,
          radic: 8730,
          prop: 8733,
          infin: 8734,
          ang: 8736,
          and: 8743,
          or: 8744,
          cap: 8745,
          cup: 8746,
          int: 8747,
          there4: 8756,
          sim: 8764,
          cong: 8773,
          asymp: 8776,
          ne: 8800,
          equiv: 8801,
          le: 8804,
          ge: 8805,
          sub: 8834,
          sup: 8835,
          nsub: 8836,
          sube: 8838,
          supe: 8839,
          oplus: 8853,
          otimes: 8855,
          perp: 8869,
          sdot: 8901,
          lceil: 8968,
          rceil: 8969,
          lfloor: 8970,
          rfloor: 8971,
          lang: 9001,
          rang: 9002,
          loz: 9674,
          spades: 9824,
          clubs: 9827,
          hearts: 9829,
          diams: 9830
        };
        Object.keys(sax.ENTITIES).forEach(function(key) {
          var e = sax.ENTITIES[key];
          var s2 = typeof e === "number" ? String.fromCharCode(e) : e;
          sax.ENTITIES[key] = s2;
        });
        for (var s in sax.STATE) {
          sax.STATE[sax.STATE[s]] = s;
        }
        S = sax.STATE;
        function emit(parser, event, data) {
          parser[event] && parser[event](data);
        }
        function getDeclaredEncoding(body) {
          var match = body && body.match(/(?:^|\s)encoding\s*=\s*(['"])([^'"]+)\1/i);
          return match ? match[2] : null;
        }
        function normalizeEncodingName(encoding) {
          if (!encoding) {
            return null;
          }
          return encoding.toLowerCase().replace(/[^a-z0-9]/g, "");
        }
        function encodingsMatch(detectedEncoding, declaredEncoding) {
          const detected = normalizeEncodingName(detectedEncoding);
          const declared = normalizeEncodingName(declaredEncoding);
          if (!detected || !declared) {
            return true;
          }
          if (declared === "utf16") {
            return detected === "utf16le" || detected === "utf16be";
          }
          return detected === declared;
        }
        function validateXmlDeclarationEncoding(parser, data) {
          if (!parser.strict || !parser.encoding || !data || data.name !== "xml") {
            return;
          }
          var declaredEncoding = getDeclaredEncoding(data.body);
          if (declaredEncoding && !encodingsMatch(parser.encoding, declaredEncoding)) {
            strictFail(
              parser,
              "XML declaration encoding " + declaredEncoding + " does not match detected stream encoding " + parser.encoding.toUpperCase()
            );
          }
        }
        function emitNode(parser, nodeType, data) {
          if (parser.textNode) closeText(parser);
          emit(parser, nodeType, data);
        }
        function closeText(parser) {
          parser.textNode = textopts(parser.opt, parser.textNode);
          if (parser.textNode) emit(parser, "ontext", parser.textNode);
          parser.textNode = "";
        }
        function textopts(opt, text) {
          if (opt.trim) text = text.trim();
          if (opt.normalize) text = text.replace(/\s+/g, " ");
          return text;
        }
        function error(parser, er) {
          closeText(parser);
          if (parser.trackPosition) {
            er += "\nLine: " + parser.line + "\nColumn: " + parser.column + "\nChar: " + parser.c;
          }
          er = new Error(er);
          parser.error = er;
          emit(parser, "onerror", er);
          return parser;
        }
        function end(parser) {
          if (parser.sawRoot && !parser.closedRoot)
            strictFail(parser, "Unclosed root tag");
          if (parser.state !== S.BEGIN && parser.state !== S.BEGIN_WHITESPACE && parser.state !== S.TEXT) {
            error(parser, "Unexpected end");
          }
          closeText(parser);
          parser.c = "";
          parser.closed = true;
          emit(parser, "onend");
          SAXParser.call(parser, parser.strict, parser.opt);
          return parser;
        }
        function strictFail(parser, message) {
          if (typeof parser !== "object" || !(parser instanceof SAXParser)) {
            throw new Error("bad call to strictFail");
          }
          if (parser.strict) {
            error(parser, message);
          }
        }
        function newTag(parser) {
          if (!parser.strict) parser.tagName = parser.tagName[parser.looseCase]();
          var parent = parser.tags[parser.tags.length - 1] || parser;
          var tag = parser.tag = { name: parser.tagName, attributes: {} };
          if (parser.opt.xmlns) {
            tag.ns = parent.ns;
          }
          parser.attribList.length = 0;
          emitNode(parser, "onopentagstart", tag);
        }
        function qname(name, attribute) {
          var i = name.indexOf(":");
          var qualName = i < 0 ? ["", name] : name.split(":");
          var prefix = qualName[0];
          var local = qualName[1];
          if (attribute && name === "xmlns") {
            prefix = "xmlns";
            local = "";
          }
          return { prefix, local };
        }
        function attrib(parser) {
          if (!parser.strict) {
            parser.attribName = parser.attribName[parser.looseCase]();
          }
          if (parser.attribList.indexOf(parser.attribName) !== -1 || parser.tag.attributes.hasOwnProperty(parser.attribName)) {
            parser.attribName = parser.attribValue = "";
            return;
          }
          if (parser.opt.xmlns) {
            var qn = qname(parser.attribName, true);
            var prefix = qn.prefix;
            var local = qn.local;
            if (prefix === "xmlns") {
              if (local === "xml" && parser.attribValue !== XML_NAMESPACE) {
                strictFail(
                  parser,
                  "xml: prefix must be bound to " + XML_NAMESPACE + "\nActual: " + parser.attribValue
                );
              } else if (local === "xmlns" && parser.attribValue !== XMLNS_NAMESPACE) {
                strictFail(
                  parser,
                  "xmlns: prefix must be bound to " + XMLNS_NAMESPACE + "\nActual: " + parser.attribValue
                );
              } else {
                var tag = parser.tag;
                var parent = parser.tags[parser.tags.length - 1] || parser;
                if (tag.ns === parent.ns) {
                  tag.ns = Object.create(parent.ns);
                }
                tag.ns[local] = parser.attribValue;
              }
            }
            parser.attribList.push([parser.attribName, parser.attribValue]);
          } else {
            parser.tag.attributes[parser.attribName] = parser.attribValue;
            emitNode(parser, "onattribute", {
              name: parser.attribName,
              value: parser.attribValue
            });
          }
          parser.attribName = parser.attribValue = "";
        }
        function openTag(parser, selfClosing) {
          if (parser.opt.xmlns) {
            var tag = parser.tag;
            var qn = qname(parser.tagName);
            tag.prefix = qn.prefix;
            tag.local = qn.local;
            tag.uri = tag.ns[qn.prefix] || "";
            if (tag.prefix && !tag.uri) {
              strictFail(
                parser,
                "Unbound namespace prefix: " + JSON.stringify(parser.tagName)
              );
              tag.uri = qn.prefix;
            }
            var parent = parser.tags[parser.tags.length - 1] || parser;
            if (tag.ns && parent.ns !== tag.ns) {
              Object.keys(tag.ns).forEach(function(p) {
                emitNode(parser, "onopennamespace", {
                  prefix: p,
                  uri: tag.ns[p]
                });
              });
            }
            for (var i = 0, l = parser.attribList.length; i < l; i++) {
              var nv = parser.attribList[i];
              var name = nv[0];
              var value = nv[1];
              var qualName = qname(name, true);
              var prefix = qualName.prefix;
              var local = qualName.local;
              var uri = prefix === "" ? "" : tag.ns[prefix] || "";
              var a = {
                name,
                value,
                prefix,
                local,
                uri
              };
              if (prefix && prefix !== "xmlns" && !uri) {
                strictFail(
                  parser,
                  "Unbound namespace prefix: " + JSON.stringify(prefix)
                );
                a.uri = prefix;
              }
              parser.tag.attributes[name] = a;
              emitNode(parser, "onattribute", a);
            }
            parser.attribList.length = 0;
          }
          parser.tag.isSelfClosing = !!selfClosing;
          parser.sawRoot = true;
          parser.tags.push(parser.tag);
          emitNode(parser, "onopentag", parser.tag);
          if (!selfClosing) {
            if (!parser.noscript && parser.tagName.toLowerCase() === "script") {
              parser.state = S.SCRIPT;
            } else {
              parser.state = S.TEXT;
            }
            parser.tag = null;
            parser.tagName = "";
          }
          parser.attribName = parser.attribValue = "";
          parser.attribList.length = 0;
        }
        function closeTag(parser) {
          if (!parser.tagName) {
            strictFail(parser, "Weird empty close tag.");
            parser.textNode += "</>";
            parser.state = S.TEXT;
            return;
          }
          if (parser.script) {
            if (parser.tagName !== "script") {
              parser.script += "</" + parser.tagName + ">";
              parser.tagName = "";
              parser.state = S.SCRIPT;
              return;
            }
            emitNode(parser, "onscript", parser.script);
            parser.script = "";
          }
          var t = parser.tags.length;
          var tagName = parser.tagName;
          if (!parser.strict) {
            tagName = tagName[parser.looseCase]();
          }
          var closeTo = tagName;
          while (t--) {
            var close = parser.tags[t];
            if (close.name !== closeTo) {
              strictFail(parser, "Unexpected close tag");
            } else {
              break;
            }
          }
          if (t < 0) {
            strictFail(parser, "Unmatched closing tag: " + parser.tagName);
            parser.textNode += "</" + parser.tagName + ">";
            parser.state = S.TEXT;
            return;
          }
          parser.tagName = tagName;
          var s2 = parser.tags.length;
          while (s2-- > t) {
            var tag = parser.tag = parser.tags.pop();
            parser.tagName = parser.tag.name;
            emitNode(parser, "onclosetag", parser.tagName);
            var x = {};
            for (var i in tag.ns) {
              x[i] = tag.ns[i];
            }
            var parent = parser.tags[parser.tags.length - 1] || parser;
            if (parser.opt.xmlns && tag.ns !== parent.ns) {
              Object.keys(tag.ns).forEach(function(p) {
                var n = tag.ns[p];
                emitNode(parser, "onclosenamespace", { prefix: p, uri: n });
              });
            }
          }
          if (t === 0) parser.closedRoot = true;
          parser.tagName = parser.attribValue = parser.attribName = "";
          parser.attribList.length = 0;
          parser.state = S.TEXT;
        }
        function parseEntity(parser) {
          var entity = parser.entity;
          var entityLC = entity.toLowerCase();
          var num;
          var numStr = "";
          if (parser.ENTITIES[entity]) {
            return parser.ENTITIES[entity];
          }
          if (parser.ENTITIES[entityLC]) {
            return parser.ENTITIES[entityLC];
          }
          entity = entityLC;
          if (entity.charAt(0) === "#") {
            if (entity.charAt(1) === "x") {
              entity = entity.slice(2);
              num = parseInt(entity, 16);
              numStr = num.toString(16);
            } else {
              entity = entity.slice(1);
              num = parseInt(entity, 10);
              numStr = num.toString(10);
            }
          }
          entity = entity.replace(/^0+/, "");
          if (isNaN(num) || numStr.toLowerCase() !== entity || num < 0 || num > 1114111) {
            strictFail(parser, "Invalid character entity");
            return "&" + parser.entity + ";";
          }
          return String.fromCodePoint(num);
        }
        function beginWhiteSpace(parser, c) {
          if (c === "<") {
            parser.state = S.OPEN_WAKA;
            parser.startTagPosition = parser.position;
          } else if (!isWhitespace(c)) {
            strictFail(parser, "Non-whitespace before first tag.");
            parser.textNode = c;
            parser.state = S.TEXT;
          }
        }
        function charAt(chunk, i) {
          var result = "";
          if (i < chunk.length) {
            result = chunk.charAt(i);
          }
          return result;
        }
        function write(chunk) {
          var parser = this;
          if (this.error) {
            throw this.error;
          }
          if (parser.closed) {
            return error(
              parser,
              "Cannot write after close. Assign an onready handler."
            );
          }
          if (chunk === null) {
            return end(parser);
          }
          if (typeof chunk === "object") {
            chunk = chunk.toString();
          }
          var i = 0;
          var c = "";
          while (true) {
            c = charAt(chunk, i++);
            parser.c = c;
            if (!c) {
              break;
            }
            if (parser.trackPosition) {
              parser.position++;
              if (c === "\n") {
                parser.line++;
                parser.column = 0;
              } else {
                parser.column++;
              }
            }
            switch (parser.state) {
              case S.BEGIN:
                parser.state = S.BEGIN_WHITESPACE;
                if (c === "\uFEFF") {
                  continue;
                }
                beginWhiteSpace(parser, c);
                continue;
              case S.BEGIN_WHITESPACE:
                beginWhiteSpace(parser, c);
                continue;
              case S.TEXT:
                if (parser.sawRoot && !parser.closedRoot) {
                  var starti = i - 1;
                  while (c && c !== "<" && c !== "&") {
                    c = charAt(chunk, i++);
                    if (c && parser.trackPosition) {
                      parser.position++;
                      if (c === "\n") {
                        parser.line++;
                        parser.column = 0;
                      } else {
                        parser.column++;
                      }
                    }
                  }
                  parser.textNode += chunk.substring(starti, i - 1);
                }
                if (c === "<" && !(parser.sawRoot && parser.closedRoot && !parser.strict)) {
                  parser.state = S.OPEN_WAKA;
                  parser.startTagPosition = parser.position;
                } else {
                  if (!isWhitespace(c) && (!parser.sawRoot || parser.closedRoot)) {
                    strictFail(parser, "Text data outside of root node.");
                  }
                  if (c === "&") {
                    parser.state = S.TEXT_ENTITY;
                  } else {
                    parser.textNode += c;
                  }
                }
                continue;
              case S.SCRIPT:
                if (c === "<") {
                  parser.state = S.SCRIPT_ENDING;
                } else {
                  parser.script += c;
                }
                continue;
              case S.SCRIPT_ENDING:
                if (c === "/") {
                  parser.state = S.CLOSE_TAG;
                } else {
                  parser.script += "<" + c;
                  parser.state = S.SCRIPT;
                }
                continue;
              case S.OPEN_WAKA:
                if (c === "!") {
                  parser.state = S.SGML_DECL;
                  parser.sgmlDecl = "";
                } else if (isWhitespace(c)) {
                } else if (isMatch(nameStart, c)) {
                  parser.state = S.OPEN_TAG;
                  parser.tagName = c;
                } else if (c === "/") {
                  parser.state = S.CLOSE_TAG;
                  parser.tagName = "";
                } else if (c === "?") {
                  parser.state = S.PROC_INST;
                  parser.procInstName = parser.procInstBody = "";
                } else {
                  strictFail(parser, "Unencoded <");
                  if (parser.startTagPosition + 1 < parser.position) {
                    var pad = parser.position - parser.startTagPosition;
                    c = new Array(pad).join(" ") + c;
                  }
                  parser.textNode += "<" + c;
                  parser.state = S.TEXT;
                }
                continue;
              case S.SGML_DECL:
                if (parser.sgmlDecl + c === "--") {
                  parser.state = S.COMMENT;
                  parser.comment = "";
                  parser.sgmlDecl = "";
                  continue;
                }
                if (parser.doctype && parser.doctype !== true && parser.sgmlDecl) {
                  parser.state = S.DOCTYPE_DTD;
                  parser.doctype += "<!" + parser.sgmlDecl + c;
                  parser.sgmlDecl = "";
                } else if ((parser.sgmlDecl + c).toUpperCase() === CDATA) {
                  emitNode(parser, "onopencdata");
                  parser.state = S.CDATA;
                  parser.sgmlDecl = "";
                  parser.cdata = "";
                } else if ((parser.sgmlDecl + c).toUpperCase() === DOCTYPE) {
                  parser.state = S.DOCTYPE;
                  if (parser.doctype || parser.sawRoot) {
                    strictFail(
                      parser,
                      "Inappropriately located doctype declaration"
                    );
                  }
                  parser.doctype = "";
                  parser.sgmlDecl = "";
                } else if (c === ">") {
                  emitNode(parser, "onsgmldeclaration", parser.sgmlDecl);
                  parser.sgmlDecl = "";
                  parser.state = S.TEXT;
                } else if (isQuote(c)) {
                  parser.state = S.SGML_DECL_QUOTED;
                  parser.sgmlDecl += c;
                } else {
                  parser.sgmlDecl += c;
                }
                continue;
              case S.SGML_DECL_QUOTED:
                if (c === parser.q) {
                  parser.state = S.SGML_DECL;
                  parser.q = "";
                }
                parser.sgmlDecl += c;
                continue;
              case S.DOCTYPE:
                if (c === ">") {
                  parser.state = S.TEXT;
                  emitNode(parser, "ondoctype", parser.doctype);
                  parser.doctype = true;
                } else {
                  parser.doctype += c;
                  if (c === "[") {
                    parser.state = S.DOCTYPE_DTD;
                  } else if (isQuote(c)) {
                    parser.state = S.DOCTYPE_QUOTED;
                    parser.q = c;
                  }
                }
                continue;
              case S.DOCTYPE_QUOTED:
                parser.doctype += c;
                if (c === parser.q) {
                  parser.q = "";
                  parser.state = S.DOCTYPE;
                }
                continue;
              case S.DOCTYPE_DTD:
                if (c === "]") {
                  parser.doctype += c;
                  parser.state = S.DOCTYPE;
                } else if (c === "<") {
                  parser.state = S.OPEN_WAKA;
                  parser.startTagPosition = parser.position;
                } else if (isQuote(c)) {
                  parser.doctype += c;
                  parser.state = S.DOCTYPE_DTD_QUOTED;
                  parser.q = c;
                } else {
                  parser.doctype += c;
                }
                continue;
              case S.DOCTYPE_DTD_QUOTED:
                parser.doctype += c;
                if (c === parser.q) {
                  parser.state = S.DOCTYPE_DTD;
                  parser.q = "";
                }
                continue;
              case S.COMMENT:
                if (c === "-") {
                  parser.state = S.COMMENT_ENDING;
                } else {
                  parser.comment += c;
                }
                continue;
              case S.COMMENT_ENDING:
                if (c === "-") {
                  parser.state = S.COMMENT_ENDED;
                  parser.comment = textopts(parser.opt, parser.comment);
                  if (parser.comment) {
                    emitNode(parser, "oncomment", parser.comment);
                  }
                  parser.comment = "";
                } else {
                  parser.comment += "-" + c;
                  parser.state = S.COMMENT;
                }
                continue;
              case S.COMMENT_ENDED:
                if (c !== ">") {
                  strictFail(parser, "Malformed comment");
                  parser.comment += "--" + c;
                  parser.state = S.COMMENT;
                } else if (parser.doctype && parser.doctype !== true) {
                  parser.state = S.DOCTYPE_DTD;
                } else {
                  parser.state = S.TEXT;
                }
                continue;
              case S.CDATA:
                var starti = i - 1;
                while (c && c !== "]") {
                  c = charAt(chunk, i++);
                  if (c && parser.trackPosition) {
                    parser.position++;
                    if (c === "\n") {
                      parser.line++;
                      parser.column = 0;
                    } else {
                      parser.column++;
                    }
                  }
                }
                parser.cdata += chunk.substring(starti, i - 1);
                if (c === "]") {
                  parser.state = S.CDATA_ENDING;
                }
                continue;
              case S.CDATA_ENDING:
                if (c === "]") {
                  parser.state = S.CDATA_ENDING_2;
                } else {
                  parser.cdata += "]" + c;
                  parser.state = S.CDATA;
                }
                continue;
              case S.CDATA_ENDING_2:
                if (c === ">") {
                  if (parser.cdata) {
                    emitNode(parser, "oncdata", parser.cdata);
                  }
                  emitNode(parser, "onclosecdata");
                  parser.cdata = "";
                  parser.state = S.TEXT;
                } else if (c === "]") {
                  parser.cdata += "]";
                } else {
                  parser.cdata += "]]" + c;
                  parser.state = S.CDATA;
                }
                continue;
              case S.PROC_INST:
                if (c === "?") {
                  parser.state = S.PROC_INST_ENDING;
                } else if (isWhitespace(c)) {
                  parser.state = S.PROC_INST_BODY;
                } else {
                  parser.procInstName += c;
                }
                continue;
              case S.PROC_INST_BODY:
                if (!parser.procInstBody && isWhitespace(c)) {
                  continue;
                } else if (c === "?") {
                  parser.state = S.PROC_INST_ENDING;
                } else {
                  parser.procInstBody += c;
                }
                continue;
              case S.PROC_INST_ENDING:
                if (c === ">") {
                  const procInstEndData = {
                    name: parser.procInstName,
                    body: parser.procInstBody
                  };
                  validateXmlDeclarationEncoding(parser, procInstEndData);
                  emitNode(parser, "onprocessinginstruction", procInstEndData);
                  parser.procInstName = parser.procInstBody = "";
                  parser.state = S.TEXT;
                } else {
                  parser.procInstBody += "?" + c;
                  parser.state = S.PROC_INST_BODY;
                }
                continue;
              case S.OPEN_TAG:
                if (isMatch(nameBody, c)) {
                  parser.tagName += c;
                } else {
                  newTag(parser);
                  if (c === ">") {
                    openTag(parser);
                  } else if (c === "/") {
                    parser.state = S.OPEN_TAG_SLASH;
                  } else {
                    if (!isWhitespace(c)) {
                      strictFail(parser, "Invalid character in tag name");
                    }
                    parser.state = S.ATTRIB;
                  }
                }
                continue;
              case S.OPEN_TAG_SLASH:
                if (c === ">") {
                  openTag(parser, true);
                  closeTag(parser);
                } else {
                  strictFail(
                    parser,
                    "Forward-slash in opening tag not followed by >"
                  );
                  parser.state = S.ATTRIB;
                }
                continue;
              case S.ATTRIB:
                if (isWhitespace(c)) {
                  continue;
                } else if (c === ">") {
                  openTag(parser);
                } else if (c === "/") {
                  parser.state = S.OPEN_TAG_SLASH;
                } else if (isMatch(nameStart, c)) {
                  parser.attribName = c;
                  parser.attribValue = "";
                  parser.state = S.ATTRIB_NAME;
                } else {
                  strictFail(parser, "Invalid attribute name");
                }
                continue;
              case S.ATTRIB_NAME:
                if (c === "=") {
                  parser.state = S.ATTRIB_VALUE;
                } else if (c === ">") {
                  strictFail(parser, "Attribute without value");
                  parser.attribValue = parser.attribName;
                  attrib(parser);
                  openTag(parser);
                } else if (isWhitespace(c)) {
                  parser.state = S.ATTRIB_NAME_SAW_WHITE;
                } else if (isMatch(nameBody, c)) {
                  parser.attribName += c;
                } else {
                  strictFail(parser, "Invalid attribute name");
                }
                continue;
              case S.ATTRIB_NAME_SAW_WHITE:
                if (c === "=") {
                  parser.state = S.ATTRIB_VALUE;
                } else if (isWhitespace(c)) {
                  continue;
                } else {
                  strictFail(parser, "Attribute without value");
                  parser.tag.attributes[parser.attribName] = "";
                  parser.attribValue = "";
                  emitNode(parser, "onattribute", {
                    name: parser.attribName,
                    value: ""
                  });
                  parser.attribName = "";
                  if (c === ">") {
                    openTag(parser);
                  } else if (isMatch(nameStart, c)) {
                    parser.attribName = c;
                    parser.state = S.ATTRIB_NAME;
                  } else {
                    strictFail(parser, "Invalid attribute name");
                    parser.state = S.ATTRIB;
                  }
                }
                continue;
              case S.ATTRIB_VALUE:
                if (isWhitespace(c)) {
                  continue;
                } else if (isQuote(c)) {
                  parser.q = c;
                  parser.state = S.ATTRIB_VALUE_QUOTED;
                } else {
                  if (!parser.opt.unquotedAttributeValues) {
                    error(parser, "Unquoted attribute value");
                  }
                  parser.state = S.ATTRIB_VALUE_UNQUOTED;
                  parser.attribValue = c;
                }
                continue;
              case S.ATTRIB_VALUE_QUOTED:
                if (c !== parser.q) {
                  if (c === "&") {
                    parser.state = S.ATTRIB_VALUE_ENTITY_Q;
                  } else {
                    parser.attribValue += c;
                  }
                  continue;
                }
                attrib(parser);
                parser.q = "";
                parser.state = S.ATTRIB_VALUE_CLOSED;
                continue;
              case S.ATTRIB_VALUE_CLOSED:
                if (isWhitespace(c)) {
                  parser.state = S.ATTRIB;
                } else if (c === ">") {
                  openTag(parser);
                } else if (c === "/") {
                  parser.state = S.OPEN_TAG_SLASH;
                } else if (isMatch(nameStart, c)) {
                  strictFail(parser, "No whitespace between attributes");
                  parser.attribName = c;
                  parser.attribValue = "";
                  parser.state = S.ATTRIB_NAME;
                } else {
                  strictFail(parser, "Invalid attribute name");
                }
                continue;
              case S.ATTRIB_VALUE_UNQUOTED:
                if (!isAttribEnd(c)) {
                  if (c === "&") {
                    parser.state = S.ATTRIB_VALUE_ENTITY_U;
                  } else {
                    parser.attribValue += c;
                  }
                  continue;
                }
                attrib(parser);
                if (c === ">") {
                  openTag(parser);
                } else {
                  parser.state = S.ATTRIB;
                }
                continue;
              case S.CLOSE_TAG:
                if (!parser.tagName) {
                  if (isWhitespace(c)) {
                    continue;
                  } else if (notMatch(nameStart, c)) {
                    if (parser.script) {
                      parser.script += "</" + c;
                      parser.state = S.SCRIPT;
                    } else {
                      strictFail(parser, "Invalid tagname in closing tag.");
                    }
                  } else {
                    parser.tagName = c;
                  }
                } else if (c === ">") {
                  closeTag(parser);
                } else if (isMatch(nameBody, c)) {
                  parser.tagName += c;
                } else if (parser.script) {
                  parser.script += "</" + parser.tagName + c;
                  parser.tagName = "";
                  parser.state = S.SCRIPT;
                } else {
                  if (!isWhitespace(c)) {
                    strictFail(parser, "Invalid tagname in closing tag");
                  }
                  parser.state = S.CLOSE_TAG_SAW_WHITE;
                }
                continue;
              case S.CLOSE_TAG_SAW_WHITE:
                if (isWhitespace(c)) {
                  continue;
                }
                if (c === ">") {
                  closeTag(parser);
                } else {
                  strictFail(parser, "Invalid characters in closing tag");
                }
                continue;
              case S.TEXT_ENTITY:
              case S.ATTRIB_VALUE_ENTITY_Q:
              case S.ATTRIB_VALUE_ENTITY_U:
                var returnState;
                var buffer;
                switch (parser.state) {
                  case S.TEXT_ENTITY:
                    returnState = S.TEXT;
                    buffer = "textNode";
                    break;
                  case S.ATTRIB_VALUE_ENTITY_Q:
                    returnState = S.ATTRIB_VALUE_QUOTED;
                    buffer = "attribValue";
                    break;
                  case S.ATTRIB_VALUE_ENTITY_U:
                    returnState = S.ATTRIB_VALUE_UNQUOTED;
                    buffer = "attribValue";
                    break;
                }
                if (c === ";") {
                  var parsedEntity = parseEntity(parser);
                  if (parser.opt.unparsedEntities && !Object.values(sax.XML_ENTITIES).includes(parsedEntity)) {
                    if ((parser.entityCount += 1) > parser.opt.maxEntityCount) {
                      error(
                        parser,
                        "Parsed entity count exceeds max entity count"
                      );
                    }
                    if ((parser.entityDepth += 1) > parser.opt.maxEntityDepth) {
                      error(
                        parser,
                        "Parsed entity depth exceeds max entity depth"
                      );
                    }
                    parser.entity = "";
                    parser.state = returnState;
                    parser.write(parsedEntity);
                    parser.entityDepth -= 1;
                  } else {
                    parser[buffer] += parsedEntity;
                    parser.entity = "";
                    parser.state = returnState;
                  }
                } else if (isMatch(parser.entity.length ? entityBody : entityStart, c)) {
                  parser.entity += c;
                } else {
                  strictFail(parser, "Invalid character in entity name");
                  parser[buffer] += "&" + parser.entity + c;
                  parser.entity = "";
                  parser.state = returnState;
                }
                continue;
              default: {
                throw new Error(parser, "Unknown state: " + parser.state);
              }
            }
          }
          if (parser.position >= parser.bufferCheckPosition) {
            checkBufferLength(parser);
          }
          return parser;
        }
        if (!String.fromCodePoint) {
          ;
          (function() {
            var stringFromCharCode = String.fromCharCode;
            var floor = Math.floor;
            var fromCodePoint = function() {
              var MAX_SIZE = 16384;
              var codeUnits = [];
              var highSurrogate;
              var lowSurrogate;
              var index = -1;
              var length = arguments.length;
              if (!length) {
                return "";
              }
              var result = "";
              while (++index < length) {
                var codePoint = Number(arguments[index]);
                if (!isFinite(codePoint) || // `NaN`, `+Infinity`, or `-Infinity`
                codePoint < 0 || // not a valid Unicode code point
                codePoint > 1114111 || // not a valid Unicode code point
                floor(codePoint) !== codePoint) {
                  throw RangeError("Invalid code point: " + codePoint);
                }
                if (codePoint <= 65535) {
                  codeUnits.push(codePoint);
                } else {
                  codePoint -= 65536;
                  highSurrogate = (codePoint >> 10) + 55296;
                  lowSurrogate = codePoint % 1024 + 56320;
                  codeUnits.push(highSurrogate, lowSurrogate);
                }
                if (index + 1 === length || codeUnits.length > MAX_SIZE) {
                  result += stringFromCharCode.apply(null, codeUnits);
                  codeUnits.length = 0;
                }
              }
              return result;
            };
            if (Object.defineProperty) {
              Object.defineProperty(String, "fromCodePoint", {
                value: fromCodePoint,
                configurable: true,
                writable: true
              });
            } else {
              String.fromCodePoint = fromCodePoint;
            }
          })();
        }
      })(typeof exports === "undefined" ? exports.sax = {} : exports);
    }
  });

  // node_modules/onml/parse.js
  var require_parse2 = __commonJS({
    "node_modules/onml/parse.js"(exports, module) {
      "use strict";
      var parser = require_sax().parser;
      function parse(data, config) {
        const res = [];
        const stack = [];
        let pointer = res;
        let trim = true;
        let strict = true;
        if (config && config.strict !== void 0) {
          strict = config.strict;
        }
        if (config !== void 0) {
          if (config.trim !== void 0) {
            trim = config.trim;
          }
        }
        const p = parser(strict);
        p.ontext = function(e) {
          if (trim === false || e.trim() !== "") {
            pointer.push(e);
          }
        };
        p.onopentag = function(e) {
          const leaf = [e.name, e.attributes];
          stack.push(pointer);
          pointer.push(leaf);
          pointer = leaf;
        };
        p.onclosetag = function() {
          pointer = stack.pop();
        };
        p.oncdata = function(e) {
          if (trim === false || e.trim() !== "") {
            pointer.push("<![CDATA[" + e + "]]>");
          }
        };
        p.write(data).close();
        return res[0];
      }
      module.exports = parse;
    }
  });

  // node_modules/onml/stringify.js
  var require_stringify2 = __commonJS({
    "node_modules/onml/stringify.js"(exports, module) {
      "use strict";
      var isObject = (o) => o && Object.prototype.toString.call(o) === "[object Object]";
      function indenter(indentation) {
        if (!(indentation > 0)) {
          return (txt) => txt;
        }
        var space = " ".repeat(indentation);
        return (txt) => {
          if (typeof txt !== "string") {
            return txt;
          }
          const arr = txt.split("\n");
          if (arr.length === 1) {
            return space + txt;
          }
          return arr.map((e) => e.trim() === "" ? e : space + e).join("\n");
        };
      }
      var clean = (txt) => txt.split("\n").filter((e) => e.trim() !== "").join("\n");
      function stringify(a, indentation) {
        const cr = indentation > 0 ? "\n" : "";
        const indent = indenter(indentation);
        function rec(a2) {
          let body = "";
          let isFlat = true;
          let res;
          const isEmpty = a2.some((e, i, arr) => {
            if (i === 0) {
              res = "<" + e;
              return arr.length === 1;
            }
            if (i === 1) {
              if (isObject(e)) {
                Object.keys(e).map((key) => {
                  let val = e[key];
                  if (Array.isArray(val)) {
                    val = val.join(" ");
                  }
                  res += " " + key + '="' + val + '"';
                });
                if (arr.length === 2) {
                  return true;
                }
                res += ">";
                return;
              }
              res += ">";
            }
            switch (typeof e) {
              case "string":
              case "number":
              case "boolean":
              case "undefined":
                body += e + cr;
                return;
            }
            isFlat = false;
            body += rec(e);
          });
          if (isEmpty) {
            return res + "/>" + cr;
          }
          return isFlat ? res + clean(body) + "</" + a2[0] + ">" + cr : res + cr + indent(body) + "</" + a2[0] + ">" + cr;
        }
        return rec(a);
      }
      module.exports = stringify;
    }
  });

  // node_modules/onml/traverse.js
  var require_traverse = __commonJS({
    "node_modules/onml/traverse.js"(exports, module) {
      "use strict";
      function skipFn() {
        this._skip = true;
      }
      function removeFn() {
        this._remove = true;
      }
      function nameFn(name) {
        this._name = name;
      }
      function replaceFn(node) {
        this._replace = node;
      }
      function traverse(origin, callbacks) {
        const empty = function() {
        };
        const enter = callbacks && callbacks.enter || empty;
        const leave = callbacks && callbacks.leave || empty;
        function rec(tree, parent) {
          if (tree === void 0) return;
          if (tree === null) return;
          if (tree === true) return;
          if (tree === false) return;
          const node = {
            attr: {},
            full: tree
          };
          const cxt = {
            name: nameFn,
            skip: skipFn,
            // break: breakFn,
            remove: removeFn,
            replace: replaceFn,
            _name: void 0,
            _skip: false,
            // _break: false,
            _remove: false,
            _replace: void 0
          };
          let e1IsNotAnObject = true;
          switch (Object.prototype.toString.call(tree)) {
            case "[object String]":
            case "[object Number]":
              return;
            case "[object Array]":
              tree.some(function(e, i) {
                if (i === 0) {
                  node.name = e;
                  return false;
                }
                if (i === 1) {
                  if (Object.prototype.toString.call(e) === "[object Object]") {
                    e1IsNotAnObject = false;
                    node.attr = e;
                  }
                  return true;
                }
              });
              enter.call(cxt, node, parent);
              if (cxt._name) {
                tree[0] = cxt._name;
              }
              if (cxt._replace) {
                return cxt._replace;
              }
              if (cxt._remove) {
                return null;
              }
              if (!cxt._skip) {
                let index = 0;
                let ilen = tree.length;
                while (index < ilen) {
                  if (index > 1 || index === 1 && e1IsNotAnObject) {
                    const returnRes = rec(tree[index], node);
                    if (returnRes === null) {
                      tree.splice(index, 1);
                      ilen -= 1;
                      continue;
                    }
                    if (returnRes) {
                      tree[index] = returnRes;
                    }
                  }
                  index += 1;
                }
                leave.call(cxt, node, parent);
                if (cxt._name) {
                  tree[0] = cxt._name;
                }
                if (cxt._replace) {
                  return cxt._replace;
                }
                if (cxt._remove) {
                  return null;
                }
              }
          }
        }
        rec(origin, void 0);
      }
      module.exports = traverse;
    }
  });

  // node_modules/onml/renderer.js
  var require_renderer = __commonJS({
    "node_modules/onml/renderer.js"(exports, module) {
      "use strict";
      var stringify = require_stringify2();
      var renderer = (root) => {
        const content = typeof root === "string" ? document.getElementById(root) : root;
        return (ml) => {
          let str;
          try {
            str = stringify(ml);
            content.innerHTML = str;
          } catch (err) {
            console.log(ml);
          }
        };
      };
      module.exports = renderer;
    }
  });

  // node_modules/onml/tt.js
  var require_tt = __commonJS({
    "node_modules/onml/tt.js"(exports, module) {
      "use strict";
      module.exports = (x, y, obj) => {
        let objt = {};
        if (x || y) {
          const tt = [x || 0].concat(y ? [y] : []);
          objt = { transform: "translate(" + tt.join(",") + ")" };
        }
        obj = typeof obj === "object" ? obj : {};
        return Object.assign(objt, obj);
      };
    }
  });

  // node_modules/onml/gen-svg.js
  var require_gen_svg = __commonJS({
    "node_modules/onml/gen-svg.js"(exports, module) {
      "use strict";
      var w3 = {
        svg: "http://www.w3.org/2000/svg",
        xlink: "http://www.w3.org/1999/xlink",
        xmlns: "http://www.w3.org/XML/1998/namespace"
      };
      module.exports = (w, h) => ["svg", {
        xmlns: w3.svg,
        "xmlns:xlink": w3.xlink,
        width: w,
        height: h,
        viewBox: "0 0 " + w + " " + h
      }];
    }
  });

  // node_modules/onml/index.js
  var require_onml = __commonJS({
    "node_modules/onml/index.js"(exports) {
      "use strict";
      var parse = require_parse2();
      var stringify = require_stringify2();
      var traverse = require_traverse();
      var renderer = require_renderer();
      var tt = require_tt();
      var genSvg = require_gen_svg();
      exports.renderer = renderer;
      exports.parse = parse;
      exports.stringify = stringify;
      exports.traverse = traverse;
      exports.tt = tt;
      exports.gen = {
        svg: genSvg
      };
      exports.p = parse;
      exports.s = stringify;
      exports.t = traverse;
    }
  });

  // built/Skin.js
  var require_Skin = __commonJS({
    "built/Skin.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Skin = void 0;
      var onml = require_onml();
      var Skin;
      (function(Skin2) {
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
          return filterPortPids(template, (attrs) => attrs["s:dir"] === "lateral" || ["left", "right"].includes(attrs["s:position"]));
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
      })(Skin || (exports.Skin = Skin = {}));
      exports.default = Skin;
    }
  });

  // built/YosysModel.js
  var require_YosysModel = __commonJS({
    "built/YosysModel.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var Yosys;
      (function(Yosys2) {
        let ConstantVal;
        (function(ConstantVal2) {
          ConstantVal2["Zero"] = "0";
          ConstantVal2["One"] = "1";
          ConstantVal2["X"] = "x";
          ConstantVal2["Z"] = "z";
        })(ConstantVal = Yosys2.ConstantVal || (Yosys2.ConstantVal = {}));
        let Direction;
        (function(Direction2) {
          Direction2["Input"] = "input";
          Direction2["Output"] = "output";
          Direction2["Inout"] = "inout";
        })(Direction = Yosys2.Direction || (Yosys2.Direction = {}));
        let HideName;
        (function(HideName2) {
          HideName2[HideName2["Hide"] = 0] = "Hide";
          HideName2[HideName2["NoHide"] = 1] = "NoHide";
        })(HideName = Yosys2.HideName || (Yosys2.HideName = {}));
        Yosys2.getInputPortPids = (cell) => Object.entries(cell.port_directions || {}).filter(([, dir]) => dir === Direction.Input).map(([name]) => name);
        Yosys2.getOutputPortPids = (cell) => Object.entries(cell.port_directions || {}).filter(([, dir]) => dir === Direction.Output).map(([name]) => name);
      })(Yosys || (Yosys = {}));
      exports.default = Yosys;
    }
  });

  // built/Port.js
  var require_Port = __commonJS({
    "built/Port.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.Port = void 0;
      var Cell_1 = __importDefault(require_Cell());
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
            constantCollector.push(Cell_1.default.fromConstantInfo(reversedName, constants, parent));
            signalsByConstantName[reversedName] = constants;
          }
        }
      };
      exports.Port = Port;
    }
  });

  // built/elkGraph.js
  var require_elkGraph = __commonJS({
    "built/elkGraph.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.ElkModel = void 0;
      exports.buildElkGraph = buildElkGraph;
      var ElkModel;
      (function(ElkModel2) {
        ElkModel2.wireNameLookup = {};
        ElkModel2.dummyNum = 0;
        ElkModel2.edgeIndex = 0;
      })(ElkModel || (exports.ElkModel = ElkModel = {}));
      function buildElkGraph(module2) {
        const moduleName = module2.moduleName;
        const children = module2.nodes.map((n) => n.buildElkChild());
        ElkModel.edgeIndex = 0;
        ElkModel.dummyNum = 0;
        const edges = [];
        module2.wires.forEach((wire) => {
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
    }
  });

  // built/drawModule.js
  var require_drawModule = __commonJS({
    "built/drawModule.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.removeDummyEdges = removeDummyEdges;
      exports.default = drawModule;
      exports.drawSubModule = drawSubModule;
      var elkGraph_1 = require_elkGraph();
      var Skin_1 = __importDefault(require_Skin());
      var onml = require_onml();
      var WireDirection;
      (function(WireDirection2) {
        WireDirection2[WireDirection2["Up"] = 0] = "Up";
        WireDirection2[WireDirection2["Down"] = 1] = "Down";
        WireDirection2[WireDirection2["Left"] = 2] = "Left";
        WireDirection2[WireDirection2["Right"] = 3] = "Right";
      })(WireDirection || (WireDirection = {}));
      function getWireDirection(start, end) {
        if (end.x === start.x && end.y === start.y) {
          throw new Error("Points cannot be identical");
        }
        if (end.x !== start.x && end.y !== start.y) {
          throw new Error("Points must be orthogonal");
        }
        if (end.x > start.x)
          return WireDirection.Right;
        if (end.x < start.x)
          return WireDirection.Left;
        if (end.y > start.y)
          return WireDirection.Down;
        return WireDirection.Up;
      }
      function findNearestBend(edges, dummyIsSource, dummyLocation) {
        const candidates = edges.map((edge) => {
          const bends = edge.sections[0].bendPoints || [];
          return dummyIsSource ? bends[0] : bends[bends.length - 1];
        }).filter((p) => p !== void 0);
        if (candidates.length === 0)
          return void 0;
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
        var _a, _b;
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
          if (edgesWithDummy.length === 0)
            continue;
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
              (_a = section.bendPoints) === null || _a === void 0 ? void 0 : _a.shift();
            } else {
              section.endPoint = newEndpoint;
              (_b = section.bendPoints) === null || _b === void 0 ? void 0 : _b.pop();
            }
          }
          const directions = new Set(edgesWithDummy.map((edge) => {
            var _a2, _b2;
            const section = edge.sections[0];
            const point = dummyIsSource ? ((_a2 = section.bendPoints) === null || _a2 === void 0 ? void 0 : _a2[0]) || section.endPoint : ((_b2 = section.bendPoints) === null || _b2 === void 0 ? void 0 : _b2[section.bendPoints.length - 1]) || section.startPoint;
            return getWireDirection(newEndpoint, point);
          }));
          if (directions.size < 3) {
            for (const edge of edgesWithDummy) {
              edge.junctionPoints = (edge.junctionPoints || []).filter((junction) => !(junction.x === newEndpoint.x && junction.y === newEndpoint.y));
            }
          }
        }
      }
      function drawModule(graph, module2) {
        const nodes = module2.nodes.map((node) => {
          const matchedChild = graph.children.find((child) => child.id === node.parent + "." + node.Key);
          return node.render(matchedChild);
        });
        removeDummyEdges(graph);
        const lines = renderWireLines(graph.edges);
        const labels = renderWireLabels(graph.edges);
        if (labels.length > 0) {
          lines.push(...labels);
        }
        const svgAttributes = { ...Skin_1.default.skin[1] };
        svgAttributes.width = String(graph.width);
        svgAttributes.height = String(graph.height);
        const styles = ["style", {}, ""];
        onml.traverse(Skin_1.default.skin, {
          enter: (node) => {
            if (node.name === "style") {
              styles[2] += node.full[2];
            }
          }
        });
        const svgElement = ["svg", svgAttributes, styles, ...nodes, ...lines];
        return onml.s(svgElement);
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
        const svgAttributes = { ...Skin_1.default.skin[1] };
        svgAttributes.width = String(cell.width);
        svgAttributes.height = String(cell.height);
        return ["svg", svgAttributes, ...nodes, ...lines];
      }
      function renderWireLines(edges) {
        return edges.flatMap((edge) => {
          const netId = elkGraph_1.ElkModel.wireNameLookup[edge.id];
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
            const junctions = (edge.junctionPoints || []).map((junction) => ["circle", {
              cx: junction.x,
              cy: junction.y,
              r: numWires > 1 ? 3 : 2,
              class: `${netClass} junction`
            }]);
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
          var _a, _b;
          if (!((_b = (_a = edge.labels) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.text))
            return [];
          const label = edge.labels[0];
          const netId = elkGraph_1.ElkModel.wireNameLookup[edge.id];
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
    }
  });

  // node_modules/clone/clone.js
  var require_clone = __commonJS({
    "node_modules/clone/clone.js"(exports, module) {
      var clone = (function() {
        "use strict";
        function _instanceof(obj, type) {
          return type != null && obj instanceof type;
        }
        var nativeMap;
        try {
          nativeMap = Map;
        } catch (_) {
          nativeMap = function() {
          };
        }
        var nativeSet;
        try {
          nativeSet = Set;
        } catch (_) {
          nativeSet = function() {
          };
        }
        var nativePromise;
        try {
          nativePromise = Promise;
        } catch (_) {
          nativePromise = function() {
          };
        }
        function clone2(parent, circular, depth, prototype, includeNonEnumerable) {
          if (typeof circular === "object") {
            depth = circular.depth;
            prototype = circular.prototype;
            includeNonEnumerable = circular.includeNonEnumerable;
            circular = circular.circular;
          }
          var allParents = [];
          var allChildren = [];
          var useBuffer = typeof Buffer != "undefined";
          if (typeof circular == "undefined")
            circular = true;
          if (typeof depth == "undefined")
            depth = Infinity;
          function _clone(parent2, depth2) {
            if (parent2 === null)
              return null;
            if (depth2 === 0)
              return parent2;
            var child;
            var proto;
            if (typeof parent2 != "object") {
              return parent2;
            }
            if (_instanceof(parent2, nativeMap)) {
              child = new nativeMap();
            } else if (_instanceof(parent2, nativeSet)) {
              child = new nativeSet();
            } else if (_instanceof(parent2, nativePromise)) {
              child = new nativePromise(function(resolve, reject) {
                parent2.then(function(value) {
                  resolve(_clone(value, depth2 - 1));
                }, function(err) {
                  reject(_clone(err, depth2 - 1));
                });
              });
            } else if (clone2.__isArray(parent2)) {
              child = [];
            } else if (clone2.__isRegExp(parent2)) {
              child = new RegExp(parent2.source, __getRegExpFlags(parent2));
              if (parent2.lastIndex) child.lastIndex = parent2.lastIndex;
            } else if (clone2.__isDate(parent2)) {
              child = new Date(parent2.getTime());
            } else if (useBuffer && Buffer.isBuffer(parent2)) {
              if (Buffer.allocUnsafe) {
                child = Buffer.allocUnsafe(parent2.length);
              } else {
                child = new Buffer(parent2.length);
              }
              parent2.copy(child);
              return child;
            } else if (_instanceof(parent2, Error)) {
              child = Object.create(parent2);
            } else {
              if (typeof prototype == "undefined") {
                proto = Object.getPrototypeOf(parent2);
                child = Object.create(proto);
              } else {
                child = Object.create(prototype);
                proto = prototype;
              }
            }
            if (circular) {
              var index = allParents.indexOf(parent2);
              if (index != -1) {
                return allChildren[index];
              }
              allParents.push(parent2);
              allChildren.push(child);
            }
            if (_instanceof(parent2, nativeMap)) {
              parent2.forEach(function(value, key) {
                var keyChild = _clone(key, depth2 - 1);
                var valueChild = _clone(value, depth2 - 1);
                child.set(keyChild, valueChild);
              });
            }
            if (_instanceof(parent2, nativeSet)) {
              parent2.forEach(function(value) {
                var entryChild = _clone(value, depth2 - 1);
                child.add(entryChild);
              });
            }
            for (var i in parent2) {
              var attrs;
              if (proto) {
                attrs = Object.getOwnPropertyDescriptor(proto, i);
              }
              if (attrs && attrs.set == null) {
                continue;
              }
              child[i] = _clone(parent2[i], depth2 - 1);
            }
            if (Object.getOwnPropertySymbols) {
              var symbols = Object.getOwnPropertySymbols(parent2);
              for (var i = 0; i < symbols.length; i++) {
                var symbol = symbols[i];
                var descriptor = Object.getOwnPropertyDescriptor(parent2, symbol);
                if (descriptor && !descriptor.enumerable && !includeNonEnumerable) {
                  continue;
                }
                child[symbol] = _clone(parent2[symbol], depth2 - 1);
                if (!descriptor.enumerable) {
                  Object.defineProperty(child, symbol, {
                    enumerable: false
                  });
                }
              }
            }
            if (includeNonEnumerable) {
              var allPropertyNames = Object.getOwnPropertyNames(parent2);
              for (var i = 0; i < allPropertyNames.length; i++) {
                var propertyName = allPropertyNames[i];
                var descriptor = Object.getOwnPropertyDescriptor(parent2, propertyName);
                if (descriptor && descriptor.enumerable) {
                  continue;
                }
                child[propertyName] = _clone(parent2[propertyName], depth2 - 1);
                Object.defineProperty(child, propertyName, {
                  enumerable: false
                });
              }
            }
            return child;
          }
          return _clone(parent, depth);
        }
        clone2.clonePrototype = function clonePrototype(parent) {
          if (parent === null)
            return null;
          var c = function() {
          };
          c.prototype = parent;
          return new c();
        };
        function __objToStr(o) {
          return Object.prototype.toString.call(o);
        }
        clone2.__objToStr = __objToStr;
        function __isDate(o) {
          return typeof o === "object" && __objToStr(o) === "[object Date]";
        }
        clone2.__isDate = __isDate;
        function __isArray(o) {
          return typeof o === "object" && __objToStr(o) === "[object Array]";
        }
        clone2.__isArray = __isArray;
        function __isRegExp(o) {
          return typeof o === "object" && __objToStr(o) === "[object RegExp]";
        }
        clone2.__isRegExp = __isRegExp;
        function __getRegExpFlags(re) {
          var flags = "";
          if (re.global) flags += "g";
          if (re.ignoreCase) flags += "i";
          if (re.multiline) flags += "m";
          return flags;
        }
        clone2.__getRegExpFlags = __getRegExpFlags;
        return clone2;
      })();
      if (typeof module === "object" && module.exports) {
        module.exports = clone;
      }
    }
  });

  // built/Cell.js
  var require_Cell = __commonJS({
    "built/Cell.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      var FlatModule_1 = require_FlatModule();
      var YosysModel_1 = __importDefault(require_YosysModel());
      var Skin_1 = __importDefault(require_Skin());
      var Port_1 = require_Port();
      var drawModule_1 = require_drawModule();
      var elkGraph_1 = require_elkGraph();
      var clone = require_clone();
      var onml = require_onml();
      var Cell = class _Cell {
        /**
         * creates a Cell from a Yosys Port
         * @param yPort the Yosys Port with our port data
         * @param name the name of the port
         */
        static fromPort(yPort, name, parent = "") {
          const isInput = yPort.direction === YosysModel_1.default.Direction.Input;
          if (isInput) {
            return new _Cell(name, "$_inputExt_", [], [new Port_1.Port("Y", yPort.bits)], {}, parent);
          }
          return new _Cell(name, "$_outputExt_", [new Port_1.Port("A", yPort.bits)], [], {}, parent);
        }
        static fromYosysCell(yCell, name, parent = "") {
          this.setAlternateCellType(yCell);
          const template = Skin_1.default.findSkinType(yCell.type) || [];
          const templateInputPids = Skin_1.default.getInputPids(template);
          const templateOutputPids = Skin_1.default.getOutputPids(template);
          const ports = Object.entries(yCell.connections).map(([portName, conn]) => new Port_1.Port(portName, conn));
          let inputPorts = ports.filter((port) => port.keyIn(templateInputPids));
          let outputPorts = ports.filter((port) => port.keyIn(templateOutputPids));
          if (inputPorts.length + outputPorts.length !== ports.length) {
            const inputPids = YosysModel_1.default.getInputPortPids(yCell);
            const outputPids = YosysModel_1.default.getOutputPortPids(yCell);
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
          const template = Skin_1.default.findSkinType(yCell.type) || [];
          const templateInputPids = Skin_1.default.getInputPids(template);
          const templateOutputPids = Skin_1.default.getOutputPids(template);
          const ports = Object.entries(yCell.connections).map(([portName, conn]) => new Port_1.Port(portName, conn));
          let inputPorts = ports.filter((port) => port.keyIn(templateInputPids));
          let outputPorts = ports.filter((port) => port.keyIn(templateOutputPids));
          if (inputPorts.length + outputPorts.length !== ports.length) {
            const inputPids = YosysModel_1.default.getInputPortPids(yCell);
            const outputPids = YosysModel_1.default.getOutputPortPids(yCell);
            inputPorts = ports.filter((port) => port.keyIn(inputPids));
            outputPorts = ports.filter((port) => port.keyIn(outputPids));
          }
          const mod = new FlatModule_1.FlatModule(subModule, name, depth + 1, parent);
          return new _Cell(name, yCell.type, inputPorts, outputPorts, yCell.attributes || {}, parent, mod, depth);
        }
        static fromConstantInfo(name, constants, parent = "") {
          return new _Cell(name, "$_constant_", [], [new Port_1.Port("Y", constants)], {}, parent);
        }
        /**
         * creates a join cell
         * @param target string name of net (starts and ends with and delimited by commas)
         * @param sources list of index strings (one number, or two numbers separated by a colon)
         */
        static fromJoinInfo(target, sources, parent = "") {
          const signalStrs = target.slice(1, -1).split(",");
          const signals = signalStrs.map((ss) => Number(ss));
          const joinOutPorts = [new Port_1.Port("Y", signals)];
          const inPorts = sources.map((name) => {
            return new Port_1.Port(name, getBits(signals, name));
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
          const inPorts = [new Port_1.Port("A", signals)];
          const splitOutPorts = targets.map((name) => {
            const sigs = getBits(signals, name);
            return new Port_1.Port(name, sigs);
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
          const template = Skin_1.default.findSkinType(this.type);
          const lateralPids = template ? Skin_1.default.getLateralPortPids(template) : [];
          this.inputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            const isGeneric = template && template[1] && template[1]["s:type"] === "generic";
            if (isLateral || isGeneric && genericsLaterals) {
              (0, FlatModule_1.addToCollection)(lateralsByNet, port.valString(), port);
            } else {
              (0, FlatModule_1.addToCollection)(ridersByNet, port.valString(), port);
            }
          });
          this.outputPorts.forEach((port) => {
            const isLateral = port.keyIn(lateralPids);
            const isGeneric = template && template[1] && template[1]["s:type"] === "generic";
            if (isLateral || isGeneric && genericsLaterals) {
              (0, FlatModule_1.addToCollection)(lateralsByNet, port.valString(), port);
            } else {
              (0, FlatModule_1.addToCollection)(driversByNet, port.valString(), port);
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
          return Skin_1.default.findSkinType(this.type, this.depth);
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
            const inTemplates = Skin_1.default.getPortsWithPrefix(template, "in");
            const outTemplates = Skin_1.default.getPortsWithPrefix(template, "out");
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
          const ports = Skin_1.default.getPortsWithPrefix(template, "").map((tp) => {
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
          const inTemplates = Skin_1.default.getPortsWithPrefix(template, "in");
          const outTemplates = Skin_1.default.getPortsWithPrefix(template, "out");
          const inPorts = this.inputPorts.map((ip, i) => ip.getGenericElkPort(i, inTemplates, "in"));
          const outPorts = this.outputPorts.map((op, i) => op.getGenericElkPort(i, outTemplates, "out"));
          const elk = (0, elkGraph_1.buildElkGraph)(subModule);
          const cell = {
            id: this.parent + "." + this.key,
            layoutOptions: { "org.eclipse.elk.portConstraints": "FIXED_SIDE" },
            labels: [],
            ports: inPorts.concat(outPorts),
            children: [],
            edges: []
          };
          elk.children.forEach((child) => {
            const isPort = cell.ports.some((port) => this.parent + "." + child.id === port.id);
            if (!isPort) {
              cell.children.push(child);
            }
          });
          elk.edges.forEach((edge) => {
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
              elkGraph_1.ElkModel.wireNameLookup[edge.id] = elkGraph_1.ElkModel.wireNameLookup[edgeId];
              edgeCopy.source = dummyId;
              edgeCopy.sourcePort = dummyId + ".pout";
              edgeCopy.id = subModule.moduleName + ".e_" + edgeCopy.sourcePort + "_" + edgeCopy.targetPort;
              elkGraph_1.ElkModel.wireNameLookup[edgeCopy.id] = elkGraph_1.ElkModel.wireNameLookup[edgeId];
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
            const outPorts = Skin_1.default.getPortsWithPrefix(template, "out");
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
            const inPorts = Skin_1.default.getPortsWithPrefix(template, "in");
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
            const inPorts = Skin_1.default.getPortsWithPrefix(template, "in");
            const ingap = Number(inPorts[1][1]["s:y"]) - Number(inPorts[0][1]["s:y"]);
            const instartY = Number(inPorts[0][1]["s:y"]);
            const outPorts = Skin_1.default.getPortsWithPrefix(template, "out");
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
            const subModuleSvg = (0, drawModule_1.drawSubModule)(cell, this.subModule);
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
            const inPorts = Skin_1.default.getPortsWithPrefix(template, "in");
            const outPorts = Skin_1.default.getPortsWithPrefix(template, "out");
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
          onml.traverse(template, {
            enter: (node) => {
              var _a;
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
                ((_a = cell.labels) !== null && _a !== void 0 ? _a : cell.labels = []).push({
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
          const inPorts = Skin_1.default.getPortsWithPrefix(template, "in");
          const outPorts = Skin_1.default.getPortsWithPrefix(template, "out");
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
      exports.default = Cell;
      function setGenericSize(tempclone, height) {
        onml.traverse(tempclone, {
          enter: (node) => {
            if (node.name === "rect" && node.attr["s:generic"] === "body") {
              node.attr.height = height;
            }
          }
        });
      }
      function setTextAttribute(tempclone, attribute, value) {
        onml.traverse(tempclone, {
          enter: (node) => {
            if (node.name === "text" && node.attr["s:attribute"] === attribute) {
              node.full[2] = value;
            }
          }
        });
      }
      function setClass(tempclone, searchKey, className) {
        onml.traverse(tempclone, {
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
    }
  });

  // built/FlatModule.js
  var require_FlatModule = __commonJS({
    "built/FlatModule.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FlatModule = void 0;
      exports.arrayToBitstring = arrayToBitstring;
      exports.contains = contains;
      exports.findIndexContaining = findIndexContaining;
      exports.addToCollection = addToCollection;
      exports.getIndicesString = getIndicesString;
      exports.processSplitsAndJoins = processSplitsAndJoins;
      var Skin_1 = __importDefault(require_Skin());
      var Cell_1 = __importDefault(require_Cell());
      function arrayToBitstring(bitArray) {
        return `,${bitArray.join(",")},`;
      }
      function contains(needle, haystack) {
        return haystack.includes(needle);
      }
      function findIndexContaining(needle, haystack) {
        return haystack.findIndex((item) => item.includes(needle));
      }
      function addToCollection(collection, key, value) {
        var _a;
        ((_a = collection[key]) !== null && _a !== void 0 ? _a : collection[key] = []).push(value);
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
          this.layoutProps = Skin_1.default.getProperties();
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
          const ports = Object.entries(mod.ports).map(([portName, portData]) => Cell_1.default.fromPort(portData, portName, this.moduleName));
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
          const expand = () => Cell_1.default.createSubModule(c, key, this.moduleName, _FlatModule.netlist.modules[c.type], depth);
          const box = () => Cell_1.default.fromYosysCell(c, key, this.moduleName);
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
          const joinCells = Object.entries(joins).map(([joinInput, joinOutputs]) => Cell_1.default.fromJoinInfo(joinInput, joinOutputs, this.moduleName));
          const splitCells = Object.entries(splits).map(([splitInput, splitOutputs]) => Cell_1.default.fromSplitInfo(splitInput, splitOutputs, this.moduleName));
          this.nodes.push(...joinCells, ...splitCells);
        }
        /**
         * Create wire connections between nodes
         */
        createWires() {
          const layoutProps = Skin_1.default.getProperties();
          const ridersByNet = {};
          const driversByNet = {};
          const lateralsByNet = {};
          this.nodes.forEach((node) => node.collectPortsByDirection(ridersByNet, driversByNet, lateralsByNet, layoutProps.genericsLaterals));
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
      exports.FlatModule = FlatModule;
    }
  });

  // built/index.js
  var require_built = __commonJS({
    "built/index.js"(exports) {
      "use strict";
      var __importDefault = exports && exports.__importDefault || function(mod) {
        return mod && mod.__esModule ? mod : { "default": mod };
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.dumpLayout = dumpLayout;
      exports.render = render2;
      var elkjs_1 = __importDefault(__require("elkjs"));
      var onml = require_onml();
      var FlatModule_1 = require_FlatModule();
      var Skin_1 = __importDefault(require_Skin());
      var elkGraph_1 = require_elkGraph();
      var drawModule_1 = __importDefault(require_drawModule());
      var elk = new elkjs_1.default();
      var defaultConfig = {
        hierarchy: {
          enable: "off",
          expandLevel: 0,
          expandModules: { types: [], ids: [] }
        },
        top: { enable: false, module: "" }
      };
      function createFlatModule(skinData, yosysNetlist, configData) {
        Skin_1.default.skin = onml.p(skinData);
        const config = configData || defaultConfig;
        return FlatModule_1.FlatModule.fromNetlist(yosysNetlist, config);
      }
      async function dumpLayout(skinData, yosysNetlist, prelayout, done) {
        try {
          const flatModule = createFlatModule(skinData, yosysNetlist);
          const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
          if (prelayout) {
            done(null, JSON.stringify(kgraph, null, 2));
            return;
          }
          const layoutProps = Skin_1.default.getProperties();
          const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
          done(null, JSON.stringify(graph, null, 2));
        } catch (error) {
          done(error instanceof Error ? error : new Error(String(error)));
        }
      }
      function render2(skinData, yosysNetlist, done, elkData, configData) {
        const flatModule = createFlatModule(skinData, yosysNetlist, configData);
        const kgraph = (0, elkGraph_1.buildElkGraph)(flatModule);
        const layoutProps = Skin_1.default.getProperties();
        const renderPromise = (async () => {
          if (elkData) {
            return (0, drawModule_1.default)(elkData, flatModule);
          }
          try {
            const graph = await elk.layout(kgraph, { layoutOptions: layoutProps.layoutEngine });
            return (0, drawModule_1.default)(graph, flatModule);
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
    }
  });

  // docs/demo.js
  var superagent = require_client();
  var JSON5 = require_dist();
  var netlistRenderer = require_built();
  var skinPaths = ["skin/default.svg", "skin/analog.svg", "skin/horizontal.svg"];
  var textarea = document.querySelector("#editor");
  var skinSelect = document.querySelector("#skinSelect");
  var exampleSelect = document.querySelector("#exampleSelect");
  var configSelect = document.querySelector("#configSelect");
  var formatButton = document.querySelector("#formatButton");
  var downloadButton = document.querySelector("#downloadButton");
  var svgImage = document.querySelector("#svgArea");
  var emptyState = document.querySelector("#emptyState");
  var toast = document.querySelector("#toast");
  var themeToggle = document.querySelector("#themeToggle");
  var orientSelect = document.querySelector("#orientSelect");
  var metricsEl = document.querySelector("#metrics");
  var currentSvgString = "";
  var THEME_KEY = "netlist2svg-theme";
  var THEME_MODES = ["system", "light", "dark"];
  var THEME_LABELS = { system: "System", light: "Light", dark: "Dark" };
  var THEME_ICONS = {
    system: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18" fill="currentColor" stroke="none"/></svg>',
    light: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
  };
  function systemPrefersDark() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function storedThemeMode() {
    try {
      return localStorage.getItem(THEME_KEY) || "system";
    } catch (e) {
      return "system";
    }
  }
  function effectiveTheme(mode) {
    return mode === "system" ? systemPrefersDark() ? "dark" : "light" : mode;
  }
  function applyTheme(mode) {
    document.documentElement.dataset.theme = effectiveTheme(mode);
    if (themeToggle) {
      const ico = themeToggle.querySelector(".ico");
      const label = themeToggle.querySelector(".label");
      if (ico) ico.innerHTML = THEME_ICONS[mode];
      if (label) label.textContent = THEME_LABELS[mode];
      themeToggle.setAttribute("aria-label", "Theme: " + THEME_LABELS[mode] + " (click to change)");
    }
    applySchematicTheme();
  }
  function cycleTheme() {
    const next = THEME_MODES[(THEME_MODES.indexOf(storedThemeMode()) + 1) % THEME_MODES.length];
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
    }
    applyTheme(next);
  }
  function applySchematicTheme() {
    if (!currentSvgString) return;
    const eff = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const themed = currentSvgString.replace("<svg ", '<svg class="' + eff + '" ');
    svgImage.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(themed)));
  }
  var HIERARCHY_CONFIGS = {
    all: { hierarchy: { enable: "all", expandLevel: 0, expandModules: { types: [], ids: [] } }, top: { enable: false, module: "" } },
    level1: { hierarchy: { enable: "level", expandLevel: 1, expandModules: { types: [], ids: [] } }, top: { enable: false, module: "" } },
    foo: { hierarchy: { enable: "modules", expandLevel: 0, expandModules: { types: [], ids: ["foo"] } }, top: { enable: false, module: "" } }
  };
  function showToast(message) {
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => {
      toast.style.display = "none";
    }, 5e3);
  }
  function hideToast() {
    toast.style.display = "none";
  }
  async function loadSkins(paths) {
    try {
      const skinPromises = paths.map((path) => superagent.get(path).then((res) => ({ path, svg: res.text })));
      const skins = await Promise.all(skinPromises);
      return skins;
    } catch (error) {
      console.error("Error loading skins:", error);
      showToast("Error loading skins. See console for details.");
      return [];
    }
  }
  function populateSkinSelect(skins) {
    skins.forEach((skin, index) => {
      const option = document.createElement("option");
      option.value = skin.svg;
      option.text = skin.path;
      option.selected = index === 0;
      skinSelect.append(option);
    });
  }
  var ORIENT_BASES = ["r", "c", "l", "d_led"];
  var MAX_AUTO_PARTS = 6;
  var ORIENT_LABELS = {
    "": "As authored",
    vertical: "All vertical",
    horizontal: "All horizontal",
    auto: "Auto (fewest bends)"
  };
  function orientBase(type) {
    if (typeof type !== "string") return null;
    const m = type.match(/^(.*)_(v|h)$/);
    if (m && ORIENT_BASES.includes(m[1])) return m[1];
    if (ORIENT_BASES.includes(type)) return type;
    return null;
  }
  function orientableCount(netlist) {
    let n = 0;
    for (const mod of Object.values(netlist.modules || {})) {
      for (const cell of Object.values(mod.cells || {})) {
        if (orientBase(cell.type)) n++;
      }
    }
    return n;
  }
  function applyOrientation(netlist, mode) {
    const nl = JSON.parse(JSON.stringify(netlist));
    for (const mod of Object.values(nl.modules || {})) {
      for (const cell of Object.values(mod.cells || {})) {
        const base = orientBase(cell.type);
        if (!base) continue;
        if (mode === "vertical") cell.type = base + "_v";
        else if (mode === "horizontal") cell.type = base + "_h";
        else if (cell.type === base) cell.type = base + "_v";
      }
    }
    return nl;
  }
  function orientVariant(netlist, mask) {
    const nl = JSON.parse(JSON.stringify(netlist));
    let i = 0;
    for (const mod of Object.values(nl.modules || {})) {
      for (const cell of Object.values(mod.cells || {})) {
        const base = orientBase(cell.type);
        if (!base) continue;
        cell.type = base + (mask >> i & 1 ? "_v" : "_h");
        i++;
      }
    }
    return nl;
  }
  function layoutGraph(netlist) {
    return new Promise((resolve, reject) => {
      netlistRenderer.dumpLayout(skinSelect.value, netlist, false, (err, out) => {
        if (err) reject(err);
        else resolve(JSON.parse(out));
      });
    });
  }
  function countBends(graph) {
    return (graph.edges || []).reduce((acc, e) => acc + (e.sections || []).reduce((s, sec) => {
      const a = sec.startPoint, b = sec.endPoint;
      if (a && b && a.x !== b.x && a.y !== b.y) return s + (sec.bendPoints || []).length;
      return s;
    }, 0), 0);
  }
  function graphSize(graph) {
    return { w: Math.round(graph.width || 0), h: Math.round(graph.height || 0) };
  }
  async function autoOrient(netlist) {
    const count = orientableCount(netlist);
    if (count === 0) {
      return { netlist: applyOrientation(netlist, "as-authored"), bends: 0, size: { w: 0, h: 0 }, layouts: 0 };
    }
    if (count > MAX_AUTO_PARTS) {
      const nl = applyOrientation(netlist, "vertical");
      const g = await layoutGraph(nl);
      return {
        netlist: nl,
        bends: countBends(g),
        size: graphSize(g),
        layouts: 0,
        note: `${count} parts \u2192 2^${count} layouts too many; showing all-vertical`
      };
    }
    let best = null, bestBends = Infinity, bestArea = Infinity, bestSize = null, worstBends = 0;
    const total = 1 << count;
    for (let mask = 0; mask < total; mask++) {
      const nl = orientVariant(netlist, mask);
      const g = await layoutGraph(nl);
      const bends = countBends(g);
      const area = (g.width || 0) * (g.height || 0);
      worstBends = Math.max(worstBends, bends);
      if (bends < bestBends || bends === bestBends && area < bestArea) {
        best = nl;
        bestBends = bends;
        bestArea = area;
        bestSize = graphSize(g);
      }
    }
    return { netlist: best, bends: bestBends, worst: worstBends, size: bestSize, layouts: total };
  }
  async function updateMetrics(netlist, mode, pre) {
    const count = orientableCount(netlist);
    if (count === 0) {
      metricsEl.hidden = true;
      return;
    }
    let bends, size, note = "";
    if (pre) {
      bends = pre.bends;
      size = pre.size;
      if (pre.note) {
        note = pre.note;
      } else if (pre.layouts) {
        note = `best of ${pre.layouts} orientations` + (pre.worst > pre.bends ? ` (worst was ${pre.worst} bends)` : "");
      }
    } else {
      const g = await layoutGraph(netlist);
      bends = countBends(g);
      size = graphSize(g);
    }
    const isAuto = mode === "auto";
    metricsEl.innerHTML = `<span class="stat${isAuto ? " win" : ""}">Orientation: <strong>${ORIENT_LABELS[mode] || ORIENT_LABELS[""]}</strong></span><span class="stat">Bends: <strong>${bends}</strong></span><span class="stat">Size: <strong>${size.w}&times;${size.h}</strong></span><span class="stat">Orientable parts: <strong>${count}</strong></span>` + (note ? `<span class="stat">${note}</span>` : "");
    metricsEl.hidden = false;
  }
  async function render() {
    hideToast();
    if (!textarea.value.trim()) {
      svgImage.style.display = "none";
      emptyState.style.display = "flex";
      downloadButton.style.display = "none";
      metricsEl.hidden = true;
      return;
    }
    try {
      const netlist = JSON5.parse(textarea.value);
      const config = HIERARCHY_CONFIGS[configSelect.value];
      const mode = orientSelect.value;
      let toRender;
      let pre = null;
      if (mode === "auto") {
        pre = await autoOrient(netlist);
        toRender = pre.netlist;
        if (pre.note) showToast("Auto-orient: " + pre.note);
      } else {
        toRender = applyOrientation(netlist, mode || "as-authored");
      }
      const svgString = await netlistRenderer.render(skinSelect.value, toRender, void 0, void 0, config);
      currentSvgString = svgString;
      applySchematicTheme();
      svgImage.style.display = "block";
      emptyState.style.display = "none";
      downloadButton.style.display = "block";
      updateMetrics(toRender, mode, pre).catch(() => {
        metricsEl.hidden = true;
      });
    } catch (error) {
      console.error("Error rendering netlist:", error);
      if (error instanceof SyntaxError) {
        showToast("Syntax Error in JSON: Please check your formatting.");
      } else {
        showToast(error.message || "Error rendering netlist. Check developer console.");
      }
      svgImage.style.display = "none";
      emptyState.style.display = "flex";
      downloadButton.style.display = "none";
      metricsEl.hidden = true;
    }
  }
  function format() {
    try {
      const netlist = JSON5.parse(textarea.value);
      textarea.value = JSON5.stringify(netlist, null, 4);
    } catch (error) {
      console.error("Error formatting JSON:", error);
      showToast("Invalid JSON5. Please check your input.");
    }
  }
  function selectSkinByPath(substr) {
    for (const option of skinSelect.options) {
      if (option.text.includes(substr)) {
        skinSelect.value = option.value;
        return;
      }
    }
  }
  async function handleExampleChange() {
    const examplePath = exampleSelect.value;
    if (!examplePath) return;
    try {
      const res = await superagent.get(examplePath);
      textarea.value = res.text;
      if (examplePath.includes("/analog/")) {
        selectSkinByPath("analog.svg");
        configSelect.value = "";
      } else if (examplePath.includes("hierarchy")) {
        selectSkinByPath("default.svg");
        configSelect.value = "all";
      } else {
        selectSkinByPath("default.svg");
        configSelect.value = "";
      }
      format();
      render();
    } catch (error) {
      console.error("Error loading example:", error);
      showToast("Failed to load example netlist.");
    }
  }
  function handleDownload() {
    if (!currentSvgString) return;
    const blob = new Blob([currentSvgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schematic.svg";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }
  async function init() {
    applyTheme(storedThemeMode());
    const skins = await loadSkins(skinPaths);
    if (skins.length > 0) {
      populateSkinSelect(skins);
    }
    formatButton.addEventListener("click", format);
    downloadButton.addEventListener("click", handleDownload);
    exampleSelect.addEventListener("change", handleExampleChange);
    skinSelect.addEventListener("change", render);
    configSelect.addEventListener("change", render);
    orientSelect.addEventListener("change", render);
    if (themeToggle) {
      themeToggle.addEventListener("click", cycleTheme);
    }
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (storedThemeMode() === "system") applyTheme("system");
      });
    }
    const debouncedRender = debounce(render, 300);
    textarea.addEventListener("input", debouncedRender);
    await handleExampleChange();
  }
  init();
})();
/*! Bundled license information:

sax/lib/sax.js:
  (*! http://mths.be/fromcodepoint v0.1.0 by @mathias *)
*/
