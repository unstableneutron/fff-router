#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/constants.js"(exports, module) {
    "use strict";
    var WIN_SLASH = "\\\\/";
    var WIN_NO_SLASH = `[^${WIN_SLASH}]`;
    var DEFAULT_MAX_EXTGLOB_RECURSION = 0;
    var DOT_LITERAL = "\\.";
    var PLUS_LITERAL = "\\+";
    var QMARK_LITERAL = "\\?";
    var SLASH_LITERAL = "\\/";
    var ONE_CHAR = "(?=.)";
    var QMARK = "[^/]";
    var END_ANCHOR = `(?:${SLASH_LITERAL}|$)`;
    var START_ANCHOR = `(?:^|${SLASH_LITERAL})`;
    var DOTS_SLASH = `${DOT_LITERAL}{1,2}${END_ANCHOR}`;
    var NO_DOT = `(?!${DOT_LITERAL})`;
    var NO_DOTS = `(?!${START_ANCHOR}${DOTS_SLASH})`;
    var NO_DOT_SLASH = `(?!${DOT_LITERAL}{0,1}${END_ANCHOR})`;
    var NO_DOTS_SLASH = `(?!${DOTS_SLASH})`;
    var QMARK_NO_DOT = `[^.${SLASH_LITERAL}]`;
    var STAR = `${QMARK}*?`;
    var SEP = "/";
    var POSIX_CHARS = {
      DOT_LITERAL,
      PLUS_LITERAL,
      QMARK_LITERAL,
      SLASH_LITERAL,
      ONE_CHAR,
      QMARK,
      END_ANCHOR,
      DOTS_SLASH,
      NO_DOT,
      NO_DOTS,
      NO_DOT_SLASH,
      NO_DOTS_SLASH,
      QMARK_NO_DOT,
      STAR,
      START_ANCHOR,
      SEP
    };
    var WINDOWS_CHARS = {
      ...POSIX_CHARS,
      SLASH_LITERAL: `[${WIN_SLASH}]`,
      QMARK: WIN_NO_SLASH,
      STAR: `${WIN_NO_SLASH}*?`,
      DOTS_SLASH: `${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$)`,
      NO_DOT: `(?!${DOT_LITERAL})`,
      NO_DOTS: `(?!(?:^|[${WIN_SLASH}])${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      NO_DOT_SLASH: `(?!${DOT_LITERAL}{0,1}(?:[${WIN_SLASH}]|$))`,
      NO_DOTS_SLASH: `(?!${DOT_LITERAL}{1,2}(?:[${WIN_SLASH}]|$))`,
      QMARK_NO_DOT: `[^.${WIN_SLASH}]`,
      START_ANCHOR: `(?:^|[${WIN_SLASH}])`,
      END_ANCHOR: `(?:[${WIN_SLASH}]|$)`,
      SEP: "\\"
    };
    var POSIX_REGEX_SOURCE = {
      __proto__: null,
      alnum: "a-zA-Z0-9",
      alpha: "a-zA-Z",
      ascii: "\\x00-\\x7F",
      blank: " \\t",
      cntrl: "\\x00-\\x1F\\x7F",
      digit: "0-9",
      graph: "\\x21-\\x7E",
      lower: "a-z",
      print: "\\x20-\\x7E ",
      punct: "\\-!\"#$%&'()\\*+,./:;<=>?@[\\]^_`{|}~",
      space: " \\t\\r\\n\\v\\f",
      upper: "A-Z",
      word: "A-Za-z0-9_",
      xdigit: "A-Fa-f0-9"
    };
    module.exports = {
      DEFAULT_MAX_EXTGLOB_RECURSION,
      MAX_LENGTH: 1024 * 64,
      POSIX_REGEX_SOURCE,
      // regular expressions
      REGEX_BACKSLASH: /\\(?![*+?^${}(|)[\]])/g,
      REGEX_NON_SPECIAL_CHARS: /^[^@![\].,$*+?^{}()|\\/]+/,
      REGEX_SPECIAL_CHARS: /[-*+?.^${}(|)[\]]/,
      REGEX_SPECIAL_CHARS_BACKREF: /(\\?)((\W)(\3*))/g,
      REGEX_SPECIAL_CHARS_GLOBAL: /([-*+?.^${}(|)[\]])/g,
      REGEX_REMOVE_BACKSLASH: /(?:\[.*?[^\\]\]|\\(?=.))/g,
      // Replace globs with equivalent patterns to reduce parsing time.
      REPLACEMENTS: {
        __proto__: null,
        "***": "*",
        "**/**": "**",
        "**/**/**": "**"
      },
      // Digits
      CHAR_0: 48,
      /* 0 */
      CHAR_9: 57,
      /* 9 */
      // Alphabet chars.
      CHAR_UPPERCASE_A: 65,
      /* A */
      CHAR_LOWERCASE_A: 97,
      /* a */
      CHAR_UPPERCASE_Z: 90,
      /* Z */
      CHAR_LOWERCASE_Z: 122,
      /* z */
      CHAR_LEFT_PARENTHESES: 40,
      /* ( */
      CHAR_RIGHT_PARENTHESES: 41,
      /* ) */
      CHAR_ASTERISK: 42,
      /* * */
      // Non-alphabetic chars.
      CHAR_AMPERSAND: 38,
      /* & */
      CHAR_AT: 64,
      /* @ */
      CHAR_BACKWARD_SLASH: 92,
      /* \ */
      CHAR_CARRIAGE_RETURN: 13,
      /* \r */
      CHAR_CIRCUMFLEX_ACCENT: 94,
      /* ^ */
      CHAR_COLON: 58,
      /* : */
      CHAR_COMMA: 44,
      /* , */
      CHAR_DOT: 46,
      /* . */
      CHAR_DOUBLE_QUOTE: 34,
      /* " */
      CHAR_EQUAL: 61,
      /* = */
      CHAR_EXCLAMATION_MARK: 33,
      /* ! */
      CHAR_FORM_FEED: 12,
      /* \f */
      CHAR_FORWARD_SLASH: 47,
      /* / */
      CHAR_GRAVE_ACCENT: 96,
      /* ` */
      CHAR_HASH: 35,
      /* # */
      CHAR_HYPHEN_MINUS: 45,
      /* - */
      CHAR_LEFT_ANGLE_BRACKET: 60,
      /* < */
      CHAR_LEFT_CURLY_BRACE: 123,
      /* { */
      CHAR_LEFT_SQUARE_BRACKET: 91,
      /* [ */
      CHAR_LINE_FEED: 10,
      /* \n */
      CHAR_NO_BREAK_SPACE: 160,
      /* \u00A0 */
      CHAR_PERCENT: 37,
      /* % */
      CHAR_PLUS: 43,
      /* + */
      CHAR_QUESTION_MARK: 63,
      /* ? */
      CHAR_RIGHT_ANGLE_BRACKET: 62,
      /* > */
      CHAR_RIGHT_CURLY_BRACE: 125,
      /* } */
      CHAR_RIGHT_SQUARE_BRACKET: 93,
      /* ] */
      CHAR_SEMICOLON: 59,
      /* ; */
      CHAR_SINGLE_QUOTE: 39,
      /* ' */
      CHAR_SPACE: 32,
      /*   */
      CHAR_TAB: 9,
      /* \t */
      CHAR_UNDERSCORE: 95,
      /* _ */
      CHAR_VERTICAL_LINE: 124,
      /* | */
      CHAR_ZERO_WIDTH_NOBREAK_SPACE: 65279,
      /* \uFEFF */
      /**
       * Create EXTGLOB_CHARS
       */
      extglobChars(chars) {
        return {
          "!": { type: "negate", open: "(?:(?!(?:", close: `))${chars.STAR})` },
          "?": { type: "qmark", open: "(?:", close: ")?" },
          "+": { type: "plus", open: "(?:", close: ")+" },
          "*": { type: "star", open: "(?:", close: ")*" },
          "@": { type: "at", open: "(?:", close: ")" }
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      }
    };
  }
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/utils.js"(exports) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL
    } = require_constants();
    exports.isObject = (val) => val !== null && typeof val === "object" && !Array.isArray(val);
    exports.hasRegexChars = (str) => REGEX_SPECIAL_CHARS.test(str);
    exports.isRegexChar = (str) => str.length === 1 && exports.hasRegexChars(str);
    exports.escapeRegex = (str) => str.replace(REGEX_SPECIAL_CHARS_GLOBAL, "\\$1");
    exports.toPosixSlashes = (str) => str.replace(REGEX_BACKSLASH, "/");
    exports.isWindows = () => {
      if (typeof navigator !== "undefined" && navigator.platform) {
        const platform = navigator.platform.toLowerCase();
        return platform === "win32" || platform === "windows";
      }
      if (typeof process !== "undefined" && process.platform) {
        return process.platform === "win32";
      }
      return false;
    };
    exports.removeBackslashes = (str) => {
      return str.replace(REGEX_REMOVE_BACKSLASH, (match) => {
        return match === "\\" ? "" : match;
      });
    };
    exports.escapeLast = (input, char, lastIdx) => {
      const idx = input.lastIndexOf(char, lastIdx);
      if (idx === -1) return input;
      if (input[idx - 1] === "\\") return exports.escapeLast(input, char, idx - 1);
      return `${input.slice(0, idx)}\\${input.slice(idx)}`;
    };
    exports.removePrefix = (input, state = {}) => {
      let output = input;
      if (output.startsWith("./")) {
        output = output.slice(2);
        state.prefix = "./";
      }
      return output;
    };
    exports.wrapOutput = (input, state = {}, options = {}) => {
      const prepend = options.contains ? "" : "^";
      const append = options.contains ? "" : "$";
      let output = `${prepend}(?:${input})${append}`;
      if (state.negated === true) {
        output = `(?:^(?!${output}).*$)`;
      }
      return output;
    };
    exports.basename = (path16, { windows } = {}) => {
      const segs = path16.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  }
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/scan.js"(exports, module) {
    "use strict";
    var utils = require_utils();
    var {
      CHAR_ASTERISK,
      /* * */
      CHAR_AT,
      /* @ */
      CHAR_BACKWARD_SLASH,
      /* \ */
      CHAR_COMMA,
      /* , */
      CHAR_DOT,
      /* . */
      CHAR_EXCLAMATION_MARK,
      /* ! */
      CHAR_FORWARD_SLASH,
      /* / */
      CHAR_LEFT_CURLY_BRACE,
      /* { */
      CHAR_LEFT_PARENTHESES,
      /* ( */
      CHAR_LEFT_SQUARE_BRACKET,
      /* [ */
      CHAR_PLUS,
      /* + */
      CHAR_QUESTION_MARK,
      /* ? */
      CHAR_RIGHT_CURLY_BRACE,
      /* } */
      CHAR_RIGHT_PARENTHESES,
      /* ) */
      CHAR_RIGHT_SQUARE_BRACKET
      /* ] */
    } = require_constants();
    var isPathSeparator = (code) => {
      return code === CHAR_FORWARD_SLASH || code === CHAR_BACKWARD_SLASH;
    };
    var depth = (token) => {
      if (token.isPrefix !== true) {
        token.depth = token.isGlobstar ? Infinity : 1;
      }
    };
    var scan = (input, options) => {
      const opts = options || {};
      const length = input.length - 1;
      const scanToEnd = opts.parts === true || opts.scanToEnd === true;
      const slashes = [];
      const tokens = [];
      const parts = [];
      let str = input;
      let index = -1;
      let start = 0;
      let lastIndex = 0;
      let isBrace = false;
      let isBracket = false;
      let isGlob = false;
      let isExtglob = false;
      let isGlobstar = false;
      let braceEscaped = false;
      let backslashes = false;
      let negated = false;
      let negatedExtglob = false;
      let finished = false;
      let braces = 0;
      let prev;
      let code;
      let token = { value: "", depth: 0, isGlob: false };
      const eos = () => index >= length;
      const peek = () => str.charCodeAt(index + 1);
      const advance = () => {
        prev = code;
        return str.charCodeAt(++index);
      };
      while (index < length) {
        code = advance();
        let next;
        if (code === CHAR_BACKWARD_SLASH) {
          backslashes = token.backslashes = true;
          code = advance();
          if (code === CHAR_LEFT_CURLY_BRACE) {
            braceEscaped = true;
          }
          continue;
        }
        if (braceEscaped === true || code === CHAR_LEFT_CURLY_BRACE) {
          braces++;
          while (eos() !== true && (code = advance())) {
            if (code === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (code === CHAR_LEFT_CURLY_BRACE) {
              braces++;
              continue;
            }
            if (braceEscaped !== true && code === CHAR_DOT && (code = advance()) === CHAR_DOT) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (braceEscaped !== true && code === CHAR_COMMA) {
              isBrace = token.isBrace = true;
              isGlob = token.isGlob = true;
              finished = true;
              if (scanToEnd === true) {
                continue;
              }
              break;
            }
            if (code === CHAR_RIGHT_CURLY_BRACE) {
              braces--;
              if (braces === 0) {
                braceEscaped = false;
                isBrace = token.isBrace = true;
                finished = true;
                break;
              }
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_FORWARD_SLASH) {
          slashes.push(index);
          tokens.push(token);
          token = { value: "", depth: 0, isGlob: false };
          if (finished === true) continue;
          if (prev === CHAR_DOT && index === start + 1) {
            start += 2;
            continue;
          }
          lastIndex = index + 1;
          continue;
        }
        if (opts.noext !== true) {
          const isExtglobChar = code === CHAR_PLUS || code === CHAR_AT || code === CHAR_ASTERISK || code === CHAR_QUESTION_MARK || code === CHAR_EXCLAMATION_MARK;
          if (isExtglobChar === true && peek() === CHAR_LEFT_PARENTHESES) {
            isGlob = token.isGlob = true;
            isExtglob = token.isExtglob = true;
            finished = true;
            if (code === CHAR_EXCLAMATION_MARK && index === start) {
              negatedExtglob = true;
            }
            if (scanToEnd === true) {
              while (eos() !== true && (code = advance())) {
                if (code === CHAR_BACKWARD_SLASH) {
                  backslashes = token.backslashes = true;
                  code = advance();
                  continue;
                }
                if (code === CHAR_RIGHT_PARENTHESES) {
                  isGlob = token.isGlob = true;
                  finished = true;
                  break;
                }
              }
              continue;
            }
            break;
          }
        }
        if (code === CHAR_ASTERISK) {
          if (prev === CHAR_ASTERISK) isGlobstar = token.isGlobstar = true;
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_QUESTION_MARK) {
          isGlob = token.isGlob = true;
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (code === CHAR_LEFT_SQUARE_BRACKET) {
          while (eos() !== true && (next = advance())) {
            if (next === CHAR_BACKWARD_SLASH) {
              backslashes = token.backslashes = true;
              advance();
              continue;
            }
            if (next === CHAR_RIGHT_SQUARE_BRACKET) {
              isBracket = token.isBracket = true;
              isGlob = token.isGlob = true;
              finished = true;
              break;
            }
          }
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
        if (opts.nonegate !== true && code === CHAR_EXCLAMATION_MARK && index === start) {
          negated = token.negated = true;
          start++;
          continue;
        }
        if (opts.noparen !== true && code === CHAR_LEFT_PARENTHESES) {
          isGlob = token.isGlob = true;
          if (scanToEnd === true) {
            while (eos() !== true && (code = advance())) {
              if (code === CHAR_LEFT_PARENTHESES) {
                backslashes = token.backslashes = true;
                code = advance();
                continue;
              }
              if (code === CHAR_RIGHT_PARENTHESES) {
                finished = true;
                break;
              }
            }
            continue;
          }
          break;
        }
        if (isGlob === true) {
          finished = true;
          if (scanToEnd === true) {
            continue;
          }
          break;
        }
      }
      if (opts.noext === true) {
        isExtglob = false;
        isGlob = false;
      }
      let base = str;
      let prefix = "";
      let glob = "";
      if (start > 0) {
        prefix = str.slice(0, start);
        str = str.slice(start);
        lastIndex -= start;
      }
      if (base && isGlob === true && lastIndex > 0) {
        base = str.slice(0, lastIndex);
        glob = str.slice(lastIndex);
      } else if (isGlob === true) {
        base = "";
        glob = str;
      } else {
        base = str;
      }
      if (base && base !== "" && base !== "/" && base !== str) {
        if (isPathSeparator(base.charCodeAt(base.length - 1))) {
          base = base.slice(0, -1);
        }
      }
      if (opts.unescape === true) {
        if (glob) glob = utils.removeBackslashes(glob);
        if (base && backslashes === true) {
          base = utils.removeBackslashes(base);
        }
      }
      const state = {
        prefix,
        input,
        start,
        base,
        glob,
        isBrace,
        isBracket,
        isGlob,
        isExtglob,
        isGlobstar,
        negated,
        negatedExtglob
      };
      if (opts.tokens === true) {
        state.maxDepth = 0;
        if (!isPathSeparator(code)) {
          tokens.push(token);
        }
        state.tokens = tokens;
      }
      if (opts.parts === true || opts.tokens === true) {
        let prevIndex;
        for (let idx = 0; idx < slashes.length; idx++) {
          const n = prevIndex ? prevIndex + 1 : start;
          const i = slashes[idx];
          const value = input.slice(n, i);
          if (opts.tokens) {
            if (idx === 0 && start !== 0) {
              tokens[idx].isPrefix = true;
              tokens[idx].value = prefix;
            } else {
              tokens[idx].value = value;
            }
            depth(tokens[idx]);
            state.maxDepth += tokens[idx].depth;
          }
          if (idx !== 0 || value !== "") {
            parts.push(value);
          }
          prevIndex = i;
        }
        if (prevIndex && prevIndex + 1 < input.length) {
          const value = input.slice(prevIndex + 1);
          parts.push(value);
          if (opts.tokens) {
            tokens[tokens.length - 1].value = value;
            depth(tokens[tokens.length - 1]);
            state.maxDepth += tokens[tokens.length - 1].depth;
          }
        }
        state.slashes = slashes;
        state.parts = parts;
      }
      return state;
    };
    module.exports = scan;
  }
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/parse.js"(exports, module) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS
    } = constants;
    var expandRange = (args, options) => {
      if (typeof options.expandRange === "function") {
        return options.expandRange(...args, options);
      }
      args.sort();
      const value = `[${args.join("-")}]`;
      try {
        new RegExp(value);
      } catch (ex) {
        return args.map((v) => utils.escapeRegex(v)).join("..");
      }
      return value;
    };
    var syntaxError = (type, char) => {
      return `Missing ${type}: "${char}" - use "\\\\${char}" to match literal characters`;
    };
    var splitTopLevel = (input) => {
      const parts = [];
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let value = "";
      let escaped = false;
      for (const ch of input) {
        if (escaped === true) {
          value += ch;
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          value += ch;
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          value += ch;
          continue;
        }
        if (quote === 0) {
          if (ch === "[") {
            bracket++;
          } else if (ch === "]" && bracket > 0) {
            bracket--;
          } else if (bracket === 0) {
            if (ch === "(") {
              paren++;
            } else if (ch === ")" && paren > 0) {
              paren--;
            } else if (ch === "|" && paren === 0) {
              parts.push(value);
              value = "";
              continue;
            }
          }
        }
        value += ch;
      }
      parts.push(value);
      return parts;
    };
    var isPlainBranch = (branch) => {
      let escaped = false;
      for (const ch of branch) {
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (/[?*+@!()[\]{}]/.test(ch)) {
          return false;
        }
      }
      return true;
    };
    var normalizeSimpleBranch = (branch) => {
      let value = branch.trim();
      let changed = true;
      while (changed === true) {
        changed = false;
        if (/^@\([^\\()[\]{}|]+\)$/.test(value)) {
          value = value.slice(2, -1);
          changed = true;
        }
      }
      if (!isPlainBranch(value)) {
        return;
      }
      return value.replace(/\\(.)/g, "$1");
    };
    var hasRepeatedCharPrefixOverlap = (branches) => {
      const values = branches.map(normalizeSimpleBranch).filter(Boolean);
      for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
          const a = values[i];
          const b = values[j];
          const char = a[0];
          if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {
            continue;
          }
          if (a === b || a.startsWith(b) || b.startsWith(a)) {
            return true;
          }
        }
      }
      return false;
    };
    var parseRepeatedExtglob = (pattern, requireEnd = true) => {
      if (pattern[0] !== "+" && pattern[0] !== "*" || pattern[1] !== "(") {
        return;
      }
      let bracket = 0;
      let paren = 0;
      let quote = 0;
      let escaped = false;
      for (let i = 1; i < pattern.length; i++) {
        const ch = pattern[i];
        if (escaped === true) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          quote = quote === 1 ? 0 : 1;
          continue;
        }
        if (quote === 1) {
          continue;
        }
        if (ch === "[") {
          bracket++;
          continue;
        }
        if (ch === "]" && bracket > 0) {
          bracket--;
          continue;
        }
        if (bracket > 0) {
          continue;
        }
        if (ch === "(") {
          paren++;
          continue;
        }
        if (ch === ")") {
          paren--;
          if (paren === 0) {
            if (requireEnd === true && i !== pattern.length - 1) {
              return;
            }
            return {
              type: pattern[0],
              body: pattern.slice(2, i),
              end: i
            };
          }
        }
      }
    };
    var getStarExtglobSequenceOutput = (pattern) => {
      let index = 0;
      const chars = [];
      while (index < pattern.length) {
        const match = parseRepeatedExtglob(pattern.slice(index), false);
        if (!match || match.type !== "*") {
          return;
        }
        const branches = splitTopLevel(match.body).map((branch2) => branch2.trim());
        if (branches.length !== 1) {
          return;
        }
        const branch = normalizeSimpleBranch(branches[0]);
        if (!branch || branch.length !== 1) {
          return;
        }
        chars.push(branch);
        index += match.end + 1;
      }
      if (chars.length < 1) {
        return;
      }
      const source = chars.length === 1 ? utils.escapeRegex(chars[0]) : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
      return `${source}*`;
    };
    var repeatedExtglobRecursion = (pattern) => {
      let depth = 0;
      let value = pattern.trim();
      let match = parseRepeatedExtglob(value);
      while (match) {
        depth++;
        value = match.body.trim();
        match = parseRepeatedExtglob(value);
      }
      return depth;
    };
    var analyzeRepeatedExtglob = (body, options) => {
      if (options.maxExtglobRecursion === false) {
        return { risky: false };
      }
      const max = typeof options.maxExtglobRecursion === "number" ? options.maxExtglobRecursion : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (branches.some((branch) => branch === "") || branches.some((branch) => /^[*?]+$/.test(branch)) || hasRepeatedCharPrefixOverlap(branches)) {
          return { risky: true };
        }
      }
      for (const branch of branches) {
        const safeOutput = getStarExtglobSequenceOutput(branch);
        if (safeOutput) {
          return { risky: true, safeOutput };
        }
        if (repeatedExtglobRecursion(branch) > max) {
          return { risky: true };
        }
      }
      return { risky: false };
    };
    var parse = (input, options) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected a string");
      }
      input = REPLACEMENTS[input] || input;
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      let len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      const bos = { type: "bos", value: "", output: opts.prepend || "" };
      const tokens = [bos];
      const capture = opts.capture ? "" : "?:";
      const PLATFORM_CHARS = constants.globChars(opts.windows);
      const EXTGLOB_CHARS = constants.extglobChars(PLATFORM_CHARS);
      const {
        DOT_LITERAL,
        PLUS_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOT_SLASH,
        NO_DOTS_SLASH,
        QMARK,
        QMARK_NO_DOT,
        STAR,
        START_ANCHOR
      } = PLATFORM_CHARS;
      const globstar = (opts2) => {
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const nodot = opts.dot ? "" : NO_DOT;
      const qmarkNoDot = opts.dot ? QMARK : QMARK_NO_DOT;
      let star = opts.bash === true ? globstar(opts) : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      if (typeof opts.noext === "boolean") {
        opts.noextglob = opts.noext;
      }
      const state = {
        input,
        index: -1,
        start: 0,
        dot: opts.dot === true,
        consumed: "",
        output: "",
        prefix: "",
        backtrack: false,
        negated: false,
        brackets: 0,
        braces: 0,
        parens: 0,
        quotes: 0,
        globstar: false,
        tokens
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = state.peek = (n = 1) => input[state.index + n];
      const advance = state.advance = () => input[++state.index] || "";
      const remaining = () => input.slice(state.index + 1);
      const consume = (value2 = "", num = 0) => {
        state.consumed += value2;
        state.index += num;
      };
      const append = (token) => {
        state.output += token.output != null ? token.output : token.value;
        consume(token.value);
      };
      const negate = () => {
        let count = 1;
        while (peek() === "!" && (peek(2) !== "(" || peek(3) === "?")) {
          advance();
          state.start++;
          count++;
        }
        if (count % 2 === 0) {
          return false;
        }
        state.negated = true;
        state.start++;
        return true;
      };
      const increment = (type) => {
        state[type]++;
        stack.push(type);
      };
      const decrement = (type) => {
        state[type]--;
        stack.pop();
      };
      const push = (tok) => {
        if (prev.type === "globstar") {
          const isBrace = state.braces > 0 && (tok.type === "comma" || tok.type === "brace");
          const isExtglob = tok.extglob === true || extglobs.length && (tok.type === "pipe" || tok.type === "paren");
          if (tok.type !== "slash" && tok.type !== "paren" && !isBrace && !isExtglob) {
            state.output = state.output.slice(0, -prev.output.length);
            prev.type = "star";
            prev.value = "*";
            prev.output = star;
            state.output += prev.output;
          }
        }
        if (extglobs.length && tok.type !== "paren") {
          extglobs[extglobs.length - 1].inner += tok.value;
        }
        if (tok.value || tok.output) append(tok);
        if (prev && prev.type === "text" && tok.type === "text") {
          prev.output = (prev.output || prev.value) + tok.value;
          prev.value += tok.value;
          return;
        }
        tok.prev = prev;
        tokens.push(tok);
        prev = tok;
      };
      const extglobOpen = (type, value2) => {
        const token = { ...EXTGLOB_CHARS[value2], conditions: 1, inner: "" };
        token.prev = prev;
        token.parens = state.parens;
        token.output = state.output;
        token.startIndex = state.index;
        token.tokensIndex = tokens.length;
        const output = (opts.capture ? "(" : "") + token.open;
        increment("parens");
        push({ type, value: value2, output: state.output ? "" : ONE_CHAR });
        push({ type: "paren", extglob: true, value: advance(), output });
        extglobs.push(token);
      };
      const extglobClose = (token) => {
        const literal = input.slice(token.startIndex, state.index + 1);
        const body = input.slice(token.startIndex + 2, state.index);
        const analysis = analyzeRepeatedExtglob(body, opts);
        if ((token.type === "plus" || token.type === "star") && analysis.risky) {
          const safeOutput = analysis.safeOutput ? (token.output ? "" : ONE_CHAR) + (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput) : void 0;
          const open2 = tokens[token.tokensIndex];
          open2.type = "text";
          open2.value = literal;
          open2.output = safeOutput || utils.escapeRegex(literal);
          for (let i = token.tokensIndex + 1; i < tokens.length; i++) {
            tokens[i].value = "";
            tokens[i].output = "";
            delete tokens[i].suffix;
          }
          state.output = token.output + open2.output;
          state.backtrack = true;
          push({ type: "paren", extglob: true, value, output: "" });
          decrement("parens");
          return;
        }
        let output = token.close + (opts.capture ? ")" : "");
        let rest;
        if (token.type === "negate") {
          let extglobStar = star;
          if (token.inner && token.inner.length > 1 && token.inner.includes("/")) {
            extglobStar = globstar(opts);
          }
          if (extglobStar !== star || eos() || /^\)+$/.test(remaining())) {
            output = token.close = `)$))${extglobStar}`;
          }
          if (token.inner.includes("*") && (rest = remaining()) && /^\.[^\\/.]+$/.test(rest)) {
            const expression = parse(rest, { ...options, fastpaths: false }).output;
            output = token.close = `)${expression})${extglobStar})`;
          }
          if (token.prev.type === "bos") {
            state.negatedExtglob = true;
          }
        }
        push({ type: "paren", extglob: true, value, output });
        decrement("parens");
      };
      if (opts.fastpaths !== false && !/(^[*!]|[/()[\]{}"])/.test(input)) {
        let backslashes = false;
        let output = input.replace(REGEX_SPECIAL_CHARS_BACKREF, (m, esc, chars, first, rest, index) => {
          if (first === "\\") {
            backslashes = true;
            return m;
          }
          if (first === "?") {
            if (esc) {
              return esc + first + (rest ? QMARK.repeat(rest.length) : "");
            }
            if (index === 0) {
              return qmarkNoDot + (rest ? QMARK.repeat(rest.length) : "");
            }
            return QMARK.repeat(chars.length);
          }
          if (first === ".") {
            return DOT_LITERAL.repeat(chars.length);
          }
          if (first === "*") {
            if (esc) {
              return esc + first + (rest ? star : "");
            }
            return star;
          }
          return esc ? m : `\\${m}`;
        });
        if (backslashes === true) {
          if (opts.unescape === true) {
            output = output.replace(/\\/g, "");
          } else {
            output = output.replace(/\\+/g, (m) => {
              return m.length % 2 === 0 ? "\\\\" : m ? "\\" : "";
            });
          }
        }
        if (output === input && opts.contains === true) {
          state.output = input;
          return state;
        }
        state.output = utils.wrapOutput(output, state, options);
        return state;
      }
      while (!eos()) {
        value = advance();
        if (value === "\0") {
          continue;
        }
        if (value === "\\") {
          const next = peek();
          if (next === "/" && opts.bash !== true) {
            continue;
          }
          if (next === "." || next === ";") {
            continue;
          }
          if (!next) {
            value += "\\";
            push({ type: "text", value });
            continue;
          }
          const match = /^\\+/.exec(remaining());
          let slashes = 0;
          if (match && match[0].length > 2) {
            slashes = match[0].length;
            state.index += slashes;
            if (slashes % 2 !== 0) {
              value += "\\";
            }
          }
          if (opts.unescape === true) {
            value = advance();
          } else {
            value += advance();
          }
          if (state.brackets === 0) {
            push({ type: "text", value });
            continue;
          }
        }
        if (state.brackets > 0 && (value !== "]" || prev.value === "[" || prev.value === "[^")) {
          if (opts.posix !== false && value === ":") {
            const inner = prev.value.slice(1);
            if (inner.includes("[")) {
              prev.posix = true;
              if (inner.includes(":")) {
                const idx = prev.value.lastIndexOf("[");
                const pre = prev.value.slice(0, idx);
                const rest2 = prev.value.slice(idx + 2);
                const posix = POSIX_REGEX_SOURCE[rest2];
                if (posix) {
                  prev.value = pre + posix;
                  state.backtrack = true;
                  advance();
                  if (!bos.output && tokens.indexOf(prev) === 1) {
                    bos.output = ONE_CHAR;
                  }
                  continue;
                }
              }
            }
          }
          if (value === "[" && peek() !== ":" || value === "-" && peek() === "]") {
            value = `\\${value}`;
          }
          if (value === "]" && (prev.value === "[" || prev.value === "[^")) {
            value = `\\${value}`;
          }
          if (opts.posix === true && value === "!" && prev.value === "[") {
            value = "^";
          }
          prev.value += value;
          append({ value });
          continue;
        }
        if (state.quotes === 1 && value !== '"') {
          value = utils.escapeRegex(value);
          prev.value += value;
          append({ value });
          continue;
        }
        if (value === '"') {
          state.quotes = state.quotes === 1 ? 0 : 1;
          if (opts.keepQuotes === true) {
            push({ type: "text", value });
          }
          continue;
        }
        if (value === "(") {
          increment("parens");
          push({ type: "paren", value });
          continue;
        }
        if (value === ")") {
          if (state.parens === 0 && opts.strictBrackets === true) {
            throw new SyntaxError(syntaxError("opening", "("));
          }
          const extglob = extglobs[extglobs.length - 1];
          if (extglob && state.parens === extglob.parens + 1) {
            extglobClose(extglobs.pop());
            continue;
          }
          push({ type: "paren", value, output: state.parens ? ")" : "\\)" });
          decrement("parens");
          continue;
        }
        if (value === "[") {
          if (opts.nobracket === true || !remaining().includes("]")) {
            if (opts.nobracket !== true && opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("closing", "]"));
            }
            value = `\\${value}`;
          } else {
            increment("brackets");
          }
          push({ type: "bracket", value });
          continue;
        }
        if (value === "]") {
          if (opts.nobracket === true || prev && prev.type === "bracket" && prev.value.length === 1) {
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          if (state.brackets === 0) {
            if (opts.strictBrackets === true) {
              throw new SyntaxError(syntaxError("opening", "["));
            }
            push({ type: "text", value, output: `\\${value}` });
            continue;
          }
          decrement("brackets");
          const prevValue = prev.value.slice(1);
          if (prev.posix !== true && prevValue[0] === "^" && !prevValue.includes("/")) {
            value = `/${value}`;
          }
          prev.value += value;
          append({ value });
          if (opts.literalBrackets === false || utils.hasRegexChars(prevValue)) {
            continue;
          }
          const escaped = utils.escapeRegex(prev.value);
          state.output = state.output.slice(0, -prev.value.length);
          if (opts.literalBrackets === true) {
            state.output += escaped;
            prev.value = escaped;
            continue;
          }
          prev.value = `(${capture}${escaped}|${prev.value})`;
          state.output += prev.value;
          continue;
        }
        if (value === "{" && opts.nobrace !== true) {
          increment("braces");
          const open2 = {
            type: "brace",
            value,
            output: "(",
            outputIndex: state.output.length,
            tokensIndex: state.tokens.length
          };
          braces.push(open2);
          push(open2);
          continue;
        }
        if (value === "}") {
          const brace = braces[braces.length - 1];
          if (opts.nobrace === true || !brace) {
            push({ type: "text", value, output: value });
            continue;
          }
          let output = ")";
          if (brace.dots === true) {
            const arr = tokens.slice();
            const range = [];
            for (let i = arr.length - 1; i >= 0; i--) {
              tokens.pop();
              if (arr[i].type === "brace") {
                break;
              }
              if (arr[i].type !== "dots") {
                range.unshift(arr[i].value);
              }
            }
            output = expandRange(range, opts);
            state.backtrack = true;
          }
          if (brace.comma !== true && brace.dots !== true) {
            const out = state.output.slice(0, brace.outputIndex);
            const toks = state.tokens.slice(brace.tokensIndex);
            brace.value = brace.output = "\\{";
            value = output = "\\}";
            state.output = out;
            for (const t of toks) {
              state.output += t.output || t.value;
            }
          }
          push({ type: "brace", value, output });
          decrement("braces");
          braces.pop();
          continue;
        }
        if (value === "|") {
          if (extglobs.length > 0) {
            extglobs[extglobs.length - 1].conditions++;
          }
          push({ type: "text", value });
          continue;
        }
        if (value === ",") {
          let output = value;
          const brace = braces[braces.length - 1];
          if (brace && stack[stack.length - 1] === "braces") {
            brace.comma = true;
            output = "|";
          }
          push({ type: "comma", value, output });
          continue;
        }
        if (value === "/") {
          if (prev.type === "dot" && state.index === state.start + 1) {
            state.start = state.index + 1;
            state.consumed = "";
            state.output = "";
            tokens.pop();
            prev = bos;
            continue;
          }
          push({ type: "slash", value, output: SLASH_LITERAL });
          continue;
        }
        if (value === ".") {
          if (state.braces > 0 && prev.type === "dot") {
            if (prev.value === ".") prev.output = DOT_LITERAL;
            const brace = braces[braces.length - 1];
            prev.type = "dots";
            prev.output += value;
            prev.value += value;
            brace.dots = true;
            continue;
          }
          if (state.braces + state.parens === 0 && prev.type !== "bos" && prev.type !== "slash") {
            push({ type: "text", value, output: DOT_LITERAL });
            continue;
          }
          push({ type: "dot", value, output: DOT_LITERAL });
          continue;
        }
        if (value === "?") {
          const isGroup = prev && prev.value === "(";
          if (!isGroup && opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("qmark", value);
            continue;
          }
          if (prev && prev.type === "paren") {
            const next = peek();
            let output = value;
            if (prev.value === "(" && !/[!=<:]/.test(next) || next === "<" && !/<([!=]|\w+>)/.test(remaining())) {
              output = `\\${value}`;
            }
            push({ type: "text", value, output });
            continue;
          }
          if (opts.dot !== true && (prev.type === "slash" || prev.type === "bos")) {
            push({ type: "qmark", value, output: QMARK_NO_DOT });
            continue;
          }
          push({ type: "qmark", value, output: QMARK });
          continue;
        }
        if (value === "!") {
          if (opts.noextglob !== true && peek() === "(") {
            if (peek(2) !== "?" || !/[!=<:]/.test(peek(3))) {
              extglobOpen("negate", value);
              continue;
            }
          }
          if (opts.nonegate !== true && state.index === 0) {
            negate();
            continue;
          }
        }
        if (value === "+") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            extglobOpen("plus", value);
            continue;
          }
          if (prev && prev.value === "(" || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace") || state.parens > 0) {
            push({ type: "plus", value });
            continue;
          }
          push({ type: "plus", value: PLUS_LITERAL });
          continue;
        }
        if (value === "@") {
          if (opts.noextglob !== true && peek() === "(" && peek(2) !== "?") {
            push({ type: "at", extglob: true, value, output: "" });
            continue;
          }
          push({ type: "text", value });
          continue;
        }
        if (value !== "*") {
          if (value === "$" || value === "^") {
            value = `\\${value}`;
          }
          const match = REGEX_NON_SPECIAL_CHARS.exec(remaining());
          if (match) {
            value += match[0];
            state.index += match[0].length;
          }
          push({ type: "text", value });
          continue;
        }
        if (prev && (prev.type === "globstar" || prev.star === true)) {
          prev.type = "star";
          prev.star = true;
          prev.value += value;
          prev.output = star;
          state.backtrack = true;
          state.globstar = true;
          consume(value);
          continue;
        }
        let rest = remaining();
        if (opts.noextglob !== true && /^\([^?]/.test(rest)) {
          extglobOpen("star", value);
          continue;
        }
        if (prev.type === "star") {
          if (opts.noglobstar === true) {
            consume(value);
            continue;
          }
          const prior = prev.prev;
          const before = prior.prev;
          const isStart = prior.type === "slash" || prior.type === "bos";
          const afterStar = before && (before.type === "star" || before.type === "globstar");
          if (opts.bash === true && (!isStart || rest[0] && rest[0] !== "/")) {
            push({ type: "star", value, output: "" });
            continue;
          }
          const isBrace = state.braces > 0 && (prior.type === "comma" || prior.type === "brace");
          const isExtglob = extglobs.length && (prior.type === "pipe" || prior.type === "paren");
          if (!isStart && prior.type !== "paren" && !isBrace && !isExtglob) {
            push({ type: "star", value, output: "" });
            continue;
          }
          while (rest.slice(0, 3) === "/**") {
            const after = input[state.index + 4];
            if (after && after !== "/") {
              break;
            }
            rest = rest.slice(3);
            consume("/**", 3);
          }
          if (prior.type === "bos" && eos()) {
            prev.type = "globstar";
            prev.value += value;
            prev.output = globstar(opts);
            state.output = prev.output;
            state.globstar = true;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && !afterStar && eos()) {
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = globstar(opts) + (opts.strictSlashes ? ")" : "|$)");
            prev.value += value;
            state.globstar = true;
            state.output += prior.output + prev.output;
            consume(value);
            continue;
          }
          if (prior.type === "slash" && prior.prev.type !== "bos" && rest[0] === "/") {
            const end = rest[1] !== void 0 ? "|$" : "";
            state.output = state.output.slice(0, -(prior.output + prev.output).length);
            prior.output = `(?:${prior.output}`;
            prev.type = "globstar";
            prev.output = `${globstar(opts)}${SLASH_LITERAL}|${SLASH_LITERAL}${end})`;
            prev.value += value;
            state.output += prior.output + prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          if (prior.type === "bos" && rest[0] === "/") {
            prev.type = "globstar";
            prev.value += value;
            prev.output = `(?:^|${SLASH_LITERAL}|${globstar(opts)}${SLASH_LITERAL})`;
            state.output = prev.output;
            state.globstar = true;
            consume(value + advance());
            push({ type: "slash", value: "/", output: "" });
            continue;
          }
          state.output = state.output.slice(0, -prev.output.length);
          prev.type = "globstar";
          prev.output = globstar(opts);
          prev.value += value;
          state.output += prev.output;
          state.globstar = true;
          consume(value);
          continue;
        }
        const token = { type: "star", value, output: star };
        if (opts.bash === true) {
          token.output = ".*?";
          if (prev.type === "bos" || prev.type === "slash") {
            token.output = nodot + token.output;
          }
          push(token);
          continue;
        }
        if (prev && (prev.type === "bracket" || prev.type === "paren") && opts.regex === true) {
          token.output = value;
          push(token);
          continue;
        }
        if (state.index === state.start || prev.type === "slash" || prev.type === "dot") {
          if (prev.type === "dot") {
            state.output += NO_DOT_SLASH;
            prev.output += NO_DOT_SLASH;
          } else if (opts.dot === true) {
            state.output += NO_DOTS_SLASH;
            prev.output += NO_DOTS_SLASH;
          } else {
            state.output += nodot;
            prev.output += nodot;
          }
          if (peek() !== "*") {
            state.output += ONE_CHAR;
            prev.output += ONE_CHAR;
          }
        }
        push(token);
      }
      while (state.brackets > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "]"));
        state.output = utils.escapeLast(state.output, "[");
        decrement("brackets");
      }
      while (state.parens > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", ")"));
        state.output = utils.escapeLast(state.output, "(");
        decrement("parens");
      }
      while (state.braces > 0) {
        if (opts.strictBrackets === true) throw new SyntaxError(syntaxError("closing", "}"));
        state.output = utils.escapeLast(state.output, "{");
        decrement("braces");
      }
      if (opts.strictSlashes !== true && (prev.type === "star" || prev.type === "bracket")) {
        push({ type: "maybe_slash", value: "", output: `${SLASH_LITERAL}?` });
      }
      if (state.backtrack === true) {
        state.output = "";
        for (const token of state.tokens) {
          state.output += token.output != null ? token.output : token.value;
          if (token.suffix) {
            state.output += token.suffix;
          }
        }
      }
      return state;
    };
    parse.fastpaths = (input, options) => {
      const opts = { ...options };
      const max = typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
      const len = input.length;
      if (len > max) {
        throw new SyntaxError(`Input length: ${len}, exceeds maximum allowed length: ${max}`);
      }
      input = REPLACEMENTS[input] || input;
      const {
        DOT_LITERAL,
        SLASH_LITERAL,
        ONE_CHAR,
        DOTS_SLASH,
        NO_DOT,
        NO_DOTS,
        NO_DOTS_SLASH,
        STAR,
        START_ANCHOR
      } = constants.globChars(opts.windows);
      const nodot = opts.dot ? NO_DOTS : NO_DOT;
      const slashDot = opts.dot ? NO_DOTS_SLASH : NO_DOT;
      const capture = opts.capture ? "" : "?:";
      const state = { negated: false, prefix: "" };
      let star = opts.bash === true ? ".*?" : STAR;
      if (opts.capture) {
        star = `(${star})`;
      }
      const globstar = (opts2) => {
        if (opts2.noglobstar === true) return star;
        return `(${capture}(?:(?!${START_ANCHOR}${opts2.dot ? DOTS_SLASH : DOT_LITERAL}).)*?)`;
      };
      const create = (str) => {
        switch (str) {
          case "*":
            return `${nodot}${ONE_CHAR}${star}`;
          case ".*":
            return `${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*.*":
            return `${nodot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "*/*":
            return `${nodot}${star}${SLASH_LITERAL}${ONE_CHAR}${slashDot}${star}`;
          case "**":
            return nodot + globstar(opts);
          case "**/*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${ONE_CHAR}${star}`;
          case "**/*.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${slashDot}${star}${DOT_LITERAL}${ONE_CHAR}${star}`;
          case "**/.*":
            return `(?:${nodot}${globstar(opts)}${SLASH_LITERAL})?${DOT_LITERAL}${ONE_CHAR}${star}`;
          default: {
            const match = /^(.*?)\.(\w+)$/.exec(str);
            if (!match) return;
            const source2 = create(match[1]);
            if (!source2) return;
            return source2 + DOT_LITERAL + match[2];
          }
        }
      };
      const output = utils.removePrefix(input, state);
      let source = create(output);
      if (source && opts.strictSlashes !== true) {
        source += `${SLASH_LITERAL}?`;
      }
      return source;
    };
    module.exports = parse;
  }
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/picomatch.js"(exports, module) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch3 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch3(input, options, returnState));
        const arrayMatcher = (str) => {
          for (const isMatch of fns) {
            const state2 = isMatch(str);
            if (state2) return state2;
          }
          return false;
        };
        return arrayMatcher;
      }
      const isState = isObject(glob) && glob.tokens && glob.input;
      if (glob === "" || typeof glob !== "string" && !isState) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState ? picomatch3.compileRe(glob, options) : picomatch3.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch3(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch3.test(input, regex, options, { glob, posix });
        const result = { glob, state, regex, posix, input, output, match, isMatch };
        if (typeof opts.onResult === "function") {
          opts.onResult(result);
        }
        if (isMatch === false) {
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (isIgnored(input)) {
          if (typeof opts.onIgnore === "function") {
            opts.onIgnore(result);
          }
          result.isMatch = false;
          return returnObject ? result : false;
        }
        if (typeof opts.onMatch === "function") {
          opts.onMatch(result);
        }
        return returnObject ? result : true;
      };
      if (returnState) {
        matcher.state = state;
      }
      return matcher;
    };
    picomatch3.test = (input, regex, options, { glob, posix } = {}) => {
      if (typeof input !== "string") {
        throw new TypeError("Expected input to be a string");
      }
      if (input === "") {
        return { isMatch: false, output: "" };
      }
      const opts = options || {};
      const format = opts.format || (posix ? utils.toPosixSlashes : null);
      let match = input === glob;
      let output = match && format ? format(input) : input;
      if (match === false) {
        output = format ? format(input) : input;
        match = output === glob;
      }
      if (match === false || opts.capture === true) {
        if (opts.matchBase === true || opts.basename === true) {
          match = picomatch3.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch3.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch3.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch3.isMatch = (str, patterns, options) => picomatch3(patterns, options)(str);
    picomatch3.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch3.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch3.scan = (input, options) => scan(input, options);
    picomatch3.compileRe = (state, options, returnOutput = false, returnState = false) => {
      if (returnOutput === true) {
        return state.output;
      }
      const opts = options || {};
      const prepend = opts.contains ? "" : "^";
      const append = opts.contains ? "" : "$";
      let source = `${prepend}(?:${state.output})${append}`;
      if (state && state.negated === true) {
        source = `^(?!${source}).*$`;
      }
      const regex = picomatch3.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch3.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
      if (!input || typeof input !== "string") {
        throw new TypeError("Expected a non-empty string");
      }
      let parsed = { negated: false, fastpaths: true };
      if (options.fastpaths !== false && (input[0] === "." || input[0] === "*")) {
        parsed.output = parse.fastpaths(input, options);
      }
      if (!parsed.output) {
        parsed = parse(input, options);
      }
      return picomatch3.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch3.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch3.constants = constants;
    module.exports = picomatch3;
  }
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/index.js"(exports, module) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch3(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch3, pico);
    module.exports = picomatch3;
  }
});

