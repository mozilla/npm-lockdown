## What's this?

NPM Lockdown is a tool that locks your node.js app to
specific versions of dependencies... So that you can:

  1. know that the code you develop against is what you test and deploy
  2. `npm install` and get the same code, every time.
  3. not have to copy all of your dependencies into your project
  4. not have to stand up a private npm repository to solve this problem.

## Who is this for?

Node.JS application developers, but not library authors.  Stuff published
in npm as libraries probably wouldn't be interested.

## Why Care?

Even if you express verbatim versions in your package.json file, you're still
vulnerable to your code breaking at any time.  This can happen if a dependency
of a project you depend on with a specific version *itself* depends on another
packages with a version range.

How can other people accidentally or intentionally break your node.js app?
Well, they might...

  * ... push a new version that no longer supports your preferred version of node.js.
  * ... fix a subtle bug that you actually depend on.
  * ... accidentally introduce a subtle bug.
  * ... be having a bad day.

And, any author at any time can overwrite the package version they have published
so one under-thought `npm publish -f` can mean a subtle bug that steals days
of your week.

## Usage!

`npm-lockdown` is easy to get started with.  It generates a single file that lists
the versions and check-sums of the software you depend on, so any time something
changes out from under you, `npm install` will fail and tell you what package has
changed.

To get started:

  1. npm install the specific dependencies of your app
  2. npm install the version of lockdown you want: `npm install --save lockdown@0.0.1`
  3. copy the bootstrap file into your repository: `cp -L node_modules/.bin/lockdown lockdown`
  4. add a line to your package.json file: `"scripts": { "preinstall": "./lockdown" }`
  5. generate a lockdown.json: `node_modules/.bin/lockdown-relock`
  6. commit: `git add package.json lockdown lockdown.json && git commit -m "be safe"`

Notes:

  * You can put the lockdown script anywhere you like, but the `preinstall` line must be changed
  * You should use the latest stable version of lockdown, find it from the [npm repository](https://npmjs.org/package/lockdown)

## Installing dependencies once locked down

    npm install

## Changing dependencies once locked down

You update your dependencies explicitly, relock, and commit:

    npm install --save foo@1.2.3
    node_modules/.bin/lockdown-relock
    git add lockdown.json package.json
    git commit -m "move to foo v1.2.3"

done!





