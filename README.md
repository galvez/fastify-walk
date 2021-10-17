# fastify-walk

A minimal Fastify interface to [**klaw**](https://github.com/jprichardson/node-klaw).

## Usage

```js
import Fastify from 'fastify'
import FastifyWalk from 'fastify-walk'

async function main () {
  const app = Fastify()
  await app.register(FastifyWalk, {
    path: '/path/to/search'
  })

  // Will match both files and directories
  fastify.walk.onMatch((entry) => {})
  // Will match only directories
  fastify.walk.onDirectory((entry) => {})  
  // Will match only files
  fastify.walk.onFile((entry) => {})

  // The first parameter can be a regular expression
  fastify.walk.onMatch(/\.md$/, (entry) => {})
  // Or a complete matcher function that also takes entry as parameter
  fastify.walk.onMatch((entry) => {
    return Math.random() * 1 > 0.5 ? true : false
  }, (randomEntry) => {
    return fs.readFile(randomEntry.path)
  })

  // Triggers actual filesystem read operation
  await fastify.ready()

  // Can be force-triggered ahead of time with:
  await fastify.walk.done()
}
```

## Install

```
npm install fastify-walk --save
```

## License

MIT