// lib/fff-router/fff-mcp-installer.ts
import { existsSync } from "node:fs";
import { chmod, mkdir, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
function defaultInstallDir(env) {
  return env.FFF_MCP_INSTALL_DIR || path.join(env.HOME || os.homedir(), ".local", "bin");
}
function detectFffMcpTarget(platform = process.platform, arch = process.arch) {
  switch (platform) {
    case "linux":
      switch (arch) {
        case "x64":
          return "x86_64-unknown-linux-musl";
        case "arm64":
          return "aarch64-unknown-linux-musl";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "darwin":
      switch (arch) {
        case "x64":
          return "x86_64-apple-darwin";
        case "arm64":
          return "aarch64-apple-darwin";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    case "win32":
      switch (arch) {
        case "x64":
          return "x86_64-pc-windows-msvc";
        case "arm64":
          return "aarch64-pc-windows-msvc";
        default:
          throw new Error(`Unsupported architecture: ${arch}`);
      }
    default:
      throw new Error(`Unsupported OS: ${platform}`);
  }
}
function findFffMcpOnPath(env = process.env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const names = process.platform === "win32" ? ["fff-mcp.exe", "fff-mcp.cmd", "fff-mcp"] : ["fff-mcp"];
  for (const directory of directories) {
    for (const name of names) {
      const candidate = path.join(directory, name);
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}
async function getDoctorFffMcpStatus(env = process.env) {
  const foundPath = findFffMcpOnPath(env);
  if (!foundPath) {
    return { found: false };
  }
  return { found: true, path: foundPath };
}
function releaseFilename(target) {
  const extension = target.includes("windows") ? ".exe" : "";
  return `fff-mcp-${target}${extension}`;
}
async function installFffMcpBinary(args = {}) {
  const env = args.env ?? process.env;
  const target = args.target ?? detectFffMcpTarget();
  const getLatestTag = args.getLatestTag ?? (async () => {
    throw new Error("getLatestTag not implemented");
  });
  const downloadToFile2 = args.downloadToFile ?? (async () => {
    throw new Error("downloadToFile not implemented");
  });
  const tag = await getLatestTag(target);
  const installDir = defaultInstallDir(env);
  const filename = releaseFilename(target);
  const binaryName = target.includes("windows") ? "fff-mcp.exe" : "fff-mcp";
  const tempPath = path.join(installDir, `${binaryName}.download`);
  const finalPath = path.join(installDir, binaryName);
  const url = `https://github.com/dmtrKovalenko/fff.nvim/releases/download/${tag}/${filename}`;
  await mkdir(installDir, { recursive: true });
  await downloadToFile2(url, tempPath);
  await chmod(tempPath, 493);
  await rename(tempPath, finalPath);
  await writeFile(
    path.join(installDir, ".fff-mcp-install.json"),
    `${JSON.stringify({ tag, target, installedAt: Date.now() }, null, 2)}
`
  );
  return finalPath;
}

// lib/fff-router/agent-mcp.ts
import path14 from "node:path";
import { stdin as processStdin } from "node:process";
import * as z2 from "zod/v4";
import { McpServer as McpServer2 } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport as StdioServerTransport3 } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync as existsSync3 } from "node:fs";
import { mkdir as mkdir3, open, readFile as readFile2, rm as rm2 } from "node:fs/promises";
import path13 from "node:path";

// lib/fff-router/daemon-config.ts
import { createHash } from "node:crypto";
import { existsSync as existsSync2, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os2 from "node:os";
import path3 from "node:path";

// lib/fff-router/backend-config.ts
function parseBackend(raw) {
  const value = raw?.trim() || "fff-node";
  switch (value) {
    case "fff-node":
    case "fff-mcp":
    case "rg":
      return value;
    default:
      throw new Error(`Invalid backend '${value}'. Expected one of: fff-node, fff-mcp, rg`);
  }
}
function getDefaultFallbackBackend(primaryBackendId) {
  switch (primaryBackendId) {
    case "fff-node":
    case "fff-mcp":
      return "rg";
    case "rg":
      return null;
  }
}

// lib/fff-router/home-path.ts
import path2 from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function joinHome(home, suffix) {
  return suffix ? path2.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path2.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path2.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path2.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("${HOME}/".length)) };
  }
  return { ok: true, value: trimmed };
}

// lib/fff-router/daemon-config.ts
var DEFAULT_DAEMON_HOST = "127.0.0.1";
var DAEMON_PROTOCOL_VERSION = "fff-router-http-daemon-v1";
var DEFAULT_DAEMON_PORT = 4319;
var DEFAULT_DAEMON_MCP_PATH = "/mcp";
var DEFAULT_BACKEND = "fff-node";
function packageVersion() {
  const candidatePaths = [
    path3.resolve(import.meta.dirname, "../../package.json"),
    path3.resolve(import.meta.dirname, "../../../package.json")
  ];
  for (const candidatePath of candidatePaths) {
    if (!existsSync2(candidatePath)) {
      continue;
    }
    const parsed = JSON.parse(readFileSync(candidatePath, "utf8"));
    if (typeof parsed.version === "string" && parsed.version.length > 0) {
      return parsed.version;
    }
  }
  throw new Error("Unable to determine fff-router package version");
}
var PACKAGE_VERSION = packageVersion();
function hashFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}
function configHome(env) {
  return env.HOME || os2.homedir();
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path3.join(configHome(env), ".local", "state");
}
function mcpSocketPathForStateDir(dir) {
  const id = hashFingerprint({ dir });
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\fff-routerd-${id}`;
  }
  return path3.join("/tmp", `fff-routerd-${id}.sock`);
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    promotion: {
      windowMs: 10 * 60 * 1e3,
      requiredHits: 2
    },
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3
    },
    limits: {
      maxPersistentDaemons: 12,
      maxPersistentNonGitDaemons: 4
    }
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    backend: {
      primaryBackendId: DEFAULT_BACKEND,
      fallbackBackendId: getDefaultFallbackBackend(DEFAULT_BACKEND)
    },
    router: getDefaultRouterConfig()
  };
}
function getDefaultDaemonFileConfig() {
  const daemon = getDefaultDaemonConfig();
  const reload = getDefaultDaemonReloadConfig();
  return {
    host: daemon.host,
    port: daemon.port,
    mcpPath: daemon.mcpPath,
    backend: reload.backend.primaryBackendId,
    allowlist: [],
    promotion: { ...reload.router.promotion },
    ttl: { ...reload.router.ttl },
    limits: { ...reload.router.limits }
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path3.join(configHome(env), ".config", "fff-routerd");
  return {
    dir,
    jsonPath: path3.join(dir, "config.json"),
    jsoncPath: path3.join(dir, "config.jsonc")
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync2(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync(paths.jsonPath, "utf8")
    };
  }
  if (existsSync2(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync(paths.jsoncPath, "utf8")
    };
  }
  return ensureDefaultConfigFile(paths);
}
function expectObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return value;
}
function readOptionalNumber(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}
function readOptionalNonNegativeInteger(value, label) {
  const parsed = readOptionalNumber(value, label);
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return parsed;
}
function readOptionalPort(value) {
  const parsed = readOptionalNumber(value, "port");
  if (parsed == null) {
    return void 0;
  }
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("port must be an integer between 1 and 65535");
  }
  return parsed;
}
function readOptionalMcpPath(value) {
  const parsed = readOptionalString(value, "mcpPath");
  if (parsed == null) {
    return void 0;
  }
  if (!parsed.startsWith("/")) {
    throw new Error("mcpPath must start with '/'");
  }
  if (parsed.includes("?") || parsed.includes("#")) {
    throw new Error("mcpPath must be a pathname without query or hash");
  }
  if (parsed === "/health") {
    throw new Error("mcpPath '/health' is reserved");
  }
  return parsed;
}
function readOptionalString(value, label) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  return value;
}
function readOptionalStringArray(value, label) {
  if (value == null) {
    return void 0;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value;
}
function readOptionalBackend(value) {
  if (value == null) {
    return void 0;
  }
  if (typeof value !== "string") {
    throw new Error("backend must be a string");
  }
  return parseBackend(value);
}
function expandAllowlistEntries(entries, env) {
  return entries.map((prefix) => expandHomePath(prefix, env)).map((result) => {
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    return result.value;
  }).filter(Boolean).map((prefix) => ({ prefix, mode: "first-child-root" }));
}
function parseJsonWithComments(text) {
  let withoutComments = "";
  let index = 0;
  let inString = false;
  let stringQuote = '"';
  let escaped = false;
  while (index < text.length) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (inString) {
      withoutComments += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      withoutComments += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      index += 2;
      while (index < text.length && text[index] !== "\n") {
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      index += 2;
      while (index < text.length) {
        if (text[index] === "*" && text[index + 1] === "/") {
          index += 2;
          break;
        }
        index += 1;
      }
      continue;
    }
    withoutComments += current;
    index += 1;
  }
  let normalized = "";
  index = 0;
  inString = false;
  escaped = false;
  while (index < withoutComments.length) {
    const current = withoutComments[index] ?? "";
    if (inString) {
      normalized += current;
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === stringQuote) {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      inString = true;
      stringQuote = current;
      normalized += current;
      index += 1;
      continue;
    }
    if (current === ",") {
      let lookahead = index + 1;
      while (lookahead < withoutComments.length && /\s/.test(withoutComments[lookahead] ?? "")) {
        lookahead += 1;
      }
      const nextNonWhitespace = withoutComments[lookahead] ?? "";
      if (nextNonWhitespace === "}" || nextNonWhitespace === "]") {
        index += 1;
        continue;
      }
    }
    normalized += current;
    index += 1;
  }
  return JSON.parse(normalized);
}
function normalizeDaemonFileConfig(raw, env) {
  const defaults = getDefaultDaemonFileConfig();
  const fileConfig = expectObject(raw, "fff-routerd config");
  const promotion = fileConfig.promotion == null ? null : expectObject(fileConfig.promotion, "promotion");
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const normalizedEnv = { ...env, HOME: configHome(env) };
  const backendId = readOptionalBackend(fileConfig.backend) ?? defaults.backend;
  const allowlist = readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const host = readOptionalString(fileConfig.host, "host") ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const promotionWindowMs = readOptionalNonNegativeInteger(promotion?.windowMs, "promotion.windowMs") ?? defaults.promotion.windowMs;
  const promotionRequiredHits = readOptionalNonNegativeInteger(promotion?.requiredHits, "promotion.requiredHits") ?? defaults.promotion.requiredHits;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs = readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxPersistentDaemons = readOptionalNonNegativeInteger(limits?.maxPersistentDaemons, "limits.maxPersistentDaemons") ?? defaults.limits.maxPersistentDaemons;
  const maxPersistentNonGitDaemons = readOptionalNonNegativeInteger(
    limits?.maxPersistentNonGitDaemons,
    "limits.maxPersistentNonGitDaemons"
  ) ?? defaults.limits.maxPersistentNonGitDaemons;
  return {
    daemon: {
      host,
      port,
      mcpPath
    },
    reload: {
      backend: {
        primaryBackendId: backendId,
        fallbackBackendId: getDefaultFallbackBackend(backendId)
      },
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        promotion: {
          windowMs: promotionWindowMs,
          requiredHits: promotionRequiredHits
        },
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs
        },
        limits: {
          maxPersistentDaemons,
          maxPersistentNonGitDaemons
        }
      }
    }
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync2(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8"));
    if (typeof metadata.host !== "string" || typeof metadata.port !== "number" || typeof metadata.mcpPath !== "string") {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath
    };
  } catch {
    return null;
  }
}
function loadNormalizedDaemonFileConfig(args = {}) {
  const env = args.env ?? process.env;
  const configFile = readPreferredDaemonPolicyFile({ env });
  return normalizeDaemonFileConfig(parseJsonWithComments(configFile.text), env);
}
function getDaemonConfig(args = {}) {
  try {
    return loadNormalizedDaemonFileConfig(args).daemon;
  } catch (error) {
    const fallback = readDaemonConfigFromMetadata(args);
    if (fallback) {
      return fallback;
    }
    throw error;
  }
}
function formatDaemonUrlHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
function getDaemonOriginFromConfig(config) {
  return `http://${formatDaemonUrlHost(config.host)}:${config.port}`;
}
function getDaemonEndpoint(args = {}) {
  const config = getDaemonConfig(args);
  return `${getDaemonOriginFromConfig(config)}${config.mcpPath}`;
}
function loadDaemonReloadConfig(args = {}) {
  return loadNormalizedDaemonFileConfig(args).reload;
}
function getDaemonServerFingerprint(args = {}) {
  const daemon = getDaemonConfig({ env: args.env });
  const paths = getDaemonPaths({ env: args.env });
  return hashFingerprint({
    daemon: {
      ...daemon,
      ...args.daemonConfig
    },
    mcpSocketPath: paths.mcpSocketPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION
  });
}
function getDaemonReloadFingerprintForConfig(config) {
  return hashFingerprint(config);
}
function getDaemonReloadFingerprint(args = {}) {
  return getDaemonReloadFingerprintForConfig(loadDaemonReloadConfig(args));
}
function getDaemonPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path3.join(stateHome(env), "fff-routerd");
  return {
    dir,
    metadataPath: path3.join(dir, "daemon.json"),
    lockPath: path3.join(dir, "startup.lock"),
    mcpSocketPath: mcpSocketPathForStateDir(dir)
  };
}

