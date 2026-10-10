import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'

test('todas as mídias e miniaturas são servidas como arquivo, nunca como HTML da aplicação', async () => {
  const catalog = JSON.parse(readFileSync('src/data/midias.generated.json', 'utf8'))
  assert.ok(catalog.some((item) => item.originalName.includes('@')))
  assert.ok(catalog.some((item) => item.originalName.includes(',')))
  assert.ok(catalog.some((item) => item.originalName.includes('$')))
  const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 0 } })
  try {
    await server.listen()
    const address = server.httpServer.address()
    const base = `http://127.0.0.1:${address.port}`
    const failures = []
    for (let index = 0; index < catalog.length; index += 16) {
      await Promise.all(catalog.slice(index, index + 16).flatMap((item) => [
        [item.path, item.mime],
        [item.thumbnail, 'image/webp'],
      ]).map(async ([path, expected]) => {
        const response = await fetch(base + path, { method: 'HEAD' })
        if (response.status !== 200 || !response.headers.get('content-type')?.startsWith(expected)) failures.push([path, response.status, response.headers.get('content-type')])
      }))
    }
    const videoCatalog = JSON.parse(readFileSync('public/videos_kit.json', 'utf8'))
    const videoResponse = await fetch(`${base}/videos_kit.json`)
    assert.equal(videoResponse.status, 200)
    assert.equal((await videoResponse.json()).videos.length, videoCatalog.videos.length)
    const routeResponse = await fetch(`${base}/midias?aba=videos`)
    assert.equal(routeResponse.status, 200)
    assert.match(routeResponse.headers.get('content-type') || '', /text\/html/)
    for (const item of videoCatalog.videos.filter((video) => existsSync(`public${video.thumbnail}`))) {
      const response = await fetch(base + item.thumbnail, { method: 'HEAD' })
      if (response.status !== 200 || !response.headers.get('content-type')?.startsWith('image/webp')) failures.push([item.thumbnail, response.status, response.headers.get('content-type')])
    }
    assert.deepEqual(failures, [])
  } finally {
    await server.close()
  }
})
