import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../lib/firebase";
import { collection, query, getDocs, doc, updateDoc, where } from "firebase/firestore";

async function main() {
  const snap = await getDocs(collection(db, "clientes"));
  for (const d of snap.docs) {
    const data = d.data();
    if (data.nombre && data.nombre.toLowerCase().includes("carny") && !data.nombre.toLowerCase().includes("carnivery")) {
      await updateDoc(doc(db, "clientes", d.id), {
        nombre: "Carnivery"
      });
      console.log(`Updated client ${d.id}: ${data.nombre} -> Carnivery`);
    }
  }

  const psnap = await getDocs(collection(db, "pedidos"));
  for (const d of psnap.docs) {
    const data = d.data();
    if (data.cliente && data.cliente.toLowerCase().includes("carny") && !data.cliente.toLowerCase().includes("carnivery")) {
      await updateDoc(doc(db, "pedidos", d.id), {
        cliente: "Carnivery"
      });
      console.log(`Updated order ${d.id}: ${data.cliente} -> Carnivery`);
    }
  }
}

main().catch(console.error);
