import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  Plus, TrendingUp, TrendingDown, Target, Upload, Wallet,
  Users, User, X, Trash2, PiggyBank, Check,
  AlertCircle, ArrowUpRight, ArrowDownRight, FileText
} from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Config ----------
const CATS_GASTO = [
  { id: "comida", label: "Comida", color: "#C4622D" },
  { id: "tarjeta", label: "Tarjeta de crédito", color: "#8B5A9E" },
  { id: "servicios", label: "Servicios", color: "#3B7A8C" },
  { id: "transporte", label: "Transporte", color: "#B8944A" },
  { id: "salud", label: "Salud", color: "#A34848" },
  { id: "casa", label: "Casa", color: "#5C7A4A" },
  { id: "ocio", label: "Ocio", color: "#4A6C8C" },
  { id: "otro", label: "Otro", color: "#7A7266" },
];
const CATS_INGRESO = [
  { id: "sueldo", label: "Sueldo", color: "#3D6B4F" },
  { id: "extra", label: "Extra / changa", color: "#6B8F5E" },
  { id: "otro_ing", label: "Otro ingreso", color: "#8FA37A" },
];
const catInfo = (id, tipo) => (tipo === "gasto" ? CATS_GASTO : CATS_INGRESO).find(c => c.id === id) || { label: id, color: "#7A7266" };

const money = (n) => Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const monthKey = (dateStr) => dateStr.slice(0, 7);
const monthLabel = (mk) => {
  const [y, m] = mk.split("-");
  return new Date(y, m - 1, 1).toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
};
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [entries, setEntries] = useState([]);
  const [goals, setGoals] = useState([]);
  const [people, setPeople] = useState(["Persona 1", "Persona 2"]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("resumen");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(null);

  // ---------- Load + realtime ----------
  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel("finanzas-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "entries" }, loadEntries)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, loadGoals)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, loadSettings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadEntries(), loadGoals(), loadSettings()]);
    setLoading(false);
  };

  const loadEntries = async () => {
    const { data, error } = await supabase.from("entries").select("*").order("fecha", { ascending: false });
    if (error) { setError("No se pudieron cargar los movimientos."); return; }
    setEntries(data || []);
  };

  const loadGoals = async () => {
    const { data, error } = await supabase.from("goals").select("*").order("created_at", { ascending: true });
    if (error) { setError("No se pudieron cargar los objetivos."); return; }
    setGoals(data || []);
  };

  const loadSettings = async () => {
    const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
    if (error || !data) return;
    if (Array.isArray(data.people) && data.people.length === 2) setPeople(data.people);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // ---------- Mutations ----------
  const addEntry = async (entry) => {
    const { error } = await supabase.from("entries").insert([entry]);
    if (error) { setError("No se pudo guardar el movimiento."); return; }
    setError(null);
    showToast(entry.tipo === "gasto" ? "Gasto cargado" : "Ingreso cargado");
    loadEntries();
  };

  const addEntries = async (rows) => {
    const { error } = await supabase.from("entries").insert(rows);
    if (error) { setError("No se pudo importar el archivo."); return; }
    showToast(`${rows.length} movimientos importados`);
    loadEntries();
  };

  const deleteEntry = async (id) => {
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) { setError("No se pudo borrar."); return; }
    loadEntries();
  };

  const addGoal = async (goal) => {
    const { error } = await supabase.from("goals").insert([{ ...goal, current: 0 }]);
    if (error) { setError("No se pudo crear el objetivo."); return; }
    showToast("Objetivo creado");
    loadGoals();
  };

  const updateGoalProgress = async (id, amount) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newCurrent = Math.max(0, Number(goal.current) + amount);
    const { error } = await supabase.from("goals").update({ current: newCurrent }).eq("id", id);
    if (error) { setError("No se pudo actualizar el objetivo."); return; }
    loadGoals();
  };

  const deleteGoal = async (id) => {
    const { error } = await supabase.from("goals").delete().eq("id", id);
    if (error) { setError("No se pudo borrar el objetivo."); return; }
    loadGoals();
  };

  const updatePeople = async (newPeople) => {
    const { error } = await supabase.from("settings").update({ people: newPeople }).eq("id", 1);
    if (error) { setError("No se pudo guardar."); return; }
    setPeople(newPeople);
  };

  if (loading) {
    return (
      <div style={S.loadingScreen}>
        <div style={S.loadingMark}>$</div>
        <div style={{ color: "#6B6459", fontFamily: F.body, fontSize: 14 }}>Abriendo la libreta…</div>
      </div>
    );
  }

  const data = { entries, goals, people };

  return (
    <div style={S.app}>
      <style>{globalCSS}</style>
      <Header people={people} onEditPeople={updatePeople} />

      <div style={S.shareNotice}>
        <Users size={13} strokeWidth={2.2} />
        <span>Datos compartidos: los ve cualquiera que abra este link.</span>
      </div>

      <Nav tab={tab} setTab={setTab} />

      <main style={S.main}>
        {tab === "resumen" && <Resumen data={data} onDelete={deleteEntry} />}
        {tab === "movimientos" && (
          <Movimientos
            data={data}
            onDelete={deleteEntry}
            onOpenImport={() => setShowImport(true)}
          />
        )}
        {tab === "objetivos" && (
          <Objetivos
            goals={goals}
            onOpenAdd={() => setShowGoalModal(true)}
            onProgress={updateGoalProgress}
            onDelete={deleteGoal}
          />
        )}
        {tab === "graficos" && <Graficos data={data} />}
      </main>

      <button style={S.fab} onClick={() => setShowAddModal(true)} aria-label="Agregar movimiento">
        <Plus size={26} strokeWidth={2.5} color="#F4F0E6" />
      </button>

      {showAddModal && (
        <AddEntryModal
          people={people}
          onClose={() => setShowAddModal(false)}
          onSave={(e) => { addEntry(e); setShowAddModal(false); }}
        />
      )}
      {showGoalModal && (
        <AddGoalModal
          onClose={() => setShowGoalModal(false)}
          onSave={(g) => { addGoal(g); setShowGoalModal(false); }}
        />
      )}
      {showImport && (
        <ImportModal
          people={people}
          onClose={() => setShowImport(false)}
          onImport={(rows) => { addEntries(rows); setShowImport(false); }}
        />
      )}
      {error && <div style={S.errorBanner}><AlertCircle size={14} /> {error}</div>}
      {toast && <div style={S.toast}><Check size={14} strokeWidth={3} /> {toast}</div>}
    </div>
  );
}

