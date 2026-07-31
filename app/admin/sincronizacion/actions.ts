import Papa from "papaparse";
import { doc, getDocs, collection, writeBatch, runTransaction } from "firebase/firestore";
import { db } from "../../../lib/firebase";

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
    // Agregamos un timestamp para forzar a Google Sheets a ignorar su propio caché interno
    const cacheBusterUrl = url.includes("?") 
      ? `${url}&_t=${Date.now()}` 
      : `${url}?_t=${Date.now()}`;
      
    const res = await fetch(cacheBusterUrl, { cache: "no-store" });
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
      
      // Buscar patrones de fecha en encabezados, ej: "SEMANA 28", "LUNES 6/7", "MARTES 6 DEL 7"
      if (fullRowText.includes("SEMANA") || fullRowText.includes("LUNES") || fullRowText.includes("MARTES") || fullRowText.includes("MIERCOLES") || fullRowText.includes("MIÉRCOLES") || fullRowText.includes("JUEVES") || fullRowText.includes("VIERNES")) {
        const match = fullRowText.match(/(\d{1,2})\s*(?:\/|-|DEL?|DE)\s*(\d{1,2})/);
        if (match) {
          const dia = match[1].padStart(2, "0");
          const mes = match[2].padStart(2, "0");
          currentFecha = `${currentYear}-${mes}-${dia}`;
        }
        // Si no tiene frascos, es solo una fila separadora, la salteamos
        const checkRes = Number(row[1]) || 0;
        const checkPollo = Number(row[2]) || 0;
        if (checkRes === 0 && checkPollo === 0) continue;
      }

      if (colE.toUpperCase() === "NOMBRE") continue;

      let resCant = 0;
      const rawRes = String(row[1] || "").trim();
      if (rawRes) {
        const resMatch = rawRes.match(/(\d+)/);
        if (resMatch) resCant = parseInt(resMatch[1], 10);
      }

      let polloCant = 0;
      const rawPollo = String(row[2] || "").trim();
      if (rawPollo) {
        const polloMatch = rawPollo.match(/(\d+)/);
        if (polloMatch) polloCant = parseInt(polloMatch[1], 10);
      }

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
      const direccionUpper = direccion.toUpperCase();
      const nombreDir = `${nombreUpper} ${direccionUpper}`;

      const preciosLocales: Record<string, number> = {
        "MADRE TIERRA PUNTA": 290,
        "MT PUNTA":           290,
        "MADRE TIERRA PORTAL": 245,
        "MADRE TIERRA MAM":   245,
        "MT PORTAL":          245,
        "MADRE TIERRA":       245,
        "CARNIVERY":          270,
        "LA ROTI":            270,
        "ROTI":               270,
        "ALMACEN":            270,
      };

      const sortedLocalKeys = Object.keys(preciosLocales).sort((a, b) => b.length - a.length);
      const localKey = sortedLocalKeys.find(k => nombreDir.includes(k));
      const esLocal = !!localKey;
      const tipo = esLocal ? "Local" : "Retail";

      let precioUnitario: number;
      if (esLocal && localKey) {
        precioUnitario = preciosLocales[localKey];
        // A partir de agosto, Punta del Este también vale 245
        if (currentFecha >= "2026-08-01" && (localKey.includes("MADRE TIERRA") || localKey.includes("MT "))) {
          precioUnitario = 245;
        }
      } else if (frascos >= 18) {
        precioUnitario = 270;
      } else if (frascos >= 12) {
        precioUnitario = 280;
      } else if (frascos >= 6) {
        precioUnitario = 290;
      } else {
        precioUnitario = 300;
      }

      // G (IMPORTE)
      const importePlanilla = Number(String(row[6]).replace(/[^0-9.-]/g, "")) || 0;

      // H (FRASCOS DEVUELTOS)
      let devuelve = Number(String(row[7]).replace(/[^0-9.-]/g, "")) || 0;
      // Sanity check: si devuelven más de 100 frascos, probablemente fue un error de tipeo (escribieron plata)
      if (devuelve > 100) {
        devuelve = 0;
      }
      const creditoDevolucion = devuelve * 20;

      // I (PAGÓ)
      const pagoRaw = String(row[8] || "").trim().toUpperCase();

      // J (ENVIOS)
      const envioRaw = String(row[9] || "").trim();

      // K (CEL)
      const cel = String(row[10] || "").trim();

      const envioNumerico = Number(envioRaw.replace(/[^0-9.-]/g, "")) || 0;
      const envio = esLocal ? 0 : envioNumerico;

      // Determinamos el estado de pago buscando en TODAS las columnas finales
      // (a veces locales como Madre Tierra anotan el pago en Notas o en Método)
      const colsToSearch = [
        String(row[5] || ""),
        String(row[6] || ""),
        String(row[7] || ""),
        String(row[8] || ""),
        String(row[9] || ""),
        String(row[10] || ""),
        String(row[11] || ""),
        String(row[12] || "")
      ].map(v => v.toUpperCase());

      const isCortesia = colsToSearch.some(v => v.includes("CORTES") || v.includes("PROMO"));
      const isPagadoStr = colsToSearch.some(v => v.includes("PAG") || v === "OK" || v === "LISTO" || v === "SI" || v === "SÍ" || v === "S");
      const pagoNumerico = Number(pagoRaw.replace(/[^0-9.-]/g, ""));
      
      let estado: "Pagado" | "Pendiente" | "Cortesía" = "Pendiente";
      if (isCortesia) {
        estado = "Cortesía";
      } else if (isPagadoStr || (pagoNumerico > 0 && pagoNumerico >= 50)) {
        estado = "Pagado";
      }
      
      if (isCortesia) metodo = "Ninguno";

      // Calculamos el importe final si no vino explícito
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

      // Agregamos un string aleatorio o un timestamp microscópico para garantizar unicidad,
      // ya que a veces un mismo local (ej. Madre Tierra) tiene múltiples filas en el mismo día.
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      pedidosAInsertar.push({ id: generateId("v", currentFecha, colE, uniqueSuffix), data: pedido });
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
