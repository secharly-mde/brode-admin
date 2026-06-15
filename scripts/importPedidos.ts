import "./setup"; // DEBE IR PRIMERO para cargar las variables de entorno
import * as xlsx from "xlsx";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const MESES: Record<string, string> = {
  ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04",
  MAYO: "05", JUNIO: "06", JULIO: "07", AGOSTO: "08",
  SETIEMBRE: "09", SEPTIEMBRE: "09", OCTUBRE: "10",
  NOVIEMBRE: "11", DICIEMBRE: "12"
};

function nowISO() {
  return new Date().toISOString();
}

async function importPedidos() {
  const excelPath = "/Users/Charly/Library/CloudStorage/GoogleDrive-brode.uy@gmail.com/Mi unidad/BRODE ANTIGRAVITY/PEDIDOS BRODE.xlsx";
  const workbook = xlsx.readFile(excelPath);

  let totalInsertados = 0;
  let totalErrores = 0;

  for (const sheetName of workbook.SheetNames) {
    // Saltamos hojas que no son de pedidos mensuales
    if (
      sheetName.includes("STOCK") ||
      sheetName.includes("PICK UP") ||
      sheetName.includes("BLACKLIST") ||
      sheetName.includes("INTERIOR")
    ) continue;

    // Parsear "MES AÑO" o "MES" (hojas viejas sin año)
    const parts = sheetName.trim().split(" ");
    const mesNombre = parts[0].toUpperCase();
    const anoStr = parts.find(p => /^\d{4}$/.test(p));
    const ano = anoStr || "2023"; // fallback para hojas sin año

    if (!MESES[mesNombre]) {
      console.log(`Saltando hoja sin mes válido: "${sheetName}"`);
      continue;
    }
    const mesStr = `${ano}-${MESES[mesNombre]}`;

    console.log(`\nProcesando: ${sheetName} → ${mesStr}`);

    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

    if (data.length < 2) {
      console.log(`  -> Hoja vacía, saltando.`);
      continue;
    }

    // Buscar fila de encabezados (la que tiene "RES" y "POLLO")
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;
      const rowStr = row.map((c: any) => String(c || "").toUpperCase()).join("|");
      if (rowStr.includes("RES") && rowStr.includes("POLLO") && rowStr.includes("NOMBRE")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.log(`  -> No se encontró fila de encabezados, saltando.`);
      continue;
    }

    // Leer headers y normalizar (forzar array denso, sin huecos undefined)
    const rawHeaders = data[headerRowIndex] as any[];
    const maxLen = rawHeaders.length || 0;
    const headers: string[] = [];
    for (let j = 0; j < maxLen; j++) {
      headers[j] = String(rawHeaders[j] == null ? "" : rawHeaders[j]).toUpperCase().trim();
    }

    // Mapear columnas (safe: todos los entries son strings válidos)
    const colRes = headers.findIndex(h => h === "RES");
    const colPollo = headers.findIndex(h => h === "POLLO");
    const colNombre = headers.findIndex(h => h === "NOMBRE");
    const colMetodo = headers.findIndex(h => h.includes("METODO") || h.includes("MÉTODO"));
    const colImporte = headers.findIndex(h => h.includes("IMPORTE") || h.includes("TOTAL"));
    const colDevueltos = headers.findIndex(h => h.includes("DEVOLV") || h.includes("FRASCOS DEV"));
    const colPago = headers.findIndex(h => h === "PAGÓ" || h === "PAGO");
    const colCel = headers.findIndex(h => h === "CEL");

    if (colRes === -1 || colPollo === -1 || colNombre === -1) {
      console.log(`  -> Faltan columnas clave (RES=${colRes}, POLLO=${colPollo}, NOMBRE=${colNombre}), saltando.`);
      console.log(`  -> Headers encontrados: ${headers.slice(0, 12).join(" | ")}`);
      continue;
    }

    console.log(`  -> Headers OK: RES[${colRes}] POLLO[${colPollo}] NOMBRE[${colNombre}]`);

    let insertados = 0;
    let errores = 0;

    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const res = Number(row[colRes]) || 0;
      const pollo = Number(row[colPollo]) || 0;
      const nombre = String(row[colNombre] || "").trim();

      // Ignorar filas sin datos relevantes
      if ((res === 0 && pollo === 0) || !nombre || nombre.toUpperCase().startsWith("SEMANA")) continue;

      const frascos = res + pollo;

      // Método de pago
      const metodoRaw = colMetodo >= 0 ? String(row[colMetodo] || "").toLowerCase() : "";
      let metodo = "Efectivo";
      if (metodoRaw.includes("trans")) metodo = "Transferencia";
      else if (metodoRaw.includes("débit") || metodoRaw.includes("debit")) metodo = "Débito";
      else if (metodoRaw.includes("tarjeta")) metodo = "Tarjeta";

      // Estado de pago
      const pagoRaw = colPago >= 0 ? String(row[colPago] || "").toUpperCase() : "";
      const estado = pagoRaw.includes("PAG") || (Number(pagoRaw) > 0) ? "Pagado" : "Pendiente";

      // Importe (si existe en el Excel, usarlo; sino calcular)
      let total = 0;
      if (colImporte >= 0 && row[colImporte]) {
        total = Number(row[colImporte]) || 0;
      }
      if (total === 0) total = frascos * 220; // fallback

      // Frascos devueltos
      const devuelve = colDevueltos >= 0 ? (Number(row[colDevueltos]) || 0) : 0;

      // Cel (guardamos en notas)
      const cel = colCel >= 0 ? String(row[colCel] || "") : "";

      const pedido = {
        fecha: `${mesStr}-01`,
        cliente: nombre,
        tipo: "Retail",
        canal: "La Roti",
        res,
        pollo,
        frascos,
        devuelve,
        envio: 0,
        total,
        estado,
        metodo,
        notas: cel,
        createdAt: nowISO(),
        importado: true, // marca para saber que viene del import
      };

      try {
        await addDoc(collection(db, "pedidos"), pedido);
        insertados++;
        if (insertados % 20 === 0) console.log(`    ... ${insertados} insertados`);
      } catch (err: any) {
        errores++;
        if (errores <= 3) console.error(`  Error en fila ${i} (${nombre}):`, err?.message || err);
      }
    }

    totalInsertados += insertados;
    totalErrores += errores;
    console.log(`  -> ✅ ${insertados} pedidos migrados${errores > 0 ? `, ❌ ${errores} errores` : ""}`);
  }

  console.log(`\n════════════════════════════════`);
  console.log(`TOTAL: ${totalInsertados} pedidos migrados, ${totalErrores} errores`);
}

importPedidos()
  .then(() => {
    console.log("Terminó la importación de pedidos.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error fatal:", err);
    process.exit(1);
  });
