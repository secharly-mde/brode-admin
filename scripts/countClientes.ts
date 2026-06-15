import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

async function main() {
  const snap = await getDocs(collection(db, "clientes"));
  let total = snap.size;
  console.log("Total Clientes:", total);
  
  let canales = new Map();
  for (const d of snap.docs) {
    const c = d.data().canal;
    canales.set(c, (canales.get(c) || 0) + 1);
  }
  console.log("Canales:", Object.fromEntries(canales));
}
main().catch(console.error);
