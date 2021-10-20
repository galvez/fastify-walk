const { lstatSync } = require('fs')
const { dirname } = require('path')
const { fileURLToPath } = require('url')
const minimatch = require('minimatch')
const fp = require('fastify-plugin')
const klaw = require('klaw')

async function walkPlugin (fastify, options = {}) {
  const path = getPath(options.path)
  const ignorePatterns = [/node_modules/]

  if (options.ignorePatterns) {
    ignorePatterns.push(...options.ignorePatterns)
  }

  const walk = {
    onMatch,
    onDirectory,
    onFile,
    ready,
  }

  fastify.decorate('walk', walk)
  fastify.addHook('onReady', async () => {
    await fastify.walk.ready()
  })

  const kStarted = Symbol('kStarted')
  const stack = []

  const callbacks = ['onFile', 'onDirectory', 'onMatch']
  if (options.pattern) {
    for (const callback of callbacks) {
      if (callback in options) {
        walk[callback].call(fastify, options.pattern, options[callback])
      }
    }
  }

  function onMatch (...args) {
    let matcher
    let callback
    if (args.length > 1) {
      matcher = args[0]
      callback = args[1]
    } else {
      callback = args[0]
    }
    stack.push(async (entry) => {
      if (matcher) {
        if (await matcher(entry)) {
          await callback(entry)
        }
      } else {
        await callback(entry)
      }
    })
  }

  function onDirectory (...args) {
    let matcher
    let callback
    if (args.length > 1) {
      matcher = getMatcher(args[0])
      callback = args[1]
    } else {
      callback = args[0]
    }
    if (matcher) {
      onMatch.call(fastify, e => e.stats.isDirectory() && matcher(e), callback)
    } else {
      onMatch.call(fastify, e => e.stats.isDirectory(), callback)
    }
  }

  function onFile (...args) {
    let matcher
    let callback
    if (args.length > 1) {
      matcher = getMatcher(args[0])
      callback = args[1]
    } else {
      callback = args[0]
    }
    if (matcher) {
      onMatch(e => e.stats.isFile() && matcher(e), callback)
    } else {
      onMatch(e => e.stats.isFile(), callback)
    }
  }

  async function ready () {
    if (stack[kStarted]) {
      return
    }
    stack[kStarted] = true
    for await (const entry of walkDir(path)) {
      for (const stacked of stack) {
        await stacked.call(fastify, entry)
      }
    }
    if (options.onReady) {
      options.onReady.call(fastify)
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

  async function * walkDir (dir) {
    const sliceAt = dir.length + (dir.endsWith('/') ? 0 : 1)

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
