import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  runTransaction,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Pedido, Gasto, LoteProduccion, Cliente } from "./types";

// ─── Helpers ────────────────────────────────────────────────
function nowISO() {
  return new Date().toISOString();
}

// ─── PEDIDOS ────────────────────────────────────────────────
export async function addPedido(pedido: Omit<Pedido, "id" | "createdAt">) {
  const stockRef = doc(db, "inventario", "stock");
  
  return runTransaction(db, async (transaction) => {
    const stockDoc = await transaction.get(stockRef);
    const stockData = stockDoc.exists() ? stockDoc.data() : { res: 0, pollo: 0 };
    
    // Validate we don't drop below 0 if that's a requirement (we won't enforce strictly for now to avoid blocking sales)
    const newRes = stockData.res - pedido.res;
    const newPollo = stockData.pollo - pedido.pollo;
    
    // Guardar pedido
    const newPedidoRef = doc(collection(db, "pedidos"));
    transaction.set(newPedidoRef, { ...pedido, createdAt: nowISO() });
    
    // Guardar movimientos
    const today = new Date().toISOString().split("T")[0];
    if (pedido.res > 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: "salida", item: "Res", cantidad: pedido.res, 
        motivo: `Venta - ${pedido.cliente}`, createdAt: nowISO()
      });
    }
    if (pedido.pollo > 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: "salida", item: "Pollo", cantidad: pedido.pollo, 
        motivo: `Venta - ${pedido.cliente}`, createdAt: nowISO()
      });
    }
    
    // Actualizar stock
    transaction.set(stockRef, { res: newRes, pollo: newPollo }, { merge: true });
    
    return newPedidoRef.id;
  });
}

export async function getPedidos(mes?: string): Promise<Pedido[]> {
  // mes: "YYYY-MM"
  const ref = collection(db, "pedidos");
  const q = mes
    ? query(ref, where("fecha", ">=", `${mes}-01`), where("fecha", "<=", `${mes}-31`), orderBy("fecha", "desc"))
    : query(ref, orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pedido));
}

export async function getPedidosRecientes(meses: number): Promise<Pedido[]> {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  const fechaLimite = d.toISOString().split("T")[0]; // YYYY-MM-DD
  
  const q = query(
    collection(db, "pedidos"),
    where("fecha", ">=", fechaLimite),
    orderBy("fecha", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Pedido));
}

// ─── GASTOS ─────────────────────────────────────────────────
export async function addGasto(gasto: Omit<Gasto, "id" | "createdAt">) {
  return addDoc(collection(db, "gastos"), { ...gasto, createdAt: nowISO() });
}

export async function deleteGasto(id: string) {
  return deleteDoc(doc(db, "gastos", id));
}

export async function getGastos(mes?: string): Promise<Gasto[]> {
  const ref = collection(db, "gastos");
  const q = mes
    ? query(ref, where("fecha", ">=", `${mes}-01`), where("fecha", "<=", `${mes}-31`), orderBy("fecha", "desc"))
    : query(ref, orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Gasto));
}

// ─── PRODUCCIÓN ─────────────────────────────────────────────
export async function addLote(lote: Omit<LoteProduccion, "id" | "createdAt">) {
  const stockRef = doc(db, "inventario", "stock");
  
  return runTransaction(db, async (transaction) => {
    const stockDoc = await transaction.get(stockRef);
    const stockData = stockDoc.exists() ? stockDoc.data() : { res: 0, pollo: 0 };
    
    // Calcular cuánto va para cada uno (simplificado, si es mixto asumimos mitad y mitad para el ejemplo, pero mejor tomar el valor real. Como LoteProduccion solo tiene un total "frascos", si es mixto deberíamos saber cuánto de cada uno. Si el usuario no especificó, asumimos 50/50, o le pedimos que especifique en UI). 
    // Wait, the interface for LoteProduccion has `tipo` and `frascos`.
    let sumRes = 0;
    let sumPollo = 0;
    if (lote.tipo === "Carne/Res") sumRes = lote.frascos;
    else if (lote.tipo === "Pollo") sumPollo = lote.frascos;
    else if (lote.tipo === "Mixto") {
      sumRes = Math.floor(lote.frascos / 2);
      sumPollo = Math.ceil(lote.frascos / 2);
    }
    
    // Guardar lote
    const newLoteRef = doc(collection(db, "produccion_lotes"));
    transaction.set(newLoteRef, { ...lote, createdAt: nowISO() });
    
    // Guardar movimientos
    const today = new Date().toISOString().split("T")[0];
    if (sumRes > 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: "entrada", item: "Res", cantidad: sumRes, 
        motivo: `Producción`, createdAt: nowISO()
      });
    }
    if (sumPollo > 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: "entrada", item: "Pollo", cantidad: sumPollo, 
        motivo: `Producción`, createdAt: nowISO()
      });
    }
    
    // Actualizar stock
    transaction.set(stockRef, { 
      res: stockData.res + sumRes, 
      pollo: stockData.pollo + sumPollo 
    }, { merge: true });
    
    return newLoteRef.id;
  });
}

export async function getLotes(): Promise<LoteProduccion[]> {
  const q = query(collection(db, "produccion_lotes"), orderBy("fecha", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoteProduccion));
}

// ─── CLIENTES ───────────────────────────────────────────────
export async function addCliente(cliente: Omit<Cliente, "id" | "createdAt">) {
  return addDoc(collection(db, "clientes"), { ...cliente, createdAt: nowISO() });
}

export async function getClientes(): Promise<Cliente[]> {
  const q = query(collection(db, "clientes"), orderBy("nombre"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Cliente));
}

export async function deleteCliente(id: string) {
  return deleteDoc(doc(db, "clientes", id));
}

// ─── INVENTARIO ─────────────────────────────────────────────
export async function getStock() {
  const docRef = doc(db, "inventario", "stock");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data() as { res: number; pollo: number };
  } else {
    return { res: 0, pollo: 0 };
  }
}

export async function ajustarStock(res: number, pollo: number, motivo: string) {
  const stockRef = doc(db, "inventario", "stock");
  
  return runTransaction(db, async (transaction) => {
    const stockDoc = await transaction.get(stockRef);
    const stockData = stockDoc.exists() ? stockDoc.data() : { res: 0, pollo: 0 };
    
    const diffRes = res - stockData.res;
    const diffPollo = pollo - stockData.pollo;
    const today = new Date().toISOString().split("T")[0];
    
    if (diffRes !== 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: diffRes > 0 ? "entrada" : "salida", item: "Res", 
        cantidad: Math.abs(diffRes), motivo, createdAt: nowISO()
      });
    }
    
    if (diffPollo !== 0) {
      const movRef = doc(collection(db, "inventario_movimientos"));
      transaction.set(movRef, {
        fecha: today, tipo: diffPollo > 0 ? "entrada" : "salida", item: "Pollo", 
        cantidad: Math.abs(diffPollo), motivo, createdAt: nowISO()
      });
    }
    
    transaction.set(stockRef, { res, pollo });
  });
}

import type { MovimientoInventario } from "./types";
export async function getMovimientos(): Promise<MovimientoInventario[]> {
  const q = query(collection(db, "inventario_movimientos"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MovimientoInventario));
}