// ==================== Header / Nav ====================

function Header({ people, onEditPeople }) {
  const [editing, setEditing] = useState(false);
  const [p1, setP1] = useState(people[0]);
  const [p2, setP2] = useState(people[1]);

  useEffect(() => { setP1(people[0]); setP2(people[1]); }, [people]);

  const save = () => {
    onEditPeople([p1.trim() || "Persona 1", p2.trim() || "Persona 2"]);
    setEditing(false);
  };

  return (
    <header style={S.header}>
      <div style={S.headerMark}><div style={S.headerMarkGlyph}>$</div></div>
      <div style={{ flex: 1 }}>
        <div style={S.headerTitle}>Libreta</div>
        {!editing ? (
          <button style={S.headerSub} onClick={() => setEditing(true)}>{people[0]} &amp; {people[1]}</button>
        ) : (
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input style={S.miniInput} value={p1} onChange={e => setP1(e.target.value)} placeholder="Persona 1" />
            <input style={S.miniInput} value={p2} onChange={e => setP2(e.target.value)} placeholder="Persona 2" />
            <button style={S.miniSaveBtn} onClick={save}><Check size={14} strokeWidth={3} /></button>
          </div>
        )}
      </div>
    </header>
  );
}

function Nav({ tab, setTab }) {
  const items = [
    { id: "resumen", label: "Resumen" },
    { id: "movimientos", label: "Movimientos" },
    { id: "objetivos", label: "Objetivos" },
    { id: "graficos", label: "Gráficos" },
  ];
  return (
    <nav style={S.nav}>
      {items.map(it => (
        <button key={it.id} onClick={() => setTab(it.id)} style={{ ...S.navBtn, ...(tab === it.id ? S.navBtnActive : {}) }}>
          {it.label}
        </button>
      ))}
    </nav>
  );
}

// ==================== Resumen ====================

