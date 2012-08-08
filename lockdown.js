var http = require('http'),
    jsel = require('JSONSelect'),
    crypto = require('crypto');

function rewriteURL(u) {
    return u.replace('registry.npmjs.org', 'localhost:1337');
}

function rewriteVersionMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  json.dist.tarball = rewriteURL(json.dist.tarball);
  return JSON.stringify(json);
}

function rewritePackageMD(json) {
  if (typeof json === 'string') json = JSON.parse(json);
  jsel.forEach(".versions > * > .dist:has(:root > .tarball)", json, function(dist) {
    dist.tarball = rewriteURL(dist.tarball);
  });
  return JSON.stringify(json);
}

http.createServer(function (req, res) {
  if (req.method !== 'GET') {
    return res.end('non GET requests not supported', 501);
  }

  // what type of request is this?
  // 1. specific version json metadata (when explicit dependency is expressed)
  // 2. package version json metadata (when version range is expressed - including '*')
  // 3. tarball - actual bits
  var arr = req.url.substr(1).split('/');
  var type = [ '', 'package_metadata', 'version_metadata', 'tarball' ][arr.length];

  console.log("Proxied NPM request -", type + ":", req.url);

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
    if (type === 'package_metadata') console.log(rres.headers);

    var b = "";
    rres.on('data', function(d) {
      hash.update(d);
      if (type != 'tarball') b += d;
      else res.write(d);
    });
    rres.on('end', function() {
      if (type === 'tarball') {
        res.end();
        console.log("sha:", hash.digest('hex'));
      } else {
        if (type === 'package_metadata') {
          b = rewritePackageMD(b);
        } else if (type === 'version_metadata') {
          b = rewriteVersionMD(b);
        }
        res.setHeader('Content-Length', Buffer.byteLength(b));
        res.end(b);
      }
    });
  });
  r.end();
}).listen(1337, '127.0.0.1');
