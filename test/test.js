const tap = require('tap')
const path = require('path')
const Fastify = require('fastify')
const FastifyWalk = require('../index.js')

tap.test('must match files or directories', async (t) => {
  t.plan(3)
  const app = await getApp()
  app.walk.onMatch((entry) => {
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

tap.test('must match directories only', async (t) => {
  t.plan(1)
  const app = await getApp()
  app.walk.onDirectory((entry) => {
    t.match(entry.path, /directory$/)
  })
  await app.walk.ready()
})

async function getApp () {
  const app = Fastify()
  await app.register(FastifyWalk, {
    ignorePatterns: [/DS_Store/],
    path: path.resolve(__dirname, 'fixture'),
  })
  return app
}
