"use client";

import { useState, useEffect, useCallback } from "react";
import { getPedidos, addPedido } from "@/lib/firestore";
import type { Pedido } from "@/lib/types";

function getMesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const fecha = new Date(Number(y), Number(m) - 1, 1);
  return fecha.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
}

const CANALES = ["MT Portal", "MT Punta", "Carnivery", "La Roti", "Retail", "Otro"];
const PRECIOS_RETAIL: Record<number, number> = { 1: 280, 6: 270, 12: 260, 18: 250 };
const PRECIOS_MAYORISTA: Record<string, number> = {
  "MT Portal": 245, "MT Punta": 270, "Carnivery": 270, "La Roti": 250,
};

function getPrecioRetail(frascos: number) {
  if (frascos >= 18) return PRECIOS_RETAIL[18];
  if (frascos >= 12) return PRECIOS_RETAIL[12];
  if (frascos >= 6) return PRECIOS_RETAIL[6];
  return PRECIOS_RETAIL[1];
}

const tipoColors: Record<string, string> = {
  Mayorista: "bg-blue-100 text-blue-800",
  Local: "bg-blue-100 text-blue-800",
  Retail: "bg-purple-100 text-purple-800",
};
const estadoColors: Record<string, string> = {
  Pagado: "bg-emerald-100 text-emerald-700",
  Pendiente: "bg-amber-100 text-amber-700",
  Cortesía: "bg-fuchsia-100 text-fuchsia-800",
};

const EMPTY_FORM = {
  fecha: new Date().toISOString().slice(0, 10),
  cliente: "",
  tipo: "Retail" as "Retail" | "Mayorista",
  canal: "Retail",
  res: 0,
  pollo: 0,
  devuelve: 0,
  envio: 0,
  estado: "Pagado" as Pedido["estado"],
  metodo: "Transferencia" as Pedido["metodo"],
  notas: "",
};