// lib/fff-router/http-daemon.ts
import { watch } from "node:fs";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { mkdir as mkdir2, readFile, rm, writeFile as writeFile2 } from "node:fs/promises";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import path5 from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/adapters/common.ts
var import_picomatch = __toESM(require_picomatch2(), 1);
import path4 from "node:path";
function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}
function matchesSingleEntry(entry, candidatePath) {
  if (entry.fileRestriction) {
    return candidatePath === entry.fileRestriction;
  }
  return candidatePath === entry.within || candidatePath.startsWith(entry.within + path4.sep);
}
function pathWithinScope(request, candidatePath) {
  if (matchesSingleEntry(
    {
      within: request.within,
      ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
    },
    candidatePath
  )) {
    return true;
  }
  for (const entry of request.additionalWithinEntries ?? []) {
    if (matchesSingleEntry(
      {
        within: entry.resolvedWithin,
        ...entry.fileRestriction !== void 0 ? { fileRestriction: entry.fileRestriction } : {}
      },
      candidatePath
    )) {
      return true;
    }
  }
  return false;
}
function matchesExtension(extensions, relativePath) {
  if (extensions.length === 0) {
    return true;
  }
  return extensions.some(
    (extension) => normalizeRelativePath(relativePath).endsWith(`.${extension}`)
  );
}
function matchesGlob(glob, relativePath) {
  if (!glob) {
    return true;
  }
  return (0, import_picomatch.default)(glob, {
    dot: true,
    basename: !glob.includes("/")
  })(normalizeRelativePath(relativePath));
}
function matchesExcludePaths(excludePaths, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return !excludePaths.some((excludePath) => {
    return normalized === excludePath || normalized.startsWith(`${excludePath}/`);
  });
}
function filterItems(request, items) {
  return items.filter((item) => pathWithinScope(request, item.path)).filter((item) => matchesGlob(request.glob, item.relativePath)).filter((item) => matchesExtension(request.extensions, item.relativePath)).filter((item) => matchesExcludePaths(request.excludePaths, item.relativePath)).slice(0, request.limit);
}
function toRelativePath(persistenceRoot, absolutePath) {
  return normalizeRelativePath(path4.relative(persistenceRoot, absolutePath));
}

// lib/fff-router/adapters/fff-mcp-stdio.ts
function backendUnavailable(message) {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "fff-mcp",
      message
    }
  };
}
function searchFailed(message) {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-mcp",
      message
    }
  };
}
function discoverFffMcpCommand() {
  return process.env.FFF_ROUTER_FFF_MCP_BIN || "fff-mcp";
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function inheritedStringEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry) => typeof entry[1] === "string"
    )
  );
}
function normalizeRelative(relativePath) {
  return relativePath.replace(/\\/g, "/").replace(/^\.\//, "");
}
function formatExcludeConstraint(excludePath) {
  return excludePath.includes(".") || excludePath.endsWith("/") ? `!${excludePath}` : `!${excludePath}/`;
}
function encodeWithinEntryToken(entry, persistenceRoot) {
  if (entry.fileRestriction) {
    const relativeFile = normalizeRelative(path5.relative(persistenceRoot, entry.fileRestriction));
    if (!relativeFile || relativeFile === ".") {
      return null;
    }
    return `**/${relativeFile}`;
  }
  const baseRelative = normalizeRelative(path5.relative(persistenceRoot, entry.basePath));
  if (!baseRelative || baseRelative === ".") {
    return null;
  }
  const withoutTrailingSlash = baseRelative.replace(/\/+$/, "");
  return `${withoutTrailingSlash}/**`;
}
function compileMultiWithinConstraint(entries, persistenceRoot) {
  const tokens = [];
  for (const entry of entries) {
    const token = encodeWithinEntryToken(entry, persistenceRoot);
    if (token !== null) {
      tokens.push(token);
    }
  }
  if (tokens.length === 0) {
    return null;
  }
  if (tokens.length === 1) {
    return tokens[0] ?? null;
  }
  return `{${tokens.join(",")}}`;
}
function buildConstraintTokens(request) {
  const tokens = [];
  const additional = request.additionalWithinEntries ?? [];
  if (additional.length > 0) {
    const multi = compileMultiWithinConstraint(
      [
        {
          basePath: request.basePath,
          ...request.fileRestriction !== void 0 ? { fileRestriction: request.fileRestriction } : {}
        },
        ...additional
      ],
      request.persistenceRoot
    );
    if (multi !== null) {
      tokens.push(multi);
    }
  } else if (request.fileRestriction) {
    const relativeFile = normalizeRelative(
      path5.relative(request.persistenceRoot, request.fileRestriction)
    );
    if (relativeFile && relativeFile !== ".") {
      tokens.push(`**/${relativeFile}`);
    }
  } else {
    const baseRelative = normalizeRelative(
      path5.relative(request.persistenceRoot, request.basePath)
    );
    if (baseRelative && baseRelative !== ".") {
      tokens.push(baseRelative.endsWith("/") ? baseRelative : `${baseRelative}/`);
    }
  }
  if (request.glob) {
    tokens.push(request.glob);
  }
  for (const extension of request.extensions) {
    tokens.push(`*.${extension}`);
  }
  for (const excludePath of request.excludePaths) {
    tokens.push(formatExcludeConstraint(excludePath));
  }
  return tokens;
}
function compileFindFilesQuery(request) {
  return [request.query, ...buildConstraintTokens(request)].filter(Boolean).join(" ");
}
function compileConstraints(request) {
  return buildConstraintTokens(request).join(" ");
}
function compileGrepQuery(request) {
  const encodedPatterns = request.patterns.map(encodeFffMcpGrepPattern);
  const combinedPattern = encodedPatterns.length === 1 ? encodedPatterns[0] ?? "" : encodedPatterns.map((pattern) => `(?:${pattern})`).join("|");
  return [...buildConstraintTokens(request), combinedPattern].filter(Boolean).join(" ");
}
function encodeFffMcpGrepPattern(pattern) {
  return pattern.replace(/[ \t]/g, "\\s");
}
function stripFindFilesSuffix(line) {
  return line.replace(/\s+-\s+(hot|warm|frequent)(\s+git:[^\s]+)?$/, "").replace(/\s+git:[^\s]+$/, "").trim();
}
function parseFindFilesOutput(text, persistenceRoot) {
  const items = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("\u2192") || line.startsWith("cursor:") || /^\d+\/\d+\s+matches/.test(line) || /^0\s+results/.test(line)) {
      continue;
    }
    const relativePath = stripFindFilesSuffix(line);
    if (!relativePath) {
      continue;
    }
    items.push({
      path: path5.join(persistenceRoot, relativePath),
      relativePath
    });
  }
  return items;
}
function parseReadRecommendation(line) {
  const match = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
  if (!match) {
    return void 0;
  }
  const relativePath = match[1];
  const reason = match[2];
  if (!relativePath) {
    return void 0;
  }
  return {
    relativePath: normalizeRelative(relativePath.trim().replace(/\s+\[def\]$/, "")),
    ...reason ? { reason: reason.trim() } : {}
  };
}
function parseShownSummary(line) {
  const match = line.match(/^(\d+)\/(\d+)\s+matches\s+shown$/);
  if (!match) {
    return {};
  }
  return {
    shownCount: Number(match[1]),
    totalCount: Number(match[2])
  };
}
function filterRenderedCompactText(text, keep) {
  const out = [];
  let currentAccepted = true;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    const readMatch = line.match(/^→\s+Read\s+(.+?)(?:\s+\((.+)\))?$/);
    if (readMatch) {
      const recPath = normalizeRelative((readMatch[1] ?? "").replace(/\s+\[def\]$/, "").trim());
      if (keep(recPath)) {
        out.push(rawLine);
      }
      continue;
    }
    if (!line || line.startsWith("cursor:") || /^\d+\/\d+\s+matches\s+shown$/.test(line) || /^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      out.push(rawLine);
      continue;
    }
    if (line === "--" || /^\s+\d+[:\-|]/.test(line)) {
      if (currentAccepted) {
        out.push(rawLine);
      }
      continue;
    }
    const headerPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentAccepted = keep(headerPath);
    if (currentAccepted) {
      out.push(rawLine);
    }
  }
  return out.join("\n");
}
function parseTextMatchOutput(text, persistenceRoot) {
  const items = [];
  const summary = {};
  let currentPath = null;
  let currentPathIsDefinition = false;
  let pendingBefore = [];
  let currentMatch = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("cursor:")) {
      continue;
    }
    const readRecommendation = parseReadRecommendation(line);
    if (readRecommendation) {
      summary.readRecommendation = readRecommendation;
      continue;
    }
    const shownSummary = parseShownSummary(line);
    if (shownSummary.shownCount !== void 0 || shownSummary.totalCount !== void 0) {
      Object.assign(summary, shownSummary);
      continue;
    }
    if (/^0\s+matches/.test(line) || /^0\s+exact\s+matches/.test(line)) {
      continue;
    }
    if (line === "--") {
      currentMatch = null;
      pendingBefore = [];
      continue;
    }
    const numbered = line.match(/^\s+(\d+)([:\-|])\s?(.*)$/);
    if (numbered) {
      const [, lineNumberRaw, kind, contentRaw] = numbered;
      const lineNumber = Number(lineNumberRaw);
      const content = (contentRaw ?? "").trim();
      if (kind === ":") {
        if (!currentPath) {
          continue;
        }
        currentMatch = {
          path: path5.join(persistenceRoot, currentPath),
          relativePath: currentPath,
          line: lineNumber,
          text: content,
          ...pendingBefore.length > 0 ? { contextBefore: [...pendingBefore] } : {},
          ...currentPathIsDefinition ? { isDefinition: true } : {}
        };
        items.push(currentMatch);
        pendingBefore = [];
        continue;
      }
      if (kind === "-") {
        if (currentMatch) {
          currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
        } else {
          pendingBefore.push(content);
        }
        continue;
      }
      if (kind === "|") {
        if (currentMatch) {
          if (currentMatch.isDefinition) {
            currentMatch.definitionBody = [...currentMatch.definitionBody ?? [], content];
          } else {
            currentMatch.contextAfter = [...currentMatch.contextAfter ?? [], content];
          }
        }
        continue;
      }
    }
    currentPathIsDefinition = /\s+\[def\]$/.test(line);
    currentPath = normalizeRelative(line.replace(/\s+\[[^\]]+\]$/, ""));
    currentMatch = null;
    pendingBefore = [];
  }
  return { items, summary };
}
function rewriteRenderedCompactIfNeeded(text, originalItems, filteredItems) {
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  const somethingDropped = originalItems.some((item) => !survivingPaths.has(item.relativePath));
  if (!somethingDropped) {
    return text;
  }
  return filterRenderedCompactText(text, (relativePath) => survivingPaths.has(relativePath));
}
function narrowSummaryToSurvivingPaths(summary, filteredItems) {
  if (!summary.readRecommendation) {
    return summary;
  }
  const survivingPaths = new Set(filteredItems.map((item) => item.relativePath));
  if (survivingPaths.has(summary.readRecommendation.relativePath)) {
    return summary;
  }
  const { readRecommendation: _dropped, ...rest } = summary;
  return rest;
}
async function callToolText(runtime, name, args) {
  return await runtime.callTool(name, args);
}
var DEFAULT_FFF_MCP_READY_TIMEOUT_MS = 3e4;
var FFF_MCP_READY_INITIAL_DELAY_MS = 100;
var FFF_MCP_READY_MAX_DELAY_MS = 2e3;
var FFF_MCP_READY_BACKOFF_FACTOR = 1.5;
function readEnvReadyTimeoutMs() {
  const raw = process.env.FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_FFF_MCP_READY_TIMEOUT_MS;
  }
  return parsed;
}
async function waitForFffMcpReady(callTool, optionsOrDelay = {}) {
  const options = typeof optionsOrDelay === "function" ? { delay: optionsOrDelay } : optionsOrDelay;
  const delay = options.delay ?? sleep;
  const now = options.now ?? Date.now;
  const deadlineMs = options.deadlineMs ?? readEnvReadyTimeoutMs();
  const initialDelayMs = options.initialDelayMs ?? FFF_MCP_READY_INITIAL_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? FFF_MCP_READY_MAX_DELAY_MS;
  const started = now();
  const deadlineAt = started + deadlineMs;
  let nextDelay = initialDelayMs;
  let lastIndexedCount = null;
  while (true) {
    const text = await callTool("find_files", { query: "a", maxResults: 1 });
    const indexedMatch = text.match(/\((\d+)\s+indexed\)/i);
    if (!indexedMatch || Number(indexedMatch[1]) > 0) {
      return text;
    }
    lastIndexedCount = Number(indexedMatch[1]);
    const remaining = deadlineAt - now();
    if (remaining <= 0) {
      break;
    }
    const waitMs = Math.min(nextDelay, remaining, maxDelayMs);
    await delay(waitMs);
    nextDelay = Math.min(Math.ceil(nextDelay * FFF_MCP_READY_BACKOFF_FACTOR), maxDelayMs);
  }
  const waitedMs = now() - started;
  const indexedSuffix = lastIndexedCount === null ? "" : " (last probe reported " + lastIndexedCount + " indexed)";
  throw new Error(
    "fff-mcp did not finish indexing within " + waitedMs + "ms" + indexedSuffix + ". Raise FFF_ROUTER_FFF_MCP_READY_TIMEOUT_MS if this repository is large."
  );
}
function createFffMcpStdioAdapter() {
  return {
    backendId: "fff-mcp",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      const transport = new StdioClientTransport({
        command: discoverFffMcpCommand(),
        args: [args.persistenceRoot],
        cwd: args.persistenceRoot,
        env: inheritedStringEnv(),
        stderr: "pipe"
      });
      const client = new Client(
        { name: "fff-router-fff-mcp", version: "1.0.0" },
        { capabilities: {} }
      );
      await client.connect(transport);
      const runtime = {
        id: `fff-mcp::${args.persistenceRoot}`,
        async close() {
          await client.close().catch(() => {
          });
          await transport.close().catch(() => {
          });
        },
        async callTool(name, args2) {
          const response = await client.callTool({ name, arguments: args2 });
          const text = response.content?.find((entry) => entry.type === "text")?.text;
          if (response.isError || typeof text !== "string") {
            throw new Error(text || `fff-mcp ${name} call failed`);
          }
          return text;
        }
      };
      try {
        await waitForFffMcpReady(runtime.callTool.bind(runtime));
      } catch (error) {
        await Promise.resolve(runtime.close()).catch(() => {
        });
        throw error;
      }
      return runtime;
    },
    async execute(args) {
      if (!args.runtime) {
        return backendUnavailable("fff-mcp runtime is not available");
      }
      try {
        switch (args.request.queryKind) {
          case "find_files": {
            const text = await callToolText(args.runtime, "find_files", {
              query: compileFindFilesQuery(args.request),
              maxResults: args.request.limit
            });
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "find_files",
                items: filterItems(
                  args.request,
                  parseFindFilesOutput(text, args.request.persistenceRoot)
                ),
                nextCursor: null
              }
            };
          }
          case "search_terms": {
            const text = await callToolText(args.runtime, "multi_grep", {
              patterns: args.request.terms,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines
            });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            const filteredItems = filterItems(args.request, parsed.items);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "search_terms",
                items: filteredItems,
                nextCursor: null,
                renderedCompact: rewriteRenderedCompactIfNeeded(text, parsed.items, filteredItems),
                summary: narrowSummaryToSurvivingPaths(parsed.summary, filteredItems)
              }
            };
          }
          case "grep": {
            const text = args.request.literal ? await callToolText(args.runtime, "multi_grep", {
              patterns: args.request.patterns,
              constraints: compileConstraints(args.request),
              maxResults: args.request.limit,
              context: args.request.contextLines
            }) : await callToolText(args.runtime, "grep", {
              query: compileGrepQuery(args.request),
              maxResults: args.request.limit
            });
            const parsed = parseTextMatchOutput(text, args.request.persistenceRoot);
            const filteredItems = filterItems(args.request, parsed.items);
            return {
              ok: true,
              value: {
                backendId: "fff-mcp",
                queryKind: "grep",
                items: filteredItems,
                nextCursor: null,
                renderedCompact: rewriteRenderedCompactIfNeeded(text, parsed.items, filteredItems),
                summary: narrowSummaryToSurvivingPaths(parsed.summary, filteredItems)
              }
            };
          }
        }
      } catch (error) {
        return searchFailed(error instanceof Error ? error.message : String(error));
      }
    }
  };
}

