/* KPSUL -- PROGRAMME BUILDER TABLEUR */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;

  const safe = v => String(v ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[s]));

  const columns = [
    "jour",
    "exercice",
    "series",
    "reps",
    "charge",
    "repos",
    "tempo",
    "consigne"
  ];

  function normalizeHeader(h) {
    h = String(h || "").toLowerCase().trim();
    if (["jour","day","séance","seance"].includes(h)) return "jour";
    if (["exercice","exercise","mouvement"].includes(h)) return "exercice";
    if (["séries","series","sets","serie"].includes(h)) return "series";
    if (["reps","répétitions","repetitions","rep"].includes(h)) return "reps";
    if (["charge","poids","kg","load"].includes(h)) return "charge";
    if (["repos","rest"].includes(h)) return "repos";
    if (["tempo"].includes(h)) return "tempo";
    if (["consigne","note","notes","instruction","coach"].includes(h)) return "consigne";
    return h;
  }

  function parseTable(raw) {
    raw = String(raw || "").trim();
    if (!raw) return [];

    const lines = raw
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    const delimiter = raw.includes("\t") ? "\t" : raw.includes(";") ? ";" : ",";

    let rows = lines.map(line => line.split(delimiter).map(c => c.trim()));
    let headers = rows[0].map(normalizeHeader);

    const hasHeader = headers.some(h => columns.includes(h));

    if (!hasHeader) {
      headers = columns;
    } else {
      rows = rows.slice(1);
    }

    return rows.map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        if (columns.includes(h)) obj[h] = row[i] || "";
      });
      columns.forEach(c => obj[c] = obj[c] || "");
      return obj;
    }).filter(r => r.exercice || r.jour);
  }

  function tableToText(rows) {
    return rows.map(r =>
      `${r.jour || ""} | ${r.exercice || ""} | ${r.series || ""} | ${r.reps || ""} | ${r.charge || ""} | ${r.repos || ""} | ${r.tempo || ""} | ${r.consigne || ""}`
    ).join("\n");
  }

  function renderProgramTable(rows) {
    if (!rows.length) {
      return `<div class="kpsulx-item"><b>Aucun exercice</b><span>Colle un tableau depuis Numbers ou Excel.</span></div>`;
    }

    return `
      <div style="overflow:auto;margin-top:12px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr>
              <th>Jour</th>
              <th>Exercice</th>
              <th>Séries</th>
              <th>Reps</th>
              <th>Charge</th>
              <th>Repos</th>
              <th>Tempo</th>
              <th>Consigne</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${safe(r.jour)}</td>
                <td><b>${safe(r.exercice)}</b></td>
                <td>${safe(r.series)}</td>
                <td>${safe(r.reps)}</td>
                <td>${safe(r.charge)}</td>
                <td>${safe(r.repos)}</td>
                <td>${safe(r.tempo)}</td>
                <td>${safe(r.consigne)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function injectStyle() {
    if ($("kprogStyle")) return;
    const st = document.createElement("style");
    st.id = "kprogStyle";
    st.textContent = `
      #kprogPreview table th,
      #kprogPreview table td,
      .kprog-client-table th,
      .kprog-client-table td{
        border:1px solid var(--line,#22403A);
        padding:10px;
        vertical-align:top;
        text-align:left;
      }
      #kprogPreview table th,
      .kprog-client-table th{
        color:var(--core,#34E0C8);
        font-family:var(--mono,monospace);
        font-size:11px;
        text-transform:uppercase;
        letter-spacing:.08em;
        background:rgba(52,224,200,.06);
      }
      .kprog-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .kprog-muted{color:#8A9A93;font-size:13px;margin-top:8px}
    `;
    document.head.appendChild(st);
  }

  function injectAdminBuilder() {
    const adminZone = qs(".admin-zone") || qs("#adminDashboard") || qs(".client-detail");
    if (!adminZone || $("kprogBuilder")) return;

    adminZone.insertAdjacentHTML("afterbegin", `
      <div class="kpsulx-panel" id="kprogBuilder">
        <h3>📊 Programme Builder tableur</h3>
        <p>Copie ton tableau depuis Numbers / Excel, colle-le ici, choisis un client, puis envoie le programme dans son espace.</p>

        <div class="kpsulx-form">
          <select id="kprogClient">
            <option value="">Choisir un client</option>
          </select>

          <input id="kprogTitle" placeholder="Titre du programme : Programme prise de masse 4 jours">

          <input id="kprogGoal" placeholder="Objectif : prise de masse, force, recomposition...">

          <textarea id="kprogPaste" style="min-height:160px" placeholder="Colle ici ton tableau Numbers/Excel :
Jour	Exercice	Séries	Reps	Charge	Repos	Tempo	Consigne
Push	Développé couché	4	8-10	80kg	2min	3010	Garder les omoplates serrées"></textarea>

          <div class="kprog-actions">
            <button class="btn btn-ghost" id="kprogParse" type="button">Prévisualiser</button>
            <button class="btn btn-primary" id="kprogSend" type="button">Envoyer au client</button>
          </div>

          <div class="kpsulx-status" id="kprogStatus"></div>
          <div id="kprogPreview"></div>
        </div>
      </div>
    `);
  }

  function injectClientViewer() {
    const anchor = qs(".module-panel");
    if (!anchor || $("modKpsulProgramsTable")) return;

    const tabs = qs(".module-tabs");
    if (tabs && !qs('[data-module="modKpsulProgramsTable"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="module-tab" data-module="modKpsulProgramsTable" type="button">Programmes tableau</button>`
      );
    }

    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulProgramsTable">
        <div class="tool-panel">
          <h3>📊 Mes programmes</h3>
          <p>Retrouve ici les programmes envoyés par ton coach au format tableau.</p>
          <button class="btn btn-ghost" id="kprogReloadClient" type="button">Rafraîchir</button>
          <div class="kpsulx-list" id="kprogClientList"></div>
        </div>
      </div>
    `);
  }

  function hookTabs() {
    qsa("[data-module]").forEach(btn => {
      if (btn.dataset.kprogHooked) return;
      btn.dataset.kprogHooked = "1";

      btn.addEventListener("click", () => {
        const target = btn.dataset.module;
        qsa(".module-tab").forEach(b => b.classList.toggle("active", b.dataset.module === target));
        qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id === target));
        if (target === "modKpsulProgramsTable") loadClientPrograms();
      });
    });
  }

  async function loadClients() {
    const client = sb();
    const select = $("kprogClient");
    if (!client || !select) return;

    const { data, error } = await client
      .from("profiles")
      .select("id,email,full_name,role")
      .neq("role", "coach")
      .order("created_at", { ascending:false });

    if (error) {
      $("kprogStatus").textContent = "Clients indisponibles : " + error.message;
      return;
    }

    select.innerHTML = `<option value="">Choisir un client</option>` + (data || []).map(c => `
      <option value="${c.id}">
        ${safe(c.full_name || c.email || c.id)}
      </option>
    `).join("");
  }

  function preview() {
    const rows = parseTable($("kprogPaste")?.value || "");
    $("kprogPreview").innerHTML = renderProgramTable(rows);
    $("kprogStatus").textContent = rows.length
      ? `${rows.length} ligne(s) détectée(s).`
      : "Aucune ligne détectée.";
    return rows;
  }

  async function sendProgram() {
    const client = sb();
    if (!client) return;

    const userId = $("kprogClient")?.value;
    const titre = $("kprogTitle")?.value.trim();
    const objectif = $("kprogGoal")?.value.trim();
    const rows = preview();

    if (!userId) {
      $("kprogStatus").textContent = "Choisis un client.";
      return;
    }

    if (!titre) {
      $("kprogStatus").textContent = "Ajoute un titre.";
      return;
    }

    if (!rows.length) {
      $("kprogStatus").textContent = "Colle un tableau valide.";
      return;
    }

    $("kprogStatus").textContent = "Envoi du programme…";

    const payload = {
      user_id: userId,
      titre,
      objectif,
      contenu: tableToText(rows),
      program_json: rows,
      source_format: "table"
    };

    const { error } = await client.from("programs").insert(payload);

    if (error) {
      $("kprogStatus").textContent = "Erreur : " + error.message;
      return;
    }

    $("kprogStatus").textContent = "Programme envoyé au client ✔";
    $("kprogPaste").value = "";
    $("kprogTitle").value = "";
    $("kprogGoal").value = "";
    $("kprogPreview").innerHTML = "";
  }

  async function currentUserId() {
    const client = sb();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    return data?.session?.user?.id || null;
  }

  async function loadClientPrograms() {
    const client = sb();
    const box = $("kprogClientList");
    const uid = await currentUserId();

    if (!client || !box || !uid) return;

    box.innerHTML = `<div class="kpsulx-item"><b>Chargement…</b></div>`;

    const { data, error } = await client
      .from("programs")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending:false });

    if (error) {
      box.innerHTML = `<div class="kpsulx-item kpsulx-red"><b>Erreur</b><span>${safe(error.message)}</span></div>`;
      return;
    }

    if (!data?.length) {
      box.innerHTML = `<div class="kpsulx-item"><b>Aucun programme</b><span>Quand ton coach t’enverra un programme, il apparaîtra ici.</span></div>`;
      return;
    }

    box.innerHTML = data.map(p => {
      let rows = [];

      if (Array.isArray(p.program_json)) {
        rows = p.program_json;
      } else if (typeof p.program_json === "string") {
        try { rows = JSON.parse(p.program_json); } catch(e) {}
      }

      return `
        <div class="kpsulx-item">
          <b>${safe(p.titre || "Programme")}</b>
          <span>${safe(p.objectif || "")}</span>
          <span>${safe(new Date(p.created_at).toLocaleDateString("fr-FR"))}</span>

          ${rows.length
            ? `<div class="kprog-client-table">${renderProgramTable(rows)}</div>`
            : `<pre style="white-space:pre-wrap;color:#C6D0CB;margin-top:10px">${safe(p.contenu || "")}</pre>`
          }
        </div>
      `;
    }).join("");
  }

  function hookButtons() {
    $("kprogParse")?.addEventListener("click", preview);
    $("kprogSend")?.addEventListener("click", sendProgram);
    $("kprogReloadClient")?.addEventListener("click", loadClientPrograms);
  }

  function init() {
    injectStyle();
    injectAdminBuilder();
    injectClientViewer();
    hookTabs();
    hookButtons();

    setTimeout(() => {
      loadClients();
      loadClientPrograms();
    }, 600);
  }

  document.readyState === "loading"
    ? document.addEventListener("DOMContentLoaded", init)
    : init();
})();