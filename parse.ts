import fs from "fs";

export function extractFields(cols: string[]) {
  let importePlanilla = 0;
  let devuelve = 0;
  let envioRaw = "";
  let pagoRaw = "";
  let cel = "";
  let isCortesia = false;

  for (let i = cols.length - 1; i >= 0; i--) {
     const val = cols[i];
     if (!val) continue;

     const num = Number(val.replace(/[^0-9.-]/g, ""));
     const hasLetters = /[A-Z]/i.test(val);

     // Telefono
     if (!cel && (val.startsWith("09") || val.startsWith("+598") || val.startsWith("54")) && val.length > 7 && !hasLetters) {
         cel = val;
         continue;
     }

     if (val.includes("CORTES") || val.includes("PROMO") || val.includes("SIN COSTO")) {
         isCortesia = true;
         pagoRaw = val;
         continue;
     }

     if (val.includes("PAG") || val.includes("PEND") || val.includes("SE COBRA")) {
         pagoRaw = val;
         continue;
     }

     if (val.includes("ENV") || val === "180" || val === "220" || val === "150") {
         envioRaw = val;
         continue;
     }

     if (!hasLetters && num > 0) {
         if (val.includes("$") || num >= 500) {
             if (i === 0) importePlanilla = num;
             else if (!pagoRaw) pagoRaw = val;
             else importePlanilla = num;
         } else if (num < 100) {
             devuelve = num;
         }
     }
  }

  return { importePlanilla, devuelve, envioRaw, pagoRaw, cel, isCortesia };
}

