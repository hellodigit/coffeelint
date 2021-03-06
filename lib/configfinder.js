(function() {
  /*
  Helpers for finding CoffeeLint config in standard locations, similar to how
  JSHint does.
  */
  var expandModuleNames, extendConfig, findFile, findFileResults, fs, getConfig, loadJSON, loadNpmConfig, path, resolve, stripComments;

  fs = require('fs');

  path = require('path');

  stripComments = require('strip-json-comments');

  resolve = require('resolve').sync;

  // Cache for findFile
  findFileResults = {};

  // Searches for a file with a specified name starting with 'dir' and going all
  // the way up either until it finds the file or hits the root.
  findFile = function(name, dir) {
    var filename, parent;
    dir = dir || process.cwd();
    filename = path.normalize(path.join(dir, name));
    if (findFileResults[filename]) {
      return findFileResults[filename];
    }
    parent = path.resolve(dir, '../');
    if (fs.existsSync(filename)) {
      return findFileResults[filename] = filename;
    } else if (dir === parent) {
      return findFileResults[filename] = null;
    } else {
      return findFile(name, parent);
    }
  };

  // Possibly find CoffeeLint configuration within a package.json file.
  loadNpmConfig = function(dir) {
    var fp, ref;
    fp = findFile('package.json', dir);
    if (fp) {
      return (ref = loadJSON(fp)) != null ? ref.coffeelintConfig : void 0;
    }
  };

  // Parse a JSON file gracefully.
  loadJSON = function(filename) {
    var e;
    try {
      return JSON.parse(stripComments(fs.readFileSync(filename).toString()));
    } catch (error) {
      e = error;
      process.stderr.write(`Could not load JSON file '${filename}': ${e}`);
      return null;
    }
  };

  // Tries to find a configuration file in either project directory (if file is
  // given), as either the package.json's 'coffeelintConfig' property, or a project
  // specific 'coffeelint.json' or a global 'coffeelint.json' in the home
  // directory.
  getConfig = function(dir) {
    var envs, home, npmConfig, projConfig;
    if (process.env.COFFEELINT_CONFIG && fs.existsSync(process.env.COFFEELINT_CONFIG)) {
      return loadJSON(process.env.COFFEELINT_CONFIG);
    }
    npmConfig = loadNpmConfig(dir);
    if (npmConfig) {
      return npmConfig;
    }
    projConfig = findFile('coffeelint.json', dir);
    if (projConfig) {
      return loadJSON(projConfig);
    }
    envs = process.env.USERPROFILE || process.env.HOME || process.env.HOMEPATH;
    home = path.normalize(path.join(envs, 'coffeelint.json'));
    if (fs.existsSync(home)) {
      return loadJSON(home);
    }
  };

  // configfinder is the only part of coffeelint that actually has the full
  // filename and can accurately resolve module names. This will find all of the
  // modules and expand them into full paths so that they can be found when the
  // source and config are passed to `coffeelint.lint`
  expandModuleNames = function(dir, config) {
    var coffeelint, data, ruleName;
    for (ruleName in config) {
      data = config[ruleName];
      if (!((data != null ? data.module : void 0) != null)) {
        continue;
      }
      config[ruleName]._module = config[ruleName].module;
      config[ruleName].module = resolve(data.module, {
        basedir: dir,
        extensions: ['.js', '.coffee', '.litcoffee', '.coffee.md']
      });
    }
    coffeelint = config.coffeelint;
    if ((coffeelint != null ? coffeelint.transforms : void 0) != null) {
      coffeelint._transforms = coffeelint.transforms;
      coffeelint.transforms = coffeelint.transforms.map(function(moduleName) {
        return resolve(moduleName, {
          basedir: dir,
          extensions: ['.js', '.coffee', '.litcoffee', '.coffee.md']
        });
      });
    }
    if ((coffeelint != null ? coffeelint.coffeescript : void 0) != null) {
      coffeelint._coffeescript = coffeelint.coffeescript;
      coffeelint.coffeescript = resolve(coffeelint.coffeescript, {
        basedir: dir,
        extensions: ['.js', '.coffee', '.litcoffee', '.coffee.md']
      });
    }
    return config;
  };

  extendConfig = function(config) {
    var extendedConfig, parentConfig, rule, ruleName;
    if (!config.extends) {
      return config;
    }
    parentConfig = require(config.extends);
    extendedConfig = {};
    for (ruleName in config) {
      rule = config[ruleName];
      extendedConfig[ruleName] = rule;
    }
    for (ruleName in parentConfig) {
      rule = parentConfig[ruleName];
      extendedConfig[ruleName] = config[ruleName] || rule;
    }
    return extendedConfig;
  };

  exports.getConfig = function(filename = null) {
    var config, dir;
    if (filename) {
      dir = path.dirname(path.resolve(filename));
    } else {
      dir = process.cwd();
    }
    config = getConfig(dir);
    if (config) {
      config = extendConfig(config);
      config = expandModuleNames(dir, config);
    }
    return config;
  };

}).call(this);