// lib/fff-router/adapters/fff-scope.ts
import fs from "node:fs";
import path6 from "node:path";
function isEncodableToken(token) {
  return token !== "" && token !== "." && !/\s/.test(token);
}
function looksLikeFile(relativePath) {
  const base = path6.posix.basename(relativePath);
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) {
    return false;
  }
  const ext = base.slice(dot + 1);
  return /^[A-Za-z][A-Za-z0-9]{0,9}$/.test(ext);
}
function classifyPathKind(persistenceRoot, relativePath) {
  const absolutePath = path6.join(persistenceRoot, relativePath);
  try {
    const stats = fs.statSync(absolutePath);
    return stats.isFile() ? "file" : "dir";
  } catch {
    return looksLikeFile(relativePath) ? "file" : "dir";
  }
}
function encodePathToken(relativePath, kind, negate = false) {
  const normalized = normalizeRelativePath(relativePath).replace(/\/+$/, "");
  if (!isEncodableToken(normalized)) {
    return null;
  }
  const suffix = kind === "dir" ? "/" : "";
  return `${negate ? "!" : ""}${normalized}${suffix}`;
}
function toRepoRelativeToken(request, candidatePath) {
  if (path6.isAbsolute(candidatePath)) {
    return toRelativePath(request.persistenceRoot, candidatePath);
  }
  return normalizeRelativePath(candidatePath);
}
function buildFffScopeTokens(request) {
  const tokens = [];
  let fallbackRequired = false;
  if (request.fileRestriction) {
    const relativeFile = toRelativePath(request.persistenceRoot, request.fileRestriction);
    const encoded = encodePathToken(relativeFile, "file");
    if (encoded) {
      tokens.push(encoded);
    } else {
      fallbackRequired = true;
    }
  } else {
    const relativeWithin = toRelativePath(request.persistenceRoot, request.within);
    if (relativeWithin !== "" && relativeWithin !== ".") {
      const encoded = encodePathToken(relativeWithin, "dir");
      if (encoded) {
        tokens.push(encoded);
      } else {
        fallbackRequired = true;
      }
    }
  }
  for (const excludePath of request.excludePaths) {
    const relativeExclude = toRepoRelativeToken(request, excludePath);
    const kind = classifyPathKind(request.persistenceRoot, relativeExclude);
    const encoded = encodePathToken(relativeExclude, kind, true);
    if (encoded) {
      tokens.push(encoded);
    } else {
      fallbackRequired = true;
    }
  }
  return {
    tokens,
    fallbackRequired
  };
}
function buildScopedQuery(tokens, query) {
  return [...tokens, query].filter(Boolean).join(" ").trim();
}

// lib/fff-router/adapters/fff-node.ts
var MAX_PAGES = 50;
function backendUnavailable2(message) {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "fff-node",
      message
    }
  };
}
function searchFailed2(message) {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "fff-node",
      message
    }
  };
}
function normalizeRegexPattern(pattern, caseSensitive) {
  if (caseSensitive) {
    return pattern;
  }
  return `(?i:${pattern})`;
}
function combineRegexPatterns(patterns, caseSensitive) {
  const combined = patterns.length === 1 ? patterns[0] ?? "" : patterns.map((pattern) => `(?:${pattern})`).join("|");
  return normalizeRegexPattern(combined, caseSensitive);
}
function mapFileItems(result) {
  return result.map((item) => ({
    path: item.path,
    relativePath: item.relativePath
  }));
}
function mapTextItems(result) {
  return result.map((item) => ({
    path: item.path,
    relativePath: item.relativePath,
    line: item.lineNumber,
    text: item.lineContent
  }));
}
function success(queryKind, items) {
  return {
    ok: true,
    value: {
      backendId: "fff-node",
      queryKind,
      items,
      nextCursor: null
    }
  };
}
function createFffNodeAdapter() {
  return {
    backendId: "fff-node",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async startRuntime(args) {
      let fffNode;
      try {
        fffNode = await import("@ff-labs/fff-node");
      } catch (error) {
        throw new Error(
          `Failed to load @ff-labs/fff-node: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      const created = fffNode.FileFinder.create({
        basePath: args.persistenceRoot
      });
      if (!created.ok) {
        throw new Error(String(created.error));
      }
      await created.value.waitForScan(5e3);
      return {
        id: `fff-node::${args.persistenceRoot}`,
        finder: created.value,
        close: async () => {
          created.value.destroy();
        }
      };
    },
    async execute(args) {
      if (!args.runtime) {
        return backendUnavailable2("FFF runtime is not available");
      }
      if ((args.request.additionalWithinEntries ?? []).length > 0) {
        return backendUnavailable2(
          "fff-node does not support multi-path `within`; route multi-path requests to rg or fff-mcp"
        );
      }
      if (args.request.limit === 0) {
        return success(args.request.queryKind, []);
      }
      const scope = buildFffScopeTokens(args.request);
      const maxPages = scope.fallbackRequired ? Number.MAX_SAFE_INTEGER : MAX_PAGES;
      switch (args.request.queryKind) {
        case "find_files": {
          const query = buildScopedQuery(scope.tokens, args.request.query);
          const pageSize = Math.max(args.request.limit, 1);
          const collected = [];
          for (let pageIndex = 0; pageIndex < maxPages && collected.length < args.request.limit; pageIndex += 1) {
            const result = args.runtime.finder.fileSearch(query, {
              pageSize,
              pageIndex
            });
            if (!result.ok || !result.value) {
              return searchFailed2(result.error ?? "FFF file search failed");
            }
            const filtered = filterItems(args.request, mapFileItems(result.value.items));
            collected.push(...filtered);
            if (result.value.items.length < pageSize) {
              break;
            }
          }
          return success("find_files", collected.slice(0, args.request.limit));
        }
        case "search_terms": {
          const constraints = scope.tokens.join(" ");
          const collected = [];
          let cursor = null;
          for (let page = 0; page < maxPages && collected.length < args.request.limit; page += 1) {
            const result = args.runtime.finder.multiGrep({
              patterns: args.request.terms,
              constraints: constraints || void 0,
              beforeContext: args.request.contextLines,
              afterContext: args.request.contextLines,
              cursor
            });
            if (!result.ok || !result.value) {
              return searchFailed2(result.error ?? "FFF multi_grep failed");
            }
            const filtered = filterItems(args.request, mapTextItems(result.value.items));
            collected.push(...filtered);
            if (!result.value.nextCursor) {
              break;
            }
            cursor = result.value.nextCursor;
          }
          return success("search_terms", collected.slice(0, args.request.limit));
        }
        case "grep": {
          const collected = [];
          let cursor = null;
          if (args.request.literal) {
            const constraints = scope.tokens.join(" ");
            for (let page = 0; page < maxPages && collected.length < args.request.limit; page += 1) {
              const result = args.runtime.finder.multiGrep({
                patterns: args.request.patterns,
                constraints: constraints || void 0,
                beforeContext: args.request.contextLines,
                afterContext: args.request.contextLines,
                cursor
              });
              if (!result.ok || !result.value) {
                return searchFailed2(result.error ?? "FFF multi_grep failed");
              }
              const filtered = filterItems(args.request, mapTextItems(result.value.items));
              collected.push(...filtered);
              if (!result.value.nextCursor) {
                break;
              }
              cursor = result.value.nextCursor;
            }
            return success("grep", collected.slice(0, args.request.limit));
          }
          const query = buildScopedQuery(
            scope.tokens,
            combineRegexPatterns(args.request.patterns, args.request.caseSensitive)
          );
          for (let page = 0; page < maxPages && collected.length < args.request.limit; page += 1) {
            const result = args.runtime.finder.grep(query, {
              mode: "regex",
              beforeContext: args.request.contextLines,
              afterContext: args.request.contextLines,
              cursor
            });
            if (!result.ok || !result.value) {
              return searchFailed2(result.error ?? "FFF grep failed");
            }
            const filtered = filterItems(args.request, mapTextItems(result.value.items));
            collected.push(...filtered);
            if (!result.value.nextCursor) {
              break;
            }
            cursor = result.value.nextCursor;
          }
          return success("grep", collected.slice(0, args.request.limit));
        }
      }
    }
  };
}

// lib/fff-router/adapters/rg.ts
import { spawn } from "node:child_process";
import path7 from "node:path";
function readStream(stream) {
  if (!stream) {
    return Promise.resolve("");
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });
    stream.once("error", reject);
    stream.once("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}
async function runCommandWithSpawn(command, args, cwd) {
  try {
    const proc = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      readStream(proc.stdout),
      readStream(proc.stderr),
      new Promise((resolve, reject) => {
        proc.once("error", reject);
        proc.once("close", resolve);
      })
    ]);
    if (exitCode === 0 || exitCode === 1) {
      return { ok: true, stdout, stderr };
    }
    return { ok: false, kind: "failed", code: exitCode ?? void 0, stderr };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      kind: /ENOENT|not found|No such file/i.test(message) ? "missing-command" : "failed",
      stderr: message
    };
  }
}
async function defaultRunCommand(command, args, cwd) {
  return runCommandWithSpawn(command, args, cwd);
}
function backendUnavailable3(message) {
  return {
    ok: false,
    error: {
      code: "BACKEND_UNAVAILABLE",
      backendId: "rg",
      message
    }
  };
}
function searchFailed3(message) {
  return {
    ok: false,
    error: {
      code: "SEARCH_FAILED",
      backendId: "rg",
      message
    }
  };
}
function mapCommandFailure(command, result) {
  const message = result.stderr ?? `${command} failed`;
  if (result.kind === "missing-command") {
    return backendUnavailable3(message);
  }
  return searchFailed3(message);
}
function buildGlobArgs(request) {
  const args = [];
  if (request.glob) {
    args.push("--glob", request.glob);
  }
  for (const extension of request.extensions) {
    args.push("--glob", `*.${extension}`);
  }
  for (const excludePath of request.excludePaths) {
    args.push("--glob", `!${excludePath}/**`);
  }
  return args;
}
function collectSearchTargets(request) {
  const targets = [];
  targets.push(request.fileRestriction ?? request.within);
  for (const entry of request.additionalWithinEntries ?? []) {
    targets.push(entry.fileRestriction ?? entry.resolvedWithin);
  }
  return targets;
}
function buildSearchTargets(request) {
  return collectSearchTargets(request);
}
function buildFdTargets(request) {
  return collectSearchTargets(request).map(
    (absolute) => toRelativePath(request.persistenceRoot, absolute) || "."
  );
}
function fuzzyMatch(relativePath, query) {
  const parts = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = relativePath.toLowerCase();
  return parts.every((part) => haystack.includes(part));
}
function parseRgJsonMatches(stdout, persistenceRoot) {
  const items = [];
  const pendingBefore = /* @__PURE__ */ new Map();
  const lastMatchIndexByPath = /* @__PURE__ */ new Map();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          backendId: "rg",
          message: "rg returned invalid JSON output"
        }
      };
    }
    const data = event.data;
    const absolutePath = data?.path?.text;
    if (!absolutePath || !data) {
      continue;
    }
    const cleanText = (data.lines?.text ?? "").replace(/\r?\n$/, "");
    const before = pendingBefore.get(absolutePath) ?? [];
    if (event.type === "context") {
      if (cleanText) {
        before.push(cleanText);
        pendingBefore.set(absolutePath, before);
        const lastMatchIndex = lastMatchIndexByPath.get(absolutePath);
        if (typeof lastMatchIndex === "number") {
          const lastMatch = items[lastMatchIndex];
          if (lastMatch) {
            const contextAfter = lastMatch.contextAfter ?? [];
            contextAfter.push(cleanText);
            lastMatch.contextAfter = contextAfter;
          }
        }
      }
      continue;
    }
    if (event.type !== "match") {
      continue;
    }
    items.push({
      path: absolutePath,
      relativePath: toRelativePath(persistenceRoot, absolutePath),
      line: data.line_number ?? 0,
      text: cleanText,
      column: data.submatches?.[0]?.start,
      ...before.length > 0 ? { contextBefore: [...before] } : {}
    });
    pendingBefore.set(absolutePath, []);
    lastMatchIndexByPath.set(absolutePath, items.length - 1);
  }
  return { ok: true, value: items };
}
function createRgAdapter(deps) {
  const runCommand = deps?.runCommand ?? defaultRunCommand;
  return {
    backendId: "rg",
    supportedQueryKinds: ["find_files", "search_terms", "grep"],
    async execute(args) {
      switch (args.request.queryKind) {
        case "find_files": {
          const request = args.request;
          const command = await runCommand(
            "fd",
            [
              "--type",
              "f",
              "--base-directory",
              request.persistenceRoot,
              ...buildGlobArgs(request),
              ".",
              ...buildFdTargets(request)
            ],
            request.persistenceRoot
          );
          if (!command.ok) {
            return mapCommandFailure("fd", command);
          }
          const items = filterItems(
            request,
            command.stdout.split(/\r?\n/).filter(Boolean).map((relativePath) => ({
              path: path7.join(request.persistenceRoot, relativePath),
              relativePath: relativePath.replace(/\\/g, "/")
            })).filter((item) => fuzzyMatch(item.relativePath, request.query))
          );
          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "find_files",
              items,
              nextCursor: null
            }
          };
        }
        case "search_terms": {
          const request = args.request;
          const command = await runCommand(
            "rg",
            [
              "--json",
              "--fixed-strings",
              "--context",
              String(request.contextLines),
              ...buildGlobArgs(request),
              ...request.terms.flatMap((term) => ["-e", term]),
              ...buildSearchTargets(request)
            ],
            request.persistenceRoot
          );
          if (!command.ok) {
            return mapCommandFailure("rg", command);
          }
          const parsed = parseRgJsonMatches(command.stdout, request.persistenceRoot);
          if (!parsed.ok) {
            return parsed;
          }
          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "search_terms",
              items: filterItems(request, parsed.value),
              nextCursor: null
            }
          };
        }
        case "grep": {
          const request = args.request;
          const rgArgs = [
            "--json",
            "--context",
            String(request.contextLines),
            ...buildGlobArgs(request)
          ];
          if (!request.caseSensitive) {
            rgArgs.push("--ignore-case");
          }
          if (request.literal) {
            rgArgs.push("--fixed-strings");
          }
          rgArgs.push(...request.patterns.flatMap((pattern) => ["-e", pattern]));
          rgArgs.push(...buildSearchTargets(request));
          const command = await runCommand("rg", rgArgs, request.persistenceRoot);
          if (!command.ok) {
            return mapCommandFailure("rg", command);
          }
          const parsed = parseRgJsonMatches(command.stdout, request.persistenceRoot);
          if (!parsed.ok) {
            return parsed;
          }
          return {
            ok: true,
            value: {
              backendId: "rg",
              queryKind: "grep",
              items: filterItems(request, parsed.value),
              nextCursor: null
            }
          };
        }
      }
    }
  };
}

// lib/fff-router/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/mcp-tools.ts
import * as z from "zod/v4";

