"use client";

import { useState, useEffect, useCallback } from "react";
import { getClientes, addCliente, deleteCliente, getPedidosRecientes } from "@/lib/firestore";
import type { Cliente } from "@/lib/types";

const CANALES = ["MT Portal", "MT Punta", "Carnivery", "La Roti", "Retail", "Otro"];

const EMPTY_FORM = {
  nombre: "",
  tipo: "Retail" as Cliente["tipo"],
  canal: "Retail",
  precio: 280,
  activo: true,
  tel: "",
  direccion: "",
  notas: "",
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [buscar, setBuscar] = useState("");
  const [clientesActivosNombres, setClientesActivosNombres] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [data, pedidosRecientes] = await Promise.all([
      getClientes(),
      getPedidosRecientes(3)
    ]);
    
    // Nombres de clientes con pedidos en los últimos 3 meses
    const activosSet = new Set<string>();
    pedidosRecientes.forEach((p) => {
      if (p.cliente) activosSet.add(p.cliente.toLowerCase());
    });
    
    setClientes(data);
    setClientesActivosNombres(activosSet);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!form.nombre) return;
    setSaving(true);
    await addCliente({ ...form });
    setSaving(false);
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    load();
  }

  async function handleDelete(id: string, nombre: string) {
    if (window.confirm(`¿Estás seguro que querés eliminar a ${nombre}?`)) {
      await deleteCliente(id);
      load();
    }
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    c.canal.toLowerCase().includes(buscar.toLowerCase())
  );

  const activos = clientesFiltrados.filter((c) => clientesActivosNombres.has(c.nombre.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500">Directorio de clientes y precios acordados</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          ➕ Nuevo Cliente
        </button>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Clientes Activos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activos.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Mayoristas</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activos.filter((c) => c.tipo === "Mayorista").length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-500">Retail Fijos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{activos.filter((c) => c.tipo === "Retail").length}</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="🔍  Buscar cliente o canal..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400">Cargando clientes...</div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">👥</p>
            <p className="text-gray-500 font-medium">No hay clientes registrados</p>
            <p className="text-sm text-gray-400 mt-1">Hacé clic en &ldquo;Nuevo Cliente&rdquo; para empezar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="text-left p-4">Cliente</th>
                  <th className="text-left p-4">Tipo</th>
                  <th className="text-left p-4">Canal</th>
                  <th className="text-left p-4">Teléfono</th>
                  <th className="text-left p-4">Dirección</th>
                  <th className="text-center p-4">Estado</th>
                  <th className="text-right p-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clientesFiltrados.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700">
                          {c.nombre[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{c.nombre}</p>
                          {c.notas && !c.notas.includes("Mapa: ") && <p className="text-xs text-gray-400">{c.notas}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        c.tipo === "Mayorista" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                      }`}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{c.canal}</td>
                    <td className="p-4 text-gray-500 text-sm">{c.tel || "—"}</td>
                    <td className="p-4 text-gray-500 text-sm">
                      {c.direccion || "—"}
                      {c.notas && c.notas.includes("Mapa:") && (
                        <a href={c.notas.replace("Mapa: ", "")} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline block mt-1 text-xs">
                          📍 Ver Mapa
                        </a>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        clientesActivosNombres.has(c.nombre.toLowerCase()) ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {clientesActivosNombres.has(c.nombre.toLowerCase()) ? "Activo" : "En Espera"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(c.id!, c.nombre)}
                        className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                        title="Eliminar cliente"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL NUEVO CLIENTE ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">Nuevo Cliente</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre del cliente o empresa"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value as Cliente["tipo"] })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    <option>Retail</option>
                    <option>Mayorista</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Canal</label>
                  <select
                    value={form.canal}
                    onChange={(e) => setForm({ ...form, canal: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  >
                    {CANALES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Precio por Frasco $</label>
                  <input
                    type="number" min={0}
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: Number(e.target.value) })}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase">Teléfono (opcional)</label>
                  <input
                    type="text"
                    value={form.tel}
                    onChange={(e) => setForm({ ...form, tel: e.target.value })}
                    placeholder="09X XXX XXX"
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Dirección (opcional)</label>
                <input
                  type="text"
                  value={form.direccion}
                  onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                  placeholder="Dirección de entrega"
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Notas (opcional)</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none"
                  placeholder="Ej: paga siempre en efectivo, recoge en local..."
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
                disabled={saving || !form.nombre}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
              >
                {saving ? "Guardando..." : "Guardar Cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
