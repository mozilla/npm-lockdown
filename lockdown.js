#!/usr/bin/env node

if (process.env['LOCKDOWN_RUNNING_IDIOT']) process.exit(0);


var http = require('http'),
    jsel = require('JSONSelect'),
    crypto = require('crypto'),
    exec = require('child_process').exec,
    fs = require('fs'),
    path = require('path');

try {
  var lockdownJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'lockdown.json')));
} catch(e) {
  // XXX: what should they do?
  console.log("I cannot read lockdown.json!  You should do something!");
  console.log("error:", e);
  process.exit(1);
}

var boundPort;

// during execution fatal errors will be appended to this list
var errors = [];

// during execution non-fatal warnings will be appended to this list
var warn = [];

function rewriteURL(u) {
    return u.replace('registry.npmjs.org', '127.0.0.1:' + boundPort);
}

function rewriteVersionMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  json.dist.tarball = rewriteURL(json.dist.tarball);

  // is the name/version/sha in our lockdown.json?
  if (!lockdownJson[json.name]) {
    errors.push("package '" + json.name + "' not in lockdown.json!");
    return null;
  }

  if (lockdownJson[json.name][json.version] === undefined) {
    errors.push("package version " + json.name + "@" + json.version + " not in lockdown.json!");
    return null;
  }

  if (lockdownJson[json.name][json.version] !== json.dist.shasum) {
    errors.push("package " + json.name + "@" + json.version + " has a different checksum (" +
                lockdownJson[json.name][json.version] + " v. " + json.dist.shasum + ")");
    return null;
  }

  return JSON.stringify(json);
}

function rewritePackageMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  jsel.forEach(".versions > * > .dist:has(:root > .tarball)", json, function(dist) {
    dist.tarball = rewriteURL(dist.tarball);
  });
  return JSON.stringify(json);
}

var server = http.createServer(function (req, res) {
  if (req.method !== 'GET') {
    return res.end('non GET requests not supported', 501);
  }

  // what type of request is this?
  // 1. specific version json metadata (when explicit dependency is expressed)
  //    - for these requests we should verify the name/version/sha advertised is allowed
  // 2. package version json metadata (when version range is expressed - including '*')
  //    XXX: for these requests we should prune all versions that are not allowed
  // 3. tarball - actual bits
  //    XXX: for these requests we should verify the name/version/sha matches something
  //         allowed, otherwise block the transaction
  var arr = req.url.substr(1).split('/');
  var type = [ '', 'package_metadata', 'version_metadata', 'tarball' ][arr.length];

  console.log("Proxied NPM request -", type + ":", req.url);

  // let's extract pkg name and version sensitive to the type of request being performed.
  var pkgname, pkgver;
  if (type === 'tarball') {
    pkgname = arr[0];
    var getVer = new RegExp("^" + pkgname + "-(.*)\\.tgz$");
    pkgver = getVer.exec(arr[2])[1];
  } else if (type === 'version_metadata') {
    pkgname = arr[0];
    pkgver = arr[1];
  } else if (type === 'package_metadata') {
    pkgname = arr[0];
  }

  var hash = crypto.createHash('sha1');

  var r = http.request({
    host: 'registry.npmjs.org',
    port: 80,
    method: req.method,
    path: req.url,
    agent: false
  }, function(rres) {
    res.setHeader('Content-Type', rres.headers['content-type']);
    if (type === 'tarball') res.setHeader('Content-Length', rres.headers['content-length']);
    var b = "";
    rres.on('data', function(d) {
      hash.update(d);
      if (type != 'tarball') b += d;
      else res.write(d);
    });
    rres.on('end', function() {
      if (type === 'tarball') {
        res.end();
      } else {
        if (type === 'package_metadata') {
          b = rewritePackageMD(b);
        } else if (type === 'version_metadata') {
          b = rewriteVersionMD(b);
        }
        if (b === null) {
          res.writeHead(404);
          res.end("package installation disallowed by lockdown");
        } else {
          res.setHeader('Content-Length', Buffer.byteLength(b));
          res.end(b);
        }
      }
    });
  });
  r.end();
});

server.listen(process.env['PORT'] || 0, '127.0.0.1', function() {
  boundPort = server.address().port;

  var child = exec('npm install', {
    env: {
      NPM_CONFIG_REGISTRY: 'http://127.0.0.1:' + boundPort,
      LOCKDOWN_RUNNING_IDIOT: "true",
      PATH: process.env['PATH']
    },
    cwd: process.cwd()
  }, function(e) {
    // XXX: here is the place to check for sha errors during our run and output them all?
    if (errors.length) {
      console.log();
      console.log("FATAL ERRORS:");
      errors.forEach(function(e) { console.log("   ", e); });
      console.log();
    }
    process.exit(e ? 1 : 0);
  });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
});
