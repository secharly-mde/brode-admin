import "./setup"; // DEBE IR PRIMERO para cargar las variables de entorno
import * as xlsx from "xlsx";
import { addGasto } from "../lib/firestore";
async function importGastos() {
  const years = ["2024", "2025", "2026"];
  const baseDir = "/Users/Charly/Library/CloudStorage/GoogleDrive-brode.uy@gmail.com/Mi unidad/BRODE ANTIGRAVITY";

  for (const year of years) {
    const excelPath = `${baseDir}/FINANZAS BRODE ${year}.xlsx`;
    let workbook;
    try {
      workbook = xlsx.readFile(excelPath);
    } catch (e) {
      console.log(`No se encontró el archivo FINANZAS BRODE ${year}.xlsx, saltando...`);
      continue;
    }

    if (!workbook.SheetNames.includes("Gastos")) continue;

    console.log(`\nProcesando FINANZAS BRODE ${year}...`);
    const data = xlsx.utils.sheet_to_json<any[]>(workbook.Sheets["Gastos"], { header: 1 });

    let currentCategoria = "Local";
    let insertados = 0;

    // Los meses suelen estar en las columnas 2 a 13 en esta plantilla
    // Asumimos que la fila 1 (0-indexed) tiene los meses
    
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const col0 = String(row[0] || "").trim();
      const col1 = String(row[1] || "").trim();

      // Si la fila tiene un texto en mayúsculas en col0, suele ser la categoría
      if (col0 && col0.toUpperCase() === col0 && col0.length > 3) {
        if (col0.includes("COCINA")) currentCategoria = "Cocina";
        else if (col0.includes("LOCAL")) currentCategoria = "Local";
        else if (col0.includes("REPARTO") || col0.includes("LOGISTICA")) currentCategoria = "Reparto";
        else if (col0.includes("PERSONAL") || col0.includes("SUELDO")) currentCategoria = "Personal";
        else currentCategoria = "Admin";
        continue;
      }

      // El nombre del gasto (subcategoría) suele estar en col 0 o col 2 (si col 1 es un número)
      let nombreGasto = "";
      if (col0 && col0 !== "Total al mes:" && !Number(col0)) nombreGasto = col0;
      else if (row[2] && typeof row[2] === "string") nombreGasto = row[2];

      if (!nombreGasto) continue;

      // Leer los 12 meses
      for (let m = 0; m < 12; m++) {
        // En tu formato, los meses empiezan en la columna 2 o 3 dependiendo de la sangría, pero la fila 2 tiene los meses 1 al 12 en índice 2 a 13.
        // Simplificación para importar totales: busquemos el valor numérico
        const valIndex = 2 + m; // Ajustar si están movidos
        const monto = Number(row[valIndex]) || 0;

        if (monto > 0) {
          const mesStr = String(m + 1).padStart(2, "0");
          const fecha = `${year}-${mesStr}-15`; // Día 15 por defecto

          try {
            await addGasto({
              fecha,
              categoria: currentCategoria as any,
              subcategoria: nombreGasto,
              descripcion: "Importado desde Excel",
              monto,
              metodo: "Transferencia" // default
            });
            insertados++;
          } catch (e) {
            console.error(`Error al insertar gasto ${nombreGasto} de ${fecha}`);
          }
        }
      }
    }

    console.log(`  -> ¡${insertados} gastos consolidados migrados para ${year}!`);
  }
}

importGastos().then(() => {
  console.log("Terminó la importación de gastos.");
  process.exit(0);
});
