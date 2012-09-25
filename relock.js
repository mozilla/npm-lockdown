#!/usr/bin/env node

var path = require('path'),
    fs = require('fs'),
    readInstalled = require("read-installed"),
    npm = require('npm');

var dir = process.cwd(),
    cache,
    tmp = path.resolve('/tmp/.npm');

function relock () {
  npm.load(function(npmErr) {
    if (npmErr) {
      console.error('npm error! ', npmErr);
      process.exit(1);
    }
    cache = npm.cache;
    var packages = {};

    readInstalled(dir, void 0, function (er, data) {
      if (er) throw er;
      //console.log(data);
      if (data.dependencies) {
        Object.keys(data.dependencies).forEach(function (key) {
          walk(data.dependencies[key], packages);
        });
      }
      fs.writeFile(path.join(process.cwd(), 'lockdown.json'), JSON.stringify(sortObj(packages), null, '  '));
    });
  });
}

// we take advantage of the way JSON.stringify() is implemented to
// write sorted lockdown.json files for better diffs.
function sortObj(obj) {
  if (typeof obj === 'object' && obj !== null) {
    var sorted = {};
    Object.keys(obj).sort().forEach(function(k) {
      sorted[k] = sortObj(obj[k]);
    });
    return sorted;
  } else if (Array.isArray(obj)) {
    return obj.sort().map(sortObj);
  }
  return obj;
}

function walk (data, packages) {
  var name, version, shasum;
  if (data.name) name = data.name;
  if (data.version) version = data.version;

  if (name) {
    shasum = getShasum(cache, name, version);
    if (!(name in packages)) packages[name] = {};
    packages[name][version] = shasum;
  }

  if (data.dependencies) {
    Object.keys(data.dependencies).forEach(function (key) {
      // ignore bundled dependencies
      if (data.bundleDependencies && data.bundleDependencies.indexOf(key) > -1 ) return;
      walk(data.dependencies[key], packages);
    });
  }
}

function getShasum (cache, name, version) {
  var sha;
  try {
    // find sha in cache/name/version/.cache.json
    sha = require(path.resolve(path.join(cache, name, version, ".cache.json"))).dist.shasum;
  } catch (e) {
    try {
      // find sha in cache/name/.cache.json
      sha = require(path.resolve(path.join(cache, name, ".cache.json"))).versions[version].dist.shasum;
    } catch (e) {
    }
  }
  // finally, check in the tmp directory
  if (!sha && cache !== tmp) return getShasum(tmp, name, version);

  if (!sha) console.error("Warning: no shasum for "+name+"@"+version);

  return sha || "*";
}

exports.relock = relock;

if (fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) relock();

