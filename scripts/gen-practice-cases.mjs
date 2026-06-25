import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dartPath = path.resolve(
  __dirname,
  '../../app_clientes/packages/caja_piura_core/lib/credit/credit_practice_cases.dart',
)
const dart = fs.readFileSync(dartPath, 'utf8')
const block = dart.match(/static final all = <CreditPracticeCase>\[([\s\S]*?)\];/)?.[1] || ''
const rows = block.split('\n').filter((l) => l.trim().startsWith('_c('))

const preMap = {
  'ResultadoPreEval.apto': 'apto',
  'ResultadoPreEval.revisar': 'revisar',
  'ResultadoPreEval.noProcede': 'noProcede',
}
const buroMap = {
  'CalificacionBuro.normal': 'normal',
  'CalificacionBuro.cpp': 'cpp',
  'CalificacionBuro.deficiente': 'deficiente',
  'CalificacionBuro.dudoso': 'dudoso',
  'CalificacionBuro.perdida': 'perdida',
}
const decMap = {
  'DecisionComite.aprobado': 'aprobado',
  'DecisionComite.condicionado': 'condicionado',
  'DecisionComite.rechazado': 'rechazado',
}

function parse(line) {
  const motivoM = line.match(/motivo:\s*'([^']*)'/)
  const motivo = motivoM ? motivoM[1] : null
  const inner = line.replace(/^\s*_c\(/, '').replace(/\),?\s*$/, '')
  const clean = inner.replace(/,?\s*motivo:\s*'[^']*'/, '')
  const parts = []
  let cur = ''
  let depth = 0
  let inStr = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === "'" && clean[i - 1] !== '\\') inStr = !inStr
    if (!inStr && ch === '(') depth++
    if (!inStr && ch === ')') depth--
    if (!inStr && ch === ',' && depth === 0) {
      parts.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  const unq = (s) => s.replace(/^'/, '').replace(/'$/, '')
  const [
    num, doc, nom, ape, neg, , dist, , ing, gas, monto, plazo, tea, , , , , , , prio, pre, punt, buro, ent, deuda, mora, inh, dec, mapr,
  ] = parts
  const documento = unq(doc)
  const n = Number(num)
  return {
    numero: n,
    documento,
    nombres: unq(nom),
    apellidos: unq(ape),
    negocio: unq(neg),
    distrito: unq(dist),
    ingresoMensual: Number(ing),
    gastoMensual: Number(gas),
    montoSolicitado: Number(monto),
    plazoMeses: Number(plazo),
    tea: Number(tea),
    prioridad: unq(prio),
    preEval: preMap[pre.trim()] || 'apto',
    puntajePreEval: Number(punt),
    buro: buroMap[buro.trim()] || 'normal',
    buroEntidades: Number(ent),
    buroDeudaTotal: Number(deuda),
    buroDiasMora: Number(mora),
    buroInhabilitado: inh.trim() === 'true',
    decision: decMap[dec.trim()] || 'aprobado',
    montoAprobado: Number(mapr),
    motivoDecision: motivo,
    clienteId: `caso-${n}-${documento.slice(-4)}`,
  }
}

const cases = rows.map(parse)
const out = `/** Auto-sync desde credit_practice_cases.dart */\nexport const all = ${JSON.stringify(cases, null, 2)};\n\nexport function byDocumento(doc) {\n  const clean = String(doc).replace(/\\D/g, '');\n  return all.find((c) => c.documento === clean) || null;\n}\n\nexport function byNumero(n) {\n  return all.find((c) => c.numero === n) || null;\n}\n`
fs.writeFileSync(path.resolve(__dirname, '../src/services/practiceCases.js'), out)
console.log('practiceCases.js:', cases.length, 'casos')
