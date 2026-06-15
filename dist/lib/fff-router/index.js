var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) =>
  function __require() {
    return (
      mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports
    );
  };
var __copyProps = (to, from, except, desc) => {
  if ((from && typeof from === "object") || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, {
          get: () => from[key],
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable,
        });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (
  (target = mod != null ? __create(__getProtoOf(mod)) : {}),
  __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule
      ? __defProp(target, "default", { value: mod, enumerable: true })
      : target,
    mod,
  )
);

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/constants.js
var require_constants = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/constants.js"(
    exports,
    module,
  ) {
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
      SEP,
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
      SEP: "\\",
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
      xdigit: "A-Fa-f0-9",
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
        "**/**/**": "**",
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
          "@": { type: "at", open: "(?:", close: ")" },
        };
      },
      /**
       * Create GLOB_CHARS
       */
      globChars(win32) {
        return win32 === true ? WINDOWS_CHARS : POSIX_CHARS;
      },
    };
  },
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/utils.js
var require_utils = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/utils.js"(
    exports,
  ) {
    "use strict";
    var {
      REGEX_BACKSLASH,
      REGEX_REMOVE_BACKSLASH,
      REGEX_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_GLOBAL,
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
    exports.basename = (path6, { windows } = {}) => {
      const segs = path6.split(windows ? /[\\/]/ : "/");
      const last = segs[segs.length - 1];
      if (last === "") {
        return segs[segs.length - 2];
      }
      return last;
    };
  },
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/scan.js
var require_scan = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/scan.js"(
    exports,
    module,
  ) {
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
      CHAR_RIGHT_SQUARE_BRACKET,
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
          const isExtglobChar =
            code === CHAR_PLUS ||
            code === CHAR_AT ||
            code === CHAR_ASTERISK ||
            code === CHAR_QUESTION_MARK ||
            code === CHAR_EXCLAMATION_MARK;
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
        negatedExtglob,
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
  },
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/parse.js
var require_parse = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/parse.js"(
    exports,
    module,
  ) {
    "use strict";
    var constants = require_constants();
    var utils = require_utils();
    var {
      MAX_LENGTH,
      POSIX_REGEX_SOURCE,
      REGEX_NON_SPECIAL_CHARS,
      REGEX_SPECIAL_CHARS_BACKREF,
      REPLACEMENTS,
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
      if ((pattern[0] !== "+" && pattern[0] !== "*") || pattern[1] !== "(") {
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
              end: i,
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
      const source =
        chars.length === 1
          ? utils.escapeRegex(chars[0])
          : `[${chars.map((ch) => utils.escapeRegex(ch)).join("")}]`;
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
      const max =
        typeof options.maxExtglobRecursion === "number"
          ? options.maxExtglobRecursion
          : constants.DEFAULT_MAX_EXTGLOB_RECURSION;
      const branches = splitTopLevel(body).map((branch) => branch.trim());
      if (branches.length > 1) {
        if (
          branches.some((branch) => branch === "") ||
          branches.some((branch) => /^[*?]+$/.test(branch)) ||
          hasRepeatedCharPrefixOverlap(branches)
        ) {
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
      const max =
        typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
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
        START_ANCHOR,
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
        tokens,
      };
      input = utils.removePrefix(input, state);
      len = input.length;
      const extglobs = [];
      const braces = [];
      const stack = [];
      let prev = bos;
      let value;
      const eos = () => state.index === len - 1;
      const peek = (state.peek = (n = 1) => input[state.index + n]);
      const advance = (state.advance = () => input[++state.index] || "");
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
          const isExtglob =
            tok.extglob === true ||
            (extglobs.length && (tok.type === "pipe" || tok.type === "paren"));
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
          const safeOutput = analysis.safeOutput
            ? (token.output ? "" : ONE_CHAR) +
              (opts.capture ? `(${analysis.safeOutput})` : analysis.safeOutput)
            : void 0;
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
        let output = input.replace(
          REGEX_SPECIAL_CHARS_BACKREF,
          (m, esc, chars, first, rest, index) => {
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
          },
        );
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
          if ((value === "[" && peek() !== ":") || (value === "-" && peek() === "]")) {
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
          if (
            opts.nobracket === true ||
            (prev && prev.type === "bracket" && prev.value.length === 1)
          ) {
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
            tokensIndex: state.tokens.length,
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
            if (
              (prev.value === "(" && !/[!=<:]/.test(next)) ||
              (next === "<" && !/<([!=]|\w+>)/.test(remaining()))
            ) {
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
          if ((prev && prev.value === "(") || opts.regex === false) {
            push({ type: "plus", value, output: PLUS_LITERAL });
            continue;
          }
          if (
            (prev && (prev.type === "bracket" || prev.type === "paren" || prev.type === "brace")) ||
            state.parens > 0
          ) {
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
          if (opts.bash === true && (!isStart || (rest[0] && rest[0] !== "/"))) {
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
      const max =
        typeof opts.maxLength === "number" ? Math.min(MAX_LENGTH, opts.maxLength) : MAX_LENGTH;
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
        START_ANCHOR,
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
  },
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/picomatch.js
var require_picomatch = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/lib/picomatch.js"(
    exports,
    module,
  ) {
    "use strict";
    var scan = require_scan();
    var parse = require_parse();
    var utils = require_utils();
    var constants = require_constants();
    var isObject = (val) => val && typeof val === "object" && !Array.isArray(val);
    var picomatch2 = (glob, options, returnState = false) => {
      if (Array.isArray(glob)) {
        const fns = glob.map((input) => picomatch2(input, options, returnState));
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
      if (glob === "" || (typeof glob !== "string" && !isState)) {
        throw new TypeError("Expected pattern to be a non-empty string");
      }
      const opts = options || {};
      const posix = opts.windows;
      const regex = isState
        ? picomatch2.compileRe(glob, options)
        : picomatch2.makeRe(glob, options, false, true);
      const state = regex.state;
      delete regex.state;
      let isIgnored = () => false;
      if (opts.ignore) {
        const ignoreOpts = { ...options, ignore: null, onMatch: null, onResult: null };
        isIgnored = picomatch2(opts.ignore, ignoreOpts, returnState);
      }
      const matcher = (input, returnObject = false) => {
        const { isMatch, match, output } = picomatch2.test(input, regex, options, { glob, posix });
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
    picomatch2.test = (input, regex, options, { glob, posix } = {}) => {
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
          match = picomatch2.matchBase(input, regex, options, posix);
        } else {
          match = regex.exec(output);
        }
      }
      return { isMatch: Boolean(match), match, output };
    };
    picomatch2.matchBase = (input, glob, options) => {
      const regex = glob instanceof RegExp ? glob : picomatch2.makeRe(glob, options);
      return regex.test(utils.basename(input));
    };
    picomatch2.isMatch = (str, patterns, options) => picomatch2(patterns, options)(str);
    picomatch2.parse = (pattern, options) => {
      if (Array.isArray(pattern)) return pattern.map((p) => picomatch2.parse(p, options));
      return parse(pattern, { ...options, fastpaths: false });
    };
    picomatch2.scan = (input, options) => scan(input, options);
    picomatch2.compileRe = (state, options, returnOutput = false, returnState = false) => {
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
      const regex = picomatch2.toRegex(source, options);
      if (returnState === true) {
        regex.state = state;
      }
      return regex;
    };
    picomatch2.makeRe = (input, options = {}, returnOutput = false, returnState = false) => {
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
      return picomatch2.compileRe(parsed, options, returnOutput, returnState);
    };
    picomatch2.toRegex = (source, options) => {
      try {
        const opts = options || {};
        return new RegExp(source, opts.flags || (opts.nocase ? "i" : ""));
      } catch (err) {
        if (options && options.debug === true) throw err;
        return /$^/;
      }
    };
    picomatch2.constants = constants;
    module.exports = picomatch2;
  },
});

// ../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/index.js
var require_picomatch2 = __commonJS({
  "../../../.cache/aube/virtual-store/picomatch@4.0.4-57db1111b1e656b2/node_modules/picomatch/index.js"(
    exports,
    module,
  ) {
    "use strict";
    var pico = require_picomatch();
    var utils = require_utils();
    function picomatch2(glob, options, returnState = false) {
      if (options && (options.windows === null || options.windows === void 0)) {
        options = { ...options, windows: utils.isWindows() };
      }
      return pico(glob, options, returnState);
    }
    Object.assign(picomatch2, pico);
    module.exports = picomatch2;
  },
});

// lib/fff-router/daemon-autostart.ts
import { spawn as spawnChildProcess } from "node:child_process";
import { constants as fsConstants, accessSync, existsSync as existsSync2 } from "node:fs";
import { mkdir as mkdir2, open, readFile as readFile2, rm as rm2 } from "node:fs/promises";
import path5 from "node:path";

// lib/fff-router/daemon-config.ts
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path2 from "node:path";

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
import path from "node:path";
function invalid(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
  };
}
function joinHome(home, suffix) {
  return suffix ? path.join(home, suffix) : home;
}
function expandHomePath(candidate, env = process.env) {
  const trimmed = candidate.trim();
  const home = env.HOME?.trim();
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice(2)) };
  }
  if (trimmed === "$HOME" || trimmed.startsWith("$HOME/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
      return invalid("HOME must be absolute to expand '~', '$HOME', or '${HOME}' paths");
    }
    return { ok: true, value: joinHome(home, trimmed.slice("$HOME/".length)) };
  }
  if (trimmed === "${HOME}" || trimmed.startsWith("${HOME}/")) {
    if (!home) {
      return invalid("HOME must be set to expand '~', '$HOME', or '${HOME}' paths");
    }
    if (!path.isAbsolute(home)) {
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
    path2.resolve(import.meta.dirname, "../../package.json"),
    path2.resolve(import.meta.dirname, "../../../package.json"),
  ];
  for (const candidatePath of candidatePaths) {
    if (!existsSync(candidatePath)) {
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
  return env.HOME || os.homedir();
}
function stateHome(env) {
  return env.XDG_STATE_HOME || path2.join(configHome(env), ".local", "state");
}
function mcpSocketPathForStateDir(dir) {
  const id = hashFingerprint({ dir });
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\fff-routerd-${id}`;
  }
  return path2.join("/tmp", `fff-routerd-${id}.sock`);
}
function getDefaultDaemonConfig() {
  return {
    host: DEFAULT_DAEMON_HOST,
    port: DEFAULT_DAEMON_PORT,
    mcpPath: DEFAULT_DAEMON_MCP_PATH,
  };
}
function getDefaultRouterConfig() {
  return {
    allowlistedNonGitPrefixes: [],
    promotion: {
      windowMs: 10 * 60 * 1e3,
      requiredHits: 2,
    },
    ttl: {
      gitMs: 60 * 60 * 1e3,
      nonGitMs: 15 * 60 * 1e3,
    },
    limits: {
      maxPersistentDaemons: 12,
      maxPersistentNonGitDaemons: 4,
    },
  };
}
function getDefaultDaemonReloadConfig() {
  return {
    backend: {
      primaryBackendId: DEFAULT_BACKEND,
      fallbackBackendId: getDefaultFallbackBackend(DEFAULT_BACKEND),
    },
    router: getDefaultRouterConfig(),
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
    limits: { ...reload.router.limits },
  };
}
function serializeDefaultDaemonFileConfig() {
  return `${JSON.stringify(getDefaultDaemonFileConfig(), null, 2)}
`;
}
function getDaemonPolicyConfigPaths(args = {}) {
  const env = args.env ?? process.env;
  const dir = path2.join(configHome(env), ".config", "fff-routerd");
  return {
    dir,
    jsonPath: path2.join(dir, "config.json"),
    jsoncPath: path2.join(dir, "config.jsonc"),
  };
}
function ensureDefaultConfigFile(paths) {
  mkdirSync(paths.dir, { recursive: true });
  const text = serializeDefaultDaemonFileConfig();
  writeFileSync(paths.jsonPath, text);
  return {
    path: paths.jsonPath,
    text,
  };
}
function readPreferredDaemonPolicyFile(args = {}) {
  const paths = getDaemonPolicyConfigPaths(args);
  if (existsSync(paths.jsonPath)) {
    return {
      path: paths.jsonPath,
      text: readFileSync(paths.jsonPath, "utf8"),
    };
  }
  if (existsSync(paths.jsoncPath)) {
    return {
      path: paths.jsoncPath,
      text: readFileSync(paths.jsoncPath, "utf8"),
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
  return entries
    .map((prefix) => expandHomePath(prefix, env))
    .map((result) => {
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    })
    .filter(Boolean)
    .map((prefix) => ({ prefix, mode: "first-child-root" }));
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
  const promotion =
    fileConfig.promotion == null ? null : expectObject(fileConfig.promotion, "promotion");
  const ttl = fileConfig.ttl == null ? null : expectObject(fileConfig.ttl, "ttl");
  const limits = fileConfig.limits == null ? null : expectObject(fileConfig.limits, "limits");
  const normalizedEnv = { ...env, HOME: configHome(env) };
  const backendId = readOptionalBackend(fileConfig.backend) ?? defaults.backend;
  const allowlist =
    readOptionalStringArray(fileConfig.allowlist, "allowlist") ?? defaults.allowlist;
  const host = readOptionalString(fileConfig.host, "host") ?? defaults.host;
  const port = readOptionalPort(fileConfig.port) ?? defaults.port;
  const mcpPath = readOptionalMcpPath(fileConfig.mcpPath) ?? defaults.mcpPath;
  const promotionWindowMs =
    readOptionalNonNegativeInteger(promotion?.windowMs, "promotion.windowMs") ??
    defaults.promotion.windowMs;
  const promotionRequiredHits =
    readOptionalNonNegativeInteger(promotion?.requiredHits, "promotion.requiredHits") ??
    defaults.promotion.requiredHits;
  const ttlGitMs = readOptionalNonNegativeInteger(ttl?.gitMs, "ttl.gitMs") ?? defaults.ttl.gitMs;
  const ttlNonGitMs =
    readOptionalNonNegativeInteger(ttl?.nonGitMs, "ttl.nonGitMs") ?? defaults.ttl.nonGitMs;
  const maxPersistentDaemons =
    readOptionalNonNegativeInteger(limits?.maxPersistentDaemons, "limits.maxPersistentDaemons") ??
    defaults.limits.maxPersistentDaemons;
  const maxPersistentNonGitDaemons =
    readOptionalNonNegativeInteger(
      limits?.maxPersistentNonGitDaemons,
      "limits.maxPersistentNonGitDaemons",
    ) ?? defaults.limits.maxPersistentNonGitDaemons;
  return {
    daemon: {
      host,
      port,
      mcpPath,
    },
    reload: {
      backend: {
        primaryBackendId: backendId,
        fallbackBackendId: getDefaultFallbackBackend(backendId),
      },
      router: {
        allowlistedNonGitPrefixes: expandAllowlistEntries(allowlist, normalizedEnv),
        promotion: {
          windowMs: promotionWindowMs,
          requiredHits: promotionRequiredHits,
        },
        ttl: {
          gitMs: ttlGitMs,
          nonGitMs: ttlNonGitMs,
        },
        limits: {
          maxPersistentDaemons,
          maxPersistentNonGitDaemons,
        },
      },
    },
  };
}
function readDaemonConfigFromMetadata(args = {}) {
  const paths = getDaemonPaths(args);
  if (!existsSync(paths.metadataPath)) {
    return null;
  }
  try {
    const metadata = JSON.parse(readFileSync(paths.metadataPath, "utf8"));
    if (
      typeof metadata.host !== "string" ||
      typeof metadata.port !== "number" ||
      typeof metadata.mcpPath !== "string"
    ) {
      return null;
    }
    return {
      host: metadata.host,
      port: metadata.port,
      mcpPath: metadata.mcpPath,
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
      ...args.daemonConfig,
    },
    mcpSocketPath: paths.mcpSocketPath,
    protocolVersion: DAEMON_PROTOCOL_VERSION,
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
  const dir = path2.join(stateHome(env), "fff-routerd");
  return {
    dir,
    metadataPath: path2.join(dir, "daemon.json"),
    lockPath: path2.join(dir, "startup.lock"),
    mcpSocketPath: mcpSocketPathForStateDir(dir),
  };
}

// lib/fff-router/http-daemon.ts
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

// lib/fff-router/adapters/fff-mcp-stdio.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// lib/fff-router/mcp-server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// lib/fff-router/mcp-tools.ts
import * as z from "zod/v4";

// lib/fff-router/public-api.ts
var import_picomatch = __toESM(require_picomatch2(), 1);
import path3 from "node:path";
import fs from "node:fs";
import { Type } from "@sinclair/typebox";
var EXTENSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
var PATH_META_PATTERN = /[*?[\]{}!]/;
var EXCLUDE_GLOB_META_PATTERN = /[*?[\]{}]/;
var DEFAULT_LIMIT = 20;
var DEFAULT_CONTEXT_LINES = 0;
var outputModeSchema = Type.Union([Type.Literal("compact"), Type.Literal("json")]);
var cursorSchema = Type.Union([Type.String({ minLength: 1 }), Type.Null()]);
var ENABLE_SEARCH_TERMS = false;
function defineTool(name, description, snippet, inputSchema) {
  return { name, description, snippet, inputSchema };
}
function invalid2(message, code = "INVALID_REQUEST") {
  return {
    ok: false,
    error: { code, message },
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
  if (!path3.isAbsolute(expanded.value)) {
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
    if (
      clean.includes("/") ||
      clean.includes("\\") ||
      containsPathMeta(clean) ||
      !EXTENSION_PATTERN.test(clean)
    ) {
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
  if (path3.isAbsolute(trimmed)) {
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
  if (path3.isAbsolute(trimmed)) {
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
    const stats = fs.statSync(primaryWithin);
    return stats.isFile() ? path3.dirname(primaryWithin) : primaryWithin;
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
      const nextAbs = path3.join(absDir, segment);
      if (rest.length === 0) {
        return fs.existsSync(nextAbs) ? [[...prefix, segment].join("/")] : [];
      }
      try {
        if (!fs.statSync(nextAbs).isDirectory()) {
          return [];
        }
      } catch {
        return [];
      }
      return expand(nextAbs, [...prefix, segment], rest);
    }
    let entries;
    try {
      entries = fs.readdirSync(absDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const matches = (0, import_picomatch.default)(segment, { dot: true });
    return entries
      .filter((entry) => matches(entry.name))
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((entry) => {
        const nextPrefix = [...prefix, entry.name];
        if (rest.length === 0) {
          return [nextPrefix.join("/")];
        }
        if (!entry.isDirectory()) {
          return [];
        }
        return expand(path3.join(absDir, entry.name), nextPrefix, rest);
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
    const excludePath = expansionBase
      ? validateExcludePathSyntax(entry)
      : normalizeExcludePath(entry);
    if (!excludePath.ok) {
      return excludePath;
    }
    const paths =
      containsExcludeGlobMeta(excludePath.value) && expansionBase !== void 0
        ? expandExcludeGlobPath(expansionBase, excludePath.value)
        : [excludePath.value];
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
  if (typeof value === "string" && value.trim() !== "") {
    return { ok: true, value };
  }
  return invalid2("cursor must be a non-empty string when provided");
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
  Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
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
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
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
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);
var grepInputSchema = Type.Object(
  {
    patterns: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    literal: Type.Boolean({
      description:
        "Required. If true, patterns are matched as literal text (safe for code, quotes, whitespace, and regex metacharacters). If false, patterns are regex. This tool does not guess; set it explicitly.",
    }),
    within: Type.Optional(withinSchema),
    glob: Type.Optional(Type.String({ minLength: 1 })),
    case_sensitive: Type.Optional(Type.Boolean()),
    extensions: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    exclude_paths: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    context_lines: Type.Optional(Type.Integer({ minimum: 0 })),
    limit: Type.Optional(Type.Integer({ minimum: 0 })),
    cursor: Type.Optional(cursorSchema),
    output_mode: Type.Optional(outputModeSchema),
  },
  { additionalProperties: false },
);
var PUBLIC_TOOL_DEFINITIONS = [
  defineTool(
    "fff_find_files",
    "Fuzzy file search by name/path under an already-resolved within scope. Use it when you are exploring a topic or looking for files, not when you already have a specific code identifier. `within` accepts a single absolute path or an array of absolute paths (multi-path unions the results \u2014 same semantics as passing multiple roots to `fd`). Keep queries short and let glob, extensions, and exclude_paths do the path narrowing.",
    '{"query":"openssl header","within":"/opt/homebrew/lib","glob":"**/*.h","exclude_paths":["pkgconfig"]}',
    findFilesInputSchema,
  ),
  ...(ENABLE_SEARCH_TERMS
    ? [
        defineTool(
          "fff_search_terms",
          "Search for one or more literal terms under an already-resolved within scope (absolute or HOME-based).",
          '{"terms":["router","coordinator"],"within":"$HOME/.config"}',
          searchTermsInputSchema,
        ),
      ]
    : []),
  defineTool(
    "fff_grep",
    "Search file contents under an already-resolved within scope. `literal` is REQUIRED: set literal=true for identifier searches, code fragments, or any string containing whitespace, quotes, or punctuation where regex interpretation is unwanted; set literal=false only when you need regex features (anchors, character classes, quantifiers, alternation). This tool does not guess. Use `patterns` for one or more terms; multiple entries use OR semantics. `within` accepts a single absolute path or an array of absolute paths \u2014 use the array form to replace shell patterns like `grep PAT file1 file2 dirA dirB` in one call (all entries must share a routing target). Use `glob` / `extensions` / `exclude_paths` to prefilter files aggressively.",
    '{"patterns":["ActorAuth","actor_auth","PopulatedActorAuth"],"literal":true,"within":["crates/portl-cli/Cargo.toml","Cargo.toml"]}',
    grepInputSchema,
  ),
];
function createPublicError(code, message) {
  return { code, message };
}
function publicErrorResult(code, message) {
  return {
    ok: false,
    error: createPublicError(code, message),
  };
}
function parsePublicOutputMode(value) {
  if (value === void 0) {
    return { ok: true, value: "compact" };
  }
  if (value === "compact" || value === "json") {
    return { ok: true, value };
  }
  return invalid2("output_mode must be one of: compact, json");
}
function isCompactOutputMode(mode) {
  return mode === "compact";
}
function isJsonOutputMode(mode) {
  return mode === "json";
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
    ...(within.value !== void 0 ? { within: within.value } : {}),
    ...(glob.value !== void 0 ? { glob: glob.value } : {}),
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };
  return {
    ok: true,
    value,
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
    DEFAULT_CONTEXT_LINES,
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
    ...(within.value !== void 0 ? { within: within.value } : {}),
    ...(glob.value !== void 0 ? { glob: glob.value } : {}),
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };
  return {
    ok: true,
    value,
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
      "literal must be explicitly set to true or false; fff_grep does not guess between regex and literal interpretation",
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
    DEFAULT_CONTEXT_LINES,
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
    ...(within.value !== void 0 ? { within: within.value } : {}),
    ...(glob.value !== void 0 ? { glob: glob.value } : {}),
    caseSensitive: input.case_sensitive ?? false,
    extensions: extensions.value,
    excludePaths: excludePaths.value,
    contextLines: contextLines.value,
    limit: limit.value,
    cursor: cursor.value,
    outputMode: outputMode.value,
  };
  return {
    ok: true,
    value,
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
var cursorZod = z.union([z.string().min(1), z.null()]);
var zodInputShapes = {
  fff_find_files: {
    query: z.string().min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
  fff_search_terms: {
    terms: z.array(z.string().min(1)).min(1),
    within: withinZod.optional(),
    extensions: z.array(z.string().min(1)).optional(),
    exclude_paths: z.array(z.string().min(1)).optional(),
    context_lines: z.number().int().min(0).optional(),
    limit: z.number().int().min(0).optional(),
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
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
    cursor: cursorZod.optional(),
    output_mode: z.enum(["compact", "json"]).optional(),
  },
};
var MCP_TOOLS = PUBLIC_TOOL_DEFINITIONS.map((tool) => ({
  ...tool,
  zodInputShape: zodInputShapes[tool.name],
}));

// lib/fff-router/resolve-within.ts
import fs2 from "node:fs/promises";
import path4 from "node:path";
function invalid3(message) {
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message,
    },
  };
}
function withinNotFound(within) {
  return {
    ok: false,
    error: {
      code: "WITHIN_NOT_FOUND",
      message: `within '${within}' does not exist`,
    },
  };
}
function internalError(message) {
  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  };
}
function validateAbsolutePath(candidate, field) {
  const trimmed = candidate.trim();
  if (trimmed === "") {
    return invalid3(`${field} must be a non-empty path`);
  }
  if (!path4.isAbsolute(trimmed)) {
    return invalid3(`${field} must be absolute`);
  }
  return { ok: true, value: trimmed };
}
function resolveStatType(stats) {
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
async function resolveWithinFromCaller(args) {
  const env = args.env ?? process.env;
  const callerCwd = validateAbsolutePath(args.callerCwd, "callerCwd");
  if (!callerCwd.ok) {
    return callerCwd;
  }
  if (args.within == null) {
    return { ok: true, value: { resolvedWithin: callerCwd.value } };
  }
  const expandedWithin = expandHomePath(args.within, env);
  if (!expandedWithin.ok) {
    return expandedWithin;
  }
  const within = expandedWithin.value;
  if (within === "") {
    return invalid3("within must be a non-empty string when provided");
  }
  return {
    ok: true,
    value: {
      resolvedWithin: path4.isAbsolute(within) ? within : path4.resolve(callerCwd.value, within),
    },
  };
}
async function validateResolvedWithinEntry(candidate) {
  const within = validateAbsolutePath(candidate, "within");
  if (!within.ok) {
    return within;
  }
  let resolvedWithin;
  try {
    resolvedWithin = await fs2.realpath(within.value);
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT") {
      return withinNotFound(within.value);
    }
    return internalError(`failed to canonicalize within '${within.value}'`);
  }
  let stats;
  try {
    stats = await fs2.stat(resolvedWithin);
  } catch {
    return internalError(`failed to stat resolved within '${resolvedWithin}'`);
  }
  const statType = resolveStatType(stats);
  if (!statType.ok) {
    return statType;
  }
  if (statType.value === "directory") {
    return {
      ok: true,
      value: {
        resolvedWithin,
        basePath: resolvedWithin,
      },
    };
  }
  return {
    ok: true,
    value: {
      resolvedWithin,
      basePath: path4.dirname(resolvedWithin),
      fileRestriction: resolvedWithin,
    },
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
      ...(primary.fileRestriction !== void 0 ? { fileRestriction: primary.fileRestriction } : {}),
      ...(rest.length > 0 ? { additionalEntries: rest } : {}),
    },
  };
}
async function validateResolvedWithin(args) {
  return validateResolvedWithinPaths({ withinPaths: [args.within] });
}

// lib/fff-router/http-daemon.ts
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport as StdioServerTransport2 } from "@modelcontextprotocol/sdk/server/stdio.js";
async function readDaemonMetadata(path6) {
  try {
    return JSON.parse(await readFile(path6, "utf8"));
  } catch {
    return null;
  }
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
  const primaryCandidatePath = path5.resolve(import.meta.dirname, "../../dist/bin/fff-routerd.js");
  const candidatePaths = [
    primaryCandidatePath,
    path5.resolve(import.meta.dirname, "../../bin/fff-routerd.js"),
  ];
  for (const candidatePath of candidatePaths) {
    if (existsSync2(candidatePath)) {
      return candidatePath;
    }
  }
  return primaryCandidatePath;
}
function sleep(ms) {
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
  const directories = pathValue.split(path5.delimiter).filter(Boolean);
  const extensions = commandExtensions(env);
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidatePath =
        process.platform === "win32" && extension && !command.toUpperCase().endsWith(extension)
          ? path5.join(directory, `${command}${extension}`)
          : path5.join(directory, command);
      if (existsSync2(candidatePath) && isExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }
  return null;
}
function resolveDaemonLaunchCommand(env = process.env, deps = {}) {
  if (!deps.preferPackaged) {
    const resolvedCommand = (
      deps.resolveExecutableOnPath ?? ((command) => defaultResolveExecutableOnPath(command, env))
    )("fff-routerd");
    if (resolvedCommand) {
      return { command: resolvedCommand, args: [], source: "path" };
    }
  }
  return {
    command: process.execPath,
    args: [packagedDaemonEntrypointPath()],
    source: "packaged",
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
  return (
    metadata.host === config.host &&
    metadata.port === config.port &&
    metadata.mcpPath === config.mcpPath
  );
}
function isNewerCompatibleDaemon(metadata, env) {
  if (!metadata) {
    return false;
  }
  return (
    comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION) === 1 &&
    metadata.protocolVersion === DAEMON_PROTOCOL_VERSION &&
    endpointMatchesConfig(metadata, getDaemonConfig({ env }))
  );
}
function assertCompatibleProtocolAndVersion(metadata, env) {
  const versionComparison = comparePackageVersions(metadata.packageVersion, PACKAGE_VERSION);
  const runningDaemonIsNewer = versionComparison === 1;
  if (metadata.protocolVersion !== DAEMON_PROTOCOL_VERSION) {
    if (runningDaemonIsNewer) {
      throw new Error(
        `newer incompatible fff-routerd is already running: expected protocol ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}. Update this client or stop fff-routerd manually.`,
      );
    }
    throw new DaemonHealthMismatchError(
      `daemon protocol mismatch: expected ${DAEMON_PROTOCOL_VERSION}, got ${metadata.protocolVersion}`,
      "protocol",
      metadata,
    );
  }
  if (versionComparison === 1) {
    if (!endpointMatchesConfig(metadata, getDaemonConfig({ env }))) {
      throw new Error(
        "newer fff-routerd is already running at this endpoint, but its metadata does not match the expected daemon endpoint. Stop fff-routerd manually before starting this client.",
      );
    }
    return "running-newer";
  }
  if (versionComparison !== 0 || metadata.packageVersion !== PACKAGE_VERSION) {
    throw new DaemonHealthMismatchError(
      `daemon package version mismatch: expected ${PACKAGE_VERSION}, got ${metadata.packageVersion}`,
      "version",
      metadata,
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
      metadata,
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
      metadata,
    );
  }
  const expectedReloadFingerprint = getDaemonReloadFingerprint({ env });
  if (metadata.reloadFingerprint !== expectedReloadFingerprint) {
    throw new DaemonHealthMismatchError(
      "daemon reload config mismatch; send SIGHUP to reload configuration",
      "reload",
      metadata,
    );
  }
}
async function withStartupLock(callback, env) {
  const paths = getDaemonPaths({ env });
  await mkdir2(paths.dir, { recursive: true });
  const startedAt = Date.now();
  while (true) {
    try {
      const handle = await open(paths.lockPath, "wx");
      await handle.writeFile(String(process.pid));
      try {
        return await callback();
      } finally {
        await handle.close().catch(() => {});
        await rm2(paths.lockPath, { force: true }).catch(() => {});
      }
    } catch (error) {
      if (typeof error !== "object" || !error || !("code" in error) || error.code !== "EEXIST") {
        throw error;
      }
      const lockOwner = Number.parseInt(
        (await readFile2(paths.lockPath, "utf8").catch(() => "0")).trim(),
        10,
      );
      if (!Number.isFinite(lockOwner) || lockOwner <= 0 || !isProcessAlive(lockOwner)) {
        await rm2(paths.lockPath, { force: true }).catch(() => {});
        continue;
      }
      if (Date.now() - startedAt > 15e3) {
        throw new Error("timed out while waiting for the daemon startup lock");
      }
      await sleep(50);
    }
  }
}
function isRecoverableHealthError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return (
    code === "ECONNREFUSED" ||
    code === "ConnectionRefused" ||
    error.message.includes("fetch") ||
    error.message.includes("ECONNREFUSED") ||
    error.message.includes("ConnectionRefused") ||
    error.message.includes("Unable to connect") ||
    error.message.includes("healthcheck failed")
  );
}
function mismatchKind(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.mismatchKind;
  }
  if (
    typeof error === "object" &&
    error &&
    "mismatchKind" in error &&
    (error.mismatchKind === "protocol" ||
      error.mismatchKind === "version" ||
      error.mismatchKind === "server" ||
      error.mismatchKind === "reload")
  ) {
    return error.mismatchKind;
  }
  return null;
}
function mismatchPid(error) {
  if (error instanceof DaemonHealthMismatchError && typeof error.metadata?.pid === "number") {
    return error.metadata.pid;
  }
  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata &&
    "pid" in error.metadata &&
    typeof error.metadata.pid === "number"
  ) {
    return error.metadata.pid;
  }
  return null;
}
function mismatchMetadata(error) {
  if (error instanceof DaemonHealthMismatchError) {
    return error.metadata;
  }
  if (
    typeof error === "object" &&
    error &&
    "metadata" in error &&
    typeof error.metadata === "object" &&
    error.metadata
  ) {
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
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.destroy();
  child.stderr?.destroy();
  return {
    unref: () => child.unref(),
    source: launchCommand.source,
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
      await sleep(delay);
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
    await sleep(delay);
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
          } catch {}
        }
      }
      if (
        mismatchKind(error) === "protocol" ||
        mismatchKind(error) === "version" ||
        mismatchKind(error) === "server" ||
        mismatchKind(error) === "reload"
      ) {
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
        if (
          child.source === "path" &&
          (mismatchKind(error) === "protocol" || mismatchKind(error) === "version")
        ) {
          const spawnedPid =
            mismatchPid(error) ?? (await deps.readRunningDaemonMetadata(env))?.pid ?? null;
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
    withStartupLock,
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
    output_mode: request.outputMode,
  };
  switch (request.tool) {
    case "fff_find_files": {
      const findRequest = request;
      return {
        name: request.tool,
        input: {
          query: findRequest.query,
          ...common,
        },
      };
    }
    case "fff_search_terms": {
      const searchTermsRequest = request;
      return {
        name: request.tool,
        input: {
          terms: searchTermsRequest.terms,
          context_lines: searchTermsRequest.contextLines,
          ...common,
        },
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
          ...common,
        },
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
        message: "daemon returned a non-text MCP tool response",
      },
    };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(first.text);
  } catch {
    if (response.isError) {
      return {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: first.text,
        },
      };
    }
    throw new Error(`daemon returned invalid JSON: ${first.text}`);
  }
  if (response.isError) {
    return {
      ok: false,
      error: {
        code:
          typeof parsed === "object" &&
          parsed &&
          "code" in parsed &&
          typeof parsed.code === "string"
            ? parsed.code
            : "INTERNAL_ERROR",
        message:
          typeof parsed === "object" &&
          parsed &&
          "message" in parsed &&
          typeof parsed.message === "string"
            ? parsed.message
            : "daemon call failed",
      },
    };
  }
  return {
    ok: true,
    value: parsed,
  };
}
async function createPersistentHttpToolClient(env) {
  const transport = new StreamableHTTPClientTransport(new URL(getDaemonEndpoint({ env })));
  const client = new Client2(
    { name: "fff-router-http-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  return {
    async callPublicTool(request) {
      const toolCall = toToolCall(request);
      const response = await client.callTool({
        name: toolCall.name,
        arguments: toolCall.input,
      });
      return unwrapToolResponse(response);
    },
    async close() {
      await client.close().catch(() => {});
      await transport.close().catch(() => {});
    },
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
export {
  ENABLE_SEARCH_TERMS,
  PUBLIC_TOOL_DEFINITIONS,
  callPublicToolOverHttp,
  checkDaemonBaseHealth,
  checkDaemonHealth,
  createPersistentHttpToolClient,
  createPublicError,
  ensureDaemonRunning,
  ensureDaemonRunningWithDeps,
  findFilesInputSchema,
  grepInputSchema,
  isCompactOutputMode,
  isJsonOutputMode,
  normalizeCursor,
  normalizeExcludePaths,
  normalizeExtensions,
  normalizeGlob,
  normalizePatterns,
  normalizePublicToolInput,
  normalizeTerms,
  normalizeWithin,
  parsePublicOutputMode,
  publicErrorResult,
  readRunningDaemonMetadata,
  resolveDaemonLaunchCommand,
  resolveWithinFromCaller,
  searchTermsInputSchema,
  unwrapToolResponse,
  validateResolvedWithin,
  validateResolvedWithinPaths,
};