// lib/fff-router/public-api.ts
var import_picomatch2 = __toESM(require_picomatch2(), 1);
import path8 from "node:path";
import fs2 from "node:fs";
import { Type } from "@sinclair/typebox";
var EXTENSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
var PATH_META_PATTERN = /[*?[\]{}!]/;
var EXCLUDE_GLOB_META_PATTERN = /[*?[\]{}]/;
var DEFAULT_LIMIT = 20;
var DEFAULT_CONTEXT_LINES = 0;
var outputModeSchema = Type.Union([Type.Literal("compact"), Type.Literal("json")]);
var cursorSchema = Type.Null();
var ENABLE_SEARCH_TERMS = false;
function defineTool(name, description, snippet, inputSchema) {
  return { name, description, snippet, inputSchema };
}
function invalid2(message, code = "INVALID_REQUEST") {
  return {
    ok: false,
    error: { code, message }
  };
}
function containsPathMeta(value) {
  return PATH_META_PATTERN.test(value);
}
function containsExcludeGlobMeta(value) {
  return EXCLUDE_GLOB_META_PATTERN.test(value);
}
function parseRequiredString(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    return invalid2(`${field} must be a non-empty string`);
  }
  return { ok: true, value };
}
function parseOptionalNonNegativeInt(value, field, defaultValue) {
  if (value === void 0) {
    return { ok: true, value: defaultValue };
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return invalid2(`${field} must be a non-negative integer`);
  }
  return { ok: true, value };
}
function normalizeWithinString(value, env) {
  if (typeof value !== "string" || value.trim() === "") {
    return invalid2("within must be a non-empty string when provided");
  }
  const expanded = expandHomePath(value, env);
  if (!expanded.ok) {
    return expanded;
  }
  if (!path8.isAbsolute(expanded.value)) {
    return invalid2("within must be absolute for direct MCP callers");
  }
  return { ok: true, value: expanded.value };
}
function normalizeWithin(value, env = process.env) {
  if (value === void 0) {
    return { ok: true, value: void 0 };
  }
  if (!Array.isArray(value)) {
    const single = normalizeWithinString(value, env);
    if (!single.ok) {
      return single;
    }
    return { ok: true, value: [single.value] };
  }
  if (value.length === 0) {
    return invalid2("within must not be an empty array when provided");
  }
  const resolved = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of value) {
    const result = normalizeWithinString(entry, env);
    if (!result.ok) {
      return result;
    }
    if (seen.has(result.value)) {
      return invalid2(`within contains duplicate path '${result.value}'`);
    }
    seen.add(result.value);
    resolved.push(result.value);
  }
  return { ok: true, value: resolved };
}
function normalizeExtensions(input) {
  if (input === void 0) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(input)) {
    return invalid2("extensions must be an array of strings");
  }
  const normalized = [];
  for (const entry of input) {
    if (typeof entry !== "string") {
      return invalid2("extensions must contain only strings");
    }
    const clean = entry.trim().replace(/^\./, "");
    if (!clean) {
      return invalid2("extensions must not contain empty values");
    }
    if (clean.includes("/") || clean.includes("\\") || containsPathMeta(clean) || !EXTENSION_PATTERN.test(clean)) {
      return invalid2("extensions must be literal suffixes without path syntax");
    }
    normalized.push(clean);
  }
  return { ok: true, value: normalized };
}
function normalizeGlobPattern(value) {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return invalid2("glob must not be empty");
  }
  if (path8.isAbsolute(trimmed)) {
    return invalid2("glob must be relative to the resolved base path");
  }
  if (trimmed.startsWith("!")) {
    return invalid2("glob must be an include pattern; use exclude_paths for exclusions");
  }
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return invalid2("glob must not contain empty or current-directory segments");
  }
  if (segments.includes("..")) {
    return invalid2("glob must not escape the resolved base path");
  }
  return { ok: true, value: trimmed };
}
function normalizeGlob(input) {
  if (input === void 0) {
    return { ok: true, value: void 0 };
  }
  if (typeof input !== "string") {
    return invalid2("glob must be a string when provided");
  }
  return normalizeGlobPattern(input);
}
function validateExcludePathSyntax(entry) {
  const trimmed = entry.trim().replace(/\\/g, "/");
  if (!trimmed) {
    return invalid2("exclude_paths must not contain empty values");
  }
  if (path8.isAbsolute(trimmed)) {
    return invalid2("exclude_paths must be relative to the resolved base path");
  }
  if (trimmed.startsWith("!")) {
    return invalid2("exclude_paths entries are already exclusions; omit leading !");
  }
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "" || segment === ".")) {
    return invalid2("exclude_paths must not contain empty or current-directory segments");
  }
  if (segments.includes("..")) {
    return invalid2("exclude_paths must not escape the resolved base path");
  }
  return { ok: true, value: segments.join("/") };
}
function normalizeExcludePath(entry) {
  const normalized = validateExcludePathSyntax(entry);
  if (!normalized.ok) {
    return normalized;
  }
  if (containsPathMeta(normalized.value)) {
    return invalid2("exclude_paths must be literal descendant paths");
  }
  return normalized;
}
function resolveExcludeExpansionBase(within) {
  const primaryWithin = within?.[0];
  if (primaryWithin === void 0) {
    return void 0;
  }
  try {
    const stats = fs2.statSync(primaryWithin);
    return stats.isFile() ? path8.dirname(primaryWithin) : primaryWithin;
  } catch {
    return primaryWithin;
  }
}
function expandExcludeGlobPath(basePath, pattern) {
  const segments = pattern.split("/");
  function expand(absDir, prefix, remaining) {
    const [segment, ...rest] = remaining;
    if (segment === void 0) {
      return [prefix.join("/")];
    }
    if (!containsExcludeGlobMeta(segment)) {
      const nextAbs = path8.join(absDir, segment);
      if (rest.length === 0) {
        return fs2.existsSync(nextAbs) ? [[...prefix, segment].join("/")] : [];
      }
      try {
        if (!fs2.statSync(nextAbs).isDirectory()) {
          return [];
        }
      } catch {
        return [];
      }
      return expand(nextAbs, [...prefix, segment], rest);
    }
    let entries;
    try {
      entries = fs2.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const matches = (0, import_picomatch2.default)(segment, { dot: true });
    return entries.filter((entry) => matches(entry.name)).sort((left, right) => left.name.localeCompare(right.name)).flatMap((entry) => {
      const nextPrefix = [...prefix, entry.name];
      if (rest.length === 0) {
        return [nextPrefix.join("/")];
      }
      if (!entry.isDirectory()) {
        return [];
      }
      return expand(path8.join(absDir, entry.name), nextPrefix, rest);
    });
  }
  return expand(basePath, [], segments);
}
function normalizeExcludePaths(input, within) {
  if (input === void 0) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(input)) {
    return invalid2("exclude_paths must be an array of strings");
  }
  const normalized = [];
  const seen = /* @__PURE__ */ new Set();
  const expansionBase = resolveExcludeExpansionBase(within);
  for (const entry of input) {
    if (typeof entry !== "string") {
      return invalid2("exclude_paths must contain only strings");
    }
    const excludePath = expansionBase ? validateExcludePathSyntax(entry) : normalizeExcludePath(entry);
    if (!excludePath.ok) {
      return excludePath;
    }
    const paths = containsExcludeGlobMeta(excludePath.value) && expansionBase !== void 0 ? expandExcludeGlobPath(expansionBase, excludePath.value) : [excludePath.value];
    for (const pathValue of paths) {
      if (!seen.has(pathValue)) {
        seen.add(pathValue);
        normalized.push(pathValue);
      }
    }
  }
  return { ok: true, value: normalized };
}
function normalizeCursor(value) {
  if (value === void 0 || value === null) {
    return { ok: true, value: null };
  }
  return invalid2("cursor must be omitted or null in the initial V2 slice");
}
function normalizeTerms(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid2("terms must contain at least one string");
  }
  const terms = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return invalid2("terms must contain only non-empty strings");
    }
    terms.push(entry);
  }
  return { ok: true, value: terms };
}
function normalizePatterns(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid2("patterns must contain at least one string");
  }
  const patterns = [];
  for (const entry of value) {
    if (typeof entry !== "string" || entry.trim() === "") {
      return invalid2("patterns must contain only non-empty strings");
    }
    patterns.push(entry);
  }
  return { ok: true, value: patterns };
}
function schemaFieldNames(schema) {
  const properties = schema.properties;
  return Object.keys(properties ?? {});
}
function rejectUnknownFields(input, schema) {
  const allowed = new Set(schemaFieldNames(schema));
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) {
      return invalid2(`unknown field '${field}'`);
    }
  }
  return { ok: true, value: true };
}
var withinSchema = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })
]);
var findFilesInputSchema = Type.Object(
  {
    query: Type.String({ minLength: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
);
var searchTermsInputSchema = Type.Object(
  {
    terms: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
);
var grepInputSchema = Type.Object(
  {
    patterns: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    literal: Type.Boolean({
      description: "Required. If true, patterns are matched as literal text (safe for code, quotes, whitespace, and regex metacharacters). If false, patterns are regex. This tool does not guess; set it explicitly."
    }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    case_sensitive: Type.Optional(Type.Boolean()),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema)
  },
  { additionalProperties: false }
);
var PUBLIC_TOOL_DEFINITIONS = [
  defineTool(
    "fff_find_files",
    "Fuzzy file search by name/path under an already-resolved within scope. Use it when you are exploring a topic or looking for files, not when you already have a specific code identifier. `within` accepts a single absolute path or an array of absolute paths (multi-path unions the results \u2014 same semantics as passing multiple roots to `fd`). Keep queries short and let glob, extensions, and exclude_paths do the path narrowing.",
    '{"query":"openssl header","within":"/opt/homebrew/lib","glob":"**/*.h","exclude_paths":["pkgconfig"]}',
    findFilesInputSchema
  ),
  ...ENABLE_SEARCH_TERMS ? [
    defineTool(
      "fff_search_terms",
      "Search for one or more literal terms under an already-resolved within scope (absolute or HOME-based).",
      '{"terms":["router","coordinator"],"within":"$HOME/.config"}',
      searchTermsInputSchema
    )
  ] : [],
  defineTool(
    "fff_grep",
    "Search file contents under an already-resolved within scope. `literal` is REQUIRED: set literal=true for identifier searches, code fragments, or any string containing whitespace, quotes, or punctuation where regex interpretation is unwanted; set literal=false only when you need regex features (anchors, character classes, quantifiers, alternation). This tool does not guess. Use `patterns` for one or more terms; multiple entries use OR semantics. `within` accepts a single absolute path or an array of absolute paths \u2014 use the array form to replace shell patterns like `grep PAT file1 file2 dirA dirB` in one call (all entries must share a routing target). Use `glob` / `extensions` / `exclude_paths` to prefilter files aggressively.",
    '{"patterns":["ActorAuth","actor_auth","PopulatedActorAuth"],"literal":true,"within":["crates/portl-cli/Cargo.toml","Cargo.toml"]}',
    grepInputSchema
  )
];
function parsePublicOutputMode(value) {
  if (value === void 0) {
    return { ok: true, value: "compact" };
  }
  if (value === "compact" || value === "json") {
    return { ok: true, value };
  }
  return invalid2("output_mode must be one of: compact, json");
}
function normalizeFindFilesInput(input) {
  const knownFields = rejectUnknownFields(input, findFilesInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }
  const query = parseRequiredString(input.query, "query");
  if (!query.ok) {
    return query;
  }
  const within = normalizeWithin(input.within);
  if (!within.ok) {
    return within;
  }
  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }
  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }
  const excludePaths = normalizeExcludePaths(input.exclude_paths, within.value);
  if (!excludePaths.ok) {
    return excludePaths;
  }
  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }
  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }
  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }
  const value = {
    tool: "fff_find_files",
    query: query.value,
    ...within.value !== void 0 ? { within: within.value } : {},
    ...glob.value !== void 0 ? { glob: glob.value } : {},
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value
  };
  return {
    ok: true,
    value
  };
}
function normalizeSearchTermsInput(input) {
  const knownFields = rejectUnknownFields(input, searchTermsInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }
  const terms = normalizeTerms(input.terms);
  if (!terms.ok) {
    return terms;
  }
  const within = normalizeWithin(input.within);
  if (!within.ok) {
    return within;
  }
  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }
  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }
  const excludePaths = normalizeExcludePaths(input.exclude_paths, within.value);
  if (!excludePaths.ok) {
    return excludePaths;
  }
  const contextLines = parseOptionalNonNegativeInt(
    input.context_lines,
    "context_lines",
    DEFAULT_CONTEXT_LINES
  );
  if (!contextLines.ok) {
    return contextLines;
  }
  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }
  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }
  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }
  const value = {
    tool: "fff_search_terms",
    terms: terms.value,
    ...within.value !== void 0 ? { within: within.value } : {},
    ...glob.value !== void 0 ? { glob: glob.value } : {},
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value
  };
  return {
    ok: true,
    value
  };
}
function normalizeGrepInput(input) {
  const knownFields = rejectUnknownFields(input, grepInputSchema);
  if (!knownFields.ok) {
    return knownFields;
  }
  const patterns = normalizePatterns(input.patterns);
  if (!patterns.ok) {
    return patterns;
  }
  if (typeof input.literal !== "boolean") {
    return invalid2(
      "literal must be explicitly set to true or false; fff_grep does not guess between regex and literal interpretation"
    );
  }
  const within = normalizeWithin(input.within);
  if (!within.ok) {
    return within;
  }
  const glob = normalizeGlob(input.glob);
  if (!glob.ok) {
    return glob;
  }
  if (input.case_sensitive !== void 0 && typeof input.case_sensitive !== "boolean") {
    return invalid2("case_sensitive must be a boolean when provided");
  }
  const extensions = normalizeExtensions(input.extensions);
  if (!extensions.ok) {
    return extensions;
  }
  const excludePaths = normalizeExcludePaths(input.exclude_paths, within.value);
  if (!excludePaths.ok) {
    return excludePaths;
  }
  const contextLines = parseOptionalNonNegativeInt(
    input.context_lines,
    "context_lines",
    DEFAULT_CONTEXT_LINES
  );
  if (!contextLines.ok) {
    return contextLines;
  }
  const limit = parseOptionalNonNegativeInt(input.limit, "limit", DEFAULT_LIMIT);
  if (!limit.ok) {
    return limit;
  }
  const cursor = normalizeCursor(input.cursor);
  if (!cursor.ok) {
    return cursor;
  }
  const outputMode = parsePublicOutputMode(input.output_mode);
  if (!outputMode.ok) {
    return outputMode;
  }
  const value = {
    tool: "fff_grep",
    patterns: patterns.value,
    literal: input.literal,
    ...within.value !== void 0 ? { within: within.value } : {},
    ...glob.value !== void 0 ? { glob: glob.value } : {},
    caseSensitive: input.case_sensitive ?? false,
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value
  };
  return {
    ok: true,
    value
  };
}
function normalizePublicToolInput(tool, input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalid2("request must be an object");
  }
  const record = input;
  switch (tool) {
    case "fff_find_files":
      return normalizeFindFilesInput(record);
    case "fff_search_terms":
      if (!ENABLE_SEARCH_TERMS) {
        return invalid2("fff_search_terms is disabled; use fff_grep with patterns instead");
      }
      return normalizeSearchTermsInput(record);
    case "fff_grep":
      return normalizeGrepInput(record);
  }
}

// lib/fff-router/mcp-tools.ts
var withinZod = z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]);
var zodInputShapes = {
  fff_find_files: {
    query: z.string().min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
  },
  fff_search_terms: {
    terms: z.array(z.string().min(1)).min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
  },
  fff_grep: {
    patterns: z.array(z.string().min(1)).min(1),
    literal: z.boolean(),
    within: withinZod.optional(),
    glob: z.string().optional(),
    case_sensitive: z.boolean().optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: z.null().optional(),
    output_mode: z.enum(["compact", "json"]).optional()
  }
};
var MCP_TOOLS = PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  zodInputShape: zodInputShapes[tool.name]
}));
function listMcpTools() {
  return MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    snippet: tool.snippet
  }));
}
async function executeMcpTool(args) {
  const normalized = normalizePublicToolInput(args.name, args.input);
  if (!normalized.ok) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              code: normalized.error.code,
              message: normalized.error.message
            },
            null,
            2
          )
        }
      ]
    };
  }
  const result = await args.coordinator.execute(normalized.value);
  if (!result.ok) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ok: false,
              code: result.error.code,
              message: result.error.message
            },
            null,
            2
          )
        }
      ]
    };
  }
  return {
    isError: false,
    content: [
      {
        type: "text",
        text: JSON.stringify(result.value, null, 2)
      }
    ]
  };
}

// lib/fff-router/mcp-server.ts
function createMcpServer(args) {
  async function callTool(name, input) {
    return executeMcpTool({
      coordinator: args.coordinator,
      name,
      input
    });
  }
  function toSdkServer() {
    const server = new McpServer({
      name: "fff-router-mcp",
      version: "2.0.0"
    });
    for (const tool of MCP_TOOLS) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.zodInputShape
        },
        async (input) => {
          return await callTool(tool.name, input);
        }
      );
    }
    return server;
  }
  return {
    listTools: async () => listMcpTools(),
    callTool,
    toSdkServer,
    async connectStdio() {
      const transport = new StdioServerTransport();
      const server = toSdkServer();
      await server.connect(transport);
      return server;
    }
  };
}

// lib/fff-router/runtime-manager.ts
function closeRuntime(runtime) {
  return Promise.resolve(runtime.close());
}
function runtimeRegistryKey(backendId, persistenceRoot) {
  return `${backendId}::${persistenceRoot}`;
}
var RuntimeManager = class {
  entries = /* @__PURE__ */ new Map();
  mutationLocked = false;
  waitingMutations = [];
  releaseMutationLock() {
    const next = this.waitingMutations.shift();
    if (next) {
      next();
      return;
    }
    this.mutationLocked = false;
  }
  async withMutationLock(callback) {
    if (this.mutationLocked) {
      await new Promise((resolve) => {
        this.waitingMutations.push(resolve);
      });
    } else {
      this.mutationLocked = true;
    }
    try {
      return callback();
    } finally {
      this.releaseMutationLock();
    }
  }
  async getOrStartRuntime(spec) {
    const key = runtimeRegistryKey(spec.backendId, spec.persistenceRoot);
    const startup = await this.withMutationLock(() => {
      const existing = this.entries.get(key);
      if (existing?.runtime) {
        return Promise.resolve(existing.runtime);
      }
      if (existing?.startup) {
        return existing.startup;
      }
      const token = Symbol(key);
      const created = Promise.resolve(spec.start()).then(async (runtime) => {
        let shouldClose = false;
        await this.withMutationLock(() => {
          const current = this.entries.get(key);
          if (!current || current.token !== token) {
            shouldClose = true;
            return;
          }
          this.entries.set(key, {
            token,
            runtime
          });
        });
        if (shouldClose) {
          await closeRuntime(runtime);
          throw new Error(`Runtime '${key}' was evicted before startup completed`);
        }
        return runtime;
      }).catch(async (error) => {
        await this.withMutationLock(() => {
          const current = this.entries.get(key);
          if (current?.token === token) {
            this.entries.delete(key);
          }
        });
        throw error;
      });
      this.entries.set(key, { token, startup: created });
      return created;
    });
    return startup;
  }
  async withRuntime(spec, execute) {
    const runtime = await this.getOrStartRuntime(spec);
    return await execute(runtime);
  }
  async evictRuntime(key) {
    const runtime = await this.withMutationLock(() => {
      const registryKey = runtimeRegistryKey(key.backendId, key.persistenceRoot);
      const entry = this.entries.get(registryKey);
      this.entries.delete(registryKey);
      return entry?.runtime;
    });
    if (runtime) {
      await closeRuntime(runtime);
    }
  }
  async closeAll() {
    const runtimes = await this.withMutationLock(() => {
      const collected = Array.from(this.entries.values()).map((entry) => entry.runtime).filter((runtime) => runtime != null);
      this.entries.clear();
      return collected;
    });
    await Promise.all(runtimes.map((runtime) => closeRuntime(runtime)));
  }
};

// lib/fff-router/coordinator.ts
import path12 from "node:path";

// lib/fff-router/routing.ts
import path9 from "node:path";
function invalidConfig(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function outsideAllowedScope(realPath) {
  return {
    ok: false,
    error: {
      code: "OUTSIDE_ALLOWED_SCOPE",
      message: `search_path '${realPath}' is outside a git repo and not under an allowlisted non-git prefix`
    }
  };
}
function normalizeAllowlistedPrefixes(config) {
  const normalized = /* @__PURE__ */ new Set();
  for (const entry of config.allowlistedNonGitPrefixes) {
    if (!path9.isAbsolute(entry.prefix)) {
      return invalidConfig("allowlisted non-git prefixes must be absolute paths");
    }
    normalized.add(path9.normalize(entry.prefix));
  }
  return {
    ok: true,
    value: [...normalized].sort((a, b) => b.length - a.length)
  };
}
function longestMatchingPrefix(realPath, prefixes) {
  for (const prefix of prefixes) {
    if (realPath === prefix || realPath.startsWith(prefix + path9.sep)) {
      return prefix;
    }
  }
  return null;
}
function deriveFirstChildRoot(prefix, realPath) {
  const relative = path9.relative(prefix, realPath);
  if (!relative || relative.startsWith("..") || path9.isAbsolute(relative)) {
    return null;
  }
  const firstSegment = relative.split(path9.sep)[0];
  if (!firstSegment) {
    return null;
  }
  return path9.join(prefix, firstSegment);
}
function deriveRoutingTarget(args) {
  if (args.gitRoot) {
    return {
      ok: true,
      value: {
        rootType: "git",
        persistenceRoot: path9.normalize(args.gitRoot),
        searchScope: args.realPath,
        backendMode: "persistent",
        ttlMs: args.config.ttl.gitMs
      }
    };
  }
  const prefixes = normalizeAllowlistedPrefixes(args.config);
  if (!prefixes.ok) {
    return prefixes;
  }
  const matchedPrefix = longestMatchingPrefix(args.realPath, prefixes.value);
  if (!matchedPrefix) {
    return outsideAllowedScope(args.realPath);
  }
  const persistenceRoot = deriveFirstChildRoot(matchedPrefix, args.realPath);
  if (!persistenceRoot) {
    return outsideAllowedScope(args.realPath);
  }
  return {
    ok: true,
    value: {
      rootType: "non-git",
      persistenceRoot,
      searchScope: args.realPath,
      backendMode: "ephemeral-candidate",
      ttlMs: args.config.ttl.nonGitMs
    }
  };
}

// lib/fff-router/lifecycle.ts
function pruneExpired(state) {
  const daemons = {};
  const evicted = [];
  for (const [key, record] of Object.entries(state.daemons)) {
    if (record.lastUsedAt + record.ttlMs <= state.now) {
      evicted.push(key);
      continue;
    }
    daemons[key] = record;
  }
  return { daemons, evicted };
}
function pruneRecentHits(now, recentHits, config) {
  const next = {};
  for (const [key, timestamps] of Object.entries(recentHits)) {
    const pruned = timestamps.filter((timestamp) => {
      return now - timestamp <= config.promotion.windowMs;
    });
    if (pruned.length > 0) {
      next[key] = pruned;
    }
  }
  return next;
}
function listLruKeys(daemons, rootType) {
  return Object.values(daemons).filter((record) => rootType ? record.rootType === rootType : true).sort((left, right) => left.lastUsedAt - right.lastUsedAt).map((record) => record.key);
}
function removeDaemon(daemons, key, evicted) {
  if (!daemons[key]) {
    return;
  }
  delete daemons[key];
  evicted.push(key);
}
function countNonGitDaemons(daemons) {
  return Object.values(daemons).filter((record) => record.rootType === "non-git").length;
}
function clearRecentHitKey(state, key) {
  const nonGitRecentHits = { ...state.nonGitRecentHits };
  delete nonGitRecentHits[key];
  return { ...state, nonGitRecentHits };
}
function enforceLimits(state, config) {
  const daemons = { ...state.daemons };
  const evicted = [];
  const nonGitOverflow = Math.max(
    0,
    countNonGitDaemons(daemons) - config.limits.maxPersistentNonGitDaemons
  );
  for (const key of listLruKeys(daemons, "non-git").slice(0, nonGitOverflow)) {
    removeDaemon(daemons, key, evicted);
  }
  const totalOverflow = Math.max(
    0,
    Object.keys(daemons).length - config.limits.maxPersistentDaemons
  );
  for (const key of listLruKeys(daemons).slice(0, totalOverflow)) {
    removeDaemon(daemons, key, evicted);
  }
  const nonGitRecentHits = { ...state.nonGitRecentHits };
  for (const key of evicted) {
    delete nonGitRecentHits[key];
  }
  return {
    state: {
      ...state,
      daemons,
      nonGitRecentHits
    },
    evicted
  };
}
function planDaemonAction(state, target, config) {
  const expired = pruneExpired(state);
  let nextState = {
    daemons: expired.daemons,
    nonGitRecentHits: pruneRecentHits(state.now, state.nonGitRecentHits, config),
    now: state.now
  };
  const evicted = [...expired.evicted];
  for (const key2 of expired.evicted) {
    delete nextState.nonGitRecentHits[key2];
  }
  const key = target.persistenceRoot;
  const existing = nextState.daemons[key];
  if (existing) {
    return {
      nextState: {
        ...nextState,
        daemons: {
          ...nextState.daemons,
          [key]: {
            ...existing,
            lastUsedAt: state.now
          }
        }
      },
      action: { type: "reuse-persistent", key },
      evicted
    };
  }
  if (target.rootType === "non-git") {
    const hits = [...nextState.nonGitRecentHits[key] ?? [], state.now];
    nextState = {
      ...nextState,
      nonGitRecentHits: {
        ...nextState.nonGitRecentHits,
        [key]: hits
      }
    };
    if (hits.length < config.promotion.requiredHits) {
      return {
        nextState,
        action: { type: "run-ephemeral", key },
        evicted
      };
    }
    nextState = clearRecentHitKey(nextState, key);
  }
  nextState = {
    ...nextState,
    daemons: {
      ...nextState.daemons,
      [key]: {
        key,
        persistenceRoot: target.persistenceRoot,
        rootType: target.rootType,
        status: "running",
        createdAt: state.now,
        lastUsedAt: state.now,
        ttlMs: target.ttlMs
      }
    }
  };
  const limited = enforceLimits(nextState, config);
  if (!limited.state.daemons[key]) {
    return {
      nextState: limited.state,
      action: { type: "run-ephemeral", key },
      evicted: [...evicted, ...limited.evicted]
    };
  }
  return {
    nextState: limited.state,
    action: { type: "start-persistent", key },
    evicted: [...evicted, ...limited.evicted]
  };
}
function planRoutingLifecycle(args) {
  const target = deriveRoutingTarget({
    realPath: args.realPath,
    statType: args.statType,
    gitRoot: args.gitRoot,
    config: args.config
  });
  if (!target.ok) {
    return target;
  }
  const daemonPlan = planDaemonAction(args.state, target.value, args.config);
  return {
    ok: true,
    value: {
      queryKind: args.queryKind,
      target: target.value,
      nextState: daemonPlan.nextState,
      action: daemonPlan.action,
      evicted: daemonPlan.evicted
    }
  };
}

// lib/fff-router/resolve-path.ts
import fs3 from "node:fs/promises";
import path10 from "node:path";
function searchPathError(code, message) {
  return { ok: false, error: { code, message } };
}
async function pathExists(candidatePath) {
  try {
    await fs3.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
async function discoverGitRoot(realPath, statType) {
  let current = statType === "directory" ? realPath : path10.dirname(realPath);
  while (true) {
    if (await pathExists(path10.join(current, ".git"))) {
      return current;
    }
    const parent = path10.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}
function resolveStatType(stats) {
  if (!stats) {
    return searchPathError("SEARCH_PATH_REALPATH_FAILED", "failed to inspect canonicalized search_path");
  }
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return searchPathError(
    "INVALID_REQUEST",
    "search_path must point to a regular file or directory"
  );
}
async function resolveSearchPath(searchPath) {
  let realPath;
  try {
    realPath = await fs3.realpath(searchPath);
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT") {
      return searchPathError("SEARCH_PATH_NOT_FOUND", `search_path '${searchPath}' does not exist`);
    }
    return searchPathError("SEARCH_PATH_REALPATH_FAILED", `failed to canonicalize '${searchPath}'`);
  }
  let stats;
  try {
    stats = await fs3.stat(realPath);
  } catch {
    return searchPathError(
      "SEARCH_PATH_REALPATH_FAILED",
      `failed to stat '${realPath}' after canonicalization`
    );
  }
  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }
  return {
    ok: true,
    value: {
      realPath,
      statType: statType.value,
      gitRoot: await discoverGitRoot(realPath, statType.value)
    }
  };
}

// lib/fff-router/resolve-within.ts
import fs4 from "node:fs/promises";
import path11 from "node:path";
function invalid3(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message
    }
  };
}
function withinNotFound(within) {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within}' does not exist`
    }
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message
    }
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid3(`${field} must be a non-empty path`);
  }
  if (!path11.isAbsolute(trimmed)) {
    return invalid3(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
function resolveStatType2(stats) {
  if (!stats) {
    return internalError("failed to inspect resolved within path");
  }
  if (stats.isDirectory()) {
    return { ok: true, value: "directory" };
  }
  if (stats.isFile()) {
    return { ok: true, value: "file" };
  }
  return invalid3("within must point to a regular file or directory");
}
async function validateResolvedWithinEntry(candidate) {
  const within = validateAbsolutePath(candidate, "within");
  if (!within.ok) {
    return within;
  }
  let resolvedWithin;
  try {
    resolvedWithin = await fs4.realpath(within.value);
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT") {
      return withinNotFound(within.value);
    }
    return internalError(`failed to canonicalize within '${within.value}'`);
  }
  let stats;
  try {
    stats = await fs4.stat(resolvedWithin);
  } catch {
    return internalError(`failed to stat resolved within '${resolvedWithin}'`);
  }
  const statType = resolveStatType2(stats);
  if (!statType.ok) {
    return statType;
  }
  if (statType.value === "directory") {
    return {
      ok: true,
      value: {
        resolvedWithin,
        basePath: resolvedWithin
      }
    };
  }
  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path11.dirname(resolvedWithin),
      fileRestriction: resolvedWithin
    }
  };
}
async function validateResolvedWithinPaths(args) {
  if (args.withinPaths.length === 0) {
    return invalid3("withinPaths must contain at least one entry");
  }
  const entries = [];
  for (const candidate of args.withinPaths) {
    const entry = await validateResolvedWithinEntry(candidate);
    if (!entry.ok) {
      return entry;
    }
    entries.push(entry.value);
  }
  const [primary, ...rest] = entries;
  return {
    ok: true,
    value: {
      resolvedWithin: primary.resolvedWithin,
      basePath: primary.basePath,
      ...primary.fileRestriction !== void 0 ? { fileRestriction: primary.fileRestriction } : {},
      ...rest.length > 0 ? { additionalEntries: rest } : {}
    }
  };
}