function Resumen({ data, onDelete }) {
  const now = new Date();
  const curMonth = now.toISOString().slice(0, 7);
  const entriesThisMonth = data.entries.filter(e => monthKey(e.fecha) === curMonth);

  const ingresos = entriesThisMonth.filter(e => e.tipo === "ingreso").reduce((s, e) => s + Number(e.monto), 0);
  const gastos = entriesThisMonth.filter(e => e.tipo === "gasto").reduce((s, e) => s + Number(e.monto), 0);
  const balance = ingresos - gastos;

  const porPersona = data.people.map(p => {
    const ing = entriesThisMonth.filter(e => e.tipo === "ingreso" && e.persona === p).reduce((s, e) => s + Number(e.monto), 0);
    const gas = entriesThisMonth.filter(e => e.tipo === "gasto" && (e.persona === p || e.persona === "Compartido")).reduce((s, e) => s + (e.persona === "Compartido" ? Number(e.monto) / 2 : Number(e.monto)), 0);
    return { persona: p, ingresos: ing, gastos: gas };
  });

  const gastoCompartido = entriesThisMonth.filter(e => e.tipo === "gasto" && e.persona === "Compartido").reduce((s, e) => s + Number(e.monto), 0);
  const recientes = [...data.entries].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  return (
    <div style={S.section}>
      <div style={S.monthLabel}>{now.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</div>

      <div style={S.statGrid}>
        <StatCard icon={<ArrowUpRight size={16} strokeWidth={2.3} />} label="Ingresos" value={money(ingresos)} tone="pos" />
        <StatCard icon={<ArrowDownRight size={16} strokeWidth={2.3} />} label="Gastos" value={money(gastos)} tone="neg" />
        <StatCard icon={<Wallet size={16} strokeWidth={2.3} />} label="Balance" value={money(balance)} tone={balance >= 0 ? "pos" : "neg"} wide />
      </div>

      <div style={S.cardBlock}>
        <div style={S.blockTitle}>Por persona este mes</div>
        {porPersona.map(pp => (
          <div key={pp.persona} style={S.personRow}>
            <div style={S.personName}><User size={13} strokeWidth={2.2} /> {pp.persona}</div>
            <div style={{ display: "flex", gap: 14, fontVariantNumeric: "tabular-nums" }}>
              <span style={{ color: "#3D6B4F", fontSize: 13 }}>+{money(pp.ingresos)}</span>
              <span style={{ color: "#A34848", fontSize: 13 }}>-{money(pp.gastos)}</span>
            </div>
          </div>
        ))}
        {gastoCompartido > 0 && (
          <div style={S.sharedNote}><Users size={12} /> Gasto compartido este mes: {money(gastoCompartido)} (dividido por igual arriba)</div>
        )}
      </div>

      <div style={S.cardBlock}>
        <div style={S.blockTitle}>Últimos movimientos</div>
        {recientes.length === 0 ? <EmptyState text="Todavía no cargaste nada. Tocá el + para empezar." /> : recientes.map(e => <EntryRow key={e.id} entry={e} onDelete={onDelete} />)}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone, wide }) {
  const toneColor = tone === "pos" ? "#3D6B4F" : "#A34848";
  return (
    <div style={{ ...S.statCard, gridColumn: wide ? "1 / -1" : "auto" }}>
      <div style={{ ...S.statIcon, color: toneColor, background: tone === "pos" ? "#E8EFE4" : "#F3E4E0" }}>{icon}</div>
      <div>
        <div style={S.statLabel}>{label}</div>
        <div style={{ ...S.statValue, color: toneColor }}>{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div style={S.emptyState}>
      <FileText size={22} strokeWidth={1.6} color="#B5AC9C" />
      <div style={{ fontSize: 13, color: "#8A8272", marginTop: 6 }}>{text}</div>
    </div>
  );
}

// ==================== Movimientos ====================

function Movimientos({ data, onDelete, onOpenImport }) {
  const [filter, setFilter] = useState("todos");
  const sorted = [...data.entries].sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filtered = filter === "todos" ? sorted : sorted.filter(e => e.tipo === filter);

  const grouped = filtered.reduce((acc, e) => {
    const mk = monthKey(e.fecha);
    acc[mk] = acc[mk] || [];
    acc[mk].push(e);
    return acc;
  }, {});

  return (
    <div style={S.section}>
      <div style={S.rowBetween}>
        <div style={S.filterRow}>
          {[["todos", "Todos"], ["gasto", "Gastos"], ["ingreso", "Ingresos"]].map(([id, label]) => (
            <button key={id} onClick={() => setFilter(id)} style={{ ...S.filterChip, ...(filter === id ? S.filterChipActive : {}) }}>{label}</button>
          ))}
        </div>
        <button style={S.importBtn} onClick={onOpenImport}><Upload size={14} strokeWidth={2.3} /> Importar CSV</button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div style={S.cardBlock}><EmptyState text="No hay movimientos para este filtro." /></div>
      ) : (
        Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([mk, items]) => (
          <div key={mk} style={S.cardBlock}>
            <div style={S.blockTitle}>{monthLabel(mk)}</div>
            {items.map(e => <EntryRow key={e.id} entry={e} onDelete={onDelete} />)}
          </div>
        ))
      )}
    </div>
  );
}

