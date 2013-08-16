#!/usr/bin/env node
;(function() {
  'use strict';

  /** Load Node.js modules */
  var vm = require('vm');

  /** Load other modules */
  var _ = require('./lodash.js'),
      minify = require('./build/minify.js'),
      util = require('./build/util.js');

  /** Module shortcuts */
  var fs = util.fs,
      path = util.path;

  /** The current working directory */
  var cwd = process.cwd();

  /** Used for array and object method references */
  var arrayRef = Array.prototype,
      objectRef = Object.prototype;

  /** Native method shortcuts */
  var hasOwnProperty = objectRef.hasOwnProperty,
      push = arrayRef.push,
      slice = arrayRef.slice;

  /** Memoize regexp creation */
  var RegExp = (function() {
    var cache = {};
    return function(pattern, flags) {
      if (flags && /g/.test(flags)) {
        return global.RegExp(pattern, flags);
      }
      var key = '/' + pattern + '/' + (flags || '');
      return cache[key] || (cache[key] = global.RegExp(pattern, flags));
    };
  }());

  /** Used to create regexes that may detect multi-line comment blocks */
  var multilineComment = '(?:\\n */\\*[^*]*\\*+(?:[^/][^*]*\\*+)*/)?\\n';

  /** Used to detect the Node.js executable in command-line arguments */
  var reNode = RegExp('(?:^|' + path.sepEscaped + ')node(?:\\.exe)?$', 'i');

  /** Shortcut to the `stdout` object */
  var stdout = process.stdout;

  /** Used to associate aliases with their real names */
  var aliasToRealMap = {
    'all': 'every',
    'any': 'some',
    'collect': 'map',
    'detect': 'find',
    'drop': 'rest',
    'each': 'forEach',
    'eachRight': 'forEachRight',
    'extend': 'assign',
    'findWhere': 'find',
    'foldl': 'reduce',
    'foldr': 'reduceRight',
    'head': 'first',
    'include': 'contains',
    'inject': 'reduce',
    'methods': 'functions',
    'object': 'zipObject',
    'select': 'filter',
    'tail': 'rest',
    'take': 'first',
    'unique': 'uniq',
    'unzip': 'zip',
    'value': 'wrapperValueOf'
  };

  /** Used to associate real names with their aliases */
  var realToAliasMap = {
    'assign': ['extend'],
    'contains': ['include'],
    'every': ['all'],
    'filter': ['select'],
    'find': ['detect', 'findWhere'],
    'first': ['head', 'take'],
    'forEach': ['each'],
    'forEachRight': ['eachRight'],
    'functions': ['methods'],
    'map': ['collect'],
    'reduce': ['foldl', 'inject'],
    'reduceRight': ['foldr'],
    'rest': ['drop', 'tail'],
    'some': ['any'],
    'uniq': ['unique'],
    'wrapperValueOf': ['value'],
    'zip': ['unzip'],
    'zipObject': ['object']
  };

  /** Used to track function dependencies */
  var funcDependencyMap = {
    // properties
    'templateSettings': ['escape'],

    // variables
    'defaultsIteratorOptions': ['keys'],
    'eachIteratorOptions': ['keys'],
    'htmlUnescapes': ['invert'],
    'reEscapedHtml': ['keys'],
    'reUnescapedHtml': ['keys'],

    // public functions
    'after': ['isFunction'],
    'assign': ['createIterator'],
    'at': ['baseFlatten', 'isString'],
    'bind': ['createBound'],
    'bindAll': ['baseFlatten', 'bind', 'functions'],
    'bindKey': ['createBound'],
    'chain': ['lodashWrapper'],
    'clone': ['baseClone', 'baseCreateCallback'],
    'cloneDeep': ['baseClone', 'baseCreateCallback'],
    'compact': [],
    'compose': ['isFunction'],
    'contains': ['baseEach', 'getIndexOf', 'isString'],
    'countBy': ['createAggregator'],
    'createCallback': ['baseCreateCallback', 'baseIsEqual', 'isObject', 'keys'],
    'curry': ['createBound'],
    'debounce': ['isFunction', 'isObject'],
    'defaults': ['createIterator'],
    'defer': ['isFunction'],
    'delay': ['isFunction'],
    'difference': ['baseFlatten', 'cacheIndexOf', 'createCache', 'getIndexOf', 'releaseObject'],
    'escape': ['escapeHtmlChar', 'keys'],
    'every': ['baseEach', 'createCallback', 'isArray'],
    'filter': ['baseEach', 'createCallback', 'isArray'],
    'find': ['baseEach', 'createCallback', 'isArray'],
    'findIndex': ['createCallback'],
    'findLastIndex': ['createCallback'],
    'findKey': ['createCallback', 'forOwn'],
    'findLast': ['createCallback', 'forEachRight'],
    'findLastKey': ['createCallback', 'forOwnRight'],
    'first': ['createCallback', 'slice'],
    'flatten': ['baseFlatten', 'map'],
    'forEach': ['baseCreateCallback', 'baseEach', 'isArray'],
    'forEachRight': ['baseCreateCallback', 'forEach', 'isString', 'keys'],
    'forIn': ['createIterator'],
    'forInRight': ['baseCreateCallback', 'forIn'],
    'forOwn': ['createIterator'],
    'forOwnRight': ['baseCreateCallback', 'keys'],
    'functions': ['forIn', 'isFunction'],
    'groupBy': ['createAggregator'],
    'has': [],
    'identity': [],
    'indexBy': ['createAggregator'],
    'indexOf': ['baseIndexOf', 'sortedIndex'],
    'initial': ['createCallback', 'slice'],
    'intersection': ['cacheIndexOf', 'createCache', 'getArray', 'getIndexOf', 'releaseArray', 'releaseObject'],
    'invert': ['keys'],
    'invoke': ['forEach'],
    'isArguments': [],
    'isArray': [],
    'isBoolean': [],
    'isDate': [],
    'isElement': [],
    'isEmpty': ['forOwn', 'isArguments', 'isFunction'],
    'isEqual': ['baseCreateCallback', 'baseIsEqual'],
    'isFinite': [],
    'isFunction': [],
    'isNaN': ['isNumber'],
    'isNull': [],
    'isNumber': [],
    'isObject': [],
    'isPlainObject': ['isArguments', 'shimIsPlainObject'],
    'isRegExp': [],
    'isString': [],
    'isUndefined': [],
    'keys': ['isArguments', 'isObject', 'shimKeys'],
    'last': ['createCallback', 'slice'],
    'lastIndexOf': [],
    'lodash': ['isArray', 'lodashWrapper'],
    'map': ['baseEach', 'createCallback', 'isArray'],
    'max': ['baseEach', 'charAtCallback', 'createCallback', 'isArray', 'isString'],
    'memoize': ['isFunction'],
    'merge': ['baseCreateCallback', 'baseMerge', 'getArray', 'isObject', 'releaseArray'],
    'min': ['baseEach', 'charAtCallback', 'createCallback', 'isArray', 'isString'],
    'mixin': ['forEach', 'functions', 'isFunction', 'lodash'],
    'noConflict': [],
    'omit': ['baseFlatten', 'createCallback', 'forIn', 'getIndexOf'],
    'once': ['isFunction'],
    'pairs': ['keys'],
    'parseInt': ['isString'],
    'partial': ['createBound'],
    'partialRight': ['createBound'],
    'pick': ['baseFlatten', 'createCallback', 'forIn', 'isObject'],
    'pluck': ['map'],
    'pull': [],
    'random': [],
    'range': [],
    'reduce': ['baseCreateCallback', 'baseEach', 'isArray'],
    'reduceRight': ['baseCreateCallback', 'forEachRight'],
    'reject': ['createCallback', 'filter'],
    'remove': ['createCallback'],
    'rest': ['createCallback', 'slice'],
    'result': ['isFunction'],
    'runInContext': ['defaults', 'pick'],
    'sample': ['random', 'shuffle', 'toArray'],
    'shuffle': ['forEach', 'random'],
    'size': ['keys'],
    'some': ['baseEach', 'createCallback', 'isArray'],
    'sortBy': ['compareAscending', 'createCallback', 'forEach', 'getObject', 'releaseObject'],
    'sortedIndex': ['createCallback', 'identity'],
    'tap': [],
    'template': ['defaults', 'escape', 'escapeStringChar', 'keys', 'values'],
    'throttle': ['debounce', 'getObject', 'isFunction', 'isObject', 'releaseObject'],
    'times': ['baseCreateCallback'],
    'toArray': ['isString', 'slice', 'values'],
    'transform': ['baseCreateCallback', 'baseEach', 'createObject', 'forOwn', 'isArray'],
    'unescape': ['keys', 'unescapeHtmlChar'],
    'union': ['baseFlatten', 'baseUniq'],
    'uniq': ['baseUniq', 'createCallback'],
    'uniqueId': [],
    'values': ['keys'],
    'where': ['filter'],
    'without': ['difference'],
    'wrap': ['isFunction'],
    'wrapperChain': [],
    'wrapperToString': [],
    'wrapperValueOf': [],
    'zip': ['max', 'pluck'],
    'zipObject': [],

    // private functions
    'baseClone': ['assign', 'baseEach', 'forOwn', 'getArray', 'isArray', 'isObject', 'isNode', 'releaseArray', 'slice'],
    'baseCreateCallback': ['bind', 'identity', 'setBindData'],
    'baseEach': ['createIterator'],
    'baseFlatten': ['isArguments', 'isArray'],
    'baseIndexOf': [],
    'baseIsEqual': ['forIn', 'getArray', 'isArguments', 'isFunction', 'isNode', 'releaseArray'],
    'baseMerge': ['forEach', 'forOwn', 'isArray', 'isPlainObject'],
    'baseUniq': ['cacheIndexOf', 'createCache', 'getArray', 'getIndexOf', 'releaseArray', 'releaseObject'],
    'cacheIndexOf': ['baseIndexOf'],
    'cachePush': [],
    'charAtCallback': [],
    'compareAscending': [],
    'createAggregator': ['createCallback', 'forEach'],
    'createBound': ['createObject', 'isFunction', 'isObject', 'setBindData'],
    'createCache': ['cachePush', 'getObject', 'releaseObject'],
    'createIterator': ['baseCreateCallback', 'getObject', 'isArguments', 'isArray', 'isString', 'iteratorTemplate', 'releaseObject'],
    'createObject': [ 'isObject', 'noop'],
    'escapeHtmlChar': [],
    'escapeStringChar': [],
    'getArray': [],
    'getIndexOf': ['baseIndexOf', 'indexOf'],
    'getObject': [],
    'isNode': [],
    'iteratorTemplate': [],
    'lodashWrapper': [],
    'noop': [],
    'releaseArray': [],
    'releaseObject': [],
    'setBindData': ['getObject', 'noop', 'releaseObject'],
    'shimIsPlainObject': ['forIn', 'isArguments', 'isFunction', 'isNode'],
    'shimKeys': ['createIterator'],
    'slice': [],
    'unescapeHtmlChar': [],

    // used by the `backbone` and `underscore` builds
    'findWhere': ['where']
  };

  /** Used to track Lo-Dash property dependencies of identifiers */
  var propDependencyMap = {
    'at': ['support'],
    'baseClone': ['support'],
    'baseIsEqual': ['support'],
    'bind': ['support'],
    'createBound': ['support'],
    'forEachRight': ['support'],
    'isArguments': ['support'],
    'isEmpty': ['support'],
    'isPlainObject': ['support'],
    'iteratorTemplate': ['support'],
    'keys': ['support'],
    'shimIsPlainObject': ['support'],
    'template': ['templateSettings'],
    'toArray': ['support']
  };

  /** Used to track variable dependencies of identifiers */
  var varDependencyMap = {
    'assign': ['defaultsIteratorOptions'],
    'baseEach': ['eachIteratorOptions'],
    'baseIsEqual': ['objectTypes'],
    'baseUniq': ['largeArraySize'],
    'bind': ['reNative'],
    'cacheIndexOf': ['keyPrefix'],
    'cachePush': ['keyPrefix'],
    'createIterator': ['indicatorObject', 'objectTypes'],
    'createBound': ['reNative'],
    'createObject': ['reNative'],
    'debounce': ['reNative'],
    'defaults': ['defaultsIteratorOptions'],
    'defer': ['objectTypes', 'reNative'],
    'difference': ['largeArraySize'],
    'escape': ['reUnescapedHtml'],
    'escapeHtmlChar': ['htmlEscapes'],
    'forIn': ['eachIteratorOptions', 'forOwnIteratorOptions'],
    'forOwn': ['eachIteratorOptions', 'forOwnIteratorOptions'],
    'forOwnIteratorOptions': ['eachIteratorOptions'],
    'getArray': ['arrayPool'],
    'getObject': ['objectPool'],
    'htmlUnescapes': ['htmlEscapes'],
    'intersection': ['largeArraySize'],
    'isArray': ['reNative'],
    'isObject': ['objectTypes'],
    'isPlainObject': ['reNative'],
    'isRegExp': ['objectTypes'],
    'keys': ['reNative'],
    'memoize': ['keyPrefix'],
    'reEscapedHtml': ['htmlUnescapes'],
    'releaseArray': ['arrayPool', 'maxPoolSize'],
    'releaseObject': ['maxPoolSize', 'objectPool'],
    'reUnescapedHtml': ['htmlEscapes'],
    'setBindData': ['reNative'],
    'support': ['reNative'],
    'template': ['reInterpolate'],
    'templateSettings': ['reInterpolate'],
    'unescape': ['reEscapedHtml'],
    'unescapeHtmlChar': ['htmlUnescapes']
  };

  /** Used to track the category of identifiers */
  var categoryMap = {
    'Arrays': [
      'compact',
      'difference',
      'findIndex',
      'findLastIndex',
      'first',
      'flatten',
      'indexOf',
      'initial',
      'intersection',
      'last',
      'lastIndexOf',
      'pull',
      'range',
      'remove',
      'rest',
      'sortedIndex',
      'union',
      'uniq',
      'without',
      'zip',
      'zipObject'
    ],
    'Chaining': [
      'chain',
      'lodash',
      'tap',
      'wrapperChain',
      'wrapperToString',
      'wrapperValueOf'
    ],
    'Collections': [
      'at',
      'contains',
      'countBy',
      'every',
      'filter',
      'find',
      'findLast',
      'findWhere',
      'forEach',
      'forEachRight',
      'groupBy',
      'indexBy',
      'invoke',
      'map',
      'max',
      'min',
      'pluck',
      'reduce',
      'reduceRight',
      'reject',
      'sample',
      'shuffle',
      'size',
      'some',
      'sortBy',
      'toArray',
      'where'
    ],
    'Functions': [
      'after',
      'bind',
      'bindAll',
      'bindKey',
      'createCallback',
      'compose',
      'curry',
      'debounce',
      'defer',
      'delay',
      'memoize',
      'once',
      'partial',
      'partialRight',
      'throttle',
      'wrap'
    ],
    'Objects': [
      'assign',
      'clone',
      'cloneDeep',
      'defaults',
      'findKey',
      'findLastKey',
      'forIn',
      'forInRight',
      'forOwn',
      'forOwnRight',
      'functions',
      'has',
      'invert',
      'isArguments',
      'isArray',
      'isBoolean',
      'isDate',
      'isElement',
      'isEmpty',
      'isEqual',
      'isFinite',
      'isFunction',
      'isNaN',
      'isNull',
      'isNumber',
      'isObject',
      'isPlainObject',
      'isRegExp',
      'isString',
      'isUndefined',
      'keys',
      'merge',
      'omit',
      'pairs',
      'pick',
      'transform',
      'values'
    ],
    'Utilities': [
      'escape',
      'identity',
      'mixin',
      'noConflict',
      'parseInt',
      'random',
      'result',
      'runInContext',
      'template',
      'templateSettings',
      'times',
      'unescape',
      'uniqueId'
    ]
  };

  /** List of Backbone's Lo-Dash dependencies */
  var backboneDependencies = [
    'bind',
    'bindAll',
    'chain',
    'clone',
    'contains',
    'countBy',
    'defaults',
    'escape',
    'every',
    'extend',
    'filter',
    'find',
    'first',
    'forEach',
    'groupBy',
    'has',
    'indexOf',
    'initial',
    'invert',
    'invoke',
    'isArray',
    'isEmpty',
    'isEqual',
    'isFunction',
    'isObject',
    'isRegExp',
    'isString',
    'keys',
    'last',
    'lastIndexOf',
    'lodash',
    'map',
    'max',
    'min',
    'mixin',
    'omit',
    'once',
    'pairs',
    'pick',
    'reduce',
    'reduceRight',
    'reject',
    'rest',
    'result',
    'shuffle',
    'size',
    'some',
    'sortBy',
    'sortedIndex',
    'toArray',
    'uniqueId',
    'value',
    'values',
    'without',
    'wrapperChain',
    'wrapperValueOf'
  ];

  /** List of all function categories */
  var allCategories = _.keys(categoryMap);

  /** List of all the ways to export the `lodash` function */
  var allExports = [
    'amd',
    'commonjs',
    'global',
    'node'
  ];

  /** List of variables with complex assignments */
  var complexVars = [
    'cloneableClasses',
    'contextProps',
    'ctorByClass',
    'freeGlobal',
    'nonEnumProps',
    'shadowedProps',
    'support',
    'whitespace'
  ];

  /** Used to inline `iteratorTemplate` */
  var iteratorOptions = [
    'args',
    'array',
    'bottom',
    'firstArg',
    'init',
    'keys',
    'loop',
    'shadowedProps',
    'support',
    'top',
    'useHas'
  ];

  /** List of Lo-Dash only functions */
  var lodashOnlyFuncs = [
    'at',
    'bindKey',
    'cloneDeep',
    'createCallback',
    'curry',
    'findIndex',
    'findKey',
    'findLast',
    'findLastIndex',
    'findLastKey',
    'forEachRight',
    'forIn',
    'forInRight',
    'forOwn',
    'forOwnRight',
    'indexBy',
    'isPlainObject',
    'merge',
    'parseInt',
    'partialRight',
    'pull',
    'remove',
    'runInContext',
    'sample',
    'transform',
    'wrapperToString'
  ];

  /** List of private functions */
  var privateFuncs = [
    'baseClone',
    'baseCreateCallback',
    'baseEach',
    'baseFlatten',
    'baseIndexOf',
    'baseIsEqual',
    'baseMerge',
    'baseUniq',
    'cacheIndexOf',
    'cachePush',
    'charAtCallback',
    'compareAscending',
    'createBound',
    'createCache',
    'createIterator',
    'escapeHtmlChar',
    'escapeStringChar',
    'getArray',
    'getObject',
    'isNode',
    'iteratorTemplate',
    'lodashWrapper',
    'noop',
    'releaseArray',
    'releaseObject',
    'setBindData',
    'shimIsPlainObject',
    'shimKeys',
    'slice',
    'unescapeHtmlChar'
  ];

  /** List of all property dependencies */
  var propDependencies = _.uniq(_.transform(propDependencyMap, function(result, propNames) {
    push.apply(result, propNames);
  }, []));

  /** List of all variable dependencies */
  var varDependencies = _.uniq(_.transform(varDependencyMap, function(result, varNames) {
    push.apply(result, varNames);
  }, []));

  /** List of all functions */
  var allFuncs = _.difference(_.keys(funcDependencyMap), propDependencies, varDependencies).filter(function(key) {
    var type = typeof _[key];
    return type == 'function' || type == 'undefined';
  });

  /** List of Lo-Dash functions */
  var lodashFuncs = _.difference(allFuncs, privateFuncs, ['findWhere']);

  /** List of Underscore functions */
  var underscoreFuncs = _.difference(allFuncs, lodashOnlyFuncs, privateFuncs);

  /*--------------------------------------------------------------------------*/

  /**
   * Adds build `commands` to the copyright/license header of the `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {Array} [commands=[]] An array of commands.
   * @returns {String} Returns the modified source.
   */
  function addCommandsToHeader(source, commands) {
    return source.replace(/(\/\**\n)( \*)( *@license[\s*]+)( *Lo-Dash [\w.-]+)(.*)/, function() {
      // remove `node path/to/build.js` from `commands`
      if (reNode.test(commands[0])) {
        commands.splice(0, 2);
      }
      // add quotes to commands with spaces or equals signs
      commands = _.map(commands, function(command) {
        var separator = command.match(/[= ]/);
        if (separator) {
          separator = separator[0];
          var pair = command.split(separator);
          command = pair[0] + separator + '"' + pair[1] + '"';
        }
        // escape newlines, carriage returns, multi-line comment end tokens
        command = command
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\*\//g, '*\\/');

        return command;
      });
      // add build commands to copyright/license header
      var parts = slice.call(arguments, 1);
      return (
        parts[0] +
        parts[1] +
        parts[2] + parts[3] + ' (Custom Build)' + parts[4] + '\n' +
        parts[1] + ' Build: `lodash ' + commands.join(' ') + '`'
      );
    });
  }

  /**
   * Adds support for Underscore style chaining to the `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {Boolean} [isModularize=false] A flag to specify a modularize build
   * @returns {String} Returns the modified source.
   */
  function addUnderscoreChaining(source, isModularize) {
    // remove `lodash.prototype.toString` and `lodash.prototype.valueOf` assignments
    source = source.replace(/^ *lodash\.prototype\.(?:toString|valueOf) *=.+\n/gm, '');

    // remove `lodash.prototype` batch method assignments
    source = source.replace(/(?:\s*\/\/.*)*\n( *)forOwn\(lodash,[\s\S]+?\n\1}.+/g, '');

    // replace `_.mixin`
    if (!isModularize) {
      source = replaceFunction(source, 'mixin', [
        'function mixin(object) {',
        '  forEach(functions(object), function(methodName) {',
        '    var func = lodash[methodName] = object[methodName];',
        '',
        '    lodash.prototype[methodName] = function() {',
        '      var args = [this.__wrapped__];',
        '      push.apply(args, arguments);',
        '',
        '      var result = func.apply(lodash, args);',
        '      if (this.__chain__) {',
        '        result = new lodashWrapper(result);',
        '        result.__chain__ = true;',
        '      }',
        '      return result;',
        '    };',
        '  });',
        '}'
      ].join('\n'));
    }
    else {
      source = replaceFunction(source, 'mixin', [
        'function mixin(object, source) {',
        '  var ctor = object,',
        '      isFunc = !source || isFunction(ctor);',
        '',
        '  if (!source) {',
        '    ctor = lodashWrapper;',
        '    source = object;',
        '    object = lodash;',
        '  }',
        '  forEach(functions(source), function(methodName) {',
        '    var func = object[methodName] = source[methodName];',
        '    if (isFunc) {',
        '      ctor.prototype[methodName] = function() {',
        '        var args = [this.__wrapped__];',
        '        push.apply(args, arguments);',
        '',
        '        var result = func.apply(object, args);',
        '        if (this.__chain__) {',
        '          result = new ctor(result);',
        '          result.__chain__ = true;',
        '        }',
        '        return result;',
        '      };',
        '    }',
        '  });',
        '}'
      ].join('\n'));
    }
    // replace wrapper `Array` method assignments
    source = source.replace(/^(?:(?: *\/\/.*\n)*(?: *if *\(.+\n)?( *)(baseEach|forEach)\(\['[\s\S]+?\n\1}\);(?:\n *})?\n+)+/m, function(match, indent, methodName) {
      return indent + [
        '// add `Array` mutator functions to the wrapper',
        methodName + "(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(methodName) {",
        '  var func = arrayRef[methodName];',
        '  lodash.prototype[methodName] = function() {',
        '    var value = this.__wrapped__;',
        '    func.apply(value, arguments);',
        '',
        '    // avoid array-like object bugs with `Array#shift` and `Array#splice`',
        '    // in Firefox < 10 and IE < 9',
        '    if (!support.spliceObjects && value.length === 0) {',
        '      delete value[0];',
        '    }',
        '    return this;',
        '  };',
        '});',
        '',
        '// add `Array` accessor functions to the wrapper',
        methodName + "(['concat', 'join', 'slice'], function(methodName) {",
        '  var func = arrayRef[methodName];',
        '  lodash.prototype[methodName] = function() {',
        '    var value = this.__wrapped__,',
        '        result = func.apply(value, arguments);',
        '',
        '    if (this.__chain__) {',
        '      result = new lodashWrapper(result);',
        '      result.__chain__ = true;',
        '    }',
        '    return result;',
        '  };',
        '});',
        ''
      ].join('\n' + indent);
    });

    // move `mixin(lodash)`
    source = source.replace(getMethodAssignments(source), function(match) {
      // remove `mixin(lodash)`
      match = match.replace(/(?:\s*\/\/.*)*\s*mixin\(lodash\).+/, '');

      // insert `mixin(lodash)` before `_.VERSION`
      return match.replace(/(?:\n *\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/)?\n( *)lodash\.VERSION/, function(match, indent) {
        return [
          '',
          '// add functions to `lodash.prototype`',
          'mixin(lodash);',
          match
        ].join('\n' + indent);
      });
    });

    return source;
  }

  /**
   * Creates modules based on the provided build state.
   *
   * @private
   * @param {Object} state The build state object.
   */
  function buildModule(state) {
    var buildFuncs = state.buildFuncs,
        funcDepMap = state.funcDepMap,
        includeProps = state.includeProps,
        includeVars = state.includeVars,
        isAMD = state.isAMD,
        isBackbone = state.isBackbone,
        isCommonJS = state.isCommonJS,
        isCSP = state.isCSP,
        isGlobal = state.isGlobal,
        isLegacy = state.isLegacy,
        isMapped = state.isMapped,
        isMobile = state.isMobile,
        isModern = state.isModern,
        isNode = state.isNode,
        isStdOut = state.isStdOut,
        isStrict = state.isStrict,
        isUnderscore = state.isUnderscore,
        outputPath = state.outputPath,
        propDepMap = state.propDepMap,
        varDepMap = state.varDepMap;

    var empty = [],
        identifiers = _.pull(buildFuncs.concat(includeProps, includeVars), 'lodash'),
        sep = '/';

    var categories = _.uniq(_.compact(identifiers.map(function(identifier) {
      return getCategory(identifier, funcDepMap);
    }))).sort();

    var topLevel = {
      'lodash': true,
      'support': true
    };

    var getDepPath = function(dep, fromPath) {
      var toPath = getPath(dep),
          relative = path.relative(fromPath || '', toPath).replace(RegExp(path.sepEscaped, 'g'), sep);

      if (relative.charAt(0) != '.') {
        relative = '.' + (relative ? sep + relative : '');
      }
      return relative + sep + dep;
    };

    var getDepPaths = function(dependencies, fromPath) {
      return dependencies.map(function(dep) {
        return getDepPath(dep, fromPath);
      });
    };

    var getPath = function(identifier) {
      return topLevel[identifier]
        ? ''
        : (getCategory(identifier, funcDepMap) || 'internals').toLowerCase() + sep;
    };

    // prepare state
    state.plusFuncs = state.minusFuncs = empty;
    state.isAMD = state.isCommonJS = state.isGlobal = state.isNode = false;

    // provide a destination if one isn't given
    if (!outputPath) {
      outputPath = '.' + path.sep + 'modularize';
    }
    // create modules for each identifier
    identifiers.forEach(function(identifier) {
      var modulePath = getPath(identifier),
          iife = [];

      var deps = getDependencies(identifier, funcDepMap, true)
        .concat(propDepMap[identifier] || arrayRef)
        .concat(varDepMap[identifier] || arrayRef)
        .sort();

      var depArgs = deps.join(', '),
          depPaths = '[' + (deps.length ? "'" + getDepPaths(deps, modulePath).join("', '") + "'" : '') + '], ';

      if (isAMD) {
        iife.push(
          'define(' + depPaths + 'function(' + depArgs + ') {',
          '%output%',
          '  return ' + identifier + ';',
          '});'
        );
      }
      state.buildFuncs = state.includeFuncs = state.includeProps = state.includeVars = empty;
      state.iife = iife.join('\n');
      state.outputPath = path.join(outputPath, modulePath + identifier + '.js');

      var include = [identifier];
      if (_.contains(includeProps, identifier)) {
        state.includeProps = include;
      }
      else if (_.contains(includeVars, identifier)) {
        state.includeVars = include;
      }
      else {
        state.buildFuncs = state.includeFuncs = include;
      }
      build(state);
    });

    // create lodash module
    (function() {
      var categoryDeps =  _.invoke(categories, 'toLowerCase'),
          identifier = 'lodash',
          modulePath = getPath(identifier);

      var deps = getDependencies(identifier, funcDepMap, true)
        .concat(propDepMap[identifier] || arrayRef)
        .concat(varDepMap[identifier] || arrayRef)
        .sort();

      var categoryDepPaths = categoryDeps.map(function(dep) { return './' + dep; }),
          depArgs = categoryDeps.concat(deps).join(', '),
          depPaths = categoryDepPaths.concat(getDepPaths(deps, modulePath)),
          iife = [];

      depPaths = '[' + (depPaths.length ? "'" + depPaths.join("', '") + "'" : '') + '], ';

      if (isAMD) {
        iife.push(
          'define(' + depPaths + 'function(' + depArgs + ') {',
          '%output%',
          '  return lodash;',
          '});'
        );
      }
      state.iife = iife.join('\n');
      state.buildFuncs = state.includeFuncs = [identifier];
      state.includeProps = state.includeVars = empty;
      state.outputPath = path.join(outputPath, identifier + '.js');

      build(state, function(data) {
        var source = data.source;

        // add category namespaces to each lodash function assignment
        source = source.replace(/(lodash(?:\.prototype)?\.\w+\s*=\s*)(\w+)/g, function(match, prelude, identifier) {
          return prelude + getCategory(identifier, funcDepMap).toLowerCase() + '.' + identifier;
        });

        if (_.contains(identifiers, 'mixin')) {
          source = source.replace(/^ *lodashWrapper\.prototype\s*=[^;]+;\n/m, function(match) {
            return match + [
              '',
              '  // wrap `_.mixin` so it works when provided only one argument',
              '  mixin = (function(fn) {',
              '    return function(object, source) {',
              '      if (!source) {',
              '        source = object;',
              '        object = lodash;',
              '      }',
              '      return fn(object, source);',
              '    };',
              '  }(mixin));',
              ''
            ].join('\n');
          });
        }

        source = source.replace(/^ *return lodash;$/m, function(match) {
          var prelude = '';
          if (_.contains(identifiers, 'support')) {
            prelude += '  lodash.support = support;\n';
          }
          if (_.contains(identifiers, 'templateSettings')) {
            prelude += '  (lodash.templateSettings = utilities.templateSettings).imports._ = lodash;\n';
          }
          return prelude + match;
        });

        data.source = source;
        defaultBuildCallback(data);
      });
    }());

    // clear state
    state.buildFuncs = state.includeFuncs = state.includeProps = state.includeVars = empty;

    // create category modules
    categories.forEach(function(category) {
      var deps = _.intersection(categoryMap[category], identifiers).sort(),
          depArgs =  deps.join(', '),
          depPaths = "['" + getDepPaths(deps).join("', '") + "'], ",
          iife = [];

      if (isAMD) {
        iife.push(
          'define(' + depPaths + 'function(' + depArgs + ') {',
          '%output%',
          '  return {',
          deps.map(function(dep) { return "    '" + dep + "': " + dep; }).join(',\n'),
          '  };',
          '});'
        );
      }
      state.iife = iife.join('\n');
      state.outputPath = path.join(outputPath, category.toLowerCase() + '.js');
      build(state);
    });
  }

  /**
   * Compiles template files based on the provided build state using the single
   * source, extending `_.templates` with precompiled templates named after
   * each template file's basename.
   *
   * @private
   * @param {Object} state The build state object.
   * @returns {String} Returns the compiled source.
   */
  function buildTemplate(state) {
    var pattern = state.templatePattern,
        settings = state.templateSettings,
        moduleId = settings.moduleId;

    pattern || (pattern = path.join(cwd, '*.jst'));

    var directory = fs.realpathSync(path.dirname(pattern));

    var source = [
      ';(function(window) {',
      '  var undefined;',
      '',
      '  var objectTypes = {',
      "    'function': true,",
      "    'object': true",
      '  };',
      '',
      "  var freeExports = objectTypes[typeof exports] && typeof require == 'function' && exports;",
      '',
      "  var freeModule = objectTypes[typeof module] && module && module.exports == freeExports && module;",
      '',
      "  var freeGlobal = objectTypes[typeof global] && global;",
      '  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {',
      '    window = freeGlobal;',
      '  }',
      '',
      '  var templates = {},',
      '      _ = window._;',
      ''
    ];

    // convert to a regexp
    pattern = RegExp(
      path.basename(pattern)
        .replace(/[.+?^=!:${}()|[\]\/\\]/g, '\\$&')
        .replace(/\*/g, '.*?') + '$'
    );

    fs.readdirSync(directory).forEach(function(filename) {
      if (!pattern.test(filename)) {
        return;
      }
      var filePath = path.join(directory, filename),
          text = fs.readFileSync(filePath, 'utf8'),
          precompiled = cleanupCompiled(getFunctionSource(_.template(text, null, settings), 2)),
          prop = filename.replace(/\..*$/, '');

      source.push("  templates['" + prop.replace(/['\n\r\t]/g, '\\$&') + "'] = " + precompiled + ';', '');
    });

    source.push(
      "  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {",
      "    define(['" + moduleId + "'], function(lodash) {",
      '      _ = lodash;',
      '      lodash.templates = lodash.extend(lodash.templates || {}, templates);',
      '    });',
      "  } else if (freeExports && !freeExports.nodeType) {",
      "    _ = require('" + moduleId + "');",
      "    if (freeModule) {",
      '      (freeModule.exports = templates).templates = templates;',
      '    } else {',
      '      freeExports.templates = templates;',
      '    }',
      '  } else if (_) {',
      '    _.templates = _.extend(_.templates || {}, templates);',
      '  }',
      '}(this));'
    );

    return source.join('\n');
  }

  /**
   * Capitalizes a given string.
   *
   * @private
   * @param {String} string The string to capitalize.
   * @returns {String} Returns the capitalized string.
   */
  function capitalize(string) {
    return string[0].toUpperCase() + string.slice(1);
  }

  /**
   * Removes unnecessary semicolons and whitespace from compiled code.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function cleanupCompiled(source) {
    return source
      .replace(/\b(function) *(\()/g, '$1$2')
      .replace(/([{}]) *;/g, '$1');
  }

  /**
   * Removes unnecessary comments, and whitespace.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function cleanupSource(source) {
    return source
      // consolidate consecutive horizontal rule comment separators
      .replace(/(?:\s*\/\*-+\*\/\s*){2,}/g, function(separators) {
        return separators.match(/^\s*/)[0] + separators.slice(separators.lastIndexOf('/*'));
      })
      // remove unneeded single line comments
      .replace(/(\{\s*)?(\n *\/\/.*)(\s*\})/g, function(match, prelude, comment, postlude) {
        return (!prelude && postlude) ? postlude : match;
      })
      // remove unneeded horizontal rule comment separators
      .replace(/(\{\n)\s*\/\*-+\*\/\n|^ *\/\*-+\*\/\n(\s*\})/gm, '$1$2')
      // remove lines with just spaces and semicolons
      .replace(/^ *;\n/gm, '')
      // remove trailing spaces from lines
      .replace(/ *$/gm, '')
      // consolidate multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      // add trailing newline
      .trim() + '\n'
  }

  /**
   * The default callback used for `build` invocations.
   *
   * @private
   * @param {Object} data The data for the given build.
   *  gzip - The gzipped output of the built source
   *  outputPath - The path where the built source is to be written
   *  source - The built source output
   *  sourceMap - The source map output
   */
  function defaultBuildCallback(data) {
    var outputPath = data.outputPath,
        sourceMap = data.sourceMap;

    if (outputPath) {
      fs.writeFileSync(outputPath, data.source, 'utf8');
      if (sourceMap) {
        fs.writeFileSync(path.join(path.dirname(outputPath), path.basename(outputPath, '.js') + '.map'), sourceMap, 'utf8');
      }
    }
  }

  /**
   * Writes the help message to standard output.
   *
   * @private
   */
  function displayHelp() {
    console.log([
      '',
      '  Commands:',
      '',
      '    lodash backbone      Build with only functions required by Backbone',
      '    lodash legacy        Build tailored for older environments without ES5 support',
      '    lodash mobile        Build without function compilation and bug fixes for old browsers',
      '    lodash modern        Build tailored for newer environments with ES5 support',
      '    lodash strict        Build with `_.assign`, `_.bindAll`, & `_.defaults` in strict mode',
      '    lodash underscore    Build tailored for projects already using Underscore',
      '',
      '    lodash modularize    Splits Lo-Dash into modules',
      '',
      '    lodash include=...   Comma separated function/category names to include in the build',
      '    lodash minus=...     Comma separated function/category names to remove from the build',
      '    lodash plus=...      Comma separated function/category names to add to the build',
      '    lodash category=...  Comma separated categories of functions to include in the build (case-insensitive)',
      '                         (i.e. “arrays”, “chaining”, “collections”, “functions”, “objects”, and “utilities”)',
      '    lodash exports=...   Comma separated names of ways to export the `lodash` function',
      '                         (i.e. “amd”, “commonjs”, “global”, “node”, and “none”)',
      '    lodash iife=...      Code to replace the immediately-invoked function expression that wraps Lo-Dash',
      '                         (e.g. `lodash iife="!function(window){%output%}(this)"`)',
      '',
      '    lodash template=...  File path pattern used to match template files to precompile',
      '                         (e.g. `lodash template=./*.jst`)',
      '    lodash settings=...  Template settings used when precompiling templates',
      '                         (e.g. `lodash settings="{interpolate:/{{([\\s\\S]+?)}}/g}"`)',
      '    lodash moduleId=...  The AMD module ID, which defaults to “lodash”, for precompiled templates',
      '',
      '    All commands, except `backbone`, `csp`, `legacy`, `mobile`, `modern`, and `underscore`, may be combined.',
      '    Unless specified by `-o` or `--output`, all files created are saved to the current working directory.',
      '',
      '  Options:',
      '',
      '    -c, --stdout      Write output to standard output',
      '    -d, --debug       Write only the non-minified development output',
      '    -h, --help        Display help information',
      '    -m, --minify      Write only the minified production output',
      '    -o, --output      Write output to a given path/filename',
      '    -p, --source-map  Generate a source map for the minified output, using an optional source map URL',
      '    -s, --silent      Skip status updates normally logged to the console',
      '    -V, --version     Output current version of Lo-Dash',
      ''
    ].join('\n'));
  }

  /**
   * Gets the aliases associated with a given function name.
   *
   * @private
   * @param {String} funcName The name of the function to get aliases for.
   * @param {Object} [depMap] The dependency map used to validate aliases.
   * @returns {Array} Returns an array of aliases.
   */
  function getAliases(funcName, depMap) {
    var aliases = hasOwnProperty.call(realToAliasMap, funcName) && realToAliasMap[funcName];
    depMap || (depMap = funcDependencyMap);
    return _.reject(aliases, function(funcName) {
      return hasOwnProperty.call(depMap, funcName);
    });
  }

  /**
   * Gets the category of the given `identifier`.
   *
   * @private
   * @param {String} identifier The identifier to query.
   * @param {Object} [depMap] The dependency map used to resolve the identifier.
   * @returns {String} Returns the identifier's category.
   */
  function getCategory(identifier, depMap) {
    identifier = getRealName(identifier, depMap);
    return _.findKey(categoryMap, function(identifiers) {
      return _.contains(identifiers, identifier);
    }) || '';
  }

  /**
   * Gets the `createObject` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getCreateObjectFork(source) {
    var result = source.match(/(?:\s*\/\/.*)*\n( *)if *\((?:!nativeCreate)[\s\S]+?\n *};\n\1}/);
    return result ? result[0] : '';
  }

  /**
   * Gets the `_.defer` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getDeferFork(source) {
    var result = source.match(/(?:\s*\/\/.*)*\n( *)if *\(isV8 *&& *freeModule[\s\S]+?\n\1}/);
    return result ? result[0] : '';
  }

  /**
   * Gets an array of depenants for the given function name(s).
   *
   * @private
   * @param {String} funcName A function name or array of function names.
   * @param {Object} [depMap] The dependency map used to look up dependants.
   * @param- {Array} [stackA=[]] Internally used track queried function names.
   * @returns {Array} Returns an array of function dependants.
   */
  function getDependants(funcName, depMap, stack) {
    var funcNames = _.isArray(funcName) ? funcName : [funcName];
    depMap || (depMap = funcDependencyMap);
    stack || (stack = []);

    // iterate over the dependency map, adding names of functions that have `funcName` as a dependency
    return _.uniq(_.transform(depMap, function(result, deps, otherName) {
      if (!_.contains(stack, otherName) && _.some(funcNames, function(funcName) {
            return _.contains(deps, funcName);
          })) {
        stack.push(otherName);
        result.push(otherName);
        push.apply(result, getDependants(otherName, depMap, stack));
      }
    }, []));
  }

  /**
   * Gets an array of dependencies for a given function name. If an array of
   * dependencies is provided, it will return an array containing the given
   * dependencies plus any additional detected sub-dependencies.
   *
   * @private
   * @param {Array|String} funcName A function name or array of dependencies to query.
   * @param {Object} [depMap] The dependency map used to look up dependants.
   * @param {Boolean} [isShallow=false] A flag to indicate getting only the immediate dependencies.
   * @param- {Array} [stackA=[]] Internally used track queried function names.
   * @returns {Array} Returns an array of function dependencies.
   */
  function getDependencies(funcName, depMap, isShallow, stack) {
    // juggle arguments
    if (typeof depMap != 'object' && typeof isShallow != 'boolean') {
      isShallow = depMap;
      depMap = null;
    }
    // allow working with ES5 Array methods
    if (typeof isShallow != 'boolean' && isShallow != null) {
      isShallow = false;
      stack = null;
    }
    depMap || (depMap = funcDependencyMap);

    var deps = _.isArray(funcName)
      ? funcName
      : (hasOwnProperty.call(depMap, funcName) && depMap[funcName]);

    if (!deps || !deps.length) {
      return [];
    }
    if (isShallow) {
      return deps.slice();
    }
    stack || (stack = []);

    // recursively accumulate the dependencies of the `funcName` function, and
    // the dependencies of its dependencies, and so on
    return _.uniq(_.transform(deps, function(result, otherName) {
      if (!_.contains(stack, otherName)) {
        stack.push(otherName);
        push.apply(result, getDependencies(otherName, depMap, isShallow, stack).concat(otherName));
      }
    }));
  }

  /**
   * Gets the formatted source of the given function.
   *
   * @private
   * @param {Function} func The function to process.
   * @param {Number|String} [indent=0] The level to indent.
   * @returns {String} Returns the formatted source.
   */
  function getFunctionSource(func, indent) {
    var source = func.source || (func + '');

    indent || (indent = '');
    if (typeof indent == 'number') {
      indent = Array(indent + 1).join(' ');
    }
    // format leading whitespace
    return source.replace(/\n(?:.*)/g, function(match, index) {
      match = match.slice(1);
      return (
        '\n' + indent +
        (match == '}' && !_.contains(source, '}', index + 2) ? '' : '  ')
      ) + match;
    });
  }

  /**
   * Gets the indent of the given function.
   *
   * @private
   * @param {Function} func The function to process.
   * @returns {String} Returns the indent.
   */
  function getIndent(func) {
    return /^ *(?=\S)/m.exec(func.source || func)[0];
  }

  /**
   * Gets the `_.isArguments` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getIsArgumentsFork(source) {
    var result = source.match(/(?:\s*\/\/.*)*\n( *)if *\((?:!support\.argsClass|!isArguments)[\s\S]+?\n *};\n\1}/);
    return result ? result[0] : '';
  }

  /**
   * Gets the `_.isArray` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getIsArrayFork(source) {
    return matchFunction(source, 'isArray')
      .replace(/^[\s\S]+?=\s*nativeIsArray\b/, '')
      .replace(/[;\s]+$/, '');
  }

  /**
   * Gets the `_.isFunction` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getIsFunctionFork(source) {
    var result = source.match(/(?:\s*\/\/.*)*\n( *)if *\(isFunction\(\/x\/[\s\S]+?\n *};\n\1}/);
    return result ? result[0] : '';
  }

  /**
   * Gets the Lo-Dash method assignments snippet from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the method assignments snippet.
   */
  function getMethodAssignments(source) {
    var result = source.match(/\n\n(?:\s*\/\/.*)*\s*lodash\.\w+\s*=[\s\S]+lodash\.\w+\s=.+/);
    return result ? result[0] : '';
  }

  /**
   * Gets the names of identifiers in `source` that belong to the given `category`.
   *
   * @private
   * @param {String} category The category to filter by.
   * @returns {Array} Returns a new array of names.
   */
  function getNamesByCategory(category) {
    return categoryMap[category] || [];
  }

  /**
   * Gets the real name, not alias, of a given function name.
   *
   * @private
   * @param {String} funcName The name of the function to resolve.
   * @param {Object} [depMap] The dependency map used to validate the real name.
   * @returns {String} Returns the real function name.
   */
  function getRealName(funcName, depMap) {
    return (
      !hasOwnProperty.call(depMap || funcDependencyMap, funcName) &&
      hasOwnProperty.call(aliasToRealMap, funcName) &&
      aliasToRealMap[funcName]
    ) || funcName;
  }

  /**
   * Gets the `setBindData` fork from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the fork.
   */
  function getSetBindDataFork(source) {
    var result = matchFunction(source, 'setBindData').match(/!defineProperty[^:]+:\s*/);
    return result ? result[0] : '';
  }

  /**
   * Creates a sorted array of all variables defined outside of Lo-Dash functions.
   *
   * @private
   * @param {String} source The source to process.
   * @param {Boolean} [isShallow=false] A flag to indicate looking for varaibles one closure deep.
   * @returns {Array} Returns a new array of variable names.
   */
  function getVars(source, isShallow) {
    var indentA = isShallow ? ' {2}' : ' {2,4}',
        indentB = isShallow ? ' {6}' : ' {6,8}';

    var result = _.reduce([
      // match a varaible at the start of a declaration list
      indentA + 'var (\\w+) *=.+?,\\n(?= *\\w+ *=)',
      // match a variable declaration in a declaration list
      indentB + '(\\w+) *=.+?[,;]\\n',
      // match a variable that is not part of a declaration list
      '(' + indentA + ')var (\\w+) *(?:|= *(?:.+?(?:&&\\n[^;]+)?|(?:\\w+\\(|[{[(]\\n)[\\s\\S]+?\\n\\1[^\\n ]+?));\\n'
    ], function(result, reSource) {
      source = source.replace(RegExp('^' + reSource, 'gm'), function(match, indent, varName) {
        if (typeof varName == 'number') {
          varName = indent;
        }
        result.push(varName);
        return '';
      });
      return result;
    }, []);

    // remove duplicates and function names
    return _.difference(_.uniq(result), allFuncs).sort();
  }

  /**
   * Determines if a variable, of the given `varName`, is used in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} varName The name of the variable.
   * @param {Boolean} [isShallow=false] A flag to indicate looking for varaibles one closure deep.
   * @returns {Boolean} Returns `true` if the variable is used, else `false`.
   */
  function isVarUsed(source, varName, isShallow) {
    var match = matchVar(source, varName, isShallow);
    if (!match) {
      return false;
    }
    // remove the variable assignment from the source
    source = source.replace(match, '');
    return RegExp('[^\\w"\'.]' + varName + '\\b').test(source);
  }

  /**
   * Searches `source` for a `funcName` function declaration, expression, or
   * assignment and returns the matched snippet.
   *
   * @private
   * @param {String} source The source to inspect.
   * @param {String} funcName The name of the function to match.
   * @param {Boolean} [leadingComments] A flag to indicate including leading comments.
   * @returns {String} Returns the matched function snippet.
   */
  function matchFunction(source, funcName, leadingComments) {
    var result = _.reduce([
      // match variable declarations using `createAggregator`, `createIterator` and `template`
      '( *)var ' + funcName + ' *=.*?(?:create[A-Z][a-z]+|template)\\((?:.+|[\\s\\S]+?\\n\\3}?)\\);\\n',
      // match a function declaration
      '( *)function ' + funcName + '\\b[\\s\\S]+?\\n\\3}\\n',
      // match a variable declaration with function expression
      '( *)var ' + funcName + ' *=.*?function\\(.+?\{\\n[\\s\\S]+?\\n\\3}(?:\\(\\)\\))?;\\n',
      // match a simple variable declaration
      ' *var ' + funcName + ' *=.+?;\\n'
    ], function(result, reSource) {
      return result || (result = source.match(RegExp(
        '(' + multilineComment + ')' +
        '(' + reSource + ')'
      ))) && result.slice(1, 3);
    }, null);

    return result && (
           /@type +Function\b/.test(result[0]) ||
           /(?:function(?:\s+\w+)?\b|create[A-Z][a-z]+|template)\(/.test(result[1]))
      ? (leadingComments ? result[0] : '') + result[1]
      : '';
  }

  /**
   * Searches `source` for a Lo-Dash property, of the given `propName`, and
   * returns the matched snippet.
   *
   * @private
   * @param {String} source The source to inspect.
   * @param {String} propName The name of the property to match.
   * @param {Boolean} [leadingComments] A flag to indicate including leading comments.
   * @returns {String} Returns the matched property snippet.
   */
  function matchProp(source, propName, leadingComments) {
    var result = source.match(RegExp(
      (leadingComments ? multilineComment : '\\n') +
      '(?: {2,4}var ' + propName + '\\b.+|(?: *|.*?=\\s*)lodash\\._?' + propName + '\\s*)=[\\s\\S]+?' +
      '(?:\\(function[\\s\\S]+?\\([^)]*\\)\\);\\n(?=\\n)|' +
      '[;}]\\n(?=\\n(?!\\s*\\(func)))'
    ));

    return result ? result[0] : '';
  }

  /**
   * Searches `source` for a `varName` variable assignment and returns
   * the matched snippet.
   *
   * @private
   * @param {String} source The source to inspect.
   * @param {String} varName The name of the variable to match.
   * @param {Boolean} [isShallow=false] A flag to indicate looking for varaibles one closure deep.
   * @returns {String} Returns the matched variable snippet.
   */
  function matchVar(source, varName, isShallow) {
    var indentA = isShallow ? ' {2}' : ' {2,4}',
        indentB = isShallow ? ' {6}' : ' {6,8}';

    var reSources = [
      // match a varaible at the start of a declaration list
      indentA + 'var ' + varName + ' *=.+?,\\n(?= *\\w+ *=)',
      // match a variable declaration in a declaration list
      indentB + varName + ' *=.+?[,;]\\n',
      // match a variable that is not part of a declaration list
      '(' + indentA + ')var ' + varName + ' *(?:|= *(?:.+?(?:&&\\n[^;]+)?|(?:\\w+\\(|[{[(]\\n)[\\s\\S]+?\\n\\1[^\\n ]+?));\\n'
    ];

    // match complex variable assignments
    if (varName != 'freeGlobal' && _.contains(complexVars, varName)) {
      reSources = [
        indentA + 'var '  + varName + ' *=[\\s\\S]+?' +
        '(?:\\(function[\\s\\S]+?\\([^)]*\\)\\);\\n(?=\\n)|' +
        '[;}]\\n(?=\\n(?!\\s*\\(func)))'
      ];
    }
    return _.reduce(reSources, function(result, reSource) {
      return result || (result = source.match(RegExp(
        '^' + reSource
      , 'm'))) && result[0];
    }, null) || '';
  }

  /**
   * Converts a comma separated options string into an array.
   *
   * @private
   * @param {String} value The option to convert.
   * @returns {Array} Returns the new converted array.
   */
  function optionToArray(value) {
    return _.compact(_.isArray(value)
      ? value
      : value.match(/\w+=(.*)$/)[1].split(/, */)
    );
  }

  /**
   * Converts a comma separated options string into an array of function names.
   *
   * @private
   * @param {String} value The option to convert.
   * @param {Object} [depMap] The dependency map used to resolve real names.
   * @returns {Array} Returns the new converted array.
   */
  function optionToMethodsArray(value, depMap) {
    depMap || (depMap = funcDependencyMap);
    return optionToArray(value).map(function(identifier) {
      // convert aliases to real function names
      return getRealName(identifier, depMap);
    });
  }

  /**
   * Removes support for Lo-Dash wrapper chaining in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeChaining(source) {
    source = removeSpliceObjectsFix(source);

    // remove `_.mixin` call
    source = source.replace(/(?:\s*\/\/.*)*\s*mixin\(lodash\).+/, '');

    // remove all `lodash.prototype` additions
    source = source
      .replace(/(?:\s*\/\/.*)*\n( *)forOwn\(lodash,[\s\S]+?\n\1}.+/g, '')
      .replace(/(?:\s*\/\/.*)*\n( *)(?:baseEach|forEach)\(\['[\s\S]+?\n\1}.+/g, '')
      .replace(/(?:\s*\/\/.*)*\n *lodash\.prototype\.[\s\S]+?;/g, '');

    // replace `lodash` with a simpler version
    source = replaceFunction(source, 'lodash', [
      'function lodash() {',
      '  // no operation performed',
      '}'
    ].join('\n'));

    // replace `lodashWrapper` with `lodash` in `_.mixin`
    source = source.replace(matchFunction(source, 'mixin'), function(match) {
      return match.replace(/\blodashWrapper\b/, 'lodash');
    });

    return source;
  }

  /**
   * Removes all comments from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeComments(source) {
    return source.replace(/^ *(?:\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/|\/\/.+)\n/gm, '');
  }

  /**
   * Removes the `createObject` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeCreateObjectFork(source) {
    return source.replace(getCreateObjectFork(source), '');
  }

  /**
   * Removes the `_.defer` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeDeferFork(source) {
    return source.replace(getDeferFork(source), '');
  }

  /**
   * Removes ES5 specific optimizations from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeEsOptimization(source) {
    // remove `__bindData__` logic and `setBindData` function calls from `createBound`
    source = source.replace(matchFunction(source, 'createBound'), function(match) {
      return match
        .replace(/(?:\s*\/\/.*)*\n( *)var bindData *=[\s\S]+?\n\1}/, '')
        .replace(/(?:\s*\/\/.*)*\n.+bindData *= *nativeSlice.+/, '')
        .replace(/(?:\s*\/\/.*)*\n.+?setBindData.+/, '');
    });

    // remove `__bindData__` logic and `setBindData` function calls from `baseCreateCallback`
    source = source.replace(matchFunction(source, 'baseCreateCallback'), function(match) {
      return match
        .replace(/(?:\s*\/\/.*)*\n( *)var bindData *=[\s\S]+?\n\1}/, '')
        .replace(/(?:\s*\/\/.*)*\n( *)if *\(bindData[\s\S]+?\n\1}/, '');
    });

    return source;
  }

  /**
   * Removes all references to `identifier` from `createIterator` in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} identifier The name of the variable or property to remove.
   * @returns {String} Returns the modified source.
   */
  function removeFromCreateIterator(source, identifier) {
    var snippet = matchFunction(source, 'createIterator');
    if (!snippet) {
      return source;
    }
    // remove data object property assignment
    var modified = snippet.replace(RegExp("^(?: *\\/\\/.*\\n)* *(\\w+)\\." + identifier + " *= *(.+\\n+)", 'm'), function(match, object, postlude) {
      return RegExp('\\b' + object + '\\.').test(postlude) ? postlude : '\n';
    });

    source = source.replace(snippet, function() {
      return modified;
    });

    // clip to the `factory` assignment
    snippet = modified.match(/Function\([\s\S]+$/)[0];

    // remove `factory` arguments
    source = source.replace(snippet, function(match) {
      return match
        .replace(RegExp("[^\\n(,']*?\\b" + identifier + "\\b[^\\n),']*(?:, *)?", 'g'), ' ')
        .replace(/, *(?=',)/, '')
        .replace(/,(?=\s*\))/, '');
    });

    return removeFromGetObject(source, identifier);
  }

  /**
   * Removes all references to `identifier` from `getObject` in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} identifier The name of the property to remove.
   * @returns {String} Returns the modified source.
   */
  function removeFromGetObject(source, identifier) {
    return source.replace(matchFunction(source, 'getObject'), function(match) {
      // remove object property assignments
      return match
        .replace(RegExp("^(?: *\\/\\/.*\\n)* *'" + identifier + "':.+\\n+", 'm'), '')
        .replace(/,(?=\s*})/, '');
    });
  }

  /**
   * Removes all references to `identifier` from `releaseObject` in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} identifier The name of the property to remove.
   * @returns {String} Returns the modified source.
   */
  function removeFromReleaseObject(source, identifier) {
    return source.replace(matchFunction(source, 'releaseObject'), function(match) {
      // remove object property assignments
      return match.replace(RegExp("(?:(^ *)| *)(\\w+)\\." + identifier + " *= *(.+\\n+)", 'm'), function(match, indent, object, postlude) {
        return (indent || '') + RegExp('\\b' + object + '\\.').test(postlude) ? postlude : '';
      });
    });
  }

  /**
   * Removes the `funcName` function declaration, expression, or assignment and
   * associated code from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} funcName The name of the function to remove.
   * @returns {String} Returns the modified source.
   */
  function removeFunction(source, funcName) {
    var snippet;

    // defer to specialized removal functions
    if (funcName == 'runInContext') {
      return removeRunInContext(source, funcName);
    }
    // remove function
    if ((snippet = matchFunction(source, funcName, true))) {
      source = source.replace(snippet, '');
    }
    return source;
  }

  /**
   * Removes all references to `getIndexOf` from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeGetIndexOf(source) {
    source = removeFunction(source, 'getIndexOf');

    // replace all `getIndexOf` calls with `baseIndexOf`
    _.each(['baseUniq', 'contains', 'difference', 'intersection', 'omit'], function(funcName) {
      source = source.replace(matchFunction(source, funcName), function(match) {
        return match.replace(/\bgetIndexOf\(\)/g, 'baseIndexOf');
      });
    });

    // simplify `isLarge` assignments
    _.each(['baseUniq', 'difference'], function(funcName) {
      source = source.replace(matchFunction(source, funcName), function(match) {
        return match.replace(/\b(largeArraySize).+?baseIndexOf\b/g, '$1');
      });
    });

    return source;
  }

  /**
   * Removes the `_.isArguments` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeIsArgumentsFork(source) {
    return source.replace(getIsArgumentsFork(source), '');
  }

  /**
   * Removes the `_.isArray` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeIsArrayFork(source) {
    return source.replace(getIsArrayFork(source), '');
  }

  /**
   * Removes the `_.isFunction` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeIsFunctionFork(source) {
    return source.replace(getIsFunctionFork(source), '');
  }

  /**
   * Removes the `Object.keys` object iteration optimization from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeKeysOptimization(source) {
    source = removeFromCreateIterator(source, 'keys');

    // remove "keys" iterator options
    _.each(['defaultsIteratorOptions', 'eachIteratorOptions'], function(varName) {
      source = source.replace(matchVar(source, varName), function(match) {
        return match
          .replace(/^ *'keys':.+\n+/m, '')
          .replace(/,(?=\s*})/, '');
      });
    });

    // remove optimized branch in `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match.replace(/^(?: *\/\/.*\n)* *["']( *)<% *if *\(useHas *&& *keys[\s\S]+?["']\1<% *} *else *{ *%>.+\n([\s\S]+?) *["']\1<% *} *%>.+/m, "'\\n' +\n$2");
    });

    return source;
  }


  /**
   * Removes all Lo-Dash assignments from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the modified source.
   */
  function removeAssignments(source) {
    source = removeMethodAssignments(source);

    // remove intermediate assignments
    source = source.replace(/(=\s*)lodash\.\w+\s*=\s*/g, '$1');
    return source;
  }

  /**
   * Removes the Lo-Dash method assignments snippet from `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the modified source.
   */
  function removeMethodAssignments(source) {
    return source.replace(getMethodAssignments(source), '');
  }

  /**
   * Removes a Lo-Dash property, of the given `propName`, from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} propName The name of the property to remove.
   * @returns {String} Returns the modified source.
   */
  function removeProp(source, propName) {
    return source.replace(matchProp(source, propName, true), '');
  }

  /**
   * Removes all pseudo private Lo-Dash properties from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removePseudoPrivates(source) {
    return source.replace(/^(?: *\/\/.*\s*)* *lodash\._\w+ *=[\s\S]+?;\n/gm, '');
  }

  /**
   * Removes all `runInContext` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeRunInContext(source) {
    // replace reference in `reThis` assignment
    source = source.replace(/\btest\(runInContext\)/, 'test(function() { return this; })');

    // remove assignment
    source = source.replace(/^(?: *\/\/.*\s*)* *lodash\.runInContext *=[\s\S]+?;\n/m, '');

    // remove function scaffolding, leaving most of its content
    source = source.replace(matchFunction(source, 'runInContext', true), function(match) {
      return match
        .replace(/^[\s\S]+?function runInContext[\s\S]+?context *= *context.+| *return lodash[\s\S]+$/g, '')
        .replace(/^ {4}/gm, '  ');
    });

    // cleanup adjusted source
    source = source
      .replace(/\bcontext\b/g, 'window')
      .replace(/(?:\n +\/\*[^*]*\*+(?:[^\/][^*]*\*+)*\/)?\n *var Array *=[\s\S]+?;\n/, '')
      .replace(/(return *|= *)_([;)])/g, '$1lodash$2')
      .replace(/^(?: *\/\/.*\s*)* *var _ *= *runInContext\b.+\n+/m, '');

    // remove local timer variables
    source = removeVar(source, 'clearTimeout');
    source = removeVar(source, 'setImmediate');
    source = removeVar(source, 'setTimeout');

    return source;
  }

  /**
   * Removes the `setBindData` fork from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSetBindDataFork(source) {
    return source = source.replace(matchFunction(source, 'isArray'), function(match) {
      return match.replace(getSetBindDataFork(source), '');
    });
  }

  /**
   * Removes the `support.spliceObjects` fix from the `Array` function mixins
   * snippet of `source`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @returns {String} Returns the modified source.
   */
  function removeSpliceObjectsFix(source) {
    return source.replace(/(?:\s*\/\/.*)*\n( *)if *\(!support\.spliceObjects[\s\S]+?(?:\{\s*}|\n\1})/, '');
  }

  /**
   * Removes all strings from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeStrings(source) {
    return source.replace(/(["'])(?:(?!\1)[^\n\\]|\\.)*\1/g, '');
  }

  /**
   * Removes all `support.argsClass` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportArgsClass(source) {
    source = removeSupportProp(source, 'argsClass');

    // replace `support.argsClass` in the `_.isArguments` fork
    source = source.replace(getIsArgumentsFork(source), function(match) {
      return match.replace(/!support\.argsClass/g, '!isArguments(arguments)');
    });

    // remove `support.argsClass` from `_.isEmpty`
    source = source.replace(matchFunction(source, 'isEmpty'), function(match) {
      return match.replace(/\s*\(support\.argsClass\s*\?([^:]+):.+?\)\)/g, '$1');
    });

    // remove `support.argsClass` from `_.isPlainObject`
    _.each(['shimIsPlainObject', 'isPlainObject'], function(funcName) {
      source = source.replace(matchFunction(source, funcName), function(match) {
        return match.replace(/\s*\|\|\s*\(!support\.argsClass[\s\S]+?\)\)/, '');
      });
    });

    return source;
  }

  /**
   * Removes all `support.argsObject` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportArgsObject(source) {
    source = removeSupportProp(source, 'argsObject');

    // remove `argsAreObjects` from `baseIsEqual`
    source = source.replace(matchFunction(source, 'baseIsEqual'), function(match) {
      return match.replace(/!support.\argsObject[^:]+:\s*/g, '');
    });

    return source;
  }

  /**
   * Removes all `support.enumErrorProps` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportEnumErrorProps(source) {
    source = removeSupportProp(source, 'enumErrorProps');

    // remove `support.enumErrorProps` from `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match
        .replace(/(?: *\/\/.*\n)* *["'] *(?:<% *)?if *\(support\.enumErrorProps *(?:&&|\))(.+?}["']|[\s\S]+?<% *} *(?:%>|["'])).+/g, '')
        .replace(/support\.enumErrorProps\s*\|\|\s*/g, '');
    });

    return source;
  }

  /**
   * Removes all `support.enumPrototypes` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportEnumPrototypes(source) {
    source = removeSupportProp(source, 'enumPrototypes');

    // remove `support.enumPrototypes` from `_.keys`
    source = source.replace(matchFunction(source, 'keys'), function(match) {
      return match
        .replace(/\(support\.enumPrototypes[^)]+\)(?:\s*\|\|\s*)?/, '')
        .replace(/\s*if *\(\s*\)[^}]+}/, '');
    });

    // remove `support.enumPrototypes` from `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match
        .replace(/(?: *\/\/.*\n)* *["'] *(?:<% *)?if *\(support\.enumPrototypes *(?:&&|\))(.+?}["']|[\s\S]+?<% *} *(?:%>|["'])).+/g, '')
        .replace(/support\.enumPrototypes\s*\|\|\s*/g, '');
    });

    return source;
  }

  /**
   * Removes all `support.nodeClass` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportNodeClass(source) {
    source = removeSupportProp(source, 'nodeClass');

    // remove `support.nodeClass` from `baseClone` and `shimIsPlainObject`
    _.each(['baseClone', 'shimIsPlainObject'], function(funcName) {
      source = source.replace(matchFunction(source, funcName), function(match) {
        return match.replace(/\s*\|\|\s*\(!support\.nodeClass[\s\S]+?\)\)/, '');
      });
    });

    // remove `support.nodeClass` from `baseIsEqual`
    source = source.replace(matchFunction(source, 'baseIsEqual'), function(match) {
      return match.replace(/\s*\|\|\s*\(!support\.nodeClass[\s\S]+?\)\)\)/, '');
    });

    return source;
  }

  /**
   * Removes all `support.nonEnumArgs` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportNonEnumArgs(source) {
    source = removeSupportProp(source, 'nonEnumArgs');

    // remove `support.nonEnumArgs` from `_.keys`
    source = source.replace(matchFunction(source, 'keys'), function(match) {
      return match
        .replace(/(?:\s*\|\|\s*)?\(support\.nonEnumArgs[\s\S]+?\)\)/, '')
        .replace(/\s*if *\(\s*\)[^}]+}/, '');
    });

    // remove `nonEnumArgs` from `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match
        .replace(/(?: *\/\/.*\n)*( *["'] *)<% *} *else *if *\(support\.nonEnumArgs[\s\S]+?(\1<% *} *%>.+)/, '$2')
        .replace(/\s*\|\|\s*support\.nonEnumArgs/, '');
    });

    return source;
  }

  /**
   * Removes all `support.nonEnumShadows` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportNonEnumShadows(source) {
    source = removeFromCreateIterator(source, 'nonEnumProps');
    source = removeFromCreateIterator(source, 'shadowedProps');
    source = removeSupportProp(source, 'nonEnumShadows');

    // remove `support.nonEnumShadows` from `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match.replace(/(?: *\/\/.*\n)* *["']( *)<% *if *\(support\.nonEnumShadows[\s\S]+?["']\1<% *} *%>.+/, '');
    });

    return source;
  }

  /**
   * Removes all `support.ownLast` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportOwnLast(source) {
    source = removeSupportProp(source, 'ownLast');

    // remove `support.ownLast` from `shimIsPlainObject`
    source = source.replace(matchFunction(source, 'shimIsPlainObject'), function(match) {
      return match.replace(/(?:\s*\/\/.*)*\n( *)if *\(support\.ownLast[\s\S]+?\n\1}/, '');
    });

    return source;
  }

  /**
   * Removes all `support.spliceObjects` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportSpliceObjects(source) {
    source = removeSupportProp(source, 'spliceObjects');
    source = removeSpliceObjectsFix(source);
    return source;
  }

  /**
   * Removes all `support.unindexedChars` references from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @returns {String} Returns the modified source.
   */
  function removeSupportUnindexedChars(source) {
    source = removeSupportProp(source, 'unindexedChars');

    // remove `support.unindexedChars` from `_.at`
    source = source.replace(matchFunction(source, 'at'), function(match) {
      return match.replace(/^ *if *\(support\.unindexedChars[^}]+}\n+/m, '');
    });

    // remove `support.unindexedChars` from `_.forEachRight`
    source = source.replace(matchFunction(source, 'forEachRight'), function(match) {
      return match.replace(/}\s*else if *\(support\.unindexedChars[^}]+/, '');
    });

    // remove `support.unindexedChars` from `_.toArray`
    source = source.replace(matchFunction(source, 'toArray'), function(match) {
      return match.replace(/(return\b).+?support\.unindexedChars[^:]+:\s*/, '$1 ');
    });

    // remove `support.unindexedChars` from `iteratorTemplate`
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match
        .replace(/'if *\(<%= *array *%>[^']*/, '$&\\n')
        .replace(/(?: *\/\/.*\n)* *["']( *)<% *if *\(support\.unindexedChars[\s\S]+?["']\1<% *} *%>.+/, '');
    });

    return source;
  }

  /**
   * Removes a given property from the `support` object in `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} varName The name of the `support` property to remove.
   * @returns {String} Returns the modified source.
   */
  function removeSupportProp(source, propName) {
    return source.replace(matchProp(source, 'support'), function(match) {
      return match.replace(RegExp(
        multilineComment +
        // match a `try` block
        '(?: *try\\b.+\\n)?' +
        // match the `support` property assignment
        ' *support\\.' + propName + ' *=.+\\n' +
        // match `catch` block
        '(?:( *).+?catch\\b[\\s\\S]+?\\n\\1}\\n)?'
      ), '');
    });
  }

  /**
   * Removes a variable, of the given `varName`, from `source`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} varName The name of the variable to remove.
   * @returns {String} Returns the modified source.
   */
  function removeVar(source, varName) {
    // simplify complex variable assignments
    if (_.contains(complexVars, varName)) {
      source = source.replace(RegExp(
        '^( *var ' + varName + ') *=[\\s\\S]+?' +
        '(?:\\(function[\\s\\S]+?\\([^)]*\\)\\);(?=\\n\\n)|' +
        '[;}](?=\\n\\n(?!\\s*\\(func)))'
      , 'm'), '$1 = null;')
    }

    _.some([
      function() {
        return removeFunction(source, varName);
      },
      function() {
        // remove a varaible at the start of a declaration list
        return source.replace(RegExp('(var +)' + varName + ' *=.+?,\\n *'), '$1');
      },
      function() {
        // remove a variable declaration in a declaration list
        return source.replace(RegExp(
          '( *(?:var +)?\\w+ *=.+?),\\n *' + varName + ' *=.+?([,;])(?=\\n)'
        ), '$1$2');
      },
      function() {
        // remove a variable that is not part of a declaration list
        return source.replace(RegExp(
          multilineComment +
          '( *)var ' + varName + ' *(?:|= *(?:.+?(?:|&&\\n[^;]+)|(?:\\w+\\(|[{[(]\\n)[\\s\\S]+?\\n\\1[^\\n ]+?));\\n'
        ), '');
      }
    ], function(func) {
      var result = func();
      if (result !== source) {
        source = result;
        return true;
      }
    });

    return source;
  }

  /**
   * Replaces the `funcName` function body in `source` with `funcValue`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} varName The name of the function to replace.
   * @returns {String} Returns the modified source.
   */
  function replaceFunction(source, funcName, funcValue) {
    var snippet = matchFunction(source, funcName);
    if (!snippet) {
      return source;
    }
    source = source.replace(snippet, function() {
      return funcValue
        .replace(RegExp('^' + getIndent(funcValue), 'gm'), getIndent(snippet))
        .trimRight() + '\n';
    });

    return source;
  }

  /**
   * Replaces the `support` object `propName` property value in `source` with `propValue`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {String} varName The name of the `support` property to replace.
   * @returns {String} Returns the modified source.
   */
  function replaceSupportProp(source, propName, propValue) {
    return source.replace(RegExp(
      // match a `try` block
      '(?: *try\\b.+\\n)?' +
      // match the `support` property assignment
      '( *support\\.' + propName + ' *=).+\\n' +
      // match `catch` block
      '(?:( *).+?catch\\b[\\s\\S]+?\\n\\2}\\n)?'
    ), function(match, left) {
      return left + ' ' + propValue + ';\n';
    });
  }

  /**
   * Replaces the `varName` variable declaration value in `source` with `varValue`.
   *
   * @private
   * @param {String} source The source to inspect.
   * @param {String} varName The name of the variable to replace.
   * @returns {String} Returns the modified source.
   */
  function replaceVar(source, varName, varValue) {
    // replace a variable that's not part of a declaration list
    var result = source.replace(RegExp(
      '(( *)var ' + varName + ' *=)' +
      '(?:.+?;|(?:Function\\(.+?|.*?[^,])\\n[\\s\\S]+?\\n\\2.+?;)\\n'
    ), function(match, left) {
      return left + ' ' + varValue + ';\n';
    });

    if (source == result) {
      // replace a varaible at the start or middle of a declaration list
      result = source.replace(RegExp('((?:var|\\n) +' + varName + ' *=).+?,'), function(match, left) {
        return left + ' ' + varValue + ',';
      });
    }
    if (source == result) {
      // replace a variable at the end of a variable declaration list
      result = source.replace(RegExp('(,\\s*' + varName + ' *=).+?;'), function(match, left) {
        return left + ' ' + varValue + ';';
      });
    }
    return result;
  }

  /**
   * Hard-codes the `strict` template option value for `iteratorTemplate`.
   *
   * @private
   * @param {String} source The source to process.
   * @param {Boolean} value The value to set.
   * @returns {String} Returns the modified source.
   */
  function setUseStrictOption(source, value) {
    // inject or remove the "use strict" directive
    source = source.replace(/^([\s\S]*?function[^{]+{)(?:\s*'use strict';)?/, '$1' + (value ? "\n  'use strict';" : ''));

    // replace `strict` branch in `iteratorTemplate` with hard-coded option
    source = source.replace(matchFunction(source, 'iteratorTemplate'), function(match) {
      return match.replace(/(template\()(?:\s*"'use strict.+)?/, '$1' + (value ? '\n    "\'use strict\';\\n" +' : ''));
    });

    return source;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a debug and/or minified build, executing the `callback` for each.
   * The `callback` is invoked with one argument; (data).
   *
   * Note: For a list of commands see `displayHelp()` or run `lodash --help`.
   *
   * @param {Array|Object} [options=[]] An array of build commands or the state object.
   * @param {Function} [callback=defaultBuildCallback] The function called or per build.
   */
  function build(options, callback) {
    options || (options = []);
    callback || (callback = defaultBuildCallback);

    // the debug version of `source`
    var debugSource;

    // used to specify the output path for builds
    var outputPath;

    // used to specify the source map URL
    var sourceMapURL;

    // use to pre-populate the build state
    var state = _.isObject(options) && !_.isArray(options) && options;

    // used to capture warnings for invalid command-line arguments
    var warnings = [];

    var isExcluded = function() {
      return _.every(arguments, function(funcName) {
        return !_.contains(buildFuncs, funcName);
      });
    };

    var isLodash = function(funcName) {
      funcName = getRealName(funcName);
      if (_.contains(lodashOnlyFuncs, funcName) || /^(?:assign|zipObject)$/.test(funcName)) {
        var funcNames = _.difference(_.union(includeFuncs, plusFuncs), minusFuncs);
        return _.contains(funcNames, funcName);
      }
      funcNames = _.difference(plusFuncs, minusFuncs);
      return _.contains(funcNames, funcName);
    };

    if (state) {
      var buildFuncs = state.buildFuncs,
          filePath = state.filePath,
          funcDepMap = state.funcDepMap,
          iife = state.iife,
          includeFuncs = state.includeFuncs,
          includeProps = state.includeProps,
          includeVars = state.includeVars,
          isAMD = state.isAMD,
          isBackbone = state.isBackbone,
          isCommonJS = state.isCommonJS,
          isCSP = state.isCSP,
          isDebug = true,
          isGlobal = state.isGlobal,
          isIIFE = state.isIIFE,
          isLegacy = state.isLegacy,
          isMapped = state.isMapped,
          isMobile = state.isMobile,
          isModern = state.isModern,
          isNode = state.isNode,
          isNoDep = true,
          isStdOut = state.isStdOut,
          isSilent = true,
          isStrict = state.isStrict,
          isUnderscore = state.isUnderscore,
          minusFuncs = state.minusFuncs,
          options = state.options,
          outputPath = state.outputPath,
          plusFuncs = state.plusFuncs,
          propDepMap = state.propDepMap,
          source = state.source,
          varDepMap = state.varDepMap;
    }
    else {
      // display help message
      if (_.find(options, function(arg) {
            return /^(?:-h|--help)$/.test(arg);
          })) {
        displayHelp();
        return;
      }

      // display `lodash.VERSION`
      if (_.find(options, function(arg) {
            return /^(?:-V|--version)$/.test(arg);
          })) {
        console.log(_.VERSION);
        return;
      }

      /*----------------------------------------------------------------------*/

      // clone dependencies to modify
      var funcDepMap = _.cloneDeep(funcDependencyMap),
          propDepMap = _.cloneDeep(propDependencyMap),
          varDepMap = _.cloneDeep(varDependencyMap);

      // the path to the source file
      var filePath = path.join(__dirname, 'lodash.js');

      // used to specify a custom IIFE to wrap Lo-Dash
      var iife = options.reduce(function(result, value) {
        var match = value.match(/^iife=([\s\S]*)$/);
        return match ? match[1] : result;
      }, null);

      // flag to specify a Backbone build
      var isBackbone = _.contains(options, 'backbone');

      // flag to specify a Content Security Policy build
      var isCSP = _.contains(options, 'csp') || _.contains(options, 'CSP');

      // flag to specify only creating the debug build
      var isDebug = _.contains(options, '-d') || _.contains(options, '--debug');

      // flag to indicate that a custom IIFE was specified
      var isIIFE = typeof iife == 'string';

      // flag to specify creating a source map for the minified source
      var isMapped = _.contains(options, '-p') || _.contains(options, '--source-map');

      // flag to specify only creating the minified build
      var isMinify = _.contains(options, '-m') || _.contains(options, '--minify');

      // flag to specify a mobile build
      var isMobile = _.contains(options, 'mobile');

      // flag to specify a modern build
      var isModern = isCSP || isMobile || _.contains(options, 'modern');

      // flag to specify a modularize build
      var isModularize = _.contains(options, 'modularize');

      // flag to specify a no-dependency build
      var isNoDep = _.contains(options, '-n') || _.contains(options, '--no-dep');

      // flag to specify writing output to standard output
      var isStdOut = _.contains(options, '-c') || _.contains(options, '--stdout');

      // flag to specify skipping status updates normally logged to the console
      var isSilent = isStdOut || _.contains(options, '-s') || _.contains(options, '--silent');

      // flag to specify `_.assign`, `_.bindAll`, and `_.defaults` are
      // constructed using the "use strict" directive
      var isStrict = _.contains(options, 'strict');

      // flag to specify an Underscore build
      var isUnderscore = isBackbone || _.contains(options, 'underscore');

      // flag to specify a legacy build
      var isLegacy = !(isModern || isUnderscore) && _.contains(options, 'legacy');

      // used to specify the ways to export the `lodash` function
      var exportsOptions = options.reduce(function(result, value) {
        return /^exports=.*$/.test(value) ? optionToArray(value).sort() : result;
      }, isUnderscore
        ? ['commonjs', 'global', 'node']
        : allExports.slice()
      );

      // used to specify the AMD module ID of Lo-Dash used by precompiled templates
      var moduleId = options.reduce(function(result, value) {
        var match = value.match(/^moduleId=(.*)$/);
        return match ? match[1] : result;
      }, 'lodash');

      // used to match external template files to precompile
      var templatePattern = options.reduce(function(result, value) {
        var match = value.match(/^template=(.+)$/);
        return match
          ? match[1]
          : result;
      }, '');

      // used as the template settings for precompiled templates
      var templateSettings = options.reduce(function(result, value) {
        var match = value.match(/^settings=(.+)$/);
        return match
          ? _.assign(result, Function('return {' + match[1].replace(/^{|}$/g, '') + '}')())
          : result;
      }, _.assign(_.clone(_.templateSettings), {
        'moduleId': moduleId
      }));

      // flags to specify export options
      var isAMD = _.contains(exportsOptions, 'amd'),
          isCommonJS = _.contains(exportsOptions, 'commonjs'),
          isGlobal = _.contains(exportsOptions, 'global'),
          isNode = _.contains(exportsOptions, 'node');

      // flag to specify a template build
      var isTemplate = !!templatePattern;

      // the lodash.js source
      var source = fs.readFileSync(filePath, 'utf8');

      /*----------------------------------------------------------------------*/

      // delete the `_.findWhere` dependency map to enable its alias mapping
      if (!isUnderscore || isLodash('findWhere')) {
        delete funcDepMap.findWhere;
      }

      // categories of functions to include in the build
      var categoryOptions = options.reduce(function(accumulator, value) {
        if (/^category=.+$/.test(value)) {
          var array = optionToArray(value);
          accumulator = _.union(array.map(function(category) {
            return capitalize(category.toLowerCase());
          }));
        }
        return accumulator;
      }, []);

      // functions to include in the build
      var includeFuncs = options.reduce(function(accumulator, value) {
        return /^include=.*$/.test(value)
          ? _.union(accumulator, optionToMethodsArray(value, funcDepMap))
          : accumulator;
      }, categoryOptions.slice());

      // properties to include in the build
      var includeProps = _.intersection(includeFuncs, propDependencies);

      // variables to include in the build
      var includeVars = _.intersection(includeFuncs, varDependencies);

      // functions to remove from the build
      var minusFuncs = options.reduce(function(accumulator, value) {
        return /^(?:exclude|minus)=.*$/.test(value)
          ? _.union(accumulator, optionToMethodsArray(value, funcDepMap))
          : accumulator;
      }, []);

      // functions to add to the build
      var plusFuncs = options.reduce(function(accumulator, value) {
        return /^plus=.*$/.test(value)
          ? _.union(accumulator, optionToMethodsArray(value, funcDepMap))
          : accumulator;
      }, []);

      // expand categories to function names
      _.each([includeFuncs, minusFuncs, plusFuncs], function(funcNames) {
        var categories = _.intersection(funcNames, allCategories);

        categories.forEach(function(category) {
          var otherFuncs = getNamesByCategory(category).filter(function(key) {
            var type = typeof _[key];
            return type == 'function' || type == 'undefined';
          });

          // limit function names to those available for specific builds
          if (isBackbone) {
            otherFuncs = _.intersection(otherFuncs, backboneDependencies);
          } else if (isUnderscore) {
            otherFuncs = _.intersection(otherFuncs, underscoreFuncs);
          }
          push.apply(funcNames, otherFuncs);
        });
      });

      // remove categories from function names
      includeFuncs = _.difference(includeFuncs, allCategories, includeProps, includeVars);
      minusFuncs = _.difference(minusFuncs, allCategories);
      plusFuncs = _.difference(plusFuncs, allCategories);

      /*----------------------------------------------------------------------*/

      // used to detect invalid command-line arguments
      var invalidArgs = _.reject(options.slice(reNode.test(options[0]) ? 2 : 0), function(value, index, options) {
        if (/^(?:-o|--output)$/.test(options[index - 1]) ||
            /^(?:category|exclude|exports|iife|include|moduleId|minus|plus|settings|template)=[\s\S]*$/.test(value)) {
          return true;
        }
        var result = _.contains([
          'backbone',
          'csp',
          'legacy',
          'mobile',
          'modern',
          'modularize',
          'strict',
          'underscore',
          '-c', '--stdout',
          '-d', '--debug',
          '-h', '--help',
          '-m', '--minify',
          '-n', '--no-dep',
          '-o', '--output',
          '-p', '--source-map',
          '-s', '--silent',
          '-V', '--version'
        ], value);

        if (!result && /^(?:-p|--source-map)$/.test(options[index - 1])) {
          result = true;
          sourceMapURL = value;
        }
        return result;
      });

      // report invalid command and option arguments
      if (invalidArgs.length) {
        warnings.push('Invalid argument' + (invalidArgs.length > 1 ? 's' : '') + ' passed: ' + invalidArgs.join(', '));
      }
      // report invalid command combinations
      invalidArgs = _.intersection(options, ['backbone', 'csp', 'legacy', 'mobile', 'modern', 'underscore']);

      if (isTemplate) {
        invalidArgs.push('template');
      }
      if (invalidArgs.length > 1) {
        warnings.push('The `' + invalidArgs.slice(0, -1).join('`, `') + '`' + (invalidArgs.length > 2 ? ',' : '') + ' and `' + invalidArgs.slice(-1) + '` commands may not be combined.');
      }
      // report invalid command entries
      _.forOwn({
        'category': {
          'entries': categoryOptions,
          'validEntries': allCategories
        },
        'exports': {
          'entries': exportsOptions,
          'validEntries': allExports
        },
        'include': {
          'entries': includeFuncs,
          'validEntries': allFuncs
        },
        'minus': {
          'entries': minusFuncs,
          'validEntries': allFuncs
        },
        'plus': {
          'entries': plusFuncs,
          'validEntries': allFuncs
        }
      }, function(data, commandName) {
        invalidArgs = _.difference(data.entries, data.validEntries, ['none']);
        if (invalidArgs.length) {
          warnings.push('Invalid `' + commandName + '` entr' + (invalidArgs.length > 1 ? 'ies' : 'y') + ' passed: ' + invalidArgs.join(', '));
        }
      });

      if (warnings.length) {
        console.log([''].concat(
          warnings,
          'For more information type: lodash --help'
        ).join('\n'));
        return;
      }

      /*----------------------------------------------------------------------*/

      // names of functions to include in the build
      var buildFuncs = !isTemplate && (function() {
        var result;

        // update dependencies
        if (isLegacy) {
          _.pull(propDepMap.createBound, 'support');

          funcDepMap.isPlainObject = funcDepMap.shimIsPlainObject.slice();
          funcDepMap.keys = funcDepMap.shimKeys.slice();

          _.forOwn(varDepMap, function(deps) {
            _.pull(deps, 'reNative');
          });
        }
        if (isModularize) {
          funcDepMap.lodash.push('support', 'baseEach', 'forOwn', 'mixin');
          _.pull(funcDepMap.mixin, 'lodash');
        }
        else {
          funcDepMap.chain.push('wrapperChain');
          funcDepMap.wrapperValueOf.push('baseEach', 'chain', 'forOwn', 'mixin', 'wrapperChain', 'wrapperToString');

          _.each(['lodashWrapper', 'tap', 'wrapperChain', 'wrapperToString'], function(funcName) {
            funcDepMap[funcName].push('wrapperValueOf');
          });
        }
        if (isMobile) {
          _.each(['assign', 'defaults'], function(funcName) {
            _.pull(funcDepMap[funcName], 'keys');
          });
        }
        if (isLegacy || isMobile || isUnderscore) {
          _.each(['baseCreateCallback', 'createBound'], function(funcName) {
            _.pull(funcDepMap[funcName], 'setBindData');
          });
        }
        if (!isModularize && _.contains(plusFuncs, 'chain') == !isUnderscore) {
          _.pull(funcDepMap.mixin, 'isFunction');
        }
        if (isUnderscore) {
          if (!isLodash('baseClone') && !isLodash('clone') && !isLodash('cloneDeep')) {
            _.pull(funcDepMap.clone, 'baseClone').push('assign', 'isArray', 'isObject');
          }
          if (!isLodash('baseIsEqual') && !isLodash('isEqual')) {
            _.pull(funcDepMap.baseIsEqual, 'isArguments');
          }
          if (!isLodash('chain')) {
            _.pull(funcDepMap.wrapperValueOf, 'wrapperToString');
          }
          if (!isLodash('contains')) {
            _.pull(funcDepMap.contains, 'isString');
          }
          if (!isLodash('flatten')) {
            _.pull(funcDepMap.flatten, 'map');
          }
          if (!isLodash('isEmpty')) {
            funcDepMap.isEmpty = ['isArray', 'isString'];
          }
          if (!isLodash('lodash')) {
            _.pull(funcDepMap.lodash, 'isArray');
          }
          if (!isLodash('pick')){
            _.pull(funcDepMap.pick, 'forIn', 'isObject');
          }
          if (!isLodash('template')) {
            _.pull(funcDepMap.template, 'keys', 'values');
          }
          if (!isLodash('toArray')) {
            funcDepMap.toArray.push('isArray', 'map');
          }
          if (!isLodash('findWhere') || !isLodash('where')) {
            _.pull(funcDepMap.createCallback, 'baseIsEqual');
            funcDepMap.where.push('find', 'isEmpty');
          }
          // unexpose "exit early" feature from functions
          if (!isLodash('forEach') && !isLodash('forEachRight') &&
              !isLodash('forIn') && !isLodash('forInRight') &&
              !isLodash('forOwn') && !isLodash('forOwnRight')) {
            _.each(['baseEach', 'forEach', 'forIn', 'forInRight', 'forOwn', 'forOwnRight'], function(funcName) {
              (varDepMap[funcName] || (varDepMap[funcName] = [])).push('indicatorObject');
            });

            // modify functions that use `_.forEach` to use the private `indicatorObject`
            _.each(['findLast', 'forEachRight', 'transform'], function(funcName) {
              (varDepMap[funcName] || (varDepMap[funcName] = [])).push('indicatorObject');
            });

            // modify functions that use `_.forIn` to use the private `indicatorObject`
            _.each(['baseIsEqual', 'shimIsPlainObject'], function(funcName) {
              (varDepMap[funcName] || (varDepMap[funcName] = [])).push('indicatorObject');
            });

            // modify functions that use `_.forOwn` to use the private `indicatorObject`
            _.each(['contains', 'every', 'find', 'findKey', 'some'], function(funcName) {
              (varDepMap[funcName] || (varDepMap[funcName] = [])).push('indicatorObject');
            });

            // modify functions that use `_.forOwnRight` to use the private `indicatorObject`
            (varDepMap.findLastKey || (varDepMap.findLastKey = [])).push('indicatorObject');
          }

          _.each(['baseUniq', 'difference', 'intersection'], function(funcName) {
            if (funcName == 'baseUniq'
                  ? (!isLodash('baseUniq') && !isLodash('uniq'))
                  : !isLodash(funcName)
                ) {
              _.pull(funcDepMap[funcName], 'cacheIndexOf', 'createCache').push('getIndexOf');
            }
          });

          _.each(['isEqual', 'omit', 'pick'], function(funcName) {
            if (funcName == 'isEqual'
                  ? (!isLodash('baseIsEqual') && !isLodash('isEqual'))
                  : !isLodash(funcName)
                ) {
              _.pull(funcDepMap[funcName], 'baseCreateCallback', 'createCallback');
            }
          });

          _.forOwn(funcDepMap, function(deps, funcName) {
            if (_.every(getDependants(funcName, funcDepMap).concat(funcName), function(otherName) {
                  return !isLodash(otherName);
                })) {
              deps = funcDepMap[funcName];
              if (_.contains(deps, 'charAtCallback')) {
                _.pull(deps, 'charAtCallback', 'isArray', 'isString');
              }
              if (_.contains(deps, 'slice')) {
                _.pull(deps, 'slice');
              }
            }
          });

          _.forOwn(varDepMap, function(deps, funcName) {
            if (!isLodash(funcName)) {
              _.pull(deps, 'arrayPool', 'largeArraySize', 'maxPoolSize', 'objectPool');
            }
          });
        }
        if (isModern || isUnderscore) {
          _.each(['assign', 'baseEach', 'defaults', 'forIn', 'forOwn', 'shimKeys'], function(funcName) {
            if (!(isUnderscore && isLodash(funcName))) {
              var deps = _.pull(funcDepMap[funcName], 'createIterator');
              _.pull(varDepMap[funcName] || (varDepMap[funcName] = []), 'defaultsIteratorOptions', 'eachIteratorOptions', 'forOwnIteratorOptions').push('objectTypes');

              if (funcName != 'baseEach') {
                deps.push('isArguments');
              }
              if (funcName != 'defaults' && funcName != 'shimKeys') {
                deps.push('baseCreateCallback');
              }
              if (funcName != 'forIn' && funcName != 'shimKeys') {
                deps.push('keys');
              }
            }
          });

          _.forOwn(propDepMap, function(deps, funcName) {
            if (funcName != 'createBound' &&
                !(isMobile && funcName == 'keys') &&
                !(isUnderscore && isLodash(funcName))) {
              _.pull(deps, 'support');
            }
          });

          _.forOwn(funcDepMap, function(deps, funcName) {
            if (_.contains(deps, 'isNode')) {
              _.pull(deps, 'isNode');
            }
            if (_.contains(deps, 'toString') && funcName != 'contains' && funcName != 'parseInt') {
              _.pull(deps, 'isString');
            }
          });

          if (isUnderscore) {
            _.forOwn(funcDepMap, function(deps, funcName) {
              if (_.every(getDependants(funcName, funcDepMap).concat(funcName), function(otherName) {
                    return !isLodash(otherName);
                  })) {
                deps = funcDepMap[funcName];
                if (_.contains(deps, 'releaseArray')) {
                  _.pull(deps, 'getArray', 'releaseArray');
                }
                if (_.contains(deps, 'releaseObject')) {
                  _.pull(deps, 'getObject', 'releaseObject');
                }
              }
            });
          }
          if (!isMobile) {
            _.pull(funcDepMap.setBindData, 'noop');

            _.each(['baseClone', 'lodash', 'transform', 'wrapperValueOf'], function(funcName) {
              _.pull(funcDepMap[funcName], 'baseEach').push('forEach');
            });

            _.each(['contains', 'every', 'filter', 'find', 'forEach', 'map', 'max', 'min', 'reduce', 'some'], function(funcName) {
             _.pull(funcDepMap[funcName], 'baseEach').push('forOwn');
            });

            _.each(['every', 'find', 'filter', 'forEach', 'forIn', 'forOwn', 'map', 'reduce', 'shimKeys'], function(funcName) {
              if (!(isUnderscore && isLodash(funcName))) {
                _.pull(funcDepMap[funcName], 'isArray');
              }
            });

            _.each(['max', 'min'], function(funcName) {
              if (!(isUnderscore && isLodash(funcName))) {
                funcDepMap[funcName].push('forEach');
              }
            });

            _.forOwn(funcDepMap, function(deps, funcName) {
              if (funcName != 'baseFlatten' && _.contains(deps, 'isArguments') &&
                  !(isUnderscore && isLodash(funcName))) {
                _.pull(deps, 'isArguments');
              }
            });
          }
        }
        if (isModularize) {
          _.forOwn(funcDepMap, function(deps, funcName) {
            if (_.contains(deps, 'getIndexOf')) {
              _.pull(deps, 'getIndexOf').push('baseIndexOf');
            }
          });
        }
        // add function names explicitly
        if (includeFuncs.length) {
          result = includeFuncs;
        }
        // add default function names
        if (!includeProps.length && !includeVars.length) {
          if (isBackbone && !result) {
            result = backboneDependencies;
          }
          else if (isUnderscore && !result) {
            result = underscoreFuncs;
          }
          if (!result) {
            result = lodashFuncs.slice();
          }
        }
        // remove special "none" entry
        if (result == 'none') {
          result = [];
        } else {
          _.pull(result, 'none');
        }
        // add and subtract function names
        if (plusFuncs.length) {
          result = _.union(result, plusFuncs);
        }
        if (minusFuncs.length) {
          result = _.difference(result, minusFuncs.concat(getDependants(minusFuncs, funcDepMap)));
        }
        if (isModularize) {
          _.pull(result, 'runInContext');
        }
        return getDependencies(result, funcDepMap);
      }());

      // add properties, variables, and their function dependencies to include in the build
      (function() {
        function expand(result, depMap, funcNames, stack) {
          stack || (stack = []);
          return _.uniq(_.reduce(funcNames || depMap, function(result, identifiers, funcName) {
            // juggle arguments
            if (funcNames) {
              funcName = identifiers;
              identifiers = depMap[funcName] || [];
            }
            if (!_.contains(stack, funcName) && (funcNames || _.contains(buildFuncs, funcName))) {
              var deps = _.uniq(_.transform(identifiers, function(deps, identifier) {
                push.apply(deps, getDependencies(identifier, funcDepMap));
              }));

              stack.push(funcName);
              push.apply(result, identifiers);

              buildFuncs = _.union(buildFuncs, deps);
              result = expand(result, depMap, deps, stack);
            }
            return result;
          }, result));
        }

        includeProps = expand(includeProps, propDepMap);
        includeVars = expand(includeVars, varDepMap);
      }());

      /*----------------------------------------------------------------------*/

      // load customized Lo-Dash module
      var lodash = !isTemplate && (function() {
        source = setUseStrictOption(source, isStrict);

        if (isLegacy) {
          source = removeSupportProp(source, 'fastBind');
          source = replaceSupportProp(source, 'argsClass', 'false');

          // remove native `Function#bind` branch in `createBound`
          source = source.replace(matchFunction(source, 'createBound'), function(match) {
            return match.replace(/(?:\s*\/\/.*)*\n( *)if *\([^{]+?nativeBind[\s\S]+?\n\1else *\{([\s\S]+?)\n\1}/, function(match, indent, snippet) {
              return snippet
                .replace(/^  /gm, '')
                .replace(/^( *)bound(?= *=)/m, '$1var bound');
            });
          });

          // remove native `Array.isArray` branch in `_.isArray`
          source = source.replace(matchFunction(source, 'isArray'), function(match) {
            return match.replace(/\bnativeIsArray\s*\|\|\s*/, '');
          });

          // replace `createObject` and `_.isArguments` with their forks
          _.forOwn({
            'createObject': [getCreateObjectFork, removeCreateObjectFork],
            'isArguments': [getIsArgumentsFork, removeIsArgumentsFork]
          },
          function(funcs, funcName) {
            var getFork = funcs[0],
                removeFork =  funcs[1];

            source = source.replace(matchFunction(source, funcName).replace(RegExp('[\\s\\S]+?function ' + funcName), ''), function() {
              var snippet = getFork(source),
                  body = snippet.match(RegExp(funcName + ' *= *function([\\s\\S]+?\\n *});'))[1],
                  indent = getIndent(snippet);

              return body.replace(RegExp('^' + indent, 'gm'), indent.slice(0, -2)) + '\n';
            });

            source = removeFork(source);
          });

          // replace `_.isPlainObject` with `shimIsPlainObject`
          source = source.replace(
            matchFunction(source, 'isPlainObject').replace(/^ *var isPlainObject *= */m, ''),
            matchFunction(source, 'shimIsPlainObject').replace(/^ *function shimIsPlainObject/m, 'function').replace(/\s*$/, ';\n')
          );

          // replace `_.keys` with `shimKeys`
          source = source.replace(
            matchFunction(source, 'keys').replace(/^ *var keys.*= */m, ''),
            matchFunction(source, 'shimKeys').replace(/^ *var shimKeys *= */m, '')
          );
        }
        if (isModern) {
          source = removeIsArgumentsFork(source);
          source = removeSetBindDataFork(source);
          source = removeSupportSpliceObjects(source);

          if (isMobile) {
            source = replaceSupportProp(source, 'enumPrototypes', 'true');
            source = replaceSupportProp(source, 'nonEnumArgs', 'true');
          }
          else {
            source = removeIsFunctionFork(source);
            source = removeCreateObjectFork(source);

            // replace `+new Date` with `Date.now` use in `_.debounce
            source = source.replace(matchFunction(source, 'debounce'), function(match) {
              return match.replace(/\+new Date\b/g, 'now()');
            });

            // remove `shimIsPlainObject` from `_.isPlainObject`
            source = source.replace(matchFunction(source, 'isPlainObject'), function(match) {
              return match.replace(/!getPrototypeOf[^:]+:\s*/, '');
            });
          }
        }
        if (!isModern || isMobile) {
          source = removeEsOptimization(source);
        }
        if (isLegacy || isMobile || isUnderscore) {
          if (isMobile || (!isLodash('assign') && !isLodash('defaults') && !isLodash('forIn') && !isLodash('forOwn'))) {
            source = removeKeysOptimization(source);
          }
          if (!isLodash('defer')) {
            source = removeDeferFork(source);
          }
        }
        if (isModern || isUnderscore) {
          source = removeSupportArgsClass(source);
          source = removeSupportArgsObject(source);
          source = removeSupportNonEnumShadows(source);
          source = removeSupportOwnLast(source);
          source = removeSupportUnindexedChars(source);
          source = removeSupportNodeClass(source);

          if (!isMobile) {
            source = removeSupportEnumErrorProps(source);
            source = removeSupportEnumPrototypes(source);
            source = removeSupportNonEnumArgs(source);

            // replace `_.forEach`
            source = replaceFunction(source, 'forEach', [
              'function forEach(collection, callback, thisArg) {',
              '  var index = -1,',
              '      length = collection ? collection.length : 0;',
              '',
              "  callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);",
              "  if (typeof length == 'number') {",
              '    while (++index < length) {',
              '      if (callback(collection[index], index, collection) === false) {',
              '        break;',
              '      }',
              '    }',
              '  } else {',
              '    baseEach(collection, callback);',
              '  }',
              '  return collection;',
              '}',
            ].join('\n'));

            // replace `_.isRegExp`
            if (!isUnderscore || (isUnderscore && isLodash('isRegExp'))) {
              source = replaceFunction(source, 'isRegExp', [
                'function isRegExp(value) {',
                "  return value ? (typeof value == 'object' && toString.call(value) == regexpClass) : false;",
                '}'
              ].join('\n'));
            }

            // replace `_.map`
            source = replaceFunction(source, 'map', [
              'function map(collection, callback, thisArg) {',
              '  var index = -1,',
              '      length = collection ? collection.length : 0;',
              '',
              '  callback = lodash.createCallback(callback, thisArg, 3);',
              "  if (typeof length == 'number') {",
              '    var result = Array(length);',
              '    while (++index < length) {',
              '      result[index] = callback(collection[index], index, collection);',
              '    }',
              '  } else {',
              '    result = [];',
              '    baseEach(collection, function(value, key, collection) {',
              '      result[++index] = callback(value, key, collection);',
              '    });',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));

            // replace `_.pluck`
            source = replaceFunction(source, 'pluck', [
              'function pluck(collection, property) {',
              '  var index = -1,',
              '      length = collection ? collection.length : 0;',
              '',
              "  if (typeof length == 'number') {",
              '    var result = Array(length);',
              '    while (++index < length) {',
              '      result[index] = collection[index][property];',
              '    }',
              '  }',
              '  return result || map(collection, property);',
              '}'
            ].join('\n'));

            // replace `isArray(collection)` checks in "Collections" functions with simpler type checks
            _.each(['every', 'filter', 'find', 'max', 'min', 'reduce', 'some'], function(funcName) {
              source = source.replace(matchFunction(source, funcName), function(match) {
                if (funcName == 'reduce') {
                  match = match.replace(/^( *)var noaccum\b/m, '$1if (!collection) return accumulator;\n$&');
                }
                else if (/^(?:max|min)$/.test(funcName)) {
                  match = match.replace(/\bbaseEach\(/, 'forEach(');
                  if (!isUnderscore || isLodash(funcName)) {
                    return match;
                  }
                }
                return match.replace(/^(( *)if *\(.*?\bisArray\([^\)]+\).*?\) *\{\n)(( *)var index[^;]+.+\n+)/m, function(snippet, statement, indent, vars) {
                  vars = vars
                    .replace(/\b(length *=)[^;=]+/, '$1 collection' + (funcName == 'reduce' ? '.length' : ' ? collection.length : 0'))
                    .replace(RegExp('^  ' + indent, 'gm'), indent);

                  return vars + statement.replace(/\bisArray\([^\)]+\)/, "typeof length == 'number'");
                });
              });
            });

            // replace `array` property value of `eachIteratorOptions` with `false`
            source = source.replace(/^( *)var eachIteratorOptions *= *[\s\S]+?\n\1};\n/m, function(match) {
              return match.replace(/(^ *'array':)[^,]+/m, '$1 false');
            });
          }
        }
        if (isUnderscore) {
          // replace `lodash`
          source = replaceFunction(source, 'lodash', [
            'function lodash(value) {',
            '  return (value instanceof lodash)',
            '    ? value',
            '    : new lodashWrapper(value);',
            '}'
          ].join('\n'));

          // replace `_.assign`
          if (!isLodash('assign')) {
            source = replaceFunction(source, 'assign', [
              'function assign(object) {',
              '  if (!object) {',
              '    return object;',
              '  }',
              '  for (var argsIndex = 1, argsLength = arguments.length; argsIndex < argsLength; argsIndex++) {',
              '    var iterable = arguments[argsIndex];',
              '    if (iterable) {',
              '      for (var key in iterable) {',
              '        object[key] = iterable[key];',
              '      }',
              '    }',
              '  }',
              '  return object;',
              '}'
            ].join('\n'));
          }
          // replace `_.clone`
          if (!isLodash('baseClone') && !isLodash('clone') && !isLodash('cloneDeep')) {
            source = replaceFunction(source, 'clone', [
              'function clone(value) {',
              '  return isObject(value)',
              '    ? (isArray(value) ? slice(value) : assign({}, value))',
              '    : value;',
              '}'
            ].join('\n'));
          }
          // replace `_.contains`
          if (!isLodash('contains')) {
            source = replaceFunction(source, 'contains', [
              'function contains(collection, target) {',
              '  var indexOf = getIndexOf(),',
              '      length = collection ? collection.length : 0,',
              '      result = false;',
              "  if (length && typeof length == 'number') {",
              '    result = indexOf(collection, target) > -1;',
              '  } else {',
              '    baseEach(collection, function(value) {',
              '      return !(result = value === target);',
              '    });',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.defaults`
          if (!isLodash('defaults')) {
            source = replaceFunction(source, 'defaults', [
              'function defaults(object) {',
              '  if (!object) {',
              '    return object;',
              '  }',
              '  for (var argsIndex = 1, argsLength = arguments.length; argsIndex < argsLength; argsIndex++) {',
              '    var iterable = arguments[argsIndex];',
              '    if (iterable) {',
              '      for (var key in iterable) {',
              "        if (typeof object[key] == 'undefined') {",
              '          object[key] = iterable[key];',
              '        }',
              '      }',
              '    }',
              '  }',
              '  return object;',
              '}'
            ].join('\n'));
          }
          // replace `_.difference`
          if (!isLodash('difference')) {
            source = replaceFunction(source, 'difference', [
              'function difference(array) {',
              '  var index = -1,',
              '      indexOf = getIndexOf(),',
              '      length = array.length,',
              '      flattened = baseFlatten(arguments, true, true, 1),',
              '      result = [];',
              '',
              '  while (++index < length) {',
              '    var value = array[index];',
              '    if (indexOf(flattened, value) < 0) {',
              '      result.push(value);',
              '    }',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // add Underscore's `_.findWhere`
          if (!isLodash('findWhere') && !isLodash('where')) {
            source = source.replace(matchFunction(source, 'find'), function(match) {
              var indent = getIndent(match);
              return match && (match + [
                '',
                '/**',
                ' * Examines each element in a `collection`, returning the first that',
                ' * has the given `properties`. When checking `properties`, this method',
                ' * performs a deep comparison between values to determine if they are',
                ' * equivalent to each other.',
                ' *',
                ' * @static',
                ' * @memberOf _',
                ' * @category Collections',
                ' * @param {Array|Object|String} collection The collection to iterate over.',
                ' * @param {Object} properties The object of property values to filter by.',
                ' * @returns {Mixed} Returns the found element, else `undefined`.',
                ' * @example',
                ' *',
                ' * var food = [',
                " *   { 'name': 'apple',  'organic': false, 'type': 'fruit' },",
                " *   { 'name': 'banana', 'organic': true,  'type': 'fruit' },",
                " *   { 'name': 'beet',   'organic': false, 'type': 'vegetable' }",
                ' * ];',
                ' *',
                " * _.findWhere(food, { 'type': 'vegetable' });",
                " * // => { 'name': 'beet', 'organic': false, 'type': 'vegetable' }",
                ' */',
                'function findWhere(object, properties) {',
                '  return where(object, properties, true);',
                '}',
                ''
              ].join('\n' + indent));
            });

            // replace alias assignment
            source = source.replace(getMethodAssignments(source), function(match) {
              return match.replace(/^( *lodash.findWhere *= *).+/m, '$1findWhere;');
            });
          }
          // replace `_.flatten`
          if (!isLodash('flatten')) {
            source = replaceFunction(source, 'flatten', [
              'function flatten(array, isShallow) {',
              '  return baseFlatten(array, isShallow);',
              '}'
            ].join('\n'));
          }
          // replace `_.intersection`
          if (!isLodash('intersection')) {
            source = replaceFunction(source, 'intersection', [
              'function intersection(array) {',
              '  var args = arguments,',
              '      argsLength = args.length,',
              '      index = -1,',
              '      indexOf = getIndexOf(),',
              '      length = array ? array.length : 0,',
              '      result = [];',
              '',
              '  outer:',
              '  while (++index < length) {',
              '    var value = array[index];',
              '    if (indexOf(result, value) < 0) {',
              '      var argsIndex = argsLength;',
              '      while (--argsIndex) {',
              '        if (indexOf(args[argsIndex], value) < 0) {',
              '          continue outer;',
              '        }',
              '      }',
              '      result.push(value);',
              '    }',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.isEmpty`
          if (!isLodash('isEmpty')) {
            source = replaceFunction(source, 'isEmpty', [
              'function isEmpty(value) {',
              '  if (!value) {',
              '    return true;',
              '  }',
              '  if (isArray(value) || isString(value)) {',
              '    return !value.length;',
              '  }',
              '  for (var key in value) {',
              '    if (hasOwnProperty.call(value, key)) {',
              '      return false;',
              '    }',
              '  }',
              '  return true;',
              '}'
            ].join('\n'));
          }
          // replace `_.isEqual`
          if (!isLodash('baseIsEqual') && !isLodash('isEqual')) {
            source = replaceFunction(source, 'isEqual', [
              'function isEqual(a, b) {',
              '  return baseIsEqual(a, b);',
              '}'
            ].join('\n'));

            source = replaceFunction(source, 'baseIsEqual', [
              'function baseIsEqual(a, b, stackA, stackB) {',
              '  if (a === b) {',
              '    return a !== 0 || (1 / a == 1 / b);',
              '  }',
              '  var type = typeof a,',
              '      otherType = typeof b;',
              '',
              '  if (a === a &&',
              "      !(a && objectTypes[type]) &&",
              "      !(b && objectTypes[otherType])) {",
              '    return false;',
              '  }',
              '  if (a == null || b == null) {',
              '    return a === b;',
              '  }',
              '  var className = toString.call(a),',
              '      otherClass = toString.call(b);',
              '',
              '  if (className != otherClass) {',
              '    return false;',
              '  }',
              '  switch (className) {',
              '    case boolClass:',
              '    case dateClass:',
              '      return +a == +b;',
              '',
              '    case numberClass:',
              '      return a != +a',
              '        ? b != +b',
              '        : (a == 0 ? (1 / a == 1 / b) : a == +b);',
              '',
              '    case regexpClass:',
              '    case stringClass:',
              '      return a == String(b);',
              '  }',
              '  var isArr = className == arrayClass;',
              '  if (!isArr) {',
              "    if (hasOwnProperty.call(a, '__wrapped__ ') || hasOwnProperty.call(b, '__wrapped__')) {",
              '      return baseIsEqual(a.__wrapped__ || a, b.__wrapped__ || b, stackA, stackB);',
              '    }',
              '    if (className != objectClass) {',
              '      return false;',
              '    }',
              '    var ctorA = a.constructor,',
              '        ctorB = b.constructor;',
              '',
              '    if (ctorA != ctorB && !(',
              '          isFunction(ctorA) && ctorA instanceof ctorA &&',
              '          isFunction(ctorB) && ctorB instanceof ctorB',
              '        )) {',
              '      return false;',
              '    }',
              '  }',
              '  stackA || (stackA = []);',
              '  stackB || (stackB = []);',
              '',
              '  var length = stackA.length;',
              '  while (length--) {',
              '    if (stackA[length] == a) {',
              '      return stackB[length] == b;',
              '    }',
              '  }',
              '  var result = true,',
              '      size = 0;',
              '',
              '  stackA.push(a);',
              '  stackB.push(b);',
              '',
              '  if (isArr) {',
              '    size = b.length;',
              '    result = size == a.length;',
              '',
              '    if (result) {',
              '      while (size--) {',
              '        if (!(result = baseIsEqual(a[size], b[size], stackA, stackB))) {',
              '          break;',
              '        }',
              '      }',
              '    }',
              '    return result;',
              '  }',
              '  forIn(b, function(value, key, b) {',
              '    if (hasOwnProperty.call(b, key)) {',
              '      size++;',
              '      return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, stackA, stackB));',
              '    }',
              '  });',
              '',
              '  if (result) {',
              '    forIn(a, function(value, key, a) {',
              '      if (hasOwnProperty.call(a, key)) {',
              '        return (result = --size > -1);',
              '      }',
              '    });',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.memoize`
          if (!isLodash('memoize')) {
             source = replaceFunction(source, 'memoize', [
                'function memoize(func, resolver) {',
                '  var cache = {};',
                '  return function() {',
                '    var key = keyPrefix + (resolver ? resolver.apply(this, arguments) : arguments[0]);',
                '    return hasOwnProperty.call(cache, key)',
                '      ? cache[key]',
                '      : (cache[key] = func.apply(this, arguments));',
                '  };',
                '}'
            ].join('\n'));
          }
          // replace `_.omit`
          if (!isLodash('omit')) {
            source = replaceFunction(source, 'omit', [
              'function omit(object) {',
              '  var indexOf = getIndexOf(),',
              '      props = baseFlatten(arguments, true, false, 1),',
              '      result = {};',
              '',
              '  forIn(object, function(value, key) {',
              '    if (indexOf(props, key) < 0) {',
              '      result[key] = value;',
              '    }',
              '  });',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.pick`
          if (!isLodash('pick')) {
            source = replaceFunction(source, 'pick', [
              'function pick(object) {',
              '  var index = -1,',
              '      props = baseFlatten(arguments, true, false, 1),',
              '      length = props.length,',
              '      result = {};',
              '',
              '  while (++index < length) {',
              '    var prop = props[index];',
              '    if (prop in object) {',
              '      result[prop] = object[prop];',
              '    }',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.result`
          if (!isLodash('result')) {
            source = replaceFunction(source, 'result', [
              'function result(object, property) {',
              '  var value = object ? object[property] : undefined;',
              '  return isFunction(value) ? object[property]() : value;',
              '}'
            ].join('\n'));
          }
          // replace `_.sortBy`
          if (!isLodash('sortBy')) {
            source = replaceFunction(source, 'sortBy', [
              'function sortBy(collection, callback, thisArg) {',
              '  var index = -1,',
              '      length = collection ? collection.length : 0,',
              "      result = Array(typeof length == 'number' ? length : 0);",
              '',
              '  callback = lodash.createCallback(callback, thisArg, 3);',
              '  forEach(collection, function(value, key, collection) {',
              '    result[++index] = {',
              "      'criteria': callback(value, key, collection),",
              "      'index': index,",
              "      'value': value",
              '    };',
              '  });',
              '',
              '  length = result.length;',
              '  result.sort(compareAscending);',
              '  while (length--) {',
              '    result[length] = result[length].value;',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.template`
          if (!isLodash('template')) {
            source = replaceFunction(source, 'template', [
              'function template(text, data, options) {',
              '  var _ = lodash,',
              '      settings = _.templateSettings;',
              '',
              "  text || (text = '');",
              '  options = iteratorTemplate ? defaults({}, options, settings) : settings;',
              '',
              '  var index = 0,',
              '      source = "__p += \'",',
              '      variable = options.variable;',
              '',
              '  var reDelimiters = RegExp(',
              "    (options.escape || reNoMatch).source + '|' +",
              "    (options.interpolate || reNoMatch).source + '|' +",
              "    (options.evaluate || reNoMatch).source + '|$'",
              "  , 'g');",
              '',
              '  text.replace(reDelimiters, function(match, escapeValue, interpolateValue, evaluateValue, offset) {',
              '    source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);',
              '    if (escapeValue) {',
              '      source += "\' +\\n_.escape(" + escapeValue + ") +\\n\'";',
              '    }',
              '    if (evaluateValue) {',
              '      source += "\';\\n" + evaluateValue + ";\\n__p += \'";',
              '    }',
              '    if (interpolateValue) {',
              '      source += "\' +\\n((__t = (" + interpolateValue + ")) == null ? \'\' : __t) +\\n\'";',
              '    }',
              '    index = offset + match.length;',
              '    return match;',
              '  });',
              '',
              '  source += "\';\\n";',
              '  if (!variable) {',
              "    variable = 'obj';",
              "    source = 'with (' + variable + ' || {}) {\\n' + source + '\\n}\\n';",
              '  }',
              "  source = 'function(' + variable + ') {\\n' +",
              '    "var __t, __p = \'\', __j = Array.prototype.join;\\n" +',
              '    "function print() { __p += __j.call(arguments, \'\') }\\n" +',
              '    source +',
              "    'return __p\\n}';",
              '',
              '  try {',
              "    var result = Function('_', 'return ' + source)(_);",
              '  } catch(e) {',
              '    e.source = source;',
              '    throw e;',
              '  }',
              '  if (data) {',
              '    return result(data);',
              '  }',
              '  result.source = source;',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.throttle`
          if (!isLodash('throttle')) {
            source = replaceFunction(source, 'throttle', [
              'function throttle(func, wait, options) {',
              '  var leading = true,',
              '      trailing = true;',
              '',
              '  if (options === false) {',
              '    leading = false;',
              '  } else if (isObject(options)) {',
              "    leading = 'leading' in options ? options.leading : leading;",
              "    trailing = 'trailing' in options ? options.trailing : trailing;",
              '  }',
              '  options = {};',
              '  options.leading = leading;',
              '  options.maxWait = wait;',
              '  options.trailing = trailing;',
              '',
              '  return debounce(func, wait, options);',
              '}'
            ].join('\n'));
          }
          // replace `_.times`
          if (!isLodash('times')) {
            source = replaceFunction(source, 'times', [
              'function times(n, callback, thisArg) {',
              '  var index = -1,',
              '      result = Array(n > -1 ? n : 0);',
              '',
              '  while (++index < n) {',
              '    result[index] = callback.call(thisArg, index);',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.toArray`
          if (!isLodash('toArray')) {
            source = replaceFunction(source, 'toArray', [
              'function toArray(collection) {',
              '  if (isArray(collection)) {',
              '    return slice(collection);',
              '  }',
              "  if (collection && typeof collection.length == 'number') {",
              '    return map(collection);',
              '  }',
              '  return values(collection);',
              '}'
            ].join('\n'));
          }
          // replace `baseUniq`
          if (!isLodash('baseUniq') && !isLodash('uniq')) {
            source = replaceFunction(source, 'baseUniq', [
              'function baseUniq(array, isSorted, callback) {',
              '  var index = -1,',
              '      indexOf = getIndexOf(),',
              '      length = array ? array.length : 0,',
              '      result = [],',
              '      seen = callback ? [] : result;',
              '',
              '  while (++index < length) {',
              '    var value = array[index],',
              '        computed = callback ? callback(value, index, array) : value;',
              '',
              '    if (isSorted',
              '          ? !index || seen[seen.length - 1] !== computed',
              '          : indexOf(seen, computed) < 0',
              '        ) {',
              '      if (callback) {',
              '        seen.push(computed);',
              '      }',
              '      result.push(value);',
              '    }',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `_.uniqueId`
          if (!isLodash('uniqueId')) {
            source = replaceFunction(source, 'uniqueId', [
              'function uniqueId(prefix) {',
              "  var id = ++idCounter + '';",
              '  return prefix ? prefix + id : id;',
              '}'
            ].join('\n'));
          }
          // replace `_.where`
          if (!isLodash('where')) {
            source = replaceFunction(source, 'where', [
              'function where(collection, properties, first) {',
              '  return (first && isEmpty(properties))',
              '    ? undefined',
              '    : (first ? find : filter)(collection, properties);',
              '}'
            ].join('\n'));

            // simplify `_.createCallback`
            source = source.replace(matchFunction(source, 'createCallback'), function(match) {
              return match
                // remove unnecessary fast path
                .replace(/^(( *)var props *=.+?),[\s\S]+?\n\2}/m, '$1;')
                // remove `baseIsEqual` use
                .replace(/=.+?\bbaseIsEqual\((.+?), *(.+?),.+?\)/, '= $1 === $2');
            });
          }
          // replace `_.zip`
          if(!isLodash('zip')) {
            source = replaceFunction(source, 'zip', [
              'function zip() {',
              '  var index = -1,',
              "      length = max(pluck(arguments, 'length')),",
              '      result = Array(length < 0 ? 0 : length);',
              '',
              '  while (++index < length) {',
              '    result[index] = pluck(arguments, index);',
              '  }',
              '  return result;',
              '}'
            ].join('\n'));
          }
          // replace `htmlEscapes` entries with hex entities
          if (!isLodash('escape')) {
            source = source.replace(matchVar(source, 'htmlEscapes'), function(match) {
              return match
                .replace('#39', '#x27')
                .replace(/(\n *)}/, ",$1  '/': '&#x2F;'$1}");
            });
          }
          // remove support for a `step` of `0` in `_.range`
          if (!isLodash('range')) {
            source = source.replace(matchFunction(source, 'range'), function(match) {
              return match
                .replace(/typeof *step[^:]+:/, '')
                .replace(/\(step.*\|\|.+?\)/, 'step')
            });
          }
          if (!isModularize) {
            // remove `_.templateSettings.imports assignment
            source = source.replace(/,[^']*'imports':[^}]+}/, '');

            // replace complex lodash wrapper checks with simpler ones
            source = source.replace(matchFunction(source, 'baseIsEqual'), function(match) {
              return match.replace(/hasOwnProperty\.call\((\w+), *'__wrapped__'\)/g, '$1 instanceof lodash')
            });
          }
          // replace `slice` with `nativeSlice.call`
          _.each(['clone', 'first', 'initial', 'last', 'rest', 'toArray'], function(funcName) {
            if (funcName == 'clone'
                  ? (!isLodash('baseClone') && !isLodash('clone') && !isLodash('cloneDeep'))
                  : !isLodash(funcName)
                ) {
              source = source.replace(matchFunction(source, funcName), function(match) {
                return match.replace(/([^\w.])slice\(/g, '$1nativeSlice.call(');
              });
            }
          });

          // remove conditional `charCodeCallback` use from `_.max` and `_.min`
          _.each(['max', 'min'], function(funcName) {
            if (!isLodash(funcName)) {
              source = source.replace(matchFunction(source, funcName), function(match) {
                return match.replace(/=.+?callback *&& *isString[^:]+:\s*/g, '= ');
              });
            }
          });
        }
        // add Underscore's chaining functions
        if (_.contains(plusFuncs, 'chain') == !isUnderscore) {
          source = addUnderscoreChaining(source, isModularize);
        }
        // replace `baseEach` references with `forEach` and `forOwn`
        if (isUnderscore || (isModern && !isMobile)) {
          // replace `baseEach` with `_.forOwn` in "Collections" functions
          source = source.replace(/\bbaseEach(?=\(collection)/g, 'forOwn');

          // replace `baseEach` with `_.forEach` in the rest of the functions
          source = source.replace(/(\?\s*)baseEach(?=\s*:)/g, '$1forEach');

          // replace `baseEach` with `_.forEach` in the function assignment snippet
          source = source.replace(/\bbaseEach(?=\(\[')/g, 'forEach');
        }

        var context = vm.createContext({
          'clearTimeout': clearTimeout,
          'console': console,
          'setTimeout': setTimeout
        });

        vm.runInContext(source, context);
        return context._;
      }());

      /*----------------------------------------------------------------------*/

      if (isTemplate) {
        source = buildTemplate({
          'templatePattern': templatePattern,
          'templateSettings': templateSettings
        });
      }
      else {
        source = removeFromCreateIterator(source, 'support');
        source = removePseudoPrivates(source);

        // inline `iteratorTemplate` template
        source = replaceFunction(source, 'iteratorTemplate', (function() {
          var snippet = cleanupCompiled(getFunctionSource(lodash._iteratorTemplate));

          // prepend data object references to property names to avoid having to
          // use a with-statement
          iteratorOptions.forEach(function(prop) {
            if (prop !== 'support') {
              snippet = snippet.replace(RegExp('(["\'])(?:(?!\\1)[^\\n\\\\]|\\\\.)*\\1|([^.])\\b' + prop + '\\b', 'g'), function(match, quote, prelude) {
                return quote ? match : (prelude + 'obj.' + prop);
              });
            }
          });

          // remove unnecessary code
          snippet = snippet
            .replace(/var __t.+/, "var __p = '';")
            .replace(/function print[^}]+}/, '')
            .replace(/'(?:\\n|\s)+'/g, "''")
            .replace(/__p *\+= *' *';/g, '')
            .replace(/\s*\+\s*'';/g, ';')
            .replace(/(__p *\+= *)' *' *\+/g, '$1')
            .replace(/\(\(__t *= *\( *([\s\S]+?) *\)\) *== *null *\? *'' *: *__t\)/g, '($1)');

          // remove the with-statement
          snippet = snippet.replace(/^ *with *\(.+?\) *{\n/m, '\n').replace(/}([^}]*}[^}]*$)/, '$1');

          // minor cleanup
          snippet = snippet
            .replace(/obj\s*\|\|\s*\(obj *= *{}\);/, '')
            .replace(/var __p = '';\s*__p \+=/, 'var __p =');

          // remove comments, including sourceURLs
          snippet = snippet.replace(/\s*\/\/.*(?:\n|$)/g, '');

          // replace `iteratorTemplate` assignment
          snippet = 'var iteratorTemplate = ' + snippet + ';\n';

          return snippet;
        }()));

        // remove `iteratorTemplate` dependency checks from `_.template`
        source = source.replace(matchFunction(source, 'template'), function(match) {
          return match
            .replace(/iteratorTemplate *&& */g, '')
            .replace(/iteratorTemplate\s*\?\s*([^:]+?)\s*:[^,;]+/g, '$1');
        });

        if (isModern || isUnderscore) {
          iteratorOptions.forEach(function(prop) {
            if (prop != 'array') {
              source = removeFromGetObject(source, prop);
            }
          });

          // inline all functions defined with `createIterator`
          _.functions(lodash).forEach(function(funcName) {
            if (!(isUnderscore && isLodash(funcName))) {
              // strip leading underscores to match pseudo private functions
              var reFunc = RegExp('^( *)(var ' + funcName.replace(/^_/, '') + ' *= *)createIterator\\(((?:{|[a-zA-Z])[\\s\\S]+?)\\);\\n', 'm');
              if (reFunc.test(source)) {
                // extract, format, and inject the compiled function's source code
                source = source.replace(reFunc, function(match, indent, left) {
                  return (indent + left) +
                    cleanupCompiled(getFunctionSource(lodash[funcName], indent)) + ';\n';
                });
              }
            }
          });

          if (isUnderscore) {
            // replace `lodash.createCallback` references with `createCallback`
            if (!isLodash('createCallback')) {
              source = source.replace(/\blodash\.(createCallback\()\b/g, '$1');
            }
            // unexpose "exit early" feature from functions
            if (!isLodash('forEach') && !isLodash('forEachRight') &&
                !isLodash('forIn') && !isLodash('forInRight') &&
                !isLodash('forOwn') && !isLodash('forOwnRight')) {
              _.each(['baseEach', 'forEach', 'forIn', 'forInRight', 'forOwn', 'forOwnRight'], function(funcName) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/=== *false\)/g, '=== indicatorObject)');
                });
              });

              _.each(['forEachRight', 'transform'], function(funcName) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/return callback[^)]+\)/, '$& === false && indicatorObject');
                });
              });

              _.each(['baseIsEqual', 'every'], function(funcName) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/\(result *= *(.+?)\);/g, '!(result = $1) && indicatorObject;');
                });
              });

              _.each(['find', 'findKey', 'findLast', 'findLastKey', 'shimIsPlainObject'], function(funcName) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/return false/, 'return indicatorObject');
                });
              });

              _.each(['contains', 'some'], function(funcName) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/!\(result *= *(.+?)\);/, '(result = $1) && indicatorObject;');
                });
              });
            }
            // remove chainability
            _.each(['baseEach', 'forEach', 'forEachRight'], function(funcName) {
              if (funcName == 'baseEach' || !isLodash(funcName)) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match.replace(/\n *return .+?([}\s]+)$/, '$1');
                });
              }
            });

            // remove `thisArg` from unexposed `forEachRight`, `forIn` and `forOwn`
            _.each(['forEachRight', 'forIn', 'forOwn'], function(funcName) {
              if (!isLodash(funcName)) {
                source = source.replace(matchFunction(source, funcName), function(match) {
                  return match
                    .replace(/(callback), *thisArg/g, '$1')
                    .replace(/^ *callback *=.+\n/m, '');
                });
              }
            });

            // unexpose methods
            source = source.replace(getMethodAssignments(source), function(match) {
              return _.reduce(['assign', 'createCallback', 'eachRight', 'forEachRight', 'forIn', 'forOwn', 'isPlainObject', 'unzip', 'zipObject'], function(result, funcName) {
                return isLodash(funcName)
                  ? result
                  : result.replace(RegExp('^(?: *//.*\\s*)* *lodash\\.' + funcName + ' *=[\\s\\S]+?;\\n', 'm'), '');
              }, match);
            });
          }
        }
        if (isModularize) {
          source = removeGetIndexOf(source);

          // replace the `lodash.templateSettings` property assignment with a variable assignment
          source = source.replace(/\b(lodash\.)(?=templateSettings *=)/, 'var ');

          // remove the `lodash` namespace from properties
          source = source.replace(/\blodash\.(?!com|prototype)(\w+)\b(?!\s*=)/g, '$1');

          // remove all horizontal rule comment separators
          source = source.replace(/^ *\/\*-+\*\/\n/gm, '');

          // remove `lodash` branch in `_.mixin`
          source = source.replace(matchFunction(source, 'mixin'), function(match) {
            return match.replace(/(?: *\/\/.*\n)*( *)if *\(!source[\s\S]+?\n\1}/, '');
          });

          // replace `lodash` use in `_.templateSettings.imports`
          source = source.replace(matchProp(source, 'templateSettings'), function(match) {
            return match.replace(/(:\s*)lodash\b/, "$1{ 'escape': escape }");
          });

          source = source.replace(matchFunction(source, 'template'), function(match) {
            if (isUnderscore) {
              // assign `_` via `template.imports`
              return match.replace(/(_ *= *)lodash\b/, '$1templateSettings.imports._');
            }
            return match
              // assign `settings` via `template.imports`
              .replace(/= *templateSettings(?=[,;])/, '$&.imports._.templateSettings')
              // remove debug sourceURL use in `_.template`
              .replace(/(?:\s*\/\/.*\n)* *var sourceURL[^;]+;|\+ *sourceURL/g, '');
          });
        }
      }

      /*----------------------------------------------------------------------*/

      // customize Lo-Dash's export bootstrap
      if (!isAMD || isModularize) {
        source = source.replace(/(?: *\/\/.*\n)*( *)if *\(typeof +define[\s\S]+?else /, '$1');
      }
      if (!isNode || isModularize) {
        source = removeVar(source, 'freeGlobal');
        source = source.replace(/(?: *\/\/.*\n)*( *)if *\(freeModule[\s\S]+?else *{([\s\S]+?\n)\1}\n+/, '$1$2');
      }
      if (!isCommonJS || isModularize) {
        source = source.replace(/(?: *\/\/.*\n)*(?:( *)(})? *else *{)?\s*freeExports\.\w+ *=[\s\S]+?(?:\n\1})?\n+/, '$1$2\n');
      }
      if (!isGlobal || isModularize) {
        source = source.replace(/(?: *\/\/.*\n)*(?:( *)(})? *else(?: *if *\(_\))? *{)?(?:\s*\/\/.*)*\s*(?:window\._|_\.templates) *=[\s\S]+?(?:\n\1})?\n+/g, '$1$2\n');
      }
      // remove `if (freeExports) {...}` if it's empty
      if (isAMD && isGlobal && !isModularize) {
        source = source.replace(/(?: *\/\/.*\n)* *(?:else )?if *\(freeExports.*?\) *{\s*}\n+/, '');
      } else {
        source = source.replace(/(?: *\/\/.*\n)* *(?:else )?if *\(freeExports.*?\) *{\s*}(?:\s*else *{([\s\S]+?) *})?\n+/, '$1\n');
      }

      /*----------------------------------------------------------------------*/

      // exit early to create modules
      if (isModularize) {
        buildModule({
          'buildFuncs': buildFuncs,
          'filePath': filePath,
          'funcDepMap': funcDepMap,
          'includeFuncs': includeFuncs,
          'includeProps': includeProps,
          'includeVars': includeVars,
          'isAMD': isAMD,
          'isBackbone': isBackbone,
          'isCommonJS': isCommonJS,
          'isCSP': isCSP,
          'isDebug': true,
          'isGlobal': isGlobal,
          'isIIFE': true,
          'isLegacy': isLegacy,
          'isMapped': isMapped,
          'isMobile': isMobile,
          'isModern': isModern,
          'isNode': isNode,
          'isStdOut': isStdOut,
          'isStrict': isStrict,
          'isUnderscore': isUnderscore,
          'minusFuncs': minusFuncs,
          'options': options,
          'outputPath': outputPath,
          'plusFuncs': plusFuncs,
          'propDepMap': propDepMap,
          'source': source,
          'varDepMap': varDepMap
        });
        return;
      }
    }

    /*------------------------------------------------------------------------*/

    // customize Lo-Dash's IIFE
    if (isIIFE) {
      source = (function() {
        var token = '%output%',
            header = source.match(/^\/\**[\s\S]+?\*\/\n/),
            index = iife.indexOf(token);

        return header + (index < 0
          ? iife
          : iife.slice(0, index).replace(/\n+$/, '') +
            source.replace(/^[\s\S]+?\(function[^{]+{\n|\s*}\(this\)\)[;\s]*$/g, '\n') +
            iife.slice(index + token.length).replace(/^\n+/, '')
        );
      }());
    }

    /*------------------------------------------------------------------------*/

    // modify/remove references to removed functions/variables
    if (!isTemplate) {
      if (isExcluded(isNoDep ? 'lodash' : 'lodashWrapper')) {
        // remove `lodashWrapper.prototype` assignment
        source = source.replace(/(?:\s*\/\/.*)*\n *lodashWrapper\.prototype *=.+/, '');
      }
      if (isExcluded(isNoDep ? 'lodash' : 'mixin')) {
        // remove `_.mixin` call
        source = source.replace(/(?:\s*\/\/.*)*\s*mixin\(lodash\).+/, '');
      }
      if (isExcluded(isNoDep ? 'lodash' : 'wrapperValueOf')) {
        source = removeChaining(source);
      }
      if (!isNoDep) {
        if (isExcluded('bind')) {
          source = removeSupportProp(source, 'fastBind');
        }
        if (isExcluded('clone', 'isEqual', 'isPlainObject')) {
          source = removeSupportNodeClass(source);
        }
        if (isExcluded('createIterator')) {
          source = removeSupportNonEnumShadows(source);
        }
        if (isExcluded('isArguments')) {
          source = replaceSupportProp(source, 'argsClass', 'true');
        }
        if (isExcluded('isArguments', 'isEmpty')) {
          source = removeSupportArgsClass(source);
        }
        if (isExcluded('isPlainObject')) {
          source = removeSupportOwnLast(source);
        }
        if (isExcluded('keys')) {
          source = removeKeysOptimization(source);
          source = removeSupportNonEnumArgs(source);
        }
        if (isExcluded('lodashWrapper')) {
          source = removeChaining(source);
        }
        if (isExcluded('throttle')) {
          _.each(['leading', 'maxWait', 'trailing'], function(prop) {
            source = removeFromGetObject(source, prop);
          });
        }
        if (!/\.(?:enumErrorProps|nonEnumShadows) *=/.test(source)) {
          source = removeFromCreateIterator(source, 'errorClass');
          source = removeFromCreateIterator(source, 'errorProto');

          // remove 'Error' from the `contextProps` array
          source = source.replace(/^ *var contextProps *=[\s\S]+?;/m, function(match) {
            return match
              .replace(/'Error',? */, '')
              .replace(/,(?=\s*])/, '');
          });
        }
        _.each([removeFromGetObject, removeFromReleaseObject], function(func) {
          if (isExcluded('setBindData')) {
            source = func(source, 'configurable');
            source = func(source, 'enumerable');
            source = func(source, 'writable');
          }
          if (isExcluded('sortBy')) {
            source = func(source, 'criteria');
            source = func(source, 'index');
            source = func(source, 'value');
          }
        });
      }

      // remove functions from the build
      allFuncs.forEach(function(funcName) {
        if (!_.contains(buildFuncs, funcName) &&
            !(funcName == 'findWhere' && !isUnderscore) &&
            !(funcName == 'lodash' && !isNoDep)) {
          source = removeFunction(source, funcName);
          if (!isNoDep) {
            source = removeFromCreateIterator(source, funcName);
            source = source.replace(RegExp('^(?: *//.*\\s*)* *lodash(?:\\.prototype)?\\.\\w+ *= *' + funcName + ';\\n', 'gm'), '');
          }
        }
      });

      // remove forks of removed functions
      _.forOwn({
        'createObject': removeCreateObjectFork,
        'defer': removeDeferFork,
        'isArguments': removeIsArgumentsFork,
        'isArray': removeIsArrayFork,
        'isFunction': removeIsFunctionFork
      },
      function(removeFork, funcName) {
        if (isExcluded(funcName)) {
          source = removeFork(source);
        }
      });

      // remove unneeded property dependencies
      _.each(propDependencies, function(propName) {
        if (!_.contains(includeProps, propName)) {
          source = removeProp(source, propName);
        }
      });

      // remove code used to resolve unneeded `support` properties
      source = source.replace(matchProp(source, 'support'), function(match) {
        return match.replace(/^ *\(function[\s\S]+?\n(( *)var ctor *=[\s\S]+?(?:\n *for.+)+\n)([\s\S]+?)}\(1\)\);\n/m, function(match, setup, indent, body) {
          var modified = setup;

          if (!/\.spliceObjects *=(?! *(?:false|true))/.test(body)) {
            modified = modified.replace(/^ *object *=.+\n/m, '');
          }
          if (!/\.enumPrototypes *=(?! *(?:false|true))/.test(body) &&
              !/\.nonEnumShadows *=(?! *(?:false|true))/.test(body) &&
              !/\.ownLast *=(?! *(?:false|true))/.test(body)) {
            modified = modified
              .replace(/\bctor *=.+\s+/, '')
              .replace(/^ *ctor\.prototype.+\s+.+\n/m, '')
              .replace(/(?:,\n)? *props *=[^;=]+/, '')
              .replace(/^ *for *\((?=prop)/, '$&var ')
          }
          if (!/\.nonEnumArgs *=(?! *(?:false|true))/.test(body)) {
            modified = modified.replace(/^ *for *\(.+? arguments.+\n/m, '');
          }
          // cleanup the empty var statement
          modified = modified.replace(/^ *var;\n/m, '');

          // if no setup then remove IIFE
          return /^\s*$/.test(modified)
            ? body.replace(RegExp('^' + indent, 'gm'), indent.slice(0, -2))
            : match.replace(setup, modified);
        });
      });

      // remove unused variables
      (function() {
        var isShallow = isExcluded('runInContext'),
            useMap = {},
            snippet = removeStrings(removeComments(source)),
            varNames = getVars(snippet, isShallow);

        while (varNames.length) {
          varNames = _.sortBy(varNames, function(varName) {
            var result = _.contains(includeVars, varName) || isVarUsed(snippet, varName, isShallow);
            useMap[varName] = result;
            return result;
          });

          if (useMap[varNames[0]]) {
            varNames.shift();
          }
          else {
            while (varNames.length && !useMap[varNames[0]]) {
              snippet = removeVar(snippet, varNames[0]);
              source = removeVar(source, varNames[0]);
              varNames.shift();
            }
          }
        }
      }());

      if (isNoDep) {
        if (isExcluded('lodash')) {
          source = removeAssignments(source);
        }
        // remove unneeded variable dependencies
        _.each(varDependencies, function(varName) {
          if (!_.contains(includeVars, varName)) {
            source = removeVar(source, varName);
          }
        });
      }
      else if (isUnderscore) {
        // unexpose `lodash.support`
        if (!isLodash('support')) {
          source = source.replace(/\blodash\.support *= */, '');
        }
      }
    }
    if (_.size(source.match(/\bfreeModule\b/g)) < 2) {
      source = removeVar(source, 'freeModule');
    }
    if (_.size(source.match(/\bfreeExports\b/g)) < 2) {
      source = removeVar(source, 'freeExports');
    }

    debugSource = cleanupSource(source);
    source = debugSource;

    /*------------------------------------------------------------------------*/

    // resolve `outputPath` and create directories if needed
    if (!outputPath) {
      outputPath = options.reduce(function(result, value, index) {
        if (/^(?:-o|--output)$/.test(value)) {
          result = options[index + 1];
          var dirname = path.dirname(result);
          fs.mkdirpSync(dirname);
          result = path.join(fs.realpathSync(dirname), path.basename(result));
        }
        return result;
      }, '');
    } else {
      fs.mkdirpSync(path.dirname(outputPath));
    }

    // flag to track if `outputPath` has been used by `callback`
    var outputUsed = false;

    // flag to specify creating a custom build
    var isCustom = !isNoDep && (
      isLegacy || isMapped || isModern || isStrict || isUnderscore || outputPath ||
      /(?:category|exclude|exports|iife|include|minus|plus)=.*$/.test(options) ||
      !_.isEqual(exportsOptions, allExports)
    );

    // used as the basename of the output path
    var basename = outputPath
      ? path.basename(outputPath, '.js')
      : 'lodash' + (isTemplate ? '.template' : isCustom ? '.custom' : '');

    // output debug build
    if (!isMinify && (isCustom || isDebug || isTemplate)) {
      if (isCustom) {
        debugSource = addCommandsToHeader(debugSource, options);
      }
      if (isDebug && isStdOut) {
        stdout.write(debugSource);
        callback({
          'source': debugSource
        });
      }
      else if (!isStdOut) {
        filePath = outputPath || path.join(cwd, basename + '.js');
        outputUsed = true;
        callback({
          'source': debugSource,
          'outputPath': filePath
        });
      }
    }
    // begin the minification process
    if (!isDebug) {
      if (outputPath && outputUsed) {
        outputPath = path.join(path.dirname(outputPath), path.basename(outputPath, '.js') + '.min.js');
      } else if (!outputPath) {
        outputPath = path.join(cwd, basename + '.min.js');
      }
      minify(source, {
        'filePath': filePath,
        'isMapped': isMapped,
        'isSilent': isSilent,
        'isTemplate': isTemplate,
        'modes': isIIFE && ['simple', 'hybrid'],
        'outputPath': outputPath,
        'sourceMapURL': sourceMapURL,
        'onComplete': function(data) {
          if (isCustom) {
            data.source = addCommandsToHeader(data.source, options);
          }
          if (isStdOut) {
            delete data.outputPath;
            stdout.write(data.source);
          }
          callback(data);
        }
      });
    }
  }

  /*--------------------------------------------------------------------------*/

  // expose `build`
  if (module != require.main) {
    module.exports = build;
  }
  else {
    // or invoked directly
    build(process.argv);
  }
}());