// lib/fff-router/coordinator.ts
function createCoordinatorRuntimeConfigRef(config) {
  return { current: config };
}
function invalid4(message) {
  return { ok: false, error: { code: "INVALID_REQUEST", message } };
}
function internalError2(message) {
  return { ok: false, error: { code: "INTERNAL_ERROR", message } };
}
function normalizeCoordinatorPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized === "" ? "." : normalized;
}
function queryKindForRequest(request) {
  switch (request.tool) {
    case "fff_find_files":
      return "find_files";
    case "fff_search_terms":
      return "search_terms";
    case "fff_grep":
      return "grep";
  }
}
function translateExcludePaths(validatedWithin, persistenceRoot, excludePaths) {
  const baseRelative = normalizeRelativePath(
    path12.relative(persistenceRoot, validatedWithin.basePath)
  );
  return excludePaths.map((excludePath) => {
    if (!baseRelative || baseRelative === ".") {
      return excludePath;
    }
    return normalizeRelativePath(path12.join(baseRelative, excludePath));
  });
}
function buildBackendRequest(args) {
  const base = {
    backendId: args.backendId,
    persistenceRoot: args.persistenceRoot,
    within: args.validatedWithin.resolvedWithin,
    basePath: args.validatedWithin.basePath,
    fileRestriction: args.validatedWithin.fileRestriction,
    additionalWithinEntries: args.validatedWithin.additionalEntries ?? [],
    ...args.request.glob !== void 0 ? { glob: args.request.glob } : {},
    extensions: args.request.extensions,
    excludePaths: translateExcludePaths(
      args.validatedWithin,
      args.persistenceRoot,
      args.request.excludePaths
    ),
    limit: args.request.limit
  };
  switch (args.request.tool) {
    case "fff_find_files":
      return { ...base, queryKind: "find_files", query: args.request.query };
    case "fff_search_terms":
      return {
        ...base,
        queryKind: "search_terms",
        terms: args.request.terms,
        contextLines: args.request.contextLines
      };
    case "fff_grep":
      return {
        ...base,
        queryKind: "grep",
        patterns: args.request.patterns,
        literal: args.request.literal,
        caseSensitive: args.request.caseSensitive,
        contextLines: args.request.contextLines
      };
  }
}
function shapePublicResult(args) {
  if (args.request.outputMode === "json") {
    const readRecommendation = args.summary?.readRecommendation ? (() => {
      const absolutePath = path12.join(
        args.persistenceRoot,
        args.summary.readRecommendation.relativePath
      );
      return {
        path: normalizeCoordinatorPath(path12.relative(args.basePath, absolutePath)),
        absolute_path: absolutePath,
        ...args.summary?.readRecommendation?.reason ? { reason: args.summary.readRecommendation.reason } : {}
      };
    })() : void 0;
    return {
      mode: "json",
      base_path: args.basePath,
      next_cursor: null,
      backend_used: args.backendUsed,
      fallback_applied: args.fallbackApplied,
      ...args.fallbackApplied ? { fallback_reason: "backend_error" } : {},
      stats: {
        result_count: args.items.length,
        ...typeof args.summary?.shownCount === "number" ? { shown_count: args.summary.shownCount } : {},
        ...typeof args.summary?.totalCount === "number" ? { total_count: args.summary.totalCount } : {}
      },
      ...readRecommendation ? { read_recommendation: readRecommendation } : {},
      items: args.items
    };
  }
  if (args.backendUsed === "fff-mcp" && (args.request.tool === "fff_search_terms" || args.request.tool === "fff_grep") && typeof args.renderedCompact === "string" && args.renderedCompact.length > 0) {
    return {
      mode: "compact",
      base_path: args.basePath,
      next_cursor: null,
      text: args.renderedCompact
    };
  }
  switch (args.request.tool) {
    case "fff_find_files":
      return {
        mode: "compact",
        base_path: args.basePath,
        next_cursor: null,
        items: args.items.map((item) => ({ path: String(item.path) }))
      };
    case "fff_search_terms":
    case "fff_grep":
      return {
        mode: "compact",
        base_path: args.basePath,
        next_cursor: null,
        items: args.items.map((item) => ({
          path: String(item.path),
          line: Number(item.line),
          text: String(item.text)
        }))
      };
  }
}
function normalizeBackendItems(basePath, items) {
  return items.map((item) => {
    const absolutePath = String(item.path);
    const normalized = {
      ...item,
      path: normalizeCoordinatorPath(path12.relative(basePath, absolutePath))
    };
    if (typeof item.line === "number") {
      return {
        path: normalized.path,
        absolute_path: absolutePath,
        line: item.line,
        text: item.text,
        ...typeof item.column === "number" ? { column: item.column } : {},
        ...Array.isArray(item.contextBefore) ? { context_before: item.contextBefore } : {},
        ...Array.isArray(item.contextAfter) ? { context_after: item.contextAfter } : {},
        ...item.isDefinition === true ? { is_definition: true } : {},
        ...Array.isArray(item.definitionBody) ? { definition_body: item.definitionBody } : {}
      };
    }
    return {
      path: normalized.path,
      absolute_path: absolutePath
    };
  });
}
var SearchCoordinatorImpl = class {
  constructor(deps) {
    this.deps = deps;
    this.validateWithin = deps.validateWithin ?? validateResolvedWithinPaths;
    this.resolveRoutingPath = deps.resolveRoutingPath ?? resolveSearchPath;
    this.planLifecycle = deps.planLifecycle ?? planRoutingLifecycle;
    this.now = deps.now ?? Date.now;
  }
  lifecycleState = {
    daemons: {},
    nonGitRecentHits: {},
    now: 0
  };
  planningLocked = false;
  planningWaiters = [];
  validateWithin;
  resolveRoutingPath;
  planLifecycle;
  now;
  releasePlanningLock() {
    const next = this.planningWaiters.shift();
    if (next) {
      next();
      return;
    }
    this.planningLocked = false;
  }
  async withPlanningLock(callback) {
    if (this.planningLocked) {
      await new Promise((resolve) => {
        this.planningWaiters.push(resolve);
      });
    } else {
      this.planningLocked = true;
    }
    try {
      return await callback();
    } finally {
      this.releasePlanningLock();
    }
  }
  getRuntimeConfig() {
    return this.deps.liveConfigRef?.current ?? {
      config: this.deps.config,
      primaryBackendId: this.deps.primaryBackendId,
      fallbackBackendId: this.deps.fallbackBackendId
    };
  }
  syncLifecycleTtls(config) {
    const nextDaemons = Object.fromEntries(
      Object.entries(this.lifecycleState.daemons).map(([key, daemon]) => [
        key,
        {
          ...daemon,
          ttlMs: daemon.rootType === "git" ? config.ttl.gitMs : config.ttl.nonGitMs
        }
      ])
    );
    this.lifecycleState = {
      ...this.lifecycleState,
      daemons: nextDaemons
    };
  }
  async rollbackPersistentLifecycle(key) {
    await this.withPlanningLock(async () => {
      const nextDaemons = { ...this.lifecycleState.daemons };
      delete nextDaemons[key];
      this.lifecycleState = {
        ...this.lifecycleState,
        daemons: nextDaemons
      };
    });
  }
  async applyLifecycleEvictions(evicted) {
    const persistentBackendIds = Object.values(this.deps.adapters).filter((adapter) => typeof adapter.startRuntime === "function").map((adapter) => adapter.backendId);
    await Promise.all(
      evicted.flatMap(
        (persistenceRoot) => persistentBackendIds.map(
          (backendId) => this.deps.runtimeManager.evictRuntime({
            backendId,
            persistenceRoot
          })
        )
      )
    );
  }
  getAdapter(backendId) {
    const adapter = this.deps.adapters[backendId];
    if (!adapter) {
      throw new Error(`No adapter registered for backend '${backendId}'`);
    }
    return adapter;
  }
  async executeWithAdapter(args) {
    const shouldUsePersistentRuntime = args.lifecyclePlan.action.type !== "run-ephemeral";
    if (!args.adapter.supportedQueryKinds.includes(args.request.queryKind)) {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          backendId: args.adapter.backendId,
          message: `${args.adapter.backendId} does not support ${args.request.queryKind}`
        }
      };
    }
    if (!args.adapter.startRuntime) {
      return args.adapter.execute({ request: args.request });
    }
    if (!shouldUsePersistentRuntime) {
      try {
        const runtime = await args.adapter.startRuntime({
          backendId: args.adapter.backendId,
          persistenceRoot: args.request.persistenceRoot
        });
        const result = await args.adapter.execute({
          request: args.request,
          runtime
        });
        try {
          await runtime.close();
        } catch {
        }
        return result;
      } catch (error) {
        return {
          ok: false,
          error: {
            code: "BACKEND_UNAVAILABLE",
            backendId: args.adapter.backendId,
            message: error instanceof Error ? error.message : String(error)
          }
        };
      }
    }
    try {
      return await this.deps.runtimeManager.withRuntime(
        {
          backendId: args.adapter.backendId,
          persistenceRoot: args.request.persistenceRoot,
          start: async () => {
            return await args.adapter.startRuntime?.({
              backendId: args.adapter.backendId,
              persistenceRoot: args.request.persistenceRoot
            });
          }
        },
        async (runtime) => {
          return await args.adapter.execute({ request: args.request, runtime });
        }
      );
    } catch (error) {
      return {
        ok: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          backendId: args.adapter.backendId,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }
  async execute(request) {
    if (!request.within || request.within.length === 0) {
      return invalid4("within must be resolved client-side before reaching the coordinator");
    }
    const queryKind = queryKindForRequest(request);
    const runtimeConfig = this.getRuntimeConfig();
    const primaryAdapter = this.getAdapter(runtimeConfig.primaryBackendId);
    if (!primaryAdapter.supportedQueryKinds.includes(queryKind)) {
      return {
        ok: false,
        error: {
          code: "SEARCH_FAILED",
          message: `${primaryAdapter.backendId} does not support ${queryKind}`
        }
      };
    }
    const validatedWithin = await this.validateWithin({ withinPaths: request.within });
    if (!validatedWithin.ok) {
      return validatedWithin;
    }
    const resolvedPath = await this.resolveRoutingPath(validatedWithin.value.resolvedWithin);
    if (!resolvedPath.ok) {
      switch (resolvedPath.error.code) {
        case "OUTSIDE_ALLOWED_SCOPE":
        case "INVALID_REQUEST":
          return {
            ok: false,
            error: {
              code: resolvedPath.error.code,
              message: resolvedPath.error.message
            }
          };
        case "SEARCH_PATH_NOT_FOUND":
          return {
            ok: false,
            error: {
              code: "WITHIN_NOT_FOUND",
              message: resolvedPath.error.message
            }
          };
        default:
          return internalError2(resolvedPath.error.message);
      }
    }
    const additionalEntries = validatedWithin.value.additionalEntries ?? [];
    if (additionalEntries.length > 0) {
      for (const entry of additionalEntries) {
        const entryPath = await this.resolveRoutingPath(entry.resolvedWithin);
        if (!entryPath.ok) {
          return {
            ok: false,
            error: {
              code: entryPath.error.code === "SEARCH_PATH_NOT_FOUND" ? "WITHIN_NOT_FOUND" : entryPath.error.code === "OUTSIDE_ALLOWED_SCOPE" ? "OUTSIDE_ALLOWED_SCOPE" : entryPath.error.code === "INVALID_REQUEST" ? "INVALID_REQUEST" : "INTERNAL_ERROR",
              message: entryPath.error.message
            }
          };
        }
        if (entryPath.value.gitRoot !== resolvedPath.value.gitRoot) {
          return invalid4(
            `within array entries must share a routing target; '${entry.resolvedWithin}' resolves to a different root than '${validatedWithin.value.resolvedWithin}'`
          );
        }
      }
    }
    const lifecyclePlan = await this.withPlanningLock(async () => {
      this.syncLifecycleTtls(runtimeConfig.config);
      const nextState = {
        ...this.lifecycleState,
        now: this.now()
      };
      const plan = this.planLifecycle({
        queryKind,
        realPath: resolvedPath.value.realPath,
        statType: resolvedPath.value.statType,
        gitRoot: resolvedPath.value.gitRoot,
        config: runtimeConfig.config,
        state: nextState
      });
      if (!plan.ok) {
        return plan;
      }
      this.lifecycleState = plan.value.nextState;
      await this.applyLifecycleEvictions(plan.value.evicted);
      return plan;
    });
    if (!lifecyclePlan.ok) {
      return {
        ok: false,
        error: {
          code: lifecyclePlan.error.code === "OUTSIDE_ALLOWED_SCOPE" ? "OUTSIDE_ALLOWED_SCOPE" : "INVALID_REQUEST",
          message: lifecyclePlan.error.message
        }
      };
    }
    const primaryRequest = buildBackendRequest({
      request,
      validatedWithin: validatedWithin.value,
      persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
      backendId: primaryAdapter.backendId
    });
    const primaryResult = await this.executeWithAdapter({
      adapter: primaryAdapter,
      request: primaryRequest,
      lifecyclePlan: lifecyclePlan.value
    });
    if (primaryResult.ok) {
      const normalizedItems2 = normalizeBackendItems(
        validatedWithin.value.basePath,
        primaryResult.value.items
      );
      return {
        ok: true,
        value: shapePublicResult({
          request,
          basePath: validatedWithin.value.basePath,
          persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
          backendUsed: primaryResult.value.backendId,
          fallbackApplied: false,
          items: normalizedItems2,
          renderedCompact: primaryResult.value.renderedCompact,
          summary: primaryResult.value.summary
        })
      };
    }
    if (lifecyclePlan.value.action.type === "start-persistent" && primaryResult.error.code === "BACKEND_UNAVAILABLE") {
      await this.rollbackPersistentLifecycle(lifecyclePlan.value.action.key);
    }
    if (primaryResult.error.code !== "BACKEND_UNAVAILABLE") {
      return {
        ok: false,
        error: {
          code: primaryResult.error.code,
          message: primaryResult.error.message
        }
      };
    }
    if (!runtimeConfig.fallbackBackendId) {
      return {
        ok: false,
        error: {
          code: primaryResult.error.code,
          message: primaryResult.error.message
        }
      };
    }
    const fallbackAdapter = this.getAdapter(runtimeConfig.fallbackBackendId);
    const fallbackRequest = buildBackendRequest({
      request,
      validatedWithin: validatedWithin.value,
      persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
      backendId: fallbackAdapter.backendId
    });
    const fallbackResult = await this.executeWithAdapter({
      adapter: fallbackAdapter,
      request: fallbackRequest,
      lifecyclePlan: {
        ...lifecyclePlan.value,
        action: { type: "run-ephemeral", key: lifecyclePlan.value.action.key }
      }
    });
    if (!fallbackResult.ok) {
      return {
        ok: false,
        error: {
          code: primaryResult.error.code === "BACKEND_UNAVAILABLE" && fallbackResult.error.code === "BACKEND_UNAVAILABLE" ? "BACKEND_UNAVAILABLE" : "SEARCH_FAILED",
          message: fallbackResult.error.message
        }
      };
    }
    const normalizedItems = normalizeBackendItems(
      validatedWithin.value.basePath,
      fallbackResult.value.items
    );
    return {
      ok: true,
      value: shapePublicResult({
        request,
        basePath: validatedWithin.value.basePath,
        persistenceRoot: lifecyclePlan.value.target.persistenceRoot,
        backendUsed: fallbackResult.value.backendId,
        fallbackApplied: true,
        items: normalizedItems,
        renderedCompact: fallbackResult.value.renderedCompact,
        summary: fallbackResult.value.summary
      })
    };
  }
};
function createSearchCoordinator(deps) {
  return new SearchCoordinatorImpl(deps);
}

