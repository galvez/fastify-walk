const { lstatSync } = require('fs')
const { dirname, join } = require('path')
const { fileURLToPath } = require('url')
const minimatch = require('minimatch')
const fp = require('fastify-plugin')
const klaw = require('klaw')
const chokidar = require('chokidar')

const kStarted = Symbol('kStarted')
const kWatched = Symbol('kWatched')
const kChanged = Symbol('kChanged')

async function walkPlugin (fastify, options = {}) {
  const path = getPath(options.path)
  const ignorePatterns = [/node_modules/]
  const sliceAt = path.length + (path.endsWith('/') ? 0 : 1)

  if (options.ignorePatterns) {
    ignorePatterns.push(...options.ignorePatterns)
  }

  const watchers = []
  const stack = []
  const done = []
  const supportedCallbacks = ['onEntry', 'onMatch', 'onFile', 'onDirectory']

  const walk = {
    addPattern,
    onReady,
    onEntry,
    onMatch,
    onDirectory,
    onFile,
    ready,
    stopWatching,
  }

  fastify.decorate('walk', walk)
  fastify.addHook('onReady', () => ready())

  function addPattern (pattern, callbacks) {
    for (const callback of supportedCallbacks) {
      if (callback in callbacks) {
        walk[callback].call(fastify, pattern, callbacks[callback])
      }
    }
  }

  function onReady (callback) {
    done.push(callback)
  }

  function stopWatching () {
    try {
      for (const watcher of watchers) {
        watcher.close()
      }
    } catch (err) {
      console.log(err)
    }
  }

  function onEntry (found, changed) {
    const watched = []
    const matched = async (entry) => {
      if (options.watch && changed) {
        watched.push(join(path, entry.path))
      }
      if (found) {
        await found(entry)
      }
    }
    matched[kWatched] = watched
    matched[kChanged] = changed
    stack.push(matched)
  }

  function onMatch (matcher, found, changed) {
    const watched = []
    const matched = async (entry) => {
      if (await matcher(entry)) {
        if (options.watch && changed) {
          watched.push(join(path, entry.path))
        }
        if (found) {
          await found(entry)
        }
      }
    }
    matched[kWatched] = watched
    matched[kChanged] = changed
    stack.push(matched)
  }

  function onDirectory (...params) {
    const [matcher, found, changed] = getParams(params)
    onMatch.call(fastify, e => e.stats.isDirectory() && matcher(e), found, changed)
  }

  function onFile (...params) {
    const [matcher, found, changed] = getParams(params)
    onMatch(e => e.stats.isFile() && matcher(e), found, changed)
  }

  function getParams (params) {
    if (params.length === 2 && params[0]) {
      const matcher = getMatcher(params[0])
      if (typeof params[1] === 'object') {
        return [matcher, params[1].found, params[1].changed]
      } else if (typeof params[1] === 'function') {
        return [matcher || (() => {}), params[1]]
      }
    }
    if (params.length === 1) {
      if (typeof params[0] === 'object') {
        return [() => true, params[0].found, params[0].changed]
      } else if (typeof params[0] === 'function') {
        return [() => true, params[0]]
      } else {
        throw new Error('Unexpected usage, see documentation.')
      }
    }
  }

  async function ready () {
    if (stack[kStarted]) {
      return
    }
    stack[kStarted] = true
    for await (const entry of walkDir(path, sliceAt)) {
      for (const found of stack) {
        await found.call(fastify, entry)
      }
    }
    for (const found of stack) {
      if (found[kChanged]) {
        const watcher = chokidar.watch(found[kWatched])
        watcher.on('change', path => found[kChanged](path.slice(sliceAt)))
        watchers.push(watcher)
      }
    }
    if (done.length) {
      for (const readyCallback of done) {
        readyCallback.call(fastify)
      }
    }
  }

  function getMatcher (matcher) {
    if (typeof matcher === 'string') {
      return ({ path }) => minimatch(path, matcher)
    } else if (matcher instanceof RegExp) {
      return ({ path }) => path.match(matcher)
    } else {
      return matcher
    }
  }

  async function * walkDir (dir, sliceAt) {
    for await (const match of klaw(dir)) {
      const pathEntry = sliceAt ? match.path.slice(sliceAt) : match.path
      if (ignorePatterns.some(ignorePattern => ignorePattern.test(match.path))) {
        continue
      }
      if (pathEntry === '') {
        continue
      }
      yield { stats: match.stats, path: pathEntry }
    }
  }

  function getPath (str) {
    let path = str || process.cwd()
    if (path.startsWith('file://')) {
      path = fileURLToPath(path)
    }
    const isDirectory = lstatSync(path).isDirectory()
    return isDirectory ? path : dirname(path)
  }
}

module.exports = fp(walkPlugin)
