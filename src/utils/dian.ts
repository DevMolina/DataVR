// Algoritmo oficial DIAN Colombia para calcular el dígito de verificación de NIT
const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

export function calcularDvDian(nit: string | number): number {
  const nitStr = String(nit).trim();
  if (!/^\d+$/.test(nitStr)) {
    throw new Error(`NIT inválido: "${nitStr}" — debe contener solo números`);
  }

  let suma = 0;
  const invertido = nitStr.split('').reverse();
  for (let i = 0; i < invertido.length && i < PESOS.length; i++) {
    suma += parseInt(invertido[i]) * PESOS[i];
  }

  const residuo = suma % 11;
  return residuo > 1 ? 11 - residuo : residuo;
}