// lib/fff-router/http-daemon.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport as StdioServerTransport2 } from "@modelcontextprotocol/sdk/server/stdio.js";
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return void 0;
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function readDaemonMetadata(path16) {
  try {
    return JSON.parse(await readFile(path16, "utf8"));
  } catch {
    return null;
  }
}
async function writeDaemonMetadata(path16, metadata) {
  await writeFile2(path16, `${JSON.stringify(metadata, null, 2)}
`);
}
function toCoordinatorRuntimeConfig(reloadConfig) {
  return {
    config: reloadConfig.router,
    primaryBackendId: reloadConfig.backend.primaryBackendId,
    fallbackBackendId: reloadConfig.backend.fallbackBackendId
  };
}
function createDefaultCoordinator(args) {
  return createSearchCoordinator({
    config: args.liveConfigRef.current.config,
    adapters: {
      "fff-node": createFffNodeAdapter(),
      "fff-mcp": createFffMcpStdioAdapter(),
      rg: createRgAdapter()
    },
    primaryBackendId: args.liveConfigRef.current.primaryBackendId,
    fallbackBackendId: args.liveConfigRef.current.fallbackBackendId,
    liveConfigRef: args.liveConfigRef,
    runtimeManager: args.runtimeManager
  });
}
function shouldReloadForWatchEvent(filename) {
  return !filename || filename === "config.json" || filename === "config.jsonc";
}
function buildMetadata(args) {
  return {
    pid: process.pid,
    host: args.config.host,
    port: args.port,
    mcpPath: args.config.mcpPath,
    mcpSocketPath: getDaemonPaths({ env: args.env }).mcpSocketPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
    packageVersion: PACKAGE_VERSION,
    serverFingerprint: getDaemonServerFingerprint({
      env: args.env,
      daemonConfig: {
        host: args.config.host,
        port: args.port,
        mcpPath: args.config.mcpPath
      }
    }),
    reloadFingerprint: getDaemonReloadFingerprintForConfig(args.reloadConfig),
    startedAt: args.startedAt
  };
}
async function startHttpDaemon(args = {}) {
  const env = args.env ?? process.env;
  const baseConfig = getDaemonConfig({ env });
  const config = {
    host: args.host ?? baseConfig.host,
    port: args.port ?? baseConfig.port,
    mcpPath: args.mcpPath ?? baseConfig.mcpPath
  };
  const loadReloadConfig = args.loadReloadConfig ?? loadDaemonReloadConfig;
  const initialReloadConfig = loadReloadConfig({ env });
  const liveConfigRef = args.liveConfigRef ?? createCoordinatorRuntimeConfigRef(toCoordinatorRuntimeConfig(initialReloadConfig));
  let runtimeManager = new RuntimeManager();
  let currentCoordinator = args.coordinator ?? args.createCoordinator?.({ liveConfigRef, runtimeManager }) ?? createDefaultCoordinator({ liveConfigRef, runtimeManager });
  const paths = getDaemonPaths({ env });
  const policyConfigPaths = getDaemonPolicyConfigPaths({ env });
  const startedAt = Date.now();
  let metadata = null;
  let mcpSocketServer = null;
  const mcpSockets = /* @__PURE__ */ new Set();
  let watcher = null;
  let watcherReloadTimer = null;
  let reloadChain = Promise.resolve();
  let closing = false;
  const reload = async (override) => {
    const nextReload = reloadChain.then(async () => {
      if (closing) {
        throw new Error("fff-routerd is closing");
      }
      const nextConfig = override?.loadConfig ? override.loadConfig() : loadReloadConfig({ env });
      const nextRuntimeConfig = toCoordinatorRuntimeConfig(nextConfig);
      const nextMetadata = buildMetadata({
        env,
        config,
        port: metadata?.port ?? config.port,
        reloadConfig: nextConfig,
        startedAt
      });
      const backendChanged = liveConfigRef.current.primaryBackendId !== nextRuntimeConfig.primaryBackendId;
      await writeDaemonMetadata(paths.metadataPath, nextMetadata);
      liveConfigRef.current = nextRuntimeConfig;
      if (backendChanged && !args.coordinator) {
        const previousRuntimeManager = runtimeManager;
        runtimeManager = new RuntimeManager();
        currentCoordinator = args.createCoordinator?.({ liveConfigRef, runtimeManager }) ?? createDefaultCoordinator({ liveConfigRef, runtimeManager });
        await previousRuntimeManager.closeAll();
      }
      metadata = nextMetadata;
    });
    reloadChain = nextReload.catch(() => {
    });
    return await nextReload;
  };
  await mkdir2(paths.dir, { recursive: true });
  await mkdir2(policyConfigPaths.dir, { recursive: true });
  await rm(paths.mcpSocketPath, { force: true });
  mcpSocketServer = createNetServer((socket) => {
    mcpSockets.add(socket);
    const transport = new StdioServerTransport2(socket, socket);
    const mcpServer = createMcpServer({ coordinator: currentCoordinator }).toSdkServer();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      mcpSockets.delete(socket);
      void transport.close();
      void mcpServer.close();
      socket.destroy();
    };
    socket.once("close", cleanup);
    socket.once("error", cleanup);
    void mcpServer.connect(transport).catch(() => {
      cleanup();
    });
  });
  const closeMcpSocketServer = async () => {
    for (const socket of mcpSockets) {
      socket.destroy();
    }
    mcpSockets.clear();
    await new Promise((resolve) => {
      if (!mcpSocketServer?.listening) {
        resolve();
        return;
      }
      mcpSocketServer.close(() => resolve());
    });
    await rm(paths.mcpSocketPath, { force: true }).catch(() => {
    });
  };
  await new Promise((resolve, reject) => {
    mcpSocketServer.once("error", reject);
    mcpSocketServer.listen(paths.mcpSocketPath, () => {
      mcpSocketServer.off("error", reject);
      resolve();
    });
  });
  const server = createServer(async (req, res) => {
    const url = new URL(
      req.url || "/",
      req.headers.host ? `http://${req.headers.host}` : getDaemonOriginFromConfig({
        host: config.host,
        port: metadata?.port ?? config.port,
        mcpPath: config.mcpPath
      })
    );
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, metadata }));
      return;
    }
    if (url.pathname !== config.mcpPath) {
      res.writeHead(404).end("Not found");
      return;
    }
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: void 0
    });
    const mcpServer = createMcpServer({ coordinator: currentCoordinator }).toSdkServer();
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      void transport.close();
      void mcpServer.close();
    };
    res.once("close", cleanup);
    res.once("finish", cleanup);
    try {
      await mcpServer.connect(transport);
      const parsedBody = req.method === "POST" ? await readJsonBody(req) : void 0;
      await transport.handleRequest(req, res, parsedBody);
      if (res.writableEnded || res.destroyed) {
        cleanup();
      }
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: error instanceof Error ? error.message : String(error)
            },
            id: null
          })
        );
      }
      cleanup();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.listen(config.port, config.host, onListening);
    });
  } catch (error) {
    await closeMcpSocketServer();
    throw error;
  }
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  metadata = buildMetadata({
    env,
    config,
    port: actualPort,
    reloadConfig: initialReloadConfig,
    startedAt
  });
  await writeDaemonMetadata(paths.metadataPath, metadata);
  if (args.watchConfig !== false) {
    watcher = watch(policyConfigPaths.dir, (_eventType, filename) => {
      if (closing) {
        return;
      }
      if (!shouldReloadForWatchEvent(filename?.toString())) {
        return;
      }
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
      }
      watcherReloadTimer = setTimeout(() => {
        watcherReloadTimer = null;
        void reload().catch((error) => {
          console.error("fff-routerd watcher reload failed:", error);
          setTimeout(() => {
            if (closing) {
              return;
            }
            void reload().catch((retryError) => {
              console.error("fff-routerd watcher reload retry failed:", retryError);
            });
          }, 100);
        });
      }, 25);
    });
    watcher.on("error", (error) => {
      console.error("fff-routerd config watcher error:", error);
    });
  }
  return {
    server,
    get metadata() {
      return metadata;
    },
    paths,
    get url() {
      return `${getDaemonOriginFromConfig({
        host: metadata.host,
        port: metadata.port,
        mcpPath: metadata.mcpPath
      })}${metadata.mcpPath}`;
    },
    reload,
    async close() {
      closing = true;
      if (watcherReloadTimer) {
        clearTimeout(watcherReloadTimer);
        watcherReloadTimer = null;
      }
      watcher?.close();
      await reloadChain.catch(() => {
      });
      await new Promise((resolve) => server.close(() => resolve()));
      await closeMcpSocketServer();
      await runtimeManager.closeAll().catch(() => {
      });
      await rm(paths.metadataPath, { force: true }).catch(() => {
      });
    }
  };
}

