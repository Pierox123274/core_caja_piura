/** Amortización francesa — misma lógica que caja_piura_core/credit_calculator.dart */

export function temFromTea(teaPercent) {
  return Math.pow(1 + teaPercent / 100, 1 / 12) - 1
}

export function cuotaFija(monto, plazoMeses, teaPercent) {
  if (plazoMeses <= 0 || monto <= 0) return 0
  const tem = temFromTea(teaPercent)
  if (tem === 0) return monto / plazoMeses
  const factor = Math.pow(1 + tem, plazoMeses)
  return (monto * tem * factor) / (factor - 1)
}

export function cronograma(monto, plazoMeses, teaPercent, fechaBase = new Date()) {
  const tem = temFromTea(teaPercent)
  const cuota = cuotaFija(monto, plazoMeses, teaPercent)
  let saldo = monto
  const rows = []
  for (let n = 1; n <= plazoMeses; n++) {
    const interes = saldo * tem
    const capital = cuota - interes
    saldo = Math.max(0, saldo - capital)
    const venc = new Date(fechaBase)
    venc.setMonth(venc.getMonth() + n)
    rows.push({
      numero: n,
      fecha_vencimiento: venc.toISOString().slice(0, 10),
      cuota: Math.round(cuota * 100) / 100,
      capital: Math.round(capital * 100) / 100,
      interes: Math.round(interes * 100) / 100,
      saldo: Math.round(saldo * 100) / 100,
    })
  }
  return rows
}