function EntryRow({ entry, onDelete }) {
  const info = catInfo(entry.categoria, entry.tipo);
  const [confirming, setConfirming] = useState(false);
  return (
    <div style={S.entryRow}>
      <div style={{ ...S.entryDot, background: info.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.entryDesc}>{entry.descripcion || info.label}</div>
        <div style={S.entryMeta}>{info.label} · {entry.persona} · {new Date(entry.fecha + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</div>
      </div>
      <div style={{ ...S.entryAmount, color: entry.tipo === "ingreso" ? "#3D6B4F" : "#A34848" }}>
        {entry.tipo === "ingreso" ? "+" : "-"}{money(entry.monto)}
      </div>
      {!confirming ? (
        <button style={S.deleteBtn} onClick={() => setConfirming(true)} aria-label="Borrar"><Trash2 size={14} strokeWidth={2} /></button>
      ) : (
        <div style={{ display: "flex", gap: 4 }}>
          <button style={S.confirmDelBtn} onClick={() => onDelete(entry.id)}>Borrar</button>
          <button style={S.cancelDelBtn} onClick={() => setConfirming(false)}>×</button>
        </div>
      )}
    </div>
  );
}

// ==================== Add Entry Modal ====================

function AddEntryModal({ people, onClose, onSave }) {
  const [tipo, setTipo] = useState("gasto");
  const [monto, setMonto] = useState("");
  const [categoria, setCategoria] = useState(CATS_GASTO[0].id);
  const [persona, setPersona] = useState(people[0]);
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(todayStr());

  const cats = tipo === "gasto" ? CATS_GASTO : CATS_INGRESO;
  useEffect(() => { setCategoria(cats[0].id); }, [tipo]);

  const valid = parseFloat(monto) > 0;
  const submit = () => {
    if (!valid) return;
    onSave({ tipo, monto: parseFloat(monto), categoria, persona, descripcion, fecha });
  };

  return (
    <Modal onClose={onClose} title="Nuevo movimiento">
      <div style={S.segmentRow}>
        <button style={{ ...S.segmentBtn, ...(tipo === "gasto" ? S.segmentBtnActiveNeg : {}) }} onClick={() => setTipo("gasto")}>
          <TrendingDown size={15} strokeWidth={2.3} /> Gasto
        </button>
        <button style={{ ...S.segmentBtn, ...(tipo === "ingreso" ? S.segmentBtnActivePos : {}) }} onClick={() => setTipo("ingreso")}>
          <TrendingUp size={15} strokeWidth={2.3} /> Ingreso
        </button>
      </div>

      <label style={S.label}>Monto</label>
      <div style={S.amountWrap}>
        <span style={S.amountPrefix}>$</span>
        <input style={S.amountInput} type="number" inputMode="decimal" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} autoFocus />
      </div>

      <label style={S.label}>Categoría</label>
      <div style={S.catGrid}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setCategoria(c.id)} style={{ ...S.catChip, borderColor: categoria === c.id ? c.color : "#E4DDCC", background: categoria === c.id ? c.color + "1c" : "#FBF9F3", color: categoria === c.id ? c.color : "#6B6459" }}>
            {c.label}
          </button>
        ))}
      </div>

      <label style={S.label}>¿De quién es?</label>
      <div style={S.segmentRow}>
        {[...people, "Compartido"].map(p => (
          <button key={p} onClick={() => setPersona(p)} style={{ ...S.segmentBtn, ...(persona === p ? S.segmentBtnActiveNeutral : {}) }}>
            {p === "Compartido" ? <Users size={14} strokeWidth={2.2} /> : <User size={14} strokeWidth={2.2} />} {p}
          </button>
        ))}
      </div>

      <label style={S.label}>Descripción (opcional)</label>
      <input style={S.textInput} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Supermercado Día" />

      <label style={S.label}>Fecha</label>
      <input style={S.textInput} type="date" value={fecha} onChange={e => setFecha(e.target.value)} />

      <button style={{ ...S.primaryBtn, opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={submit}>Guardar</button>
    </Modal>
  );
}

// ==================== Import CSV Modal ====================