// lib/fff-router/daemon-autostart.ts
var DaemonHealthMismatchError = class extends Error {
  constructor(message, mismatchKind2, metadata) {
    super(message);
    this.mismatchKind = mismatchKind2;
    this.metadata = metadata;
  }
};
function packagedDaemonEntrypointPath() {
  const primaryCandidatePath = path13.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path13.resolve(import.meta.dirname, "../../bin/fff-routerd.js")
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync3(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function sleep2(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function isExecutable(pathValue) {
  try {
    accessSync(pathValue, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}
function commandExtensions(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  const pathExt = env.PATHEXT?.split(";").filter(Boolean);
  return pathExt && pathExt.length > 0 ? pathExt : [".EXE", ".CMD", ".BAT", ".COM"];
}
function defaultResolveExecutableOnPath(command, env) {
  const pathValue = env.PATH || process.env.PATH || "";
  const directories = pathValue.split(path13.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath = process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension) ? path13.join(directory, `${command}${extension}`) : path13.join(directory, command);
      if (existsSync3(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function resolveDaemonLaunchCommand(env = process.env, deps = {}) {
  if (!deps.preferPackaged) {
    const resolvedCommand = (deps.resolveExecutableOnPath ?? ((command) => defaultResolveExecutableOnPath(command, env)))("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }
  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath()],
    source: "packaged"
  };
}
async function fetchHealthMetadata(env) {
  const config = getDaemonConfig({ env });
  const response = await fetch(new URL(`/health`, getDaemonOriginFromConfig(config)));
  if (!response.ok) {
    throw new Error(`daemon healthcheck failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (!payload.ok || !payload.metadata) {
    throw new Error("daemon healthcheck returned an invalid payload");
  }
  return payload.metadata;
}
function parsePackageVersion(version) {
  if (typeof version !== "string") {
    return null;
  }
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:[.-].*)?$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
function comparePackageVersions(left, right) {
  const leftParts = parsePackageVersion(left);
  const rightParts = parsePackageVersion(right);
  if (!leftParts || !rightParts) {
    return null;
  }
  for (const index of [0, 1, 2]) {
    if (leftParts[index] < rightParts[index]) {
      return -1;
    }
    if (leftParts[index] > rightParts[index]) {
      return 1;
    }
  }
  return 0;
}
function endpointMatchesConfig(metadata, config = getDaemonConfig()) {
  return metadata.host === config.host && metadata.port === config.port && metadata.mcpPath === config.mcpPath;
}
function isNewerCompatibleDaemon(metadata, env) {
  if (!metadata) {
    return false;
  }
  return comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION) === 1 && metadata.protocolVersion === DAEMON_PROTOCOL_VERSION && endpointMatchesConfig(metadata, getDaemonConfig({ env }));
}
function assertCompatibleProtocolAndVersion(metadata, env) {
  const versionComparison = comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION);
  const runningDaemonIsNewer = versionComparison === 1;
  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    if (runningDaemonIsNewer) {
      throw new Error(
        `newer incompatible fff-routerd is already running: expected protocol ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}. Update this client or stop fff-routerd manually.`
      );
    }
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata
    );
  }
  if (versionComparison === 1) {
    if (!endpointMatchesConfig(metadata, getDaemonConfig({ env }))) {
      throw new Error(
        "newer fff-routerd is already running at this endpoint, but its metadata does not match the expected daemon endpoint. Stop fff-routerd manually before starting this client."
      );
    }
    return "running-newer";
  }
  if (versionComparison !== 0 || metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata
    );
  }
  return "same";
}
async function checkDaemonBaseHealth(env) {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }
  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata
    );
  }
}
async function checkDaemonHealth(env) {
  const metadata = await fetchHealthMetadata(env);
  if (assertCompatibleProtocolAndVersion(metadata, env) === "running-newer") {
    return;
  }
  const expectedServerFingerprint = getDaemonServerFingerprint({ env });
  if (metadata.serverFingerprint !== expectedServerFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon server config mismatch; restart required",
      "server",
      metadata
    );
  }
  const expectedReloadFingerprint = getDaemonReloadFingerprint({ env });
  if (metadata.reloadFingerprint !== expectedReloadFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon reload config mismatch; send SIGHUP to reload configuration",
      "reload",
      metadata
    );
  }
}
async function withStartupLock(callback, env) {
  const paths = getDaemonPaths({ env });
  await mkdir3(paths.dir, { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(paths.lockPath, "wx");
      await handle.writeFile(String(process.pid));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => {
        });
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const lockOwner = Number.parseInt(
        (await readFile2(paths.lockPath, "utf8").catch(() => "0")).trim(),
        10
      );
      if (!Number.isFinite(lockOwner) || lockOwner <= 0 || !isProcessAlive(lockOwner)) {
        await rm2(paths.lockPath, { force: true }).catch(() => {
        });
        continue;
      }
      if (Date.now() - startedAt > 15e3) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }
      await sleep2(50);
    }
  }
}
function isRecoverableHealthError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "ECONNREFUSED" || code === "ConnectionRefused" || error.message.includes("fetch") || error.message.includes("ECONNREFUSED") || error.message.includes("ConnectionRefused") || error.message.includes("Unable to connect") || error.message.includes("healthcheck failed");
}
function mismatchKind(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.mismatchKind;
  }
  if (typeof error === "object" && error && "mismatchKind" in error && (error.mismatchKind === "protocol" || error.mismatchKind === "version" || error.mismatchKind === "server" || error.mismatchKind === "reload")) {
    return error.mismatchKind;
  }
  return null;
}
function mismatchPid(error) {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }
  if (typeof error === "object" && error && "metadata" in error && typeof error.metadata === "object" && error.metadata && "pid" in error.metadata && typeof error.metadata.pid === "number") {
    return error.metadata.pid;
  }
  return null;
}
function mismatchMetadata(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.metadata;
  }
  if (typeof error === "object" && error && "metadata" in error && typeof error.metadata === "object" && error.metadata) {
    return error.metadata;
  }
  return null;
}
function shouldPreserveNewerDaemonMismatch(error, env) {
  return mismatchKind(error) !== null && isNewerCompatibleDaemon(mismatchMetadata(error), env);
}
function spawnDaemon(env, options) {
  const launchCommand = resolveDaemonLaunchCommand(env ?? process.env, options);
  const child = spawnChildProcess(launchCommand.command, launchCommand.args, {
    env: env ?? process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
  return {
    unref: () => child.unref(),
    source: launchCommand.source
  };
}
async function waitForDaemonReady(env) {
  let lastError;
  for (const delay of [50, 100, 200, 400, 800, 1200]) {
    try {
      await checkDaemonHealth(env);
      return;
    } catch (error) {
      lastError = error;
      await sleep2(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
async function signalProcess(pid, signal) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }
  try {
    process.kill(pid, signal);
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "ESRCH") {
      return;
    }
    throw error;
  }
}
async function terminateProcess(pid) {
  if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }
  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive(pid)) {
      return;
    }
    await sleep2(delay);
  }
  if (isProcessAlive(pid)) {
    process.kill(pid, "SIGKILL");
  }
}
async function ensureDaemonRunningWithDeps(env, deps) {
  try {
    await deps.checkDaemonHealth(env);
    return;
  } catch (error) {
    if (shouldPreserveNewerDaemonMismatch(error, env)) {
      return;
    }
    if (!isRecoverableHealthError(error) && mismatchKind(error) === null) {
      throw error;
    }
  }
  await deps.withStartupLock(async () => {
    try {
      await deps.checkDaemonHealth(env);
      return;
    } catch (error) {
      if (shouldPreserveNewerDaemonMismatch(error, env)) {
        return;
      }
      const pid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
      if (mismatchKind(error) === "reload") {
        if (pid) {
          try {
            await deps.signalProcess(pid, "SIGHUP");
            await deps.waitForDaemonReady(env);
            return;
          } catch {
          }
        }
      }
      if (mismatchKind(error) === "protocol" || mismatchKind(error) === "version" || mismatchKind(error) === "server" || mismatchKind(error) === "reload") {
        if (pid) {
          await deps.terminateProcess(pid);
        }
      } else if (!isRecoverableHealthError(error)) {
        throw error;
      }
    }
    const existingPid = (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
    if (existingPid) {
      await deps.terminateProcess(existingPid);
    }
    let child = deps.spawnDaemon(env);
    try {
      try {
        await deps.waitForDaemonReady(env);
      } catch (error) {
        if (shouldPreserveNewerDaemonMismatch(error, env)) {
          return;
        }
        if (child.source === "path" && (mismatchKind(error) === "protocol" || mismatchKind(error) === "version")) {
          const spawnedPid = mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
          if (spawnedPid) {
            await deps.terminateProcess(spawnedPid);
          }
          child = deps.spawnDaemon(env, { preferPackaged: true });
          await deps.waitForDaemonReady(env);
        } else {
          throw error;
        }
      }
    } finally {
      child.unref();
    }
  }, env);
}
async function ensureDaemonRunning(env) {
  await ensureDaemonRunningWithDeps(env, {
    checkDaemonHealth,
    checkDaemonBaseHealth,
    readRunningDaemonMetadata,
    signalProcess,
    terminateProcess,
    spawnDaemon,
    waitForDaemonReady,
    withStartupLock
  });
}
async function readRunningDaemonMetadata(env) {
  const paths = getDaemonPaths({ env });
  return await readDaemonMetadata(paths.metadataPath);
}

// lib/fff-router/http-client.ts
import { Client as Client2 } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
function toToolCall(request) {
  const common = {
    within: request.within,
    glob: request.glob,
    extensions: request.extensions,
    exclude_paths: request.excludePaths,
    limit: request.limit,
    cursor: request.cursor,
    output_mode: request.outputMode
  };
  switch (request.tool) {
    case "fff_find_files": {
      const findRequest = request;
      return {
        name: request.tool,
        input: {
          query: findRequest.query,
          ...common
        }
      };
    }
    case "fff_search_terms": {
      const searchTermsRequest = request;
      return {
        name: request.tool,
        input: {
          terms: searchTermsRequest.terms,
          context_lines: searchTermsRequest.contextLines,
          ...common
        }
      };
    }
    case "fff_grep": {
      const grepRequest = request;
      return {
        name: request.tool,
        input: {
          patterns: grepRequest.patterns,
          literal: grepRequest.literal,
          case_sensitive: grepRequest.caseSensitive,
          context_lines: grepRequest.contextLines,
          ...common
        }
      };
    }
  }
}
function unwrapToolResponse(response) {
  const first = response.content?.[0];
  if (!first || first.type !== "text" || typeof first.text !== "string") {
    return {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "daemon returned a non-text MCP tool response"
      }
    };
  }
  const parsed = JSON.parse(first.text);
  if (response.isError) {
    return {
      ok: false,
      error: {
        code: typeof parsed === "object" && parsed && "code" in parsed && typeof parsed.code === "string" ? parsed.code : "INTERNAL_ERROR",
        message: typeof parsed === "object" && parsed && "message" in parsed && typeof parsed.message === "string" ? parsed.message : "daemon call failed"
      }
    };
  }
  return {
    ok: true,
    value: parsed
  };
}
async function createPersistentHttpToolClient(env) {
  const transport = new StreamableHTTPClientTransport(new URL(getDaemonEndpoint({ env })));
  const client = new Client2(
    { name: "fff-router-http-client", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);
  return {
    async callPublicTool(request) {
      const toolCall = toToolCall(request);
      const response = await client.callTool({
        name: toolCall.name,
        arguments: toolCall.input
      });
      return unwrapToolResponse(response);
    },
    async close() {
      await client.close().catch(() => {
      });
      await transport.close().catch(() => {
      });
    }
  };
}
async function callPublicToolOverHttp(request, env) {
  const client = await createPersistentHttpToolClient(env);
  try {
    return await client.callPublicTool(request);
  } finally {
    await client.close();
  }
}

// lib/fff-router/agent-mcp.ts
var agentMcpInputShapes = {
  find_files: {
    query: z2.string().min(1).describe("Fuzzy search query. Keep it short; glob/exclude tokens are allowed."),
    within: z2.string().min(1).optional().describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z2.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z2.array(z2.string().min(1)).optional().describe("Optional relative paths/globs to exclude."),
    extensions: z2.array(z2.string().min(1)).optional().describe("Optional file extensions without leading dots."),
    maxResults: z2.number().int().min(0).optional().describe("Max results (default 20)."),
    cursor: z2.union([z2.string(), z2.null()]).optional().describe("Pagination is not supported; omit or pass null.")
  },
  grep: {
    query: z2.string().min(1).describe(
      "Regex search query with optional constraint prefixes, e.g. '*.ts createMcpServer'."
    ),
    within: z2.string().min(1).optional().describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z2.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z2.array(z2.string().min(1)).optional().describe("Optional relative paths/globs to exclude."),
    extensions: z2.array(z2.string().min(1)).optional().describe("Optional file extensions without leading dots."),
    maxResults: z2.number().int().min(0).optional().describe("Max matching lines (default 20)."),
    cursor: z2.union([z2.string(), z2.null()]).optional().describe("Pagination is not supported; omit or pass null.")
  },
  multi_grep: {
    patterns: z2.array(z2.string().min(1)).min(1).describe("Literal patterns to match with OR semantics."),
    constraints: z2.string().min(1).optional().describe("Optional file constraints, e.g. '*.{ts,tsx} !test/'."),
    within: z2.string().min(1).optional().describe("Optional path to search within. Defaults to the MCP process cwd."),
    glob: z2.string().min(1).optional().describe("Optional include glob relative to within."),
    exclude_paths: z2.array(z2.string().min(1)).optional().describe("Optional relative paths/globs to exclude."),
    extensions: z2.array(z2.string().min(1)).optional().describe("Optional file extensions without leading dots."),
    context: z2.number().int().min(0).optional().describe("Context lines before/after each match."),
    maxResults: z2.number().int().min(0).optional().describe("Max matching lines (default 20)."),
    cursor: z2.union([z2.string(), z2.null()]).optional().describe("Pagination is not supported; omit or pass null.")
  }
};
var AGENT_MCP_TOOLS = [
  {
    name: "find_files",
    description: "Fuzzy file search by name. Searches file names, not file contents. Keep queries short; use glob, within, extensions, and exclude_paths to narrow results.",
    inputSchema: z2.toJSONSchema(z2.object(agentMcpInputShapes.find_files)),
    zodInputShape: agentMcpInputShapes.find_files
  },
  {
    name: "grep",
    description: "Search file contents with a regex-style query. Put optional file constraints before the pattern, e.g. '*.ts createMcpServer'. Use multi_grep for literal OR searches.",
    inputSchema: z2.toJSONSchema(z2.object(agentMcpInputShapes.grep)),
    zodInputShape: agentMcpInputShapes.grep
  },
  {
    name: "multi_grep",
    description: "Search file contents for lines matching ANY literal pattern. Patterns are literal text; use constraints, glob, extensions, and exclude_paths to prefilter files.",
    inputSchema: z2.toJSONSchema(z2.object(agentMcpInputShapes.multi_grep)),
    zodInputShape: agentMcpInputShapes.multi_grep
  }
];
function errorResponse(message) {
  return { isError: true, content: [{ type: "text", text: message }] };
}
function textResponse(text) {
  return { isError: false, content: [{ type: "text", text }] };
}
function normalizeOptionalNonNegativeInt(value, field) {
  if (value === void 0 || value === null) {
    return void 0;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}
function normalizeStringArray(value, field) {
  if (value === void 0 || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  return value;
}
function normalizeCursor2(value) {
  if (value === void 0 || value === null) {
    return null;
  }
  throw new Error("cursor pagination is not supported by fff-routerd's agent MCP profile");
}
function resolveAgentWithin(value, cwd, env) {
  if (value === void 0 || value === null) {
    return cwd;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("within must be a non-empty string when provided");
  }
  const expanded = expandHomePath(value, env);
  if (!expanded.ok) {
    throw new Error(expanded.error.message);
  }
  return path14.isAbsolute(expanded.value) ? expanded.value : path14.resolve(cwd, expanded.value);
}
var GLOB_META_PATTERN = /[*?[\]{}!]/;
function isConstraintToken(token) {
  return token.startsWith("!") || token.endsWith("/") || token.includes("/") || GLOB_META_PATTERN.test(token);
}
function normalizeExcludeToken(token) {
  return token.replace(/^!/, "").replace(/^\.\//, "").replace(/\/\*\*$/, "").replace(/\/+$/, "");
}
function normalizeIncludeToken(token) {
  const normalized = token.replace(/^\.\//, "");
  if (normalized.endsWith("/")) {
    return `${normalized}**`;
  }
  return normalized;
}
function mergeGlobTokens(tokens) {
  const unique = Array.from(new Set(tokens.filter(Boolean)));
  if (unique.length === 0) {
    return void 0;
  }
  if (unique.length === 1) {
    return unique[0];
  }
  return `{${unique.join(",")}}`;
}
function parseConstraints(text) {
  const includeTokens = [];
  const excludePaths = [];
  for (const token of text?.trim().split(/\s+/).filter(Boolean) ?? []) {
    if (token.startsWith("!")) {
      excludePaths.push(normalizeExcludeToken(token));
      continue;
    }
    includeTokens.push(normalizeIncludeToken(token));
  }
  return { glob: mergeGlobTokens(includeTokens), excludePaths };
}
function combineGlobs(left, right) {
  return mergeGlobTokens([left, right].filter((value) => Boolean(value)));
}
function parseFindFilesQuery(query) {
  const queryTokens = [];
  const constraintTokens = [];
  for (const token of query.trim().split(/\s+/).filter(Boolean)) {
    if (isConstraintToken(token)) {
      constraintTokens.push(token);
    } else {
      queryTokens.push(token);
    }
  }
  return {
    query: queryTokens.length > 0 ? queryTokens.join(" ") : query.trim(),
    constraints: parseConstraints(constraintTokens.join(" "))
  };
}
function parseGrepQuery(query) {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const pattern = tokens.pop();
  if (!pattern) {
    throw new Error("query must include a search pattern");
  }
  return { pattern, constraints: parseConstraints(tokens.join(" ")) };
}
function normalizePublicRequest(tool, input) {
  const normalized = normalizePublicToolInput(tool, input);
  if (!normalized.ok) {
    throw new Error(`${normalized.error.code}: ${normalized.error.message}`);
  }
  return normalized.value;
}
function buildFindFilesRequest(input, cwd, env) {
  if (typeof input.query !== "string" || input.query.trim() === "") {
    throw new Error("query must be a non-empty string");
  }
  const parsed = parseFindFilesQuery(input.query);
  const explicitGlob = typeof input.glob === "string" ? input.glob : void 0;
  return normalizePublicRequest("fff_find_files", {
    query: parsed.query,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(parsed.constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...parsed.constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths")
    ],
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor2(input.cursor),
    output_mode: "compact"
  });
}
function buildGrepRequest(input, cwd, env) {
  if (typeof input.query !== "string" || input.query.trim() === "") {
    throw new Error("query must be a non-empty string");
  }
  const parsed = parseGrepQuery(input.query);
  const explicitGlob = typeof input.glob === "string" ? input.glob : void 0;
  return normalizePublicRequest("fff_grep", {
    patterns: [parsed.pattern],
    literal: false,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(parsed.constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...parsed.constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths")
    ],
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor2(input.cursor),
    output_mode: "compact"
  });
}
function buildMultiGrepRequest(input, cwd, env) {
  const patterns = normalizeStringArray(input.patterns, "patterns");
  if (patterns.length === 0) {
    throw new Error("patterns must contain at least one entry");
  }
  const constraints = parseConstraints(
    typeof input.constraints === "string" ? input.constraints : void 0
  );
  const explicitGlob = typeof input.glob === "string" ? input.glob : void 0;
  return normalizePublicRequest("fff_grep", {
    patterns,
    literal: true,
    within: resolveAgentWithin(input.within, cwd, env),
    glob: combineGlobs(constraints.glob, explicitGlob),
    extensions: normalizeStringArray(input.extensions, "extensions"),
    exclude_paths: [
      ...constraints.excludePaths,
      ...normalizeStringArray(input.exclude_paths, "exclude_paths")
    ],
    context_lines: normalizeOptionalNonNegativeInt(input.context, "context"),
    limit: normalizeOptionalNonNegativeInt(input.maxResults, "maxResults"),
    cursor: normalizeCursor2(input.cursor),
    output_mode: "compact"
  });
}
function formatFindFilesResult(result) {
  const body = result.items.length > 0 ? result.items.map((item) => item.path).join("\n") : "(no files found)";
  return `base_path: ${result.base_path}

${body}`;
}
function formatStructuredGrepResult(result) {
  const body = result.items.length > 0 ? result.items.map((item) => `${item.path}
  ${item.line}: ${item.text}`).join("\n--\n") : "(no matches found)";
  return `base_path: ${result.base_path}

${body}`;
}
function formatJsonResult(result) {
  return JSON.stringify(result, null, 2);
}
function formatAgentResult(result) {
  if (result.mode === "compact" && "text" in result) {
    return result.text;
  }
  if (result.mode === "compact" && "items" in result) {
    const first = result.items[0];
    if (!first || "line" in first) {
      return formatStructuredGrepResult(
        result
      );
    }
    return formatFindFilesResult(result);
  }
  return formatJsonResult(result);
}
function buildRequest(name, input, cwd, env) {
  switch (name) {
    case "find_files":
      return buildFindFilesRequest(input, cwd, env);
    case "grep":
      return buildGrepRequest(input, cwd, env);
    case "multi_grep":
      return buildMultiGrepRequest(input, cwd, env);
  }
}
async function executeAgentMcpTool(args) {
  if (!args.input || typeof args.input !== "object" || Array.isArray(args.input)) {
    return errorResponse("request must be an object");
  }
  const env = args.env ?? process.env;
  const cwd = args.cwd ?? process.cwd();
  const ensureDaemonRunning2 = args.ensureDaemonRunning ?? ensureDaemonRunning;
  const callPublicToolOverHttp2 = args.callPublicToolOverHttp ?? callPublicToolOverHttp;
  try {
    const request = buildRequest(args.name, args.input, cwd, env);
    await ensureDaemonRunning2(env);
    const result = await callPublicToolOverHttp2(request, env);
    if (!result.ok) {
      return errorResponse(`${result.error.code}: ${result.error.message}`);
    }
    return textResponse(formatAgentResult(result.value));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error));
  }
}
function createAgentMcpServer(args = {}) {
  const server = new McpServer2({ name: "fff-router-agent-mcp", version: "1.0.0" });
  for (const tool of AGENT_MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.zodInputShape
      },
      async (input) => await executeAgentMcpTool({
        name: tool.name,
        input,
        cwd: args.cwd,
        env: args.env,
        ensureDaemonRunning: args.ensureDaemonRunning,
        callPublicToolOverHttp: args.callPublicToolOverHttp
      })
    );
  }
  return server;
}
async function runAgentMcpServer(args = {}) {
  const server = createAgentMcpServer({ cwd: args.cwd, env: args.env });
  const transport = new StdioServerTransport3();
  await server.connect(transport);
  await new Promise((resolve, reject) => {
    const stdin = args.stdin ?? processStdin;
    stdin.once("end", resolve);
    stdin.once("close", resolve);
    stdin.once("error", reject);
  }).finally(async () => {
    await server.close().catch(() => {
    });
  });
}

// lib/fff-router/daemon-update.ts
import { createHash as createHash2 } from "node:crypto";
import { spawn as spawn2 } from "node:child_process";
import { access, chmod as chmod2, mkdir as mkdir4, rename as rename2, writeFile as writeFile3 } from "node:fs/promises";
import { constants as fsConstants2 } from "node:fs";
import os3 from "node:os";
import path15 from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as processStdin2, stdout as processStdout } from "node:process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
var execFileAsync = promisify(execFile);
var FFF_MCP_REPO = "dmtrKovalenko/fff.nvim";
var FFF_ROUTER_GITHUB_PACKAGE_JSON = "https://raw.githubusercontent.com/unstableneutron/fff-router/main/package.json";
var FFF_ROUTER_AUBE_SPEC = "github:unstableneutron/fff-router";
function defaultInstallDir2(env) {
  return env.FFF_MCP_INSTALL_DIR || path15.join(env.HOME || os3.homedir(), ".local", "bin");
}
function fffMcpBinaryPath(env, target) {
  return path15.join(defaultInstallDir2(env), target.includes("windows") ? "fff-mcp.exe" : "fff-mcp");
}
function releaseFilename2(target) {
  const extension = target.includes("windows") ? ".exe" : "";
  return `fff-mcp-${target}${extension}`;
}
function stripLeadingV(version) {
  return version.replace(/^v/i, "");
}
function compareVersions(left, right) {
  const leftParts = stripLeadingV(left).split(/[.-]/).map((part) => Number(part));
  const rightParts = stripLeadingV(right).split(/[.-]/).map((part) => Number(part));
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
    const rightValue = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;
    if (leftValue < rightValue) {
      return -1;
    }
    if (leftValue > rightValue) {
      return 1;
    }
  }
  return 0;
}
function parseFffMcpVersion(text) {
  const match = text.match(/fff-mcp\s+([0-9]+(?:\.[0-9]+){1,3})/i) ?? text.match(/([0-9]+(?:\.[0-9]+){1,3})/);
  return match?.[1] ?? null;
}
async function readInstalledFffMcpVersion(binaryPath) {
  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, ["--version"], { timeout: 5e3 });
    return parseFffMcpVersion(`${stdout}
${stderr}`);
  } catch {
    return null;
  }
}
async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json, application/json",
      "user-agent": "fff-routerd-update"
    }
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.json();
}
async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "fff-routerd-update" }
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return await response.text();
}
function isReleaseAsset(value) {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string" && "browser_download_url" in value && typeof value.browser_download_url === "string";
}
function isStableReleaseTag(tag) {
  return /^v?\d+\.\d+\.\d+$/.test(tag);
}
function selectLatestFffMcpRelease(releases, target) {
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }
  const filename = releaseFilename2(target);
  for (const release of releases) {
    if (typeof release !== "object" || release === null) {
      continue;
    }
    const releaseRecord = release;
    const tag = typeof releaseRecord.tag_name === "string" ? releaseRecord.tag_name : null;
    if (!tag || releaseRecord.prerelease === true || !isStableReleaseTag(tag)) {
      continue;
    }
    const assets = Array.isArray(releaseRecord.assets) ? releaseRecord.assets : [];
    const asset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === filename
    );
    if (!isReleaseAsset(asset)) {
      continue;
    }
    const checksumAsset = assets.find(
      (candidate) => isReleaseAsset(candidate) && candidate.name === `${filename}.sha256`
    );
    return {
      tag,
      version: stripLeadingV(tag),
      assetUrl: asset.browser_download_url,
      checksumUrl: isReleaseAsset(checksumAsset) ? checksumAsset.browser_download_url : `${asset.browser_download_url}.sha256`
    };
  }
  throw new Error(`No fff-mcp release contains ${filename}`);
}
async function getLatestFffMcpRelease(target) {
  const releases = await fetchJson(`https://api.github.com/repos/${FFF_MCP_REPO}/releases`);
  if (!Array.isArray(releases)) {
    throw new Error("GitHub releases response was not an array");
  }
  return selectLatestFffMcpRelease(releases, target);
}
async function checkFffMcpUpdate(args = {}) {
  const env = args.env ?? process.env;
  let target;
  let binaryPath;
  try {
    target = args.target ?? detectFffMcpTarget();
    binaryPath = fffMcpBinaryPath(env, target);
    const [currentVersion, latest] = await Promise.all([
      (args.readInstalledVersion ?? readInstalledFffMcpVersion)(binaryPath),
      (args.getLatestRelease ?? getLatestFffMcpRelease)(target)
    ]);
    const common = {
      binaryPath,
      target,
      latestVersion: latest.version,
      latestTag: latest.tag
    };
    if (!currentVersion) {
      return {
        kind: "missing",
        ...common,
        currentVersion: null,
        assetUrl: latest.assetUrl,
        checksumUrl: latest.checksumUrl
      };
    }
    if (compareVersions(currentVersion, latest.version) >= 0) {
      return { kind: "current", ...common, currentVersion };
    }
    return {
      kind: "outdated",
      ...common,
      currentVersion,
      assetUrl: latest.assetUrl,
      checksumUrl: latest.checksumUrl
    };
  } catch (error) {
    target = args.target ?? "unknown";
    binaryPath = fffMcpBinaryPath(env, target);
    return {
      kind: "unavailable",
      binaryPath,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
async function downloadToFile(url, destinationPath) {
  const response = await fetch(url, { headers: { "user-agent": "fff-routerd-update" } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  await writeFile3(destinationPath, Buffer.from(await response.arrayBuffer()));
}
function extractSha256(text) {
  const match = text.match(/[a-f0-9]{64}/i);
  if (!match) {
    throw new Error("checksum response did not contain a SHA256 digest");
  }
  return match[0].toLowerCase();
}
async function sha256File(filePath) {
  const { readFile: readFile3 } = await import("node:fs/promises");
  return createHash2("sha256").update(await readFile3(filePath)).digest("hex");
}
async function installFffMcpUpdate(plan, deps = {}) {
  const directory = path15.dirname(plan.binaryPath);
  const tempPath = path15.join(directory, `.fff-mcp.${process.pid}.${Date.now()}.download`);
  await mkdir4(directory, { recursive: true });
  await (deps.downloadToFile ?? downloadToFile)(plan.assetUrl, tempPath);
  const expectedDigest = extractSha256(await (deps.fetchText ?? fetchText)(plan.checksumUrl));
  const actualDigest = await sha256File(tempPath);
  if (actualDigest !== expectedDigest) {
    throw new Error(`fff-mcp checksum mismatch: expected ${expectedDigest}, got ${actualDigest}`);
  }
  await chmod2(tempPath, 493);
  await rename2(tempPath, plan.binaryPath);
  await writeFile3(
    path15.join(directory, ".fff-mcp-install.json"),
    `${JSON.stringify(
      {
        tag: plan.latestTag,
        target: plan.target,
        version: plan.latestVersion,
        installedAt: Date.now()
      },
      null,
      2
    )}
`
  );
  return plan.binaryPath;
}
function commandExtensions2(env) {
  if (process.platform !== "win32") {
    return [""];
  }
  return env.PATHEXT?.split(";").filter(Boolean) ?? [".EXE", ".CMD", ".BAT", ".COM"];
}
async function commandExists(command, env = process.env) {
  const directories = (env.PATH || process.env.PATH || "").split(path15.delimiter).filter(Boolean);
  for (const directory of directories) {
    for (const extension of commandExtensions2(env)) {
      const candidate = path15.join(directory, extension ? `${command}${extension}` : command);
      try {
        await access(candidate, fsConstants2.X_OK);
        return true;
      } catch {
      }
    }
  }
  return false;
}
async function getLatestFffRouterdVersion() {
  const parsed = await fetchJson(FFF_ROUTER_GITHUB_PACKAGE_JSON);
  if (typeof parsed !== "object" || parsed === null || !("version" in parsed) || typeof parsed.version !== "string") {
    throw new Error("fff-router package.json did not contain a version");
  }
  return parsed.version;
}
async function checkFffRouterdUpdate(args = {}) {
  const currentVersion = args.currentVersion ?? PACKAGE_VERSION;
  try {
    if (!await (args.commandExists ?? commandExists)("aube")) {
      return {
        kind: "unavailable",
        currentVersion,
        message: "aube is not available on PATH; install with: aube add -g github:unstableneutron/fff-router"
      };
    }
    const latestVersion = await (args.getLatestVersion ?? getLatestFffRouterdVersion)();
    if (compareVersions(currentVersion, latestVersion) >= 0) {
      return { kind: "current", currentVersion, latestVersion };
    }
    return {
      kind: "outdated",
      currentVersion,
      latestVersion,
      command: ["aube", "add", "-g", FFF_ROUTER_AUBE_SPEC]
    };
  } catch (error) {
    return {
      kind: "unavailable",
      currentVersion,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
async function installFffRouterdUpdate(plan) {
  await new Promise((resolve, reject) => {
    const child = spawn2(plan.command[0], plan.command.slice(1), { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${plan.command.join(" ")} exited with code ${code ?? "null"}`));
    });
  });
}
async function defaultConfirm(question) {
  const rl = createInterface({ input: processStdin2, output: processStdout });
  try {
    const answer = await rl.question(`${question} [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
async function runInteractiveUpdate(options = {}) {
  const env = options.env ?? process.env;
  const writeStdout = options.writeStdout ?? ((text) => process.stdout.write(text));
  const writeStderr = options.writeStderr ?? ((text) => process.stderr.write(text));
  const confirm = options.confirm ?? defaultConfirm;
  const checkMcp = options.checkFffMcpUpdate ?? (() => checkFffMcpUpdate({ env }));
  const checkRouterd = options.checkFffRouterdUpdate ?? (() => checkFffRouterdUpdate());
  const applyMcp = options.installFffMcpUpdate ?? installFffMcpUpdate;
  const applyRouterd = options.installFffRouterdUpdate ?? installFffRouterdUpdate;
  const stopDaemon2 = options.stopDaemon ?? (async () => false);
  let updatedSomething = false;
  const mcp = await checkMcp();
  switch (mcp.kind) {
    case "current":
      writeStdout(`fff-mcp is already up to date (${mcp.currentVersion}).
`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-mcp at ${mcp.binaryPath}: ${mcp.message}
`);
      break;
    case "missing":
    case "outdated": {
      const label = mcp.currentVersion ?? "not installed";
      if (await confirm(`Update fff-mcp ${label} -> ${mcp.latestVersion}?`)) {
        const installedPath = await applyMcp(mcp);
        writeStdout(`Updated fff-mcp to ${mcp.latestVersion} at ${installedPath}.
`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-mcp update.\n");
      }
      break;
    }
  }
  const routerd = await checkRouterd();
  switch (routerd.kind) {
    case "current":
      writeStdout(`fff-routerd is already up to date (${routerd.currentVersion}).
`);
      break;
    case "unavailable":
      writeStderr(`Could not check fff-routerd: ${routerd.message}
`);
      break;
    case "outdated":
      if (await confirm(
        `Update fff-routerd ${routerd.currentVersion} -> ${routerd.latestVersion} with aube?`
      )) {
        await applyRouterd(routerd);
        writeStdout(`Updated fff-routerd to ${routerd.latestVersion}.
`);
        updatedSomething = true;
      } else {
        writeStdout("Skipped fff-routerd update.\n");
      }
      break;
  }
  if (updatedSomething) {
    const stopped = await stopDaemon2();
    if (stopped) {
      writeStdout("Stopped fff-routerd; it will restart on the next request.\n");
    } else {
      writeStdout("fff-routerd was not running; it will start on the next request.\n");
    }
  }
  return 0;
}

// lib/fff-router/mcp-bridge.ts
import { createConnection } from "node:net";
function waitForSocketConnect(socket) {
  if (socket.readyState === "open") {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
async function openMcpSocket(socketPath, connectSocket) {
  const socket = connectSocket(socketPath);
  try {
    await waitForSocketConnect(socket);
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}
async function connectMcpSocket(options = {}) {
  const env = options.env ?? process.env;
  const ensureDaemonRunning2 = options.ensureDaemonRunning ?? ensureDaemonRunning;
  const connectSocket = options.connectSocket ?? createConnection;
  const socketPath = getDaemonPaths({ env }).mcpSocketPath;
  let lastError;
  for (const _attempt of [0, 1]) {
    await ensureDaemonRunning2();
    try {
      return await openMcpSocket(socketPath, connectSocket);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `failed to connect to fff-routerd MCP socket at ${socketPath}: ${errorMessage(lastError)}`
  );
}
async function runMcpSocketBridge(options = {}) {
  const socket = await connectMcpSocket(options);
  const input = options.stdin ?? process.stdin;
  const output = options.stdout ?? process.stdout;
  let inputEnded = false;
  await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      input.off("end", onInputEnd);
      input.off("close", onInputEnd);
      input.off("error", onInputError);
      output.off("error", onOutputError);
      socket.off("close", onSocketClose);
      socket.off("error", onSocketError);
      input.unpipe(socket);
      socket.unpipe(output);
    };
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    };
    const onInputEnd = () => {
      inputEnded = true;
      socket.end();
    };
    const onSocketClose = () => {
      setTimeout(() => {
        if (inputEnded || input.readableEnded || input.destroyed) {
          finish();
          return;
        }
        fail(new Error("MCP socket closed unexpectedly before stdin ended"));
      }, 0);
    };
    const onSocketError = (error) => {
      fail(error);
    };
    const onInputError = (error) => {
      fail(error);
    };
    const onOutputError = (error) => {
      fail(error);
    };
    input.once("end", onInputEnd);
    input.once("close", onInputEnd);
    input.once("error", onInputError);
    output.once("error", onOutputError);
    socket.once("close", onSocketClose);
    socket.once("error", onSocketError);
    input.pipe(socket);
    socket.pipe(output, { end: false });
  });
}

// lib/fff-router/daemon-cli.ts
function isProcessAlive2(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
function parseDaemonCliCommand(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case void 0:
    case "run":
      return { name: "run" };
    case "mcp":
      if (rest.length === 0) {
        return { name: "mcp", profile: "agent" };
      }
      if (rest.length === 1 && rest[0] === "--structured") {
        return { name: "mcp", profile: "structured" };
      }
      if (rest.length === 2 && rest[0] === "--profile") {
        if (rest[1] === "agent" || rest[1] === "structured") {
          return { name: "mcp", profile: rest[1] };
        }
        throw new Error(`unknown mcp profile: ${rest[1]}`);
      }
      throw new Error(`unknown mcp arguments: ${rest.join(" ")}`);
    case "status":
      return { name: "status" };
    case "reload":
      return { name: "reload" };
    case "stop":
      return { name: "stop" };
    case "doctor":
      return { name: "doctor" };
    case "install-fff-mcp":
      return { name: "install-fff-mcp" };
    case "update":
      return { name: "update" };
    default:
      throw new Error(`unknown command: ${command}`);
  }
}
async function getDaemonStatus(env = process.env) {
  const metadata = await readDaemonMetadata(getDaemonPaths({ env }).metadataPath);
  if (!metadata || !isProcessAlive2(metadata.pid)) {
    return { running: false, metadata: null };
  }
  return { running: true, metadata };
}
async function reloadDaemon(env = process.env) {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  process.kill(status.metadata.pid, "SIGHUP");
  return true;
}
async function sleep3(ms) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}
async function stopDaemon(env = process.env) {
  const status = await getDaemonStatus(env);
  if (!status.metadata) {
    return false;
  }
  process.kill(status.metadata.pid, "SIGTERM");
  for (const delay of [25, 50, 100, 200, 400, 800]) {
    if (!isProcessAlive2(status.metadata.pid)) {
      return true;
    }
    await sleep3(delay);
  }
  if (isProcessAlive2(status.metadata.pid)) {
    process.kill(status.metadata.pid, "SIGKILL");
  }
  return true;
}
async function runForegroundDaemon(env = process.env) {
  const daemon = await startHttpDaemon({ env });
  const shutdown = async () => {
    const hardExit = setTimeout(() => {
      process.exit(1);
    }, 1e3);
    hardExit.unref?.();
    try {
      await daemon.close();
      clearTimeout(hardExit);
      process.exit(0);
    } catch (error) {
      console.error("fff-routerd shutdown failed:", error);
      clearTimeout(hardExit);
      process.exit(1);
    }
  };
  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGHUP", () => {
    void daemon.reload().catch((error) => {
      console.error("fff-routerd reload failed:", error);
    });
  });
  await new Promise(() => {
  });
}
async function getDoctorReport(env = process.env) {
  const status = await getDaemonStatus(env);
  const policyPaths = getDaemonPolicyConfigPaths({ env });
  const daemonPaths = getDaemonPaths({ env });
  return {
    ...status,
    endpoint: getDaemonEndpoint({ env }),
    configPath: policyPaths.jsonPath,
    stateDir: daemonPaths.dir,
    daemonConfig: getDaemonConfig({ env }),
    fffMcp: await getDoctorFffMcpStatus(env)
  };
}
async function executeDaemonCliCommand(command, deps) {
  switch (command.name) {
    case "run":
      await deps.runDaemon();
      return 0;
    case "mcp":
      await (deps.runMcpServer ?? runSelectedMcpServer)(command.profile);
      return 0;
    case "status": {
      const status = await deps.getStatus();
      deps.writeStdout(`${JSON.stringify(status, null, 2)}
`);
      return 0;
    }
    case "reload": {
      const reloaded = await deps.reloadDaemon();
      if (!reloaded) {
        deps.writeStderr("fff-routerd is not running\n");
        return 1;
      }
      deps.writeStdout("Reloaded fff-routerd\n");
      return 0;
    }
    case "stop": {
      const stopped = await deps.stopDaemon();
      if (!stopped) {
        deps.writeStderr("fff-routerd is not running\n");
        return 1;
      }
      deps.writeStdout("Stopped fff-routerd\n");
      return 0;
    }
    case "doctor": {
      const report = await deps.getDoctorReport();
      deps.writeStdout(`${JSON.stringify(report, null, 2)}
`);
      return 0;
    }
    case "install-fff-mcp": {
      const installedPath = await deps.installFffMcp();
      deps.writeStdout(`Installed fff-mcp to ${installedPath}
`);
      return 0;
    }
    case "update":
      return await (deps.runUpdate ?? runInteractiveUpdate)();
  }
}
async function runSelectedMcpServer(profile) {
  if (profile === "structured") {
    await runMcpSocketBridge();
    return;
  }
  await runAgentMcpServer();
}
async function main(argv, env = process.env) {
  const command = parseDaemonCliCommand(argv);
  return await executeDaemonCliCommand(command, {
    getStatus: async () => await getDaemonStatus(env),
    reloadDaemon: async () => await reloadDaemon(env),
    stopDaemon: async () => await stopDaemon(env),
    getDoctorReport: async () => await getDoctorReport(env),
    installFffMcp: async () => await installFffMcpBinary({ env }),
    runUpdate: async () => await runInteractiveUpdate({
      env,
      stopDaemon: async () => await stopDaemon(env)
    }),
    runDaemon: async () => await runForegroundDaemon(env),
    runMcpServer: async (profile) => {
      if (profile === "structured") {
        await runMcpSocketBridge({ env });
        return;
      }
      await runAgentMcpServer({ env });
    },
    writeStdout: (text) => process.stdout.write(text),
    writeStderr: (text) => process.stderr.write(text)
  });
}

// bin/fff-routerd.ts
main(process.argv.slice(2), process.env).then((exitCode) => {
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}).catch((error) => {
  console.error("fff-routerd failed:", error);
  process.exit(1);
});
