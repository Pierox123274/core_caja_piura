import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { all } from '../src/services/practiceCases.js'

const dir = dirname(fileURLToPath(import.meta.url))
writeFileSync(
  join(dir, '../backend/practice_cases.json'),
  JSON.stringify(all, null, 2),
  'utf8',
)
console.log(`Exported ${all.length} practice cases`)
