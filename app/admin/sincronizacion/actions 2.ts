import Papa from "papaparse";
import { doc, getDocs, collection, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Helper para agrupar arrays en chunks de N elementos (máx 500 por batch en Firestore)
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// Helper to generate a safe ID
function generateId(prefix: string, ...parts: string[]) {
  const clean = parts.map(p => String(p).toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_")).join("_");
  return `${prefix}_${clean}`;
}

export async function importarVentasCSV(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo descargar el CSV. Verificá que el link sea correcto y esté publicado.");
    
    const csvText = await res.text();
    
    const parsed = Papa.parse(csvText, {
      skipEmptyLines: true,
      header: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = parsed.data as any[][];
    if (rows.length === 0) throw new Error("El archivo CSV está vacío.");

    // ─── PASO 1: Borrar todos los pedidos importados anteriormente (en batch) ──
    const snapPedidos = await getDocs(collection(db, "pedidos"));
    
    let oldResTotal = 0;
    let oldPolloTotal = 0;

    const toDeletePedidos = snapPedidos.docs.filter(d => {
      const data = d.data();
      const isSync = data.importado_desde_sync === true || d.id.startsWith("v_");
      if (isSync) {
        oldResTotal += (Number(data.res) || 0);
        oldPolloTotal += (Number(data.pollo) || 0);
      }
      return isSync;
    });

    // Borrar en chunks de 500 (límite de Firestore por batch)
    for (const chunk of chunks(toDeletePedidos, 500)) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    let nuevos = 0;
    let newResTotal = 0;
    let newPolloTotal = 0;
    let currentFecha = new Date().toISOString().split("T")[0];
    const clientesUnicos = new Map<string, Record<string, unknown>>();
    const currentYear = new Date().getFullYear() || 2026;

    // Preparar todos los pedidos a insertar
    const pedidosAInsertar: { id: string; data: Record<string, unknown> }[] = [];

    for (const row of rows) {
      if (!row || row.length < 5) continue;

      const colB = String(row[0] || "").trim();
      const colE = String(row[3] || "").trim();

      const fullRowText = row.join(" ").toUpperCase();
      if (fullRowText.includes("SEMANA") && (fullRowText.includes("/") || fullRowText.includes("LUNES") || fullRowText.includes("MARTES"))) {
        const match = fullRowText.match(/(\d{1,2})\/(\d{1,2})/);
        if (match) {
          const dia = match[1].padStart(2, "0");
          const mes = match[2].padStart(2, "0");
          currentFecha = `${currentYear}-${mes}-${dia}`;
        }
        continue;
      }

      if (!colE || colE.toUpperCase() === "NOMBRE") continue;

      let resCant = Number(row[1]) || 0;
      let polloCant = Number(row[2]) || 0;

      if (resCant === 0 && polloCant === 0 && colB) {
        const slashMatch = colB.match(/(\d+)\s*\/\s*(\d+)/);
        if (slashMatch) {
          resCant = parseInt(slashMatch[1]);
          polloCant = parseInt(slashMatch[2]);
        } else {
          const resMatch = colB.match(/(\d+)\s*(?:res)/i);
          if (resMatch) resCant = parseInt(resMatch[1]);
          const polloMatch = colB.match(/(\d+)\s*(?:pollo)/i);
          if (polloMatch) polloCant = parseInt(polloMatch[1]);
        }
      }

      if (resCant === 0 && polloCant === 0) continue;

      const frascos = resCant + polloCant;
      const direccion = String(row[4] || "");
      const metodoRaw = String(row[5] || "").toLowerCase();

      let metodo = "Efectivo";
      if (metodoRaw.includes("trans")) metodo = "Transferencia";
      else if (metodoRaw.includes("débit") || metodoRaw.includes("debit")) metodo = "Débito";
      else if (metodoRaw.includes("tarjeta")) metodo = "Tarjeta";

      const nombreUpper = colE.toUpperCase();

      const preciosLocales: Record<string, number> = {
        "MT PORTAL":    245,
        "MADRE TIERRA": 245,
        "MT PUNTA":     290,
        "CARNIVERY":    270,
        "LA ROTI":      270,
        "ROTI":         270,
        "ALMACEN":      270,
      };

      const localKey = Object.keys(preciosLocales).find(k => nombreUpper.includes(k));
      const esLocal = !!localKey;
      const tipo = esLocal ? "Local" : "Retail";

      let precioUnitario: number;
      if (esLocal && localKey) {
        precioUnitario = preciosLocales[localKey];
      } else if (frascos >= 18) {
        precioUnitario = 270;
      } else if (frascos >= 12) {
        precioUnitario = 280;
      } else if (frascos >= 6) {
        precioUnitario = 290;
      } else {
        precioUnitario = 300;
      }

      let importePlanilla = 0;
      let devuelve = 0;
      let envioRaw = "";
      let pagoRaw = "";
      let cel = "";
      let isCortesia = false;

      const rightCols = row.slice(5);
      for (let i = rightCols.length - 1; i >= 0; i--) {
        const val = String(rightCols[i] || "").trim();
        if (!val) continue;

        const valUpper = val.toUpperCase();
        const num = Number(val.replace(/[^0-9.-]/g, ""));
        const hasLetters = /[A-Z]/i.test(valUpper);

        if (!cel && (val.startsWith("09") || val.startsWith("+598") || val.startsWith("54")) && val.length >= 8 && !hasLetters) {
          cel = val;
          continue;
        }

        if (valUpper.includes("CORTES") || valUpper.includes("PROMO") || valUpper.includes("SIN COSTO")) {
          isCortesia = true;
          pagoRaw = valUpper;
          continue;
        }

        if (valUpper.includes("PAG") || valUpper.includes("PEND") || valUpper.includes("COBRA") || valUpper.includes("ADEUDA")) {
          pagoRaw = valUpper;
          continue;
        }

        if (valUpper.includes("ENV") || val === "180" || val === "220" || val === "150" || val === "250") {
          envioRaw = valUpper;
          continue;
        }

        if (!hasLetters && num > 0) {
          if (val.includes("$") || num >= 300) {
            if (importePlanilla === 0) importePlanilla = num;
            else if (!pagoRaw) pagoRaw = valUpper;
          } else if (num < 100) {
            devuelve = num;
          } else {
             if (!pagoRaw) pagoRaw = valUpper;
          }
        }
      }

      if (colB.toUpperCase().includes("CORTES")) isCortesia = true;

      const creditoDevolucion = devuelve * 20;
      const envioNumerico = Number(envioRaw.replace(/[^0-9.-]/g, "")) || 0;
      const envio = esLocal ? 0 : envioNumerico;

      const pagoNumerico = Number(pagoRaw.replace(/[^0-9.-]/g, ""));
      
      let estado: "Pagado" | "Pendiente" | "Cortesía" = "Pendiente";
      if (isCortesia) {
        estado = "Cortesía";
      } else if (pagoRaw.includes("PAG") || pagoNumerico > 0) {
        estado = "Pagado";
      }
      
      if (isCortesia) metodo = "Ninguno";

      let importe = importePlanilla > 0
        ? importePlanilla
        : (frascos * precioUnitario) + envio - creditoDevolucion;
        
      if (estado === "Cortesía") {
        importe = 0;
      }

      const now = new Date().toISOString();
      const pedido = {
        fecha: currentFecha, cliente: colE, direccion,
        res: resCant, pollo: polloCant, frascos, devuelve, envio,
        total: importe, estado, metodo,
        notas: [colB, cel].filter(Boolean).join(" - "),
        tipo, canal: tipo,
        importado_desde_sync: true,
        createdAt: now, updatedAt: now,
      };

      pedidosAInsertar.push({ id: generateId("v", currentFecha, colE), data: pedido });
      nuevos++;
      newResTotal += resCant;
      newPolloTotal += polloCant;

      if (colE) {
        const clienteId = generateId("c", colE);
        clientesUnicos.set(clienteId, {
          nombre: colE, tipo, canal: tipo, precio: precioUnitario,
          activo: true, tel: cel || "", direccion: direccion || "",
          notas: colB || "",
          importado_desde_sync: true,
          updatedAt: now,
        });
      }
    }

    // ─── PASO 2: Insertar pedidos en batch ───────────────────────────────────
    for (const chunk of chunks(pedidosAInsertar, 500)) {
      const batch = writeBatch(db);
      chunk.forEach(({ id, data }) => batch.set(doc(db, "pedidos", id), data));
      await batch.commit();
    }

    // ─── PASO 3: Insertar/actualizar clientes en batch ───────────────────────
    const clientesArr = Array.from(clientesUnicos.entries());
    for (const chunk of chunks(clientesArr, 500)) {
      const batch = writeBatch(db);
      chunk.forEach(([id, data]) => batch.set(doc(db, "clientes", id), data, { merge: true }));
      await batch.commit();
    }

    // ─── PASO 4: Ajustar Inventario por Diferencia ───────────────────────────
    const deltaRes = newResTotal - oldResTotal;
    const deltaPollo = newPolloTotal - oldPolloTotal;

    if (deltaRes !== 0 || deltaPollo !== 0) {
      const stockRef = doc(db, "inventario", "stock");
      
      await runTransaction(db, async (transaction) => {
        const stockDoc = await transaction.get(stockRef);
        const stockData = stockDoc.exists() ? stockDoc.data() : { res: 0, pollo: 0 };
        
        // Si hay MAS pedidos (+delta), el stock BAJA
        const newStockRes = stockData.res - deltaRes;
        const newStockPollo = stockData.pollo - deltaPollo;
        
        const today = new Date().toISOString().split("T")[0];
        const now = new Date().toISOString();

        if (deltaRes !== 0) {
          const movRef = doc(collection(db, "inventario_movimientos"));
          transaction.set(movRef, {
            fecha: today,
            tipo: deltaRes > 0 ? "salida" : "entrada", 
            item: "Res",
            cantidad: Math.abs(deltaRes),
            motivo: `Ajuste automático por Sincronización (Delta: ${deltaRes > 0 ? '+' : ''}${deltaRes} pedidos)`,
            createdAt: now
          });
        }

        if (deltaPollo !== 0) {
          const movRef = doc(collection(db, "inventario_movimientos"));
          transaction.set(movRef, {
            fecha: today,
            tipo: deltaPollo > 0 ? "salida" : "entrada",
            item: "Pollo",
            cantidad: Math.abs(deltaPollo),
            motivo: `Ajuste automático por Sincronización (Delta: ${deltaPollo > 0 ? '+' : ''}${deltaPollo} pedidos)`,
            createdAt: now
          });
        }
        
        transaction.set(stockRef, { res: newStockRes, pollo: newStockPollo }, { merge: true });
      });
    }

    return { nuevos, borrados: toDeletePedidos.length };
  } catch (error: unknown) {
    console.error("Error en importarVentasCSV:", error);
    throw new Error((error as Error).message || "Error al procesar el CSV de ventas");
  }
}

export async function importarGastosCSV(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("No se pudo descargar el CSV. Verificá que el link sea correcto.");

    const csvText = await res.text();
    const parsed = Papa.parse(csvText, {
      skipEmptyLines: true,
      header: true,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = parsed.data as any[];
    if (rows.length === 0) throw new Error("El archivo CSV está vacío.");

    // ─── PASO 1: Borrar gastos importados anteriormente (en batch) ───────────
    const snapGastos = await getDocs(collection(db, "gastos"));
    const toDeleteGastos = snapGastos.docs.filter(d =>
      d.data().importado_desde_sync === true || d.id.startsWith("g_")
    );
    for (const chunk of chunks(toDeleteGastos, 500)) {
      const batch = writeBatch(db);
      chunk.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    let nuevos = 0;
    const gastosAInsertar: { id: string; data: Record<string, unknown> }[] = [];

    for (const row of rows) {
      const keys = Object.keys(row);
      const getVal = (possibleNames: string[], exclude: string[] = []) => {
        const key = keys.find(k => {
          const lowerK = k.toLowerCase().trim();
          return possibleNames.some(p => lowerK.includes(p)) && !exclude.some(e => lowerK.includes(e));
        });
        return key ? row[key] : "";
      };

      const fechaStr = getVal(["fecha"]);
      const categoria = getVal(["categoría", "categoria"], ["sub"]);
      const subcategoria = getVal(["subcategoría", "subcategoria"]);
      const descripcion = getVal(["descripción", "descripcion"]);
      const montoRaw = getVal(["monto", "importe", "total"]);
      const metodoRaw = getVal(["método", "metodo", "pago"]);
      const notas = getVal(["notas", "observaciones"]);

      if (!fechaStr || !montoRaw) continue;

      const monto = Number(montoRaw) || 0;
      if (monto === 0) continue;

      let fecha = new Date().toISOString().split("T")[0];
      const dateMatch = String(fechaStr).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
      if (dateMatch) {
        const d = dateMatch[1].padStart(2, "0");
        const m = dateMatch[2].padStart(2, "0");
        let y = dateMatch[3];
        if (y.length === 2) y = "20" + y;
        fecha = `${y}-${m}-${d}`;
      }

      let metodo = "Transferencia";
      const mRaw = String(metodoRaw).toLowerCase();
      if (mRaw.includes("efectivo")) metodo = "Efectivo";
      else if (mRaw.includes("débito") || mRaw.includes("debito")) metodo = "Débito";
      else if (mRaw.includes("tarjeta")) metodo = "Tarjeta";

      let finalSubcategoria = String(subcategoria || "");
      let finalDescripcion = String(descripcion || "");
      const finalNotas = String(notas || "");

      // Retro-compatibilidad: Si el CSV no tiene la columna "subcategoría" pero tiene "descripción" y "notas",
      // asumimos que están usando el formato viejo donde descripción era subcategoría y notas era descripción.
      if (!subcategoria && descripcion && notas) {
        finalSubcategoria = finalDescripcion;
        finalDescripcion = finalNotas;
      } else if (finalNotas) {
        // Si hay notas y también descripción, las concatenamos
        finalDescripcion = finalDescripcion ? `${finalDescripcion} - ${finalNotas}` : finalNotas;
      }

      const now = new Date().toISOString();
      const gasto = {
        fecha,
        categoria: categoria || "Admin",
        subcategoria: finalSubcategoria,
        descripcion: finalDescripcion,
        monto,
        metodo,
        importado_desde_sync: true,
        createdAt: now,
        updatedAt: now,
      };

      gastosAInsertar.push({
        id: generateId("g", fecha, categoria, descripcion, String(monto)),
        data: gasto,
      });
      nuevos++;
    }

    // ─── PASO 2: Insertar gastos en batch ────────────────────────────────────
    for (const chunk of chunks(gastosAInsertar, 500)) {
      const batch = writeBatch(db);
      chunk.forEach(({ id, data }) => batch.set(doc(db, "gastos", id), data));
      await batch.commit();
    }

    return { nuevos, borrados: toDeleteGastos.length };
  } catch (error: unknown) {
    console.error("Error en importarGastosCSV:", error);
    throw new Error((error as Error).message || "Error al procesar el CSV de gastos");
  }
}
