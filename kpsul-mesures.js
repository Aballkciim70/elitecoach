/* KPSUL — MENSURATIONS (poids, mesures, photos de progression) */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
  const getSb = () => window.sb || null;
  let me = null;

  function status(msg, err = false) {
    const el = $("kmesStatus"); if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("kpsulx-error", !!err);
  }
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("fr-FR"); } catch (e) { return ""; } };
  const val = id => { const v = $(id)?.value.trim(); return v === "" || v == null ? null : Number(v); };

  /* ---------- style ---------- */
  function injectStyle() {
    if ($("kmesStyle")) return;
    const st = document.createElement("style");
    st.id = "kmesStyle";
    st.textContent = `
      .kmes-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .kmes-grid .full{grid-column:1/-1}
      .kmes-field label{display:block;font-size:12.5px;color:#8A9A93;margin:0 0 5px}
      .kmes-entry{border:1px solid var(--line,#22403A);border-radius:14px;background:rgba(255,255,255,.025);padding:14px;margin-top:10px}
      .kmes-entry b{font-family:var(--disp,system-ui);color:var(--core,#34E0C8)}
      .kmes-vals{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .kmes-pill{border:1px solid var(--line,#22403A);border-radius:99px;padding:4px 11px;font-size:12.5px;color:#C6D0CB}
      .kmes-photo{margin-top:10px;max-width:180px;border-radius:12px;border:1px solid var(--line,#22403A);display:block}
      .kmes-note{color:#8A9A93;font-size:13px;margin-top:8px;white-space:pre-wrap}
      .kmes-del{margin-top:10px;border:1px solid var(--line,#22403A);background:none;color:#8A9A93;border-radius:99px;padding:5px 12px;font-size:12px;cursor:pointer}
      .kmes-del:hover{border-color:#E8735B;color:#E8735B}
      @media(max-width:560px){.kmes-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(st);
  }

  /* ---------- injection ---------- */
  function injectModule() {
    const tabs = qs(".module-tabs");
    if (tabs && !qs('[data-module="modKpsulMesures"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="module-tab" data-module="modKpsulMesures" type="button">Mensurations</button>`);
    }
    const anchor = qs(".module-panel");
    if (!anchor || $("modKpsulMesures")) return;
    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulMesures">
        <div class="tool-panel">
          <h3>📏 Mensurations</h3>
          <p>Note tes mesures régulièrement (idéalement le matin, à jeun, une fois par semaine) et ajoute une photo pour visualiser ta progression.</p>
          <div class="kpsulx-form">
            <div class="kmes-grid">
              <div class="kmes-field"><label for="kmesDate">Date</label><input id="kmesDate" type="date"></div>
              <div class="kmes-field"><label for="kmesWeight">Poids (kg)</label><input id="kmesWeight" type="number" step="0.1" min="30" max="300" placeholder="74.5"></div>
              <div class="kmes-field"><label for="kmesWaist">Tour de taille (cm)</label><input id="kmesWaist" type="number" step="0.5" min="40" max="200" placeholder="82"></div>
              <div class="kmes-field"><label for="kmesChest">Poitrine (cm)</label><input id="kmesChest" type="number" step="0.5" min="50" max="200" placeholder="102"></div>
              <div class="kmes-field"><label for="kmesArm">Bras (cm)</label><input id="kmesArm" type="number" step="0.5" min="15" max="70" placeholder="36"></div>
              <div class="kmes-field"><label for="kmesThigh">Cuisse (cm)</label><input id="kmesThigh" type="number" step="0.5" min="30" max="110" placeholder="58"></div>
              <div class="kmes-field"><label for="kmesHips">Hanches (cm)</label><input id="kmesHips" type="number" step="0.5" min="50" max="200" placeholder="96"></div>
              <div class="kmes-field"><label for="kmesPhoto">Photo (optionnel)</label><input id="kmesPhoto" type="file" accept="image/*"></div>
              <div class="kmes-field full"><label for="kmesNote">Note (optionnel)</label><textarea id="kmesNote" placeholder="Ressenti, contexte, objectif de la semaine..."></textarea></div>
            </div>
            <button class="btn btn-primary" id="kmesSave" type="button">Enregistrer mes mesures</button>
            <div class="kpsulx-status" id="kmesStatus"></div>
          </div>
          <div id="kmesList"></div>
        </div>
      </div>`);
    const d = $("kmesDate"); if (d) d.value = new Date().toISOString().slice(0, 10);
  }

  function hookTab() {
    qsa('[data-module="modKpsulMesures"]').forEach(btn => {
      if (btn.dataset.kmesHooked) return; btn.dataset.kmesHooked = "1";
      btn.addEventListener("click", () => {
        qsa(".module-tab").forEach(b => b.classList.toggle("active", b.dataset.module === "modKpsulMesures"));
        qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id === "modKpsulMesures"));
        loadEntries();
      });
    });
  }

  /* ---------- données ---------- */
  async function loadMe() {
    const sb = getSb(); if (!sb) return null;
    try {
      const { data: s } = await sb.auth.getSession();
      const uid = s?.session?.user?.id; if (!uid) return null;
      me = { id: uid };
      return me;
    } catch (e) { return null; }
  }

  async function uploadPhoto(file) {
    const sb = getSb(); if (!sb || !me || !file) return null;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${me.id}/${Date.now()}.${ext}`;
    const { error } = await sb.storage.from("progress-photos").upload(path, file, { upsert: false });
    if (error) throw new Error("photo : " + error.message);
    return path;
  }

  async function saveEntry() {
    const sb = getSb(); if (!sb) return;
    await loadMe();
    if (!me) { status("Connecte-toi pour enregistrer.", true); return; }
    const weight = val("kmesWeight"), waist = val("kmesWaist"), chest = val("kmesChest"),
          arm = val("kmesArm"), thigh = val("kmesThigh"), hips = val("kmesHips");
    if ([weight, waist, chest, arm, thigh, hips].every(v => v == null)) {
      status("Renseigne au moins une mesure.", true); return;
    }
    const btn = $("kmesSave"); btn.disabled = true;
    status("Enregistrement…");
    try {
      let photo_path = null;
      const file = $("kmesPhoto")?.files?.[0];
      if (file) { status("Envoi de la photo…"); photo_path = await uploadPhoto(file); }
      const { error } = await sb.from("body_measurements").insert({
        user_id: me.id,
        log_date: $("kmesDate")?.value || new Date().toISOString().slice(0, 10),
        weight_kg: weight, waist_cm: waist, chest_cm: chest,
        arm_cm: arm, thigh_cm: thigh, hips_cm: hips,
        note: $("kmesNote")?.value.trim() || null,
        photo_path
      });
      if (error) throw new Error(error.message);
      ["kmesWeight","kmesWaist","kmesChest","kmesArm","kmesThigh","kmesHips","kmesNote","kmesPhoto"].forEach(id => { const el = $(id); if (el) el.value = ""; });
      status("Mesures enregistrées ✔");
      if (weight != null) syncLastWeight(weight);
      loadEntries();
    } catch (e) {
      status("Erreur : " + e.message, true);
    } finally { btn.disabled = false; }
  }

  function syncLastWeight(w) {
    const el = $("lastWeight");
    if (el && w != null) el.textContent = w + " kg";
  }

  async function loadEntries() {
    const sb = getSb(), box = $("kmesList"); if (!sb || !box) return;
    await loadMe(); if (!me) return;
    box.innerHTML = `<div class="kpsulx-item"><b>Chargement…</b></div>`;
    const { data, error } = await sb.from("body_measurements")
      .select("*").eq("user_id", me.id)
      .order("log_date", { ascending: false }).order("created_at", { ascending: false }).limit(30);
    if (error) { box.innerHTML = `<div class="kpsulx-item kpsulx-red"><b>Historique indisponible</b><span>${safe(error.message)}</span></div>`; return; }
    if (!data?.length) { box.innerHTML = `<div class="kpsulx-item" style="margin-top:14px"><b>Aucune mesure pour l'instant</b><span>Ta première entrée devient ton point de départ — c'est elle qui rendra ta progression visible.</span></div>`; return; }
    const latestW = data.find(e => e.weight_kg != null);
    if (latestW) syncLastWeight(latestW.weight_kg);
    box.innerHTML = data.map(e => {
      const pills = [
        e.weight_kg != null ? `Poids ${e.weight_kg} kg` : null,
        e.waist_cm != null ? `Taille ${e.waist_cm} cm` : null,
        e.chest_cm != null ? `Poitrine ${e.chest_cm} cm` : null,
        e.arm_cm != null ? `Bras ${e.arm_cm} cm` : null,
        e.thigh_cm != null ? `Cuisse ${e.thigh_cm} cm` : null,
        e.hips_cm != null ? `Hanches ${e.hips_cm} cm` : null
      ].filter(Boolean).map(t => `<span class="kmes-pill">${safe(t)}</span>`).join("");
      return `<div class="kmes-entry" data-kmes-id="${e.id}">
        <b>${fmtDate(e.log_date || e.created_at)}</b>
        <div class="kmes-vals">${pills || '<span class="kmes-pill">—</span>'}</div>
        ${e.photo_path ? `<img class="kmes-photo" data-kmes-photo="${safe(e.photo_path)}" alt="Photo de progression">` : ""}
        ${e.note ? `<div class="kmes-note">${safe(e.note)}</div>` : ""}
        <button class="kmes-del" data-kmes-del="${e.id}" type="button">Supprimer</button>
      </div>`;
    }).join("");
    // photos privées : liens signés
    qsa("[data-kmes-photo]", box).forEach(async img => {
      try {
        const { data: signed } = await sb.storage.from("progress-photos").createSignedUrl(img.dataset.kmesPhoto, 3600);
        if (signed?.signedUrl) img.src = signed.signedUrl; else img.remove();
      } catch (e) { img.remove(); }
    });
    qsa("[data-kmes-del]", box).forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Supprimer cette entrée ?")) return;
      await sb.from("body_measurements").delete().eq("id", b.dataset.kmesDel);
      loadEntries();
    }));
  }

  /* ---------- init ---------- */
  function init() {
    injectStyle();
    injectModule();
    hookTab();
    $("kmesSave")?.addEventListener("click", saveEntry);
    setTimeout(loadEntries, 800);
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
