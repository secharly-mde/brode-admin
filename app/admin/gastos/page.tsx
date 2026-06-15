"use client";

import { useState, useEffect, useCallback } from "react";
import { getGastos, addGasto, deleteGasto } from "@/lib/firestore";
import type { Gasto } from "@/lib/types";

function getMesActual() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMesLabel(mes: string) {
  const [y, m] = mes.split("-");
  const fecha = new Date(Number(y), Number(m) - 1, 1);
  return fecha.toLocaleDateString("es-UY", { month: "long", year: "numeric" });
}

const CATEGORIAS: Gasto["categoria"][] = ["Cocina", "Local", "Reparto", "Personal", "Admin"];

const SUBCATEGORIAS: Record<Gasto["categoria"], string[]> = {
  Cocina: ["Pollo Carnivery", "Carne Carnivery", "Carne Novillo", "Pollo Novillo", "Verduras", "Condimentos", "Frascos nuevos", "Tapas", "Frascos usados devueltos", "Otro"],
  Local: ["Alquiler", "UTE", "OSE", "Antel", "Seguro", "Limpieza", "Otro"],
  Reparto: ["Logística Punta del Este", "Cadetería Montevideo", "Gasolina", "Otro"],
  Personal: ["Mariana", "Diego", "Otro"],
  Admin: ["Publicidad en redes", "Dominio/Hosting", "Contabilidad", "Otro"],
};

const catColors: Record<string, string> = {
  Cocina: "bg-orange-100 text-orange-800",
  Local: "bg-blue-100 text-blue-800",
  Reparto: "bg-purple-100 text-purple-800",
  Personal: "bg-pink-100 text-pink-800",
  Admin: "bg-gray-100 text-gray-700",
};
const catIcons: Record<string, string> = {
  Cocina: "🍲", Local: "🏠", Reparto: "🚚", Personal: "👥", Admin: "💻",
};

const EMPTY_FORM = {
  fecha: new Date().toISOString().slice(0, 10),
  categoria: "Cocina" as Gasto["categoria"],
  subcategoria: "",
  descripcion: "",
  monto: 0,
  metodo: "Transferencia" as Gasto["metodo"],
};

export default function GastosPage() {
  const [mes, setMes] = useState(getMesActual());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [buscar, setBuscar] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getGastos(mes);
    setGastos(data);
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.subcategoria || form.monto <= 0) return;
    setSaving(true);
    await addGasto({ ...form });
    setSaving(false);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    load();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteGasto(id);
    setDeletingId(null);
    setConfirmDeleteId(null);
    load();
  }

  const gastosFiltrados = gastos.filter((g) => {
    const matchBuscar =
      g.subcategoria.toLowerCase().includes(buscar.toLowerCase()) ||
      g.descripcion.toLowerCase().includes(buscar.toLowerCase());
    const matchCat = filtroCategoria ? g.categoria === filtroCategoria : true;
    return matchBuscar && matchCat;
  });

  const totalGastos = gastosFiltrados.reduce((a, g) => a + g.monto, 0);
  const porCategoria = gastosFiltrados.reduce((acc: Record<string, number>, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto;
    return acc;
  }, {});

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
          <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500">Costos operativos y de producción</p>
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {meses.map((m) => (
                <option key={m} value={m}>{getMesLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          ➕ Registrar Gasto
        </button>
      </div>

      {/* Resumen por categoría */}
      {Object.keys(porCategoria).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(porCategoria).map(([cat, total]) => (
            <div key={cat} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-2xl mb-1">{catIcons[cat] || "📌"}</div>
              <p className="text-xs text-gray-500">{cat}</p>
              <p className="text-lg font-bold text-gray-900">${total.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3 flex-wrap">
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="🔍  Buscar..."
            className="flex-1 min-w-[160px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando gastos...</div>
        ) : gastosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-gray-500 font-medium">No hay gastos registrados</p>
            <p className="text-sm text-gray-400 mt-1">Hacé clic en &ldquo;Registrar Gasto&rdquo; para empezar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Categoría</th>
                  <th className="text-left p-4">Subcategoría</th>
                  <th className="text-left p-4">Descripción</th>
                  <th className="text-right p-4">Monto</th>
                  <th className="text-center p-4">Método</th>
                  <th className="text-center p-4">Origen</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {gastosFiltrados.map((g) => {
                  const esManual = !g.importado_desde_sync;
                  const isDeleting = deletingId === g.id;
                  const confirmando = confirmDeleteId === g.id;
                  return (
                    <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-500 text-xs">{g.fecha}</td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${catColors[g.categoria] || "bg-gray-100 text-gray-700"}`}>
                          {catIcons[g.categoria]} {g.categoria}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-gray-900">{g.subcategoria}</td>
                      <td className="p-4 text-gray-500 text-xs">{g.descripcion}</td>
                      <td className="p-4 text-right font-bold text-gray-900">
                        {g.monto > 0 ? `$${g.monto.toLocaleString()}` : "—"}
                      </td>
                      <td className="p-4 text-center text-xs text-gray-500">{g.metodo}</td>
                      <td className="p-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${esManual ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {esManual ? "Manual" : "Drive"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {esManual && (
                          confirmando ? (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => handleDelete(g.id!)}
                                disabled={isDeleting}
                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-lg transition-colors"
                              >
                                {isDeleting ? "..." : "Confirmar"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 px-1"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(g.id!)}
                              className="text-gray-300 hover:text-red-500 transition-colors text-base"
                              title="Borrar gasto"
                            >
                              🗑️
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr className="font-bold text-gray-800 text-sm">
                  <td colSpan={4} className="p-4">TOTAL GASTOS ({gastosFiltrados.length})</td>
                  <td className="p-4 text-right text-red-600">${totalGastos.toLocaleString()}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO GASTO ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Registrar Gasto</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Fecha</label>
                <input type="date" value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Categoría</label>
                <select value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value as Gasto["categoria"], subcategoria: "" })}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Subcategoría</label>
                <select value={form.subcategoria}
                  onChange={(e) => setForm({ ...form, subcategoria: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                  <option value="">Seleccioná...</option>
                  {SUBCATEGORIAS[form.categoria].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Descripción (opcional)</label>
                <input type="text" value={form.descripcion} placeholder="Detalle del gasto..."
                  onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Monto $</label>
                  <input type="number" min={0} value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Método de Pago</label>
                  <select value={form.metodo}
                    onChange={(e) => setForm({ ...form, metodo: e.target.value as Gasto["metodo"] })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                    <option>Transferencia</option>
                    <option>Efectivo</option>
                    <option>Débito</option>
                    <option>Tarjeta</option>
                    <option>Crédito</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.subcategoria || form.monto <= 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? "Guardando..." : "Guardar Gasto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
