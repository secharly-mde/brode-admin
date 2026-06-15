"use client";

import { useState, useEffect, useCallback } from "react";
import { getLotes, addLote } from "@/lib/firestore";
import type { LoteProduccion } from "@/lib/types";

const EMPTY_FORM = {
  fecha: new Date().toISOString().slice(0, 10),
  tipo: "Pollo" as LoteProduccion["tipo"],
  frascos: 0,
  frascos_usados: 0,
  frascos_nuevos: 0,
  observaciones: "",
};

export default function ProduccionPage() {
  const [lotes, setLotes] = useState<LoteProduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getLotes();
    setLotes(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-compute total frascos
  const totalFrascos = form.frascos_usados + form.frascos_nuevos;

  async function handleSave() {
    if (totalFrascos === 0) return;
    setSaving(true);
    await addLote({ ...form, frascos: totalFrascos });
    setSaving(false);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    load();
  }

  const totalProducido = lotes.reduce((a, l) => a + l.frascos, 0);
  const totalUsados = lotes.reduce((a, l) => a + l.frascos_usados, 0);
  const totalNuevos = lotes.reduce((a, l) => a + l.frascos_nuevos, 0);

  const tipoIcon: Record<string, string> = { Pollo: "🍗", "Carne/Res": "🥩", Mixto: "🍲" };
  const tipoColor: Record<string, string> = {
    Pollo: "bg-yellow-100 text-yellow-800",
    "Carne/Res": "bg-red-100 text-red-800",
    Mixto: "bg-orange-100 text-orange-800",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Producción</h1>
          <p className="text-gray-500">Registro de lotes de cocción</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          🍲 Nuevo Lote
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Total Producido</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalProducido} <span className="text-sm font-normal text-gray-400">frascos</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Envases Reutilizados</p>
          <p className="text-xl font-bold text-emerald-700 mt-1">{totalUsados} <span className="text-sm font-normal text-gray-400">frascos</span></p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Envases Nuevos Usados</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{totalNuevos} <span className="text-sm font-normal text-gray-400">frascos</span></p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando lotes...</div>
        ) : lotes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🍲</p>
            <p className="text-gray-500 font-medium">No hay lotes registrados</p>
            <p className="text-sm text-gray-400 mt-1">Registrá el próximo lote de cocción</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Tipo</th>
                  <th className="text-center p-4">Total Frascos</th>
                  <th className="text-center p-4">♻️ Reutilizados</th>
                  <th className="text-center p-4">🆕 Nuevos</th>
                  <th className="text-left p-4">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lotes.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-500 text-xs">{l.fecha}</td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${tipoColor[l.tipo]}`}>
                        {tipoIcon[l.tipo]} {l.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-center font-bold text-gray-900">{l.frascos}</td>
                    <td className="p-4 text-center text-emerald-700 font-medium">{l.frascos_usados}</td>
                    <td className="p-4 text-center text-amber-700 font-medium">{l.frascos_nuevos}</td>
                    <td className="p-4 text-gray-500 text-xs">{l.observaciones || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO LOTE ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Lote de Producción</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Tipo de Caldo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as LoteProduccion["tipo"] })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>Pollo</option>
                    <option>Carne/Res</option>
                    <option>Mixto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">♻️ Envases Reutilizados</label>
                  <input
                    type="number" min={0}
                    value={form.frascos_usados}
                    onChange={(e) => setForm({ ...form, frascos_usados: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">🆕 Envases Nuevos</label>
                  <input
                    type="number" min={0}
                    value={form.frascos_nuevos}
                    onChange={(e) => setForm({ ...form, frascos_nuevos: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {/* Resumen */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800 font-semibold text-center">
                Total producido: {totalFrascos} frascos
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Observaciones (opcional)</label>
                <textarea
                  value={form.observaciones}
                  onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  rows={2}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                  placeholder="Ej: calidad excelente, nueva receta..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || totalFrascos === 0}
                className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Guardar Lote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
