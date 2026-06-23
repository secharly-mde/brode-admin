export function extractFields(cols: string[]) {
  let importePlanilla = 0;
  let devuelve = 0;
  let envioRaw = "";
  let pagoRaw = "";
  let cel = "";
  let isCortesia = false;

  for (const val of cols) {
    if (!val) continue;
    
    const num = Number(val.replace(/[^0-9.-]/g, ""));
    const hasLetters = /[A-Z]/i.test(val);
    
    // Celular
    if ((val.startsWith("09") || val.startsWith("+598") || val.startsWith("54")) && val.length > 7 && !hasLetters) {
      if (!cel) cel = val;
      continue;
    }
    
    // Cortesía / Promo
    if (val.includes("CORTES") || val.includes("PROMO") || val.includes("SIN COSTO")) {
      isCortesia = true;
      pagoRaw = val;
      continue;
    }

    // Pago state string
    if (val.includes("PAG") || val.includes("PEND")) {
      pagoRaw = val;
      continue;
    }

    // Envío
    if (val.includes("ENV") || val === "180" || val === "220" || val === "150") {
      envioRaw = val;
      continue;
    }

    // Importe Planilla vs Devuelve vs Pago Numérico
    if (!hasLetters && num > 0) {
      if (val.includes("$")) {
        importePlanilla = num;
      } else if (num >= 500) {
        // If we don't have an importe yet, maybe it's the importe. But it could also be pago.
        // Usually, if there's a payment number, we can set pagoRaw.
        if (!importePlanilla) {
           // We can just keep it in pagoRaw and set importePlanilla later if needed
           pagoRaw = val;
        }
      } else if (num < 100) {
        devuelve = num;
      }
    }
  }

  return { importePlanilla, devuelve, envioRaw, pagoRaw, cel, isCortesia };
}

console.log(extractFields(["$1020", "2", "980", "099 132 536"]));
console.log(extractFields(["", "11", "PAGO", "099 631 665"]));
console.log(extractFields(["", "", "PAGO", "099 894 926"]));
console.log(extractFields(["$3300", "13", "3040", "099 054 197"]));
console.log(extractFields(["", "4", "PAGA 29/9 se cobra 1 envio", "099 600 435"]));