function ImportModal({ people, onClose, onImport }) {
  const [parsed, setParsed] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [persona, setPersona] = useState(people[0]);
  const [categoria, setCategoria] = useState("tarjeta");

  const handleFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => tryParse(ev.target.result);
    reader.readAsText(file, "utf-8");
  };

  const normalizeDate = (s) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = "20" + y;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    return null;
  };

  const tryParse = (text) => {
    try {
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) throw new Error("El archivo no tiene datos suficientes.");
      const delim = lines[0].includes(";") ? ";" : ",";
      const header = lines[0].split(delim).map(h => h.trim().toLowerCase());

      const idxFecha = header.findIndex(h => h.includes("fecha"));
      const idxDesc = header.findIndex(h => h.includes("desc") || h.includes("detalle") || h.includes("concepto"));
      const idxMonto = header.findIndex(h => h.includes("monto") || h.includes("importe") || h.includes("total"));

      if (idxFecha === -1 || idxMonto === -1) {
        throw new Error("No encontré columnas de fecha y monto. Revisá que el CSV tenga encabezados como 'fecha' y 'monto'.");
      }

      const rows = lines.slice(1).map(line => {
        const cols = line.split(delim);
        const fecha = normalizeDate((cols[idxFecha] || "").trim());
        const montoRaw = (cols[idxMonto] || "0").replace(/[^0-9,.-]/g, "").replace(",", ".");
        const monto = Math.abs(parseFloat(montoRaw) || 0);
        const descripcion = idxDesc !== -1 ? (cols[idxDesc] || "").trim() : "";
        return { fecha, monto, descripcion };
      }).filter(r => r.monto > 0 && r.fecha);

      if (rows.length === 0) throw new Error("No pude leer ninguna fila válida del archivo.");
      setParsed(rows);
      setParseError(null);
    } catch (e) {
      setParseError(e.message);
      setParsed(null);
    }
  };

  const confirmImport = () => {
    if (!parsed) return;
    onImport(parsed.map(r => ({ tipo: "gasto", monto: r.monto, categoria, persona, descripcion: r.descripcion, fecha: r.fecha })));
  };

  return (
    <Modal onClose={onClose} title="Importar resumen (CSV)">
      {!parsed && (
        <>
          <div style={S.importHint}>
            Subí el CSV que bajaste del resumen de tarjeta o home banking. Necesita columnas de <strong>fecha</strong> y <strong>monto</strong> (idealmente también una de descripción).
          </div>
          <label style={S.fileDrop}>
            <Upload size={20} strokeWidth={1.8} color="#8A8272" />
            <span style={{ fontSize: 13, color: "#6B6459", marginTop: 6 }}>Tocá para elegir el archivo .csv</span>
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </label>
          {parseError && <div style={S.parseError}><AlertCircle size={14} /> {parseError}</div>}
        </>
      )}

      {parsed && (
        <>
          <div style={S.importHint}>
            Encontré <strong>{parsed.length}</strong> movimientos. Se van a cargar todos como gasto — elegí a quién y qué categoría asignarles (podés editarlos después uno por uno).
          </div>

          <label style={S.label}>Asignar a</label>
          <div style={S.segmentRow}>
            {[...people, "Compartido"].map(p => (
              <button key={p} onClick={() => setPersona(p)} style={{ ...S.segmentBtn, ...(persona === p ? S.segmentBtnActiveNeutral : {}) }}>
                {p === "Compartido" ? <Users size={14} /> : <User size={14} />} {p}
              </button>
            ))}
          </div>

          <label style={S.label}>Categoría</label>
          <div style={S.catGrid}>
            {CATS_GASTO.map(c => (
              <button key={c.id} onClick={() => setCategoria(c.id)} style={{ ...S.catChip, borderColor: categoria === c.id ? c.color : "#E4DDCC", background: categoria === c.id ? c.color + "1c" : "#FBF9F3", color: categoria === c.id ? c.color : "#6B6459" }}>
                {c.label}
              </button>
            ))}
          </div>

          <div style={S.previewList}>
            {parsed.slice(0, 5).map((r, i) => (
              <div key={i} style={S.previewRow}>
                <span style={{ color: "#8A8272" }}>{r.fecha}</span>
                <span style={{ flex: 1, margin: "0 8px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descripcion || "—"}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(r.monto)}</span>
              </div>
            ))}
            {parsed.length > 5 && <div style={{ fontSize: 12, color: "#B5AC9C", marginTop: 4 }}>+{parsed.length - 5} más</div>}
          </div>

          <button style={S.primaryBtn} onClick={confirmImport}>Cargar {parsed.length} movimientos</button>
        </>
      )}
    </Modal>
  );
}

// ==================== Objetivos ====================

function Objetivos({ goals, onOpenAdd, onProgress, onDelete }) {
  return (
    <div style={S.section}>
      <button style={S.newGoalBtn} onClick={onOpenAdd}><Target size={16} strokeWidth={2.3} /> Nuevo objetivo de ahorro</button>
      {goals.length === 0 ? (
        <div style={S.cardBlock}><EmptyState text="Todavía no armaron ningún objetivo de ahorro." /></div>
      ) : (
        goals.map(g => <GoalCard key={g.id} goal={g} onProgress={onProgress} onDelete={onDelete} />)
      )}
    </div>
  );
}

function GoalCard({ goal, onProgress, onDelete }) {
  const [addAmount, setAddAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const current = Number(goal.current);
  const target = Number(goal.target);
  const pct = Math.min(100, (current / target) * 100);
  const done = current >= target;

  return (
    <div style={S.goalCard}>
      <div style={S.rowBetween}>
        <div style={S.goalTitleRow}>
          <PiggyBank size={16} strokeWidth={2} color="#3D6B4F" />
          <span style={S.goalTitle}>{goal.nombre}</span>
        </div>
        {!confirming ? (
          <button style={S.deleteBtn} onClick={() => setConfirming(true)}><Trash2 size={14} /></button>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button style={S.confirmDelBtn} onClick={() => onDelete(goal.id)}>Borrar</button>
            <button style={S.cancelDelBtn} onClick={() => setConfirming(false)}>×</button>
          </div>
        )}
      </div>

      <div style={S.goalBarTrack}>
        <div style={{ ...S.goalBarFill, width: `${pct}%`, background: done ? "#3D6B4F" : "#8FA37A" }} />
      </div>
      <div style={S.goalNums}>
        <span style={{ fontWeight: 600, color: "#2B2A24" }}>{money(current)}</span>
        <span style={{ color: "#B5AC9C" }}> / {money(target)}</span>
        {done && <span style={{ color: "#3D6B4F", marginLeft: 6, fontWeight: 600 }}>· ¡Cumplido!</span>}
      </div>
      {goal.fecha_limite && (
        <div style={S.goalDeadline}>Meta: {new Date(goal.fecha_limite + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}</div>
      )}

      <div style={S.goalAddRow}>
        <input style={S.goalAddInput} type="number" inputMode="decimal" placeholder="Sumar monto" value={addAmount} onChange={e => setAddAmount(e.target.value)} />
        <button style={S.goalAddBtn} onClick={() => { const v = parseFloat(addAmount); if (v > 0) { onProgress(goal.id, v); setAddAmount(""); } }}>Sumar</button>
      </div>
    </div>
  );
}

function AddGoalModal({ onClose, onSave }) {
  const [nombre, setNombre] = useState("");
  const [target, setTarget] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const valid = nombre.trim() && parseFloat(target) > 0;

  return (
    <Modal onClose={onClose} title="Nuevo objetivo">
      <label style={S.label}>¿Para qué están ahorrando?</label>
      <input style={S.textInput} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Vacaciones, colchón nuevo…" autoFocus />

      <label style={S.label}>Monto objetivo</label>
      <div style={S.amountWrap}>
        <span style={S.amountPrefix}>$</span>
        <input style={S.amountInput} type="number" inputMode="decimal" placeholder="0" value={target} onChange={e => setTarget(e.target.value)} />
      </div>

      <label style={S.label}>Fecha límite (opcional)</label>
      <input style={S.textInput} type="date" value={fechaLimite} onChange={e => setFechaLimite(e.target.value)} />

      <button
        style={{ ...S.primaryBtn, opacity: valid ? 1 : 0.5 }}
        disabled={!valid}
        onClick={() => onSave({ nombre: nombre.trim(), target: parseFloat(target), fecha_limite: fechaLimite || null })}
      >
        Crear objetivo
      </button>
    </Modal>
  );
}

// ==================== Gráficos ====================

function Graficos({ data }) {
  const now = new Date();
  const last6 = [...Array(6)].map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toISOString().slice(0, 7);
  });

  const monthly = last6.map(mk => {
    const items = data.entries.filter(e => monthKey(e.fecha) === mk);
    return {
      mes: monthLabel(mk),
      Ingresos: items.filter(e => e.tipo === "ingreso").reduce((s, e) => s + Number(e.monto), 0),
      Gastos: items.filter(e => e.tipo === "gasto").reduce((s, e) => s + Number(e.monto), 0),
    };
  });

  const curMonth = now.toISOString().slice(0, 7);
  const gastosMes = data.entries.filter(e => e.tipo === "gasto" && monthKey(e.fecha) === curMonth);
  const byCat = CATS_GASTO.map(c => ({
    name: c.label,
    value: gastosMes.filter(e => e.categoria === c.id).reduce((s, e) => s + Number(e.monto), 0),
    color: c.color,
  })).filter(c => c.value > 0);

  const byPersona = data.people.map(p => ({
    name: p,
    value: gastosMes.filter(e => e.persona === p).reduce((s, e) => s + Number(e.monto), 0),
  }));
  const compartido = gastosMes.filter(e => e.persona === "Compartido").reduce((s, e) => s + Number(e.monto), 0);
  if (compartido > 0) byPersona.push({ name: "Compartido", value: compartido });

  if (data.entries.length === 0) {
    return <div style={S.section}><div style={S.cardBlock}><EmptyState text="Cargá movimientos para ver los gráficos acá." /></div></div>;
  }

  return (
    <div style={S.section}>
      <div style={S.cardBlock}>
        <div style={S.blockTitle}>Ingresos vs. gastos (últimos 6 meses)</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E4DDCC" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#8A8272" }} axisLine={{ stroke: "#E4DDCC" }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8A8272" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => money(v)} contentStyle={S.tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Ingresos" fill="#8FA37A" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Gastos" fill="#C4622D" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {byCat.length > 0 && (
        <div style={S.cardBlock}>
          <div style={S.blockTitle}>Gastos por categoría este mes</div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {byCat.map((c, i) => <Cell key={i} fill={c.color} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v)} contentStyle={S.tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {byPersona.some(p => p.value > 0) && (
        <div style={S.cardBlock}>
          <div style={S.blockTitle}>Gastos por persona este mes</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byPersona} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: "#8A8272" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#4A4739" }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={(v) => money(v)} contentStyle={S.tooltipStyle} />
              <Bar dataKey="value" fill="#3B7A8C" radius={[0, 4, 4, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ==================== Modal shell ====================

function Modal({ title, onClose, children }) {
  return (
    <div style={S.modalOverlay} onClick={onClose}>
      <div style={S.modalSheet} onClick={e => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>{title}</div>
          <button style={S.modalClose} onClick={onClose}><X size={18} strokeWidth={2.2} /></button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ==================== Styles ====================

const F = { display: "'Fraunces', 'Georgia', serif", body: "'Inter', -apple-system, sans-serif" };

const globalCSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
* { box-sizing: border-box; }
body { margin: 0; }
input:focus, button:focus { outline: 2px solid #3D6B4F; outline-offset: 1px; }
input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

const S = {
  app: { fontFamily: F.body, background: "#F4F0E6", minHeight: "100vh", color: "#2B2A24", paddingBottom: 90, maxWidth: 480, margin: "0 auto", position: "relative" },
  loadingScreen: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#F4F0E6" },
  loadingMark: { width: 44, height: 44, borderRadius: 12, background: "#3D6B4F", color: "#F4F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.display, fontSize: 22, fontWeight: 600 },
  header: { display: "flex", alignItems: "center", gap: 12, padding: "20px 18px 12px" },
  headerMark: { width: 38, height: 38, borderRadius: 10, background: "#3D6B4F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  headerMarkGlyph: { fontFamily: F.display, fontSize: 19, fontWeight: 600, color: "#F4F0E6" },
  headerTitle: { fontFamily: F.display, fontSize: 21, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.1 },
  headerSub: { background: "none", border: "none", padding: 0, marginTop: 2, fontFamily: F.body, fontSize: 13, color: "#8A8272", cursor: "pointer", textAlign: "left" },
  miniInput: { fontFamily: F.body, fontSize: 12, padding: "5px 8px", borderRadius: 7, border: "1px solid #D8CFB8", background: "#fff", width: 84 },
  miniSaveBtn: { background: "#3D6B4F", border: "none", borderRadius: 7, color: "#fff", width: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  shareNotice: { display: "flex", alignItems: "center", gap: 6, margin: "0 18px 10px", fontSize: 11.5, color: "#7A7266", background: "#EAE3D2", padding: "6px 10px", borderRadius: 8 },
  nav: { display: "flex", gap: 4, padding: "0 14px", marginBottom: 4, borderBottom: "1px solid #E4DDCC" },
  navBtn: { flex: 1, background: "none", border: "none", padding: "10px 4px", fontFamily: F.body, fontSize: 13, fontWeight: 500, color: "#8A8272", cursor: "pointer", borderBottom: "2px solid transparent", transition: "color 0.15s, border-color 0.15s" },
  navBtnActive: { color: "#2B2A24", fontWeight: 600, borderBottom: "2px solid #3D6B4F" },
  main: { padding: "14px 14px 0" },
  section: { display: "flex", flexDirection: "column", gap: 12 },
  monthLabel: { fontFamily: F.display, fontSize: 15, color: "#8A8272", textTransform: "capitalize", marginBottom: -2, paddingLeft: 2 },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  statCard: { background: "#FBF9F3", border: "1px solid #E4DDCC", borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 },
  statIcon: { width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  statLabel: { fontSize: 11.5, color: "#8A8272", marginBottom: 1 },
  statValue: { fontFamily: F.display, fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  cardBlock: { background: "#FBF9F3", border: "1px solid #E4DDCC", borderRadius: 14, padding: 14 },
  blockTitle: { fontFamily: F.display, fontSize: 14.5, fontWeight: 600, marginBottom: 10, color: "#2B2A24" },
  personRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" },
  personName: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "#4A4739" },
  sharedNote: { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#8A8272", marginTop: 6, paddingTop: 8, borderTop: "1px solid #EEE8D8" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 0", textAlign: "center" },
  entryRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0EADB" },
  entryDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  entryDesc: { fontSize: 13.5, fontWeight: 500, color: "#2B2A24", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  entryMeta: { fontSize: 11.5, color: "#9A9282", marginTop: 1 },
  entryAmount: { fontSize: 13.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" },
  deleteBtn: { background: "none", border: "none", color: "#C4B9A0", cursor: "pointer", padding: 4, display: "flex" },
  confirmDelBtn: { background: "#A34848", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, padding: "4px 8px", cursor: "pointer" },
  cancelDelBtn: { background: "#EEE8D8", color: "#6B6459", border: "none", borderRadius: 6, fontSize: 13, padding: "4px 8px", cursor: "pointer" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  filterRow: { display: "flex", gap: 6 },
  filterChip: { fontFamily: F.body, fontSize: 12.5, padding: "6px 12px", borderRadius: 20, border: "1px solid #E4DDCC", background: "#FBF9F3", color: "#8A8272", cursor: "pointer" },
  filterChipActive: { background: "#3D6B4F", borderColor: "#3D6B4F", color: "#F4F0E6" },
  importBtn: { display: "flex", alignItems: "center", gap: 5, fontFamily: F.body, fontSize: 12.5, padding: "7px 12px", borderRadius: 20, border: "1px solid #D8CFB8", background: "#EAE3D2", color: "#4A4739", cursor: "pointer" },
  fab: { position: "fixed", bottom: 22, right: "50%", transform: "translateX(190px)", width: 56, height: 56, borderRadius: 28, background: "#3D6B4F", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 6px 18px rgba(61,107,79,0.35)", zIndex: 20 },
  newGoalBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: F.body, fontSize: 13.5, fontWeight: 600, padding: "12px", borderRadius: 12, border: "1.5px dashed #B9AE8F", background: "#FBF9F3", color: "#4A4739", cursor: "pointer" },
  goalCard: { background: "#FBF9F3", border: "1px solid #E4DDCC", borderRadius: 14, padding: 14 },
  goalTitleRow: { display: "flex", alignItems: "center", gap: 7 },
  goalTitle: { fontFamily: F.display, fontSize: 15, fontWeight: 600 },
  goalBarTrack: { height: 8, background: "#EEE8D8", borderRadius: 4, marginTop: 10, overflow: "hidden" },
  goalBarFill: { height: "100%", borderRadius: 4, transition: "width 0.3s ease" },
  goalNums: { marginTop: 7, fontSize: 13.5 },
  goalDeadline: { fontSize: 11.5, color: "#9A9282", marginTop: 2 },
  goalAddRow: { display: "flex", gap: 6, marginTop: 10 },
  goalAddInput: { flex: 1, fontFamily: F.body, fontSize: 13, padding: "8px 10px", borderRadius: 9, border: "1px solid #D8CFB8", background: "#fff" },
  goalAddBtn: { fontFamily: F.body, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 9, border: "none", background: "#3D6B4F", color: "#F4F0E6", cursor: "pointer" },
  tooltipStyle: { background: "#2B2A24", border: "none", borderRadius: 8, fontSize: 12, color: "#F4F0E6" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(43,42,36,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  modalSheet: { background: "#F4F0E6", width: "100%", maxWidth: 480, maxHeight: "88vh", overflowY: "auto", borderRadius: "20px 20px 0 0", padding: "0 0 20px" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 10px", position: "sticky", top: 0, background: "#F4F0E6", zIndex: 2 },
  modalTitle: { fontFamily: F.display, fontSize: 18, fontWeight: 600 },
  modalClose: { background: "#EAE3D2", border: "none", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6459", cursor: "pointer" },
  modalBody: { padding: "0 18px" },
  segmentRow: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  segmentBtn: { flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontFamily: F.body, fontSize: 12.5, fontWeight: 500, padding: "9px 10px", borderRadius: 10, border: "1px solid #D8CFB8", background: "#FBF9F3", color: "#6B6459", cursor: "pointer" },
  segmentBtnActiveNeg: { background: "#F3E4E0", borderColor: "#A34848", color: "#A34848" },
  segmentBtnActivePos: { background: "#E8EFE4", borderColor: "#3D6B4F", color: "#3D6B4F" },
  segmentBtnActiveNeutral: { background: "#2B2A24", borderColor: "#2B2A24", color: "#F4F0E6" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#8A8272", marginBottom: 6, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.03em" },
  amountWrap: { display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid #D8CFB8", borderRadius: 12, padding: "4px 14px", marginBottom: 14 },
  amountPrefix: { fontFamily: F.display, fontSize: 20, color: "#B5AC9C", marginRight: 4 },
  amountInput: { border: "none", background: "none", flex: 1, fontFamily: F.display, fontSize: 24, fontWeight: 600, padding: "8px 0", color: "#2B2A24", fontVariantNumeric: "tabular-nums" },
  catGrid: { display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 },
  catChip: { fontFamily: F.body, fontSize: 12.5, fontWeight: 500, padding: "7px 12px", borderRadius: 20, border: "1.5px solid", cursor: "pointer" },
  textInput: { width: "100%", fontFamily: F.body, fontSize: 14, padding: "11px 13px", borderRadius: 11, border: "1.5px solid #D8CFB8", background: "#fff", marginBottom: 14, color: "#2B2A24" },
  primaryBtn: { width: "100%", fontFamily: F.body, fontSize: 14.5, fontWeight: 600, padding: "13px", borderRadius: 12, border: "none", background: "#3D6B4F", color: "#F4F0E6", cursor: "pointer", marginTop: 4 },
  importHint: { fontSize: 12.5, color: "#6B6459", lineHeight: 1.5, marginBottom: 14, background: "#EAE3D2", padding: "10px 12px", borderRadius: 10 },
  fileDrop: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1.5px dashed #C4B9A0", borderRadius: 14, padding: "30px 10px", cursor: "pointer", marginBottom: 14, background: "#FBF9F3" },
  parseError: { display: "flex", gap: 6, alignItems: "flex-start", fontSize: 12.5, color: "#A34848", background: "#F3E4E0", padding: "9px 11px", borderRadius: 9 },
  previewList: { background: "#fff", border: "1px solid #E4DDCC", borderRadius: 10, padding: "6px 10px", marginBottom: 14 },
  previewRow: { display: "flex", fontSize: 12, padding: "5px 0", borderBottom: "1px solid #F0EADB" },
  toast: { position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", background: "#2B2A24", color: "#F4F0E6", padding: "9px 16px", borderRadius: 20, fontSize: 13, fontFamily: F.body, display: "flex", alignItems: "center", gap: 6, zIndex: 60, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" },
  errorBanner: { position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", background: "#A34848", color: "#fff", padding: "7px 14px", borderRadius: 10, fontSize: 12, display: "flex", alignItems: "center", gap: 6, zIndex: 60 },
};
