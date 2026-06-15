// ─── PEDIDOS ────────────────────────────────────────────────
export interface Pedido {
  id?: string;
  fecha: string;           // "YYYY-MM-DD"
  cliente: string;
  tipo: "Retail" | "Mayorista" | "Local";
  canal: string;           // "MT Portal" | "MT Punta" | "Carnivery" | "La Roti" | "Retail" | otro
  res: number;
  pollo: number;
  frascos: number;         // res + pollo
  devuelve: number;        // frascos devueltos (logística inversa)
  envio: number;           // costo de envío en $
  total: number;           // calculado
  estado: "Pagado" | "Pendiente" | "Cortesía";
  metodo: "Transferencia" | "Efectivo" | "Débito" | "Tarjeta" | "Ninguno";
  notas?: string;
  createdAt?: string;
}

// ─── GASTOS ─────────────────────────────────────────────────
export interface Gasto {
  id?: string;
  fecha: string;
  categoria: "Cocina" | "Local" | "Reparto" | "Personal" | "Admin";
  subcategoria: string;
  descripcion: string;
  monto: number;
  metodo: "Transferencia" | "Efectivo" | "Débito" | "Tarjeta" | "Crédito";
  importado_desde_sync?: boolean;  // true = viene del Drive, false/undefined = ingreso manual
  createdAt?: string;
}

// ─── PRODUCCIÓN ─────────────────────────────────────────────
export interface LoteProduccion {
  id?: string;
  fecha: string;
  tipo: "Pollo" | "Carne/Res" | "Mixto";
  frascos: number;
  frascos_usados: number;   // envases reutilizados
  frascos_nuevos: number;   // envases nuevos
  observaciones?: string;
  createdAt?: string;
}

// ─── CLIENTES ───────────────────────────────────────────────
export interface Cliente {
  id?: string;
  nombre: string;
  tipo: "Retail" | "Local";
  canal: string;
  precio: number;          // precio por frasco acordado
  activo: boolean;
  tel?: string;
  direccion?: string;
  notas?: string;
  createdAt?: string;
}

// ─── INVENTARIO ─────────────────────────────────────────────
export interface MovimientoInventario {
  id?: string;
  fecha: string;
  tipo: "entrada" | "salida";
  item: "Res" | "Pollo";
  cantidad: number;
  motivo: string;
  createdAt?: string;
}
