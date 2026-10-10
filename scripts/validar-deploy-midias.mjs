import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const report = JSON.parse(readFileSync('.cache/midias-build.json', 'utf8'))
for (const item of report.excluded) {
  if (!item.reason.startsWith('Acima de 25 MiB')) continue
  const copy = join('dist', 'midia', item.path)
  if (existsSync(copy)) unlinkSync(copy)
}
console.log(`Deploy: ${report.cataloged} mídias; ${report.excluded.length} fora do catálogo.`)