export default function PedidosPage() {
  const [mes, setMes] = useState(getMesActual());
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [buscar, setBuscar] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPedidos(mes);
    setPedidos(data);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  const frascos = form.res + form.pollo;
  const precioUnitario =
    form.tipo === "Mayorista"
      ? (PRECIOS_MAYORISTA[form.canal] ?? 250)
      : getPrecioRetail(frascos);
  const creditoDevolucion = form.devuelve * 20;
  
  let totalCalculado = frascos * precioUnitario - creditoDevolucion + form.envio;
  if (form.estado === "Cortesía") {
    totalCalculado = 0;
  }

  async function handleSave() {
    if (!form.cliente || frascos === 0) return;
    setSaving(true);
    await addPedido({ ...form, frascos, total: totalCalculado });
    setSaving(false);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    load();
  }

  const pedidosFiltrados = pedidos.filter((p) => {
    const matchBuscar = p.cliente.toLowerCase().includes(buscar.toLowerCase());
    // "Local" y "Mayorista" son equivalentes en los datos
    const esLocal = filtroTipo === "Local";
    const matchTipo = filtroTipo
      ? esLocal
        ? p.tipo === "Local" || p.tipo === "Mayorista"
        : p.tipo === filtroTipo
      : true;
    const matchEstado = filtroEstado ? p.estado === filtroEstado : true;
    const matchDesde = filtroDesde ? p.fecha >= filtroDesde : true;
    const matchHasta = filtroHasta ? p.fecha <= filtroHasta : true;
    return matchBuscar && matchTipo && matchEstado && matchDesde && matchHasta;
  });

  const totalIngresos = pedidosFiltrados.reduce((a, p) => a + p.total, 0);
  const totalFrascos = pedidosFiltrados.reduce((a, p) => a + p.frascos, 0);
  const totalDevueltos = pedidosFiltrados.reduce((a, p) => a + (p.devuelve || 0), 0);
  const hayFiltros = buscar || filtroTipo || filtroEstado || filtroDesde || filtroHasta;

  const meses: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500">Registro de ventas retail y locales</p>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {meses.map((m) => (
                <option key={m} value={m}>{getMesLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          ➕ Nuevo Pedido
        </button>
      </div>

      {/* Mini stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Facturado</p>
          <p className="text-xl font-bold text-gray-900 mt-1">${totalIngresos.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Frascos Vendidos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalFrascos}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Envases Devueltos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">
            {totalDevueltos}{" "}
            <span className="text-sm font-normal text-emerald-600">(-${totalDevueltos * 20} crédito)</span>
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* ── Filtros ── */}
        <div className="p-4 border-b border-gray-100 space-y-3">
          {/* Fila 1: búsqueda + tipo + estado */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="🔍  Buscar cliente..."
              className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none"
            >
              <option value="">Todos los tipos</option>
              <option value="Retail">Retail</option>
              <option value="Local">Local / Mayorista</option>
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="Pagado">Pagado</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cortesía">Cortesía</option>
            </select>
          </div>
          {/* Fila 2: filtros de fecha */}
          <div className="flex gap-3 flex-wrap items-center">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Fecha:</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Desde</label>
              <input
                type="date"
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">Hasta</label>
              <input
                type="date"
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            {hayFiltros && (
              <button
                onClick={() => {
                  setBuscar(""); setFiltroTipo(""); setFiltroEstado("");
                  setFiltroDesde(""); setFiltroHasta("");
                }}
                className="text-xs text-red-500 hover:text-red-700 underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando pedidos...</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-gray-500 font-medium">No hay pedidos que coincidan</p>
            <p className="text-sm text-gray-400 mt-1">Probá cambiando los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Cliente</th>
                  <th className="text-left p-4">Tipo</th>
                  <th className="text-center p-4">🥩 Res</th>
                  <th className="text-center p-4">🍗 Pollo</th>
                  <th className="text-center p-4">Total Frascos</th>
                  <th className="text-center p-4">Devuelve</th>
                  <th className="text-center p-4">Envío</th>
                  <th className="text-right p-4">Total</th>
                  <th className="text-center p-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-500 text-xs">{p.fecha}</td>
                    <td className="p-4 font-medium text-gray-900">{p.cliente}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${tipoColors[p.tipo] ?? "bg-gray-100 text-gray-700"}`}>{p.tipo}</span>
                    </td>
                    <td className="p-4 text-center text-gray-700">{p.res || "—"}</td>
                    <td className="p-4 text-center text-gray-700">{p.pollo || "—"}</td>
                    <td className="p-4 text-center font-medium text-gray-900">{p.frascos}</td>
                    <td className="p-4 text-center">
                      {p.devuelve > 0 ? (
                        <span className="text-emerald-600 font-medium">
                          {p.devuelve} <span className="text-xs text-gray-400">(-${p.devuelve * 20})</span>
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="p-4 text-center text-gray-600">{p.envio > 0 ? `$${p.envio}` : "—"}</td>
                    <td className="p-4 text-right font-bold text-gray-900">${p.total.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${estadoColors[p.estado]}`}>{p.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="font-bold text-gray-800 text-sm">
                  <td colSpan={5} className="p-4">TOTAL ({pedidosFiltrados.length} pedidos)</td>
                  <td className="p-4 text-center">{totalFrascos}</td>
                  <td className="p-4 text-center text-emerald-600">{totalDevueltos}</td>
                  <td className="p-4"></td>
                  <td className="p-4 text-right">${totalIngresos.toLocaleString()}</td>
                  <td className="p-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO PEDIDO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Pedido</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Fecha</label>
                  <input type="date" value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Cliente</label>
                  <input type="text" value={form.cliente} placeholder="Nombre del cliente"
                    onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Tipo</label>
                  <select value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as "Retail" | "Mayorista", canal: e.target.value === "Retail" ? "Retail" : "MT Portal" })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <option>Retail</option>
                    <option>Mayorista</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Canal</label>
                  <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    {CANALES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">🥩 Frascos Res</label>
                  <input type="number" min={0} value={form.res}
                    onChange={(e) => setForm({ ...form, res: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">🍗 Frascos Pollo</label>
                  <input type="number" min={0} value={form.pollo}
                    onChange={(e) => setForm({ ...form, pollo: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Envases que devuelve</label>
                  <input type="number" min={0} value={form.devuelve}
                    onChange={(e) => setForm({ ...form, devuelve: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Costo de Envío $</label>
                  <input type="number" min={0} value={form.envio}
                    onChange={(e) => setForm({ ...form, envio: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Estado de Pago</label>
                  <select value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value as Pedido["estado"] })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <option>Pagado</option>
                    <option>Pendiente</option>
                    <option>Cortesía</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Método de Pago</label>
                  <select value={form.metodo}
                    onChange={(e) => setForm({ ...form, metodo: e.target.value as Pedido["metodo"] })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <option>Transferencia</option>
                    <option>Efectivo</option>
                    <option>Débito</option>
                    <option>Tarjeta</option>
                    <option>Ninguno</option>
                  </select>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase mb-2">Resumen</p>
                <div className="flex justify-between text-sm text-gray-700">
                  <span>{frascos} frascos × ${precioUnitario}</span>
                  <span className="font-semibold">${(frascos * precioUnitario).toLocaleString()}</span>
                </div>
                {form.devuelve > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700 mt-1">
                    <span>Crédito por devolución ({form.devuelve} × $20)</span>
                    <span className="font-semibold">-${creditoDevolucion}</span>
                  </div>
                )}
                {form.envio > 0 && (
                  <div className="flex justify-between text-sm text-gray-700 mt-1">
                    <span>Envío</span>
                    <span>${form.envio}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 border-t border-emerald-200 mt-2 pt-2">
                  <span>Total</span>
                  <span className={form.estado === "Cortesía" ? "line-through text-gray-400" : ""}>
                    ${totalCalculado === 0 && form.estado !== "Cortesía" ? 0 : totalCalculado.toLocaleString()}
                  </span>
                  {form.estado === "Cortesía" && <span className="text-fuchsia-600 ml-2">GRATIS</span>}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Notas (opcional)</label>
                <textarea value={form.notas} rows={2} placeholder="Observaciones..."
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.cliente || frascos === 0}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? "Guardando..." : "Guardar Pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
