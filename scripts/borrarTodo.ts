import "./setup";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

async function borrarColeccion(nombre: string) {
  console.log(`\nBorrando colección: ${nombre}...`);
  const snap = await getDocs(collection(db, nombre));
  if (snap.empty) {
    console.log(`  -> Vacía, nada que borrar.`);
    return 0;
  }
  let borrados = 0;
  for (const d of snap.docs) {
    await deleteDoc(doc(db, nombre, d.id));
    borrados++;
    if (borrados % 50 === 0) console.log(`  ... ${borrados} borrados`);
  }
  console.log(`  -> ✅ ${borrados} documentos borrados de "${nombre}"`);
  return borrados;
}

async function main() {
  console.log("⚠️  Borrando todos los datos importados...\n");
  
  await borrarColeccion("pedidos");
  await borrarColeccion("gastos");
  await borrarColeccion("inventario_movimientos");

  // Resetear stock a cero también
  const { doc: docRef, setDoc } = await import("firebase/firestore");
  await setDoc(docRef(db, "inventario", "stock"), { res: 0, pollo: 0 });
  console.log("\n✅ Stock reseteado a 0.");

  console.log("\n════════════════════════════════");
  console.log("🧹 Todo limpio. Listo para empezar de cero.");
}

main().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
