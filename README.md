# fastify-walk

A minimal Fastify interface to [**klaw**](https://github.com/jprichardson/node-klaw).

## Install

```
npm install fastify-walk --save
```

## Basic Usage

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
  await fastify.walk.ready()
}
```

## Blog Example

```js
import Fastify from 'fastify'
import FastifyWalk from 'fastify-walk'
import { readFile } from 'fs/promises'
import { parse, add, sort, entries, archive } from './entry.js'

const app = Fastify()

app.decorate('blog', {
  index: null,
  entries,
  archive
})

app.register(FastifyWalk, {
  path: import.meta.url,
  pattern: 'posts/*.md',
  onFile,
  onReady
})

await app.ready()

async function onFile ({ path }) {
  const source = await readFile(path, 'utf8')
  const entry = await parse(source, path)
  if (!entry) {
    return
  }
  add(entry)
}

function onReady () {
  const entryList = Object.values(entries)
  this.blog.index = sort(entryList).slice(0, 10)
  for (const year in archive) {
    for (const month in archive[year]) {
      archive[year][month] = sort(archive[year][month])
    }
  }
}
```

## License

MIT
