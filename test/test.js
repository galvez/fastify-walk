const tap = require('tap')
const path = require('path')
const fs = require('fs')
const { setTimeout } = require('timers/promises')
const Fastify = require('fastify')
const FastifyWalk = require('../index.js')

const root = path.resolve(__dirname, 'fixture')

tap.test('must match files or directories', async (t) => {
  t.plan(3)
  const app = await getApp()
  app.walk.onEntry((entry) => {
    t.ok(entry.path)
  })
  await app.walk.ready()
})

tap.test('must match files only', async (t) => {
  t.plan(2)
  const app = await getApp()
  app.walk.onFile(/file/, (entry) => {
    t.match(entry.path, /file$/)
  })
  await app.walk.ready()
})

tap.test('must match files and listen for changes', async (t) => {
  t.plan(4)
  let changedCount = 0
  let watchedPath
  const app = await getApp()
  app.walk.onFile(/file/, {
    found (entry) {
      t.match(entry.path, /file$/)
      watchedPath = path.join(root, entry.path)
    },
    changed (path) {
      t.match(path, /file$/)
      if (++changedCount === 2) {
        app.walk.stopWatching()
      }
    },
  })
  await app.walk.ready()
  fs.writeFileSync(watchedPath, 'file changed')
  await setTimeout(1000)
  fs.writeFileSync(watchedPath, 'file')
  await setTimeout(1000)
})

tap.test('must match directories only, call onReady', async (t) => {
  t.plan(2)
  const app = await getApp()
  app.walk.onDirectory((entry) => {
    t.match(entry.path, /directory$/)
  })
  app.walk.onReady(() => {
    t.pass('onReady called')
  })
  await app.walk.ready()
})

async function getApp () {
  const app = Fastify()
  await app.register(FastifyWalk, {
    watch: true,
    ignorePatterns: [/DS_Store/],
    path: root,
  })
  return app
}
