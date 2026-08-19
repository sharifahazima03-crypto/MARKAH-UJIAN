// 1) Deploy Code.gs sebagai Google Apps Script Web App.
// 2) Tampal URL deployment di bawah.
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbztkjVEcQ-NWHrzsQWsMIRPb05JEtKAuoGs8SatuUFSZPyR0qJRGzGmTGl5q8FSROgJ/exec"
}

const state = { masters: { murid: [], guru: [], kelas: [], subjek: [] }, records: [] };
const $ = (id) => document.getElementById(id);
const els = {
  status: $("statusPill"), tarikh: $("tarikh"), guru: $("guru"), kelas: $("kelas"), subjek: $("subjek"),
  muridBody: $("muridBody"), rekodInfo: $("rekodInfo"), simpan: $("simpanRekod"),
  filterKelas: $("filterKelas"), filterSubjek: $("filterSubjek"), filterGuru: $("filterGuru"), filterMurid: $("filterMurid"),
  filterMula: $("filterMula"), filterAkhir: $("filterAkhir"), reportBody: $("reportBody")
};

function toast(message, isError = false) {
  const t = $("toast"); t.textContent = message; t.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.className = "toast", 2800);
}
function todayISO() { return new Date().toISOString().slice(0,10); }
function escapeHTML(v="") { return String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function grade(mark) {
  const m = Number(mark); if (!Number.isFinite(m)) return "-";
  if (m >= 80) return "A"; if (m >= 65) return "B"; if (m >= 50) return "C"; if (m >= 40) return "D"; return "E";
}
function setOptions(select, values, placeholder, valueKey=null, labelKey=null) {
  select.innerHTML = `<option value="">${placeholder}</option>` + values.map(v => {
    const value = valueKey ? v[valueKey] : v; const label = labelKey ? v[labelKey] : v;
    return `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;
  }).join("");
}
async function apiGet(action, params={}) {
  if (!CONFIG.API_URL || CONFIG.API_URL.includes("PASTE_")) throw new Error("URL Google Apps Script belum dimasukkan dalam script.js.");
  const url = new URL(CONFIG.API_URL); url.searchParams.set("action", action);
  Object.entries(params).forEach(([k,v]) => { if (v !== "" && v != null) url.searchParams.set(k,v); });
  const r = await fetch(url.toString(), { method: "GET", redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}
async function apiPost(action, data={}) {
  const body = new URLSearchParams({ action, ...data });
  const r = await fetch(CONFIG.API_URL, { method: "POST", body, redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json();
}

async function boot() {
  els.tarikh.value = todayISO();
  try {
    const data = await apiGet("bootstrap");
    if (!data.ok) throw new Error(data.message || "Gagal memuat data");
    state.masters = data.masters; state.records = data.records || [];
    populateMasters(); renderStudents(); renderReport();
    els.status.textContent = "Google Sheet berjaya disambungkan"; els.status.className = "status-pill ok";
  } catch (e) {
    els.status.textContent = e.message; els.status.className = "status-pill error";
    toast(e.message, true);
  }
}
function populateMasters() {
  setOptions(els.guru, state.masters.guru, "Pilih guru", "nama", "nama");
  setOptions(els.kelas, state.masters.kelas, "Pilih kelas");
  setOptions(els.subjek, state.masters.subjek, "Pilih subjek", "subjek", "subjek");
  setOptions(els.filterKelas, state.masters.kelas, "Semua Kelas");
  setOptions(els.filterSubjek, state.masters.subjek, "Semua Subjek", "subjek", "subjek");
  setOptions(els.filterGuru, state.masters.guru, "Semua Guru", "nama", "nama");
  setOptions(els.filterMurid, state.masters.murid, "Semua Murid", "nama", "nama");
}
function renderStudents() {
  const kelas = els.kelas.value; const students = state.masters.murid.filter(m => m.kelas === kelas);
  if (!kelas) { els.muridBody.innerHTML = `<tr><td colspan="4" class="empty">Pilih kelas untuk memaparkan senarai murid.</td></tr>`; updateFilledInfo(); return; }
  if (!students.length) { els.muridBody.innerHTML = `<tr><td colspan="4" class="empty">Tiada murid ditemui untuk kelas ini.</td></tr>`; updateFilledInfo(); return; }
  els.muridBody.innerHTML = students.map((m,i) => `<tr data-id="${escapeHTML(m.id)}">
    <td>${i+1}</td><td><strong>${escapeHTML(m.nama)}</strong></td>
    <td><input class="mark-input" type="number" min="0" max="100" step="1" inputmode="numeric" placeholder="0 - 100" data-student="${escapeHTML(m.id)}"></td>
    <td><span class="grade-badge">-</span></td></tr>`).join("");
  document.querySelectorAll(".mark-input").forEach(inp => inp.addEventListener("input", e => {
    const v = e.target.value; const badge = e.target.closest("tr").querySelector(".grade-badge");
    badge.textContent = v === "" ? "-" : grade(v); updateFilledInfo();
  }));
  updateFilledInfo();
}
function updateFilledInfo() {
  const count = [...document.querySelectorAll(".mark-input")].filter(i => i.value !== "").length;
  els.rekodInfo.textContent = count ? `${count} markah sedia untuk disimpan.` : "Tiada markah diisi.";
}
function collectBatch() {
  const tarikh = els.tarikh.value, guru = els.guru.value, kelas = els.kelas.value, subjek = els.subjek.value;
  if (!tarikh || !guru || !kelas || !subjek) throw new Error("Sila pilih tarikh, guru, kelas dan subjek.");
  const items = [...document.querySelectorAll(".mark-input")].filter(i => i.value !== "").map(inp => {
    const m = state.masters.murid.find(x => x.id === inp.dataset.student); const markah = Number(inp.value);
    if (markah < 0 || markah > 100) throw new Error(`Markah ${m.nama} mesti antara 0 hingga 100.`);
    return { idMurid: m.id, namaMurid: m.nama, markah, gred: grade(markah) };
  });
  if (!items.length) throw new Error("Sila isi sekurang-kurangnya satu markah.");
  return { tarikh, guru, kelas, subjek, items };
}
async function saveBatch() {
  try {
    const payload = collectBatch(); els.simpan.disabled = true; els.simpan.textContent = "Menyimpan...";
    const data = await apiPost("saveBatch", { payload: JSON.stringify(payload) });
    if (!data.ok) throw new Error(data.message || "Gagal menyimpan");
    toast(`${data.saved} rekod berjaya disimpan.`);
    document.querySelectorAll(".mark-input").forEach(i => i.value = ""); renderStudents();
    await refreshRecords();
  } catch (e) { toast(e.message, true); }
  finally { els.simpan.disabled = false; els.simpan.textContent = "Simpan Rekod"; }
}
async function refreshRecords() {
  const data = await apiGet("records"); if (!data.ok) throw new Error(data.message || "Gagal memuat rekod");
  state.records = data.records || []; renderReport();
}
function filteredRecords() {
  const fk=els.filterKelas.value, fs=els.filterSubjek.value, fg=els.filterGuru.value, fm=els.filterMurid.value, start=els.filterMula.value, end=els.filterAkhir.value;
  return state.records.filter(r => (!fk||r.kelas===fk) && (!fs||r.subjek===fs) && (!fg||r.guru===fg) && (!fm||r.namaMurid===fm) && (!start||r.tarikh>=start) && (!end||r.tarikh<=end));
}
function renderReport() {
  const rows = filteredRecords();
  $("reportGenerated").textContent = `Dikemas kini: ${new Date().toLocaleString("ms-MY")}`;
  $("statJumlah").textContent = rows.length;
  const marks = rows.map(r=>Number(r.markah)).filter(Number.isFinite);
  $("statPurata").textContent = marks.length ? (marks.reduce((a,b)=>a+b,0)/marks.length).toFixed(1) : "0";
  $("statTinggi").textContent = marks.length ? Math.max(...marks) : "0"; $("statRendah").textContent = marks.length ? Math.min(...marks) : "0";
  if (!rows.length) { els.reportBody.innerHTML = `<tr><td colspan="9" class="empty">Belum ada rekod untuk tapisan semasa.</td></tr>`; return; }
  els.reportBody.innerHTML = rows.map((r,i)=>`<tr>
    <td>${i+1}</td><td>${escapeHTML(formatDate(r.tarikh))}</td><td>${escapeHTML(r.namaMurid)}</td><td>${escapeHTML(r.guru)}</td>
    <td>${escapeHTML(r.kelas)}</td><td>${escapeHTML(r.subjek)}</td><td><strong>${escapeHTML(r.markah)}</strong></td><td>${escapeHTML(r.gred)}</td>
    <td class="no-print"><div class="action-group"><button class="btn small edit-btn" data-id="${escapeHTML(r.id)}" data-mark="${escapeHTML(r.markah)}">Edit Markah</button><button class="btn small danger delete-btn" data-id="${escapeHTML(r.id)}">Padam</button></div></td></tr>`).join("");
  document.querySelectorAll(".edit-btn").forEach(b => b.onclick = () => editMark(b.dataset.id, b.dataset.mark));
  document.querySelectorAll(".delete-btn").forEach(b => b.onclick = () => deleteRecord(b.dataset.id));
}
function formatDate(iso) { if (!iso) return ""; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; }
async function editMark(id, oldMark) {
  const input = prompt("Masukkan markah baharu (0 - 100):", oldMark); if (input === null) return;
  const markah = Number(input); if (!Number.isFinite(markah) || markah < 0 || markah > 100) return toast("Markah mesti antara 0 hingga 100.", true);
  try { const d = await apiPost("updateMark", { id, markah: String(markah), gred: grade(markah) }); if (!d.ok) throw new Error(d.message); toast("Markah berjaya dikemas kini."); await refreshRecords(); }
  catch(e){ toast(e.message, true); }
}
async function deleteRecord(id) {
  if (!confirm("Padam rekod ini?")) return;
  try { const d = await apiPost("deleteRecord", { id }); if (!d.ok) throw new Error(d.message); toast("Rekod dipadam."); await refreshRecords(); }
  catch(e){ toast(e.message, true); }
}
function resetFilters() { [els.filterKelas,els.filterSubjek,els.filterGuru,els.filterMurid,els.filterMula,els.filterAkhir].forEach(e=>e.value=""); renderReport(); }

// Tabs
[...document.querySelectorAll(".tab-btn")].forEach(btn => btn.onclick = () => {
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active")); $("tab-"+btn.dataset.tab).classList.add("active");
  if (btn.dataset.tab === "dashboard") renderReport();
});
els.kelas.addEventListener("change", renderStudents); els.simpan.addEventListener("click", saveBatch);
$("kosongkanMarkah").onclick = () => { document.querySelectorAll(".mark-input").forEach(i=>i.value=""); renderStudents(); };
[els.filterKelas,els.filterSubjek,els.filterGuru,els.filterMurid,els.filterMula,els.filterAkhir].forEach(e => e.addEventListener("change", renderReport));
$("resetFilter").onclick = resetFilters; $("cetakLaporan").onclick = () => window.print();
boot();
