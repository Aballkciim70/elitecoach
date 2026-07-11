/* KPSUL — COURBES DE PROGRESSION (SVG natif, zéro dépendance) */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const sb = () => window.sb || null;
  const safe = v => String(v ?? "").replace(/[&<>"']/g, s =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[s]));
  const fmtDate = d => { try { return new Date(d).toLocaleDateString("fr-FR",{day:"2-digit",month:"short"}); } catch(e) { return d||""; } };
  const round1 = n => Math.round(Number(n||0)*10)/10;
  const clamp = (v,mn,mx) => Math.max(mn, Math.min(mx, v));

  /* ─── SVG LINE CHART ───────────────────────────────────────── */
  function lineChart({ data, width=340, height=160, color="#34E0C8", label="", unit="" }) {
    if (!data?.length) return `<div style="text-align:center;color:#5E6E68;padding:20px;font-size:13px">Pas assez de données pour tracer la courbe.<br>Continue à enregistrer tes données !</div>`;
    if (data.length === 1) data = [data[0], data[0]]; // éviter division par zéro

    const pad = { top:20, right:16, bottom:34, left:44 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;

    const vals = data.map(d => d.y);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = maxV - minV || 1;

    const xScale = i => pad.left + (i / (data.length - 1)) * W;
    const yScale = v => pad.top + H - ((v - minV) / range) * H;

    // Points
    const pts = data.map((d, i) => ({ x: xScale(i), y: yScale(d.y), ...d }));

    // Polyline
    const polyline = pts.map(p => `${p.x},${p.y}`).join(" ");

    // Aire sous la courbe
    const area = `${pts[0].x},${pad.top + H} ` +
                 pts.map(p => `${p.x},${p.y}`).join(" ") +
                 ` ${pts[pts.length-1].x},${pad.top + H}`;

    // Labels Y (3 niveaux)
    const yLabels = [minV, minV + range/2, maxV].map((v, i) => ({
      v: round1(v),
      y: yScale(v)
    }));

    // Labels X (max 5 visibles)
    const step = Math.ceil(data.length / 5);
    const xLabels = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

    // Ligne de tendance (régression linéaire simple)
    const n = pts.length;
    const meanX = (n - 1) / 2;
    const meanY = pts.reduce((a, p) => a + p.y, 0) / n;
    const num = pts.reduce((a, p, i) => a + (i - meanX) * (p.y - meanY), 0);
    const den = pts.reduce((a, _, i) => a + Math.pow(i - meanX, 2), 0);
    const slope = den ? num / den : 0;
    const intercept = meanY - slope * meanX;
    const trendY1 = clamp(intercept, pad.top, pad.top + H);
    const trendY2 = clamp(slope * (n - 1) + intercept, pad.top, pad.top + H);

    // Delta total
    const delta = round1(vals[vals.length-1] - vals[0]);
    const deltaColor = delta >= 0 ? "#34E0C8" : "#E8735B";
    const deltaSign = delta >= 0 ? "+" : "";

    return `
      <div style="overflow:hidden;border-radius:14px;background:rgba(4,10,9,.32);border:1px solid rgba(52,224,200,.18);padding:12px 8px 6px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 8px 10px">
          <span style="font-family:var(--mono,monospace);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8A9A93">${safe(label)}</span>
          <span style="font-family:var(--disp,system-ui);font-size:14px;color:${deltaColor}">
            ${deltaSign}${delta} ${safe(unit)}
          </span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" style="width:100%;display:block" aria-hidden="true">
          <defs>
            <linearGradient id="kchartGrad_${label.replace(/\s/g,'')}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${color}" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
            </linearGradient>
          </defs>

          <!-- Grille -->
          ${yLabels.map(l => `
            <line x1="${pad.left}" y1="${l.y}" x2="${pad.left+W}" y2="${l.y}"
              stroke="#22403A" stroke-width="1" stroke-dasharray="4 4"/>
            <text x="${pad.left-6}" y="${l.y+4}" text-anchor="end"
              font-size="10" fill="#5E6E68" font-family="monospace">${l.v}</text>
          `).join("")}

          <!-- Aire -->
          <polygon points="${area}" fill="url(#kchartGrad_${label.replace(/\s/g,'')})" />

          <!-- Ligne de tendance -->
          <line x1="${pts[0].x}" y1="${trendY1}" x2="${pts[pts.length-1].x}" y2="${trendY2}"
            stroke="${color}" stroke-width="1" stroke-dasharray="6 4" opacity="0.4"/>

          <!-- Courbe -->
          <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/>

          <!-- Points -->
          ${pts.map((p, i) => `
            <circle cx="${p.x}" cy="${p.y}" r="${i===0||i===pts.length-1?5:3}"
              fill="${i===pts.length-1?color:"var(--ink-800,#10201D)"}"
              stroke="${color}" stroke-width="2"/>
          `).join("")}

          <!-- Labels X -->
          ${xLabels.map(p => `
            <text x="${p.x}" y="${pad.top+H+18}" text-anchor="middle"
              font-size="9" fill="#5E6E68" font-family="monospace">${fmtDate(p.label||"")}</text>
          `).join("")}

          <!-- Valeur de départ et fin -->
          <text x="${pts[0].x}" y="${pts[0].y-9}" text-anchor="middle"
            font-size="11" fill="#8A9A93" font-family="monospace">${round1(vals[0])}</text>
          <text x="${pts[pts.length-1].x}" y="${pts[pts.length-1].y-9}" text-anchor="middle"
            font-size="11" fill="${color}" font-weight="bold" font-family="monospace">${round1(vals[vals.length-1])}</text>
        </svg>
      </div>`;
  }

  /* ─── BAR CHART (habitudes) ────────────────────────────────── */
  function barChart({ data, width=340, height=120, color="#34E0C8", label="", unit="" }) {
    if (!data?.length) return `<div style="text-align:center;color:#5E6E68;padding:16px;font-size:13px">Pas encore de données.</div>`;

    const pad = { top:16, right:8, bottom:30, left:36 };
    const W = width - pad.left - pad.right;
    const H = height - pad.top - pad.bottom;
    const vals = data.map(d => d.y);
    const maxV = Math.max(...vals) || 1;
    const barW = Math.max(4, W / data.length - 3);

    return `
      <div style="overflow:hidden;border-radius:14px;background:rgba(4,10,9,.32);border:1px solid rgba(52,224,200,.12);padding:10px 6px 4px">
        <div style="padding:0 6px 8px;font-family:var(--mono,monospace);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8A9A93">${safe(label)}</div>
        <svg viewBox="0 0 ${width} ${height}" style="width:100%;display:block" aria-hidden="true">
          ${data.map((d, i) => {
            const bH = ((d.y / maxV) * H) || 2;
            const x = pad.left + i * (W / data.length) + (W/data.length - barW)/2;
            const y = pad.top + H - bH;
            return `
              <rect x="${x}" y="${y}" width="${barW}" height="${bH}"
                rx="3" fill="${color}" opacity="0.75"/>
              ${i % Math.ceil(data.length/6) === 0 ? `
                <text x="${x+barW/2}" y="${pad.top+H+16}" text-anchor="middle"
                  font-size="9" fill="#5E6E68" font-family="monospace">${fmtDate(d.label||"")}</text>` : ""}
            `;
          }).join("")}
          <text x="${pad.left-4}" y="${pad.top+6}" text-anchor="end"
            font-size="10" fill="#5E6E68" font-family="monospace">${round1(maxV)}</text>
          <text x="${pad.left-4}" y="${pad.top+H}" text-anchor="end"
            font-size="10" fill="#5E6E68" font-family="monospace">0</text>
        </svg>
      </div>`;
  }

  /* ─── MODULE PROGRESSION ───────────────────────────────────── */
  function injectChartsModule() {
    if ($("modKpsulCharts")) return;
    const anchor = qs(".module-panel");
    if (!anchor) return;

    // Ajouter le tab
    const tabs = qs(".module-tabs");
    if (tabs && !qs('[data-module="modKpsulCharts"]')) {
      tabs.insertAdjacentHTML("beforeend",
        `<button class="module-tab" data-module="modKpsulCharts" type="button">Graphes</button>`);
    }

    anchor.insertAdjacentHTML("beforebegin", `
      <div class="module-panel" id="modKpsulCharts">
        <div class="tool-panel">
          <h3>📊 Ma progression</h3>
          <p>Tes données dans le temps — poids, charges, calories, sommeil.</p>

          <!-- Sélecteur de période -->
          <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
            <button class="kcht-period active" data-days="14"  type="button">2 sem.</button>
            <button class="kcht-period"        data-days="30"  type="button">1 mois</button>
            <button class="kcht-period"        data-days="90"  type="button">3 mois</button>
            <button class="kcht-period"        data-days="180" type="button">6 mois</button>
          </div>

          <div id="kchtContent">
            <div style="text-align:center;color:#8A9A93;padding:40px 0">Chargement…</div>
          </div>
        </div>
      </div>`);

    // Style des boutons période
    const style = document.createElement("style");
    style.textContent = `
      .kcht-period {
        border:1px solid var(--line,#22403A);background:none;
        color:#8A9A93;border-radius:99px;padding:7px 14px;
        font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;
        cursor:pointer;transition:.18s;
      }
      .kcht-period.active,.kcht-period:hover {
        border-color:var(--core,#34E0C8);color:var(--core,#34E0C8);
        background:rgba(52,224,200,.08);
      }
      .kcht-section { margin-bottom:24px }
      .kcht-section h4 {
        font-family:var(--mono,monospace);font-size:11px;letter-spacing:.12em;
        text-transform:uppercase;color:#8A9A93;margin-bottom:10px;
      }
      .kcht-exo-select {
        width:100%;margin-bottom:10px;font-size:14px;
      }
      .kcht-stat-row {
        display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;
      }
      .kcht-stat {
        border:1px solid var(--line,#22403A);border-radius:12px;
        padding:12px;background:rgba(255,255,255,.02);text-align:center;
      }
      .kcht-stat b { display:block;font-family:var(--disp,system-ui);
        font-size:18px;color:var(--core,#34E0C8) }
      .kcht-stat span { font-size:11px;color:#8A9A93 }
      .kcht-photos { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px }
      .kcht-photo { border-radius:12px;border:1px solid var(--line,#22403A);width:100%;aspect-ratio:3/4;object-fit:cover;display:block }
      .kcht-photo-label { font-size:11px;color:#8A9A93;text-align:center;margin-top:5px }
    `;
    document.head.appendChild(style);

    // Boutons période
    qsa(".kcht-period").forEach(btn => {
      btn.addEventListener("click", () => {
        qsa(".kcht-period").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        loadChartsData(Number(btn.dataset.days));
      });
    });

    // Hook onglet
    qsa('[data-module="modKpsulCharts"]').forEach(btn => {
      if (btn.dataset.chartHooked) return; btn.dataset.chartHooked = "1";
      btn.addEventListener("click", () => {
        qsa(".module-tab").forEach(b => b.classList.toggle("active", b.dataset.module==="modKpsulCharts"));
        qsa(".module-panel").forEach(p => p.classList.toggle("active", p.id==="modKpsulCharts"));
        loadChartsData(14);
      });
    });
  }

  async function loadChartsData(days = 14) {
    const client = sb(); const box = $("kchtContent");
    if (!client || !box) return;
    box.innerHTML = `<div style="text-align:center;color:#8A9A93;padding:30px 0">Chargement…</div>`;

    const { data: sess } = await client.auth.getSession();
    const uid = sess?.session?.user?.id; if (!uid) return;
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

    const [mRes, wRes, nRes, hRes] = await Promise.all([
      client.from("body_measurements").select("log_date,weight_kg,waist_cm,arm_cm,photo_path")
        .eq("user_id", uid).gte("log_date", since).order("log_date"),
      client.from("workout_exercise_logs").select("log_date,exercise_name,load_kg,sets,reps")
        .eq("user_id", uid).gte("log_date", since).order("log_date"),
      client.from("nutrition_logs").select("log_date,calories,protein_g")
        .eq("user_id", uid).gte("log_date", since).order("log_date"),
      client.from("habit_logs").select("log_date,sleep_hours,energy_level")
        .eq("user_id", uid).gte("log_date", since).order("log_date"),
    ]);

    const measures  = mRes.data || [];
    const workouts  = wRes.data || [];
    const nutrition = nRes.data || [];
    const habits    = hRes.data || [];

    // Aggréger nutrition par jour
    const nutByDay = {};
    nutrition.forEach(n => {
      if (!nutByDay[n.log_date]) nutByDay[n.log_date] = { kcal: 0, prot: 0 };
      nutByDay[n.log_date].kcal += Number(n.calories || 0);
      nutByDay[n.log_date].prot += Number(n.protein_g || 0);
    });

    // Exercices uniques pour le sélecteur
    const exoNames = [...new Set(workouts.map(w => w.exercise_name).filter(Boolean))].sort();

    // Stats rapides
    const lastW = measures.filter(m => m.weight_kg).pop();
    const firstW = measures.filter(m => m.weight_kg)[0];
    const deltaPoids = (lastW && firstW) ? round1(lastW.weight_kg - firstW.weight_kg) : null;
    const nbSeances = [...new Set(workouts.map(w => w.log_date))].length;
    const totalKcal = nutrition.reduce((a, n) => a + Number(n.calories||0), 0);
    const avgKcal = nbSeances ? round1(totalKcal / Object.keys(nutByDay).length) : null;

    // Photos avant/après
    const photos = measures.filter(m => m.photo_path);
    const firstPhoto = photos[0];
    const lastPhoto  = photos[photos.length - 1];
    let photosHtml = "";
    if (firstPhoto && lastPhoto && firstPhoto.photo_path !== lastPhoto.photo_path) {
      const [url1, url2] = await Promise.all([
        getSignedUrl(client, firstPhoto.photo_path),
        getSignedUrl(client, lastPhoto.photo_path),
      ]);
      if (url1 && url2) {
        photosHtml = `
          <div class="kcht-section">
            <h4>📸 Avant / Après</h4>
            <div class="kcht-photos">
              <div>
                <img class="kcht-photo" src="${url1}" alt="Photo avant">
                <div class="kcht-photo-label">${fmtDate(firstPhoto.log_date)}</div>
              </div>
              <div>
                <img class="kcht-photo" src="${url2}" alt="Photo après">
                <div class="kcht-photo-label">Aujourd'hui</div>
              </div>
            </div>
          </div>`;
      }
    }

    // Construire les données pour les charts
    const weightData = measures.filter(m => m.weight_kg).map(m => ({
      label: m.log_date, y: round1(m.weight_kg)
    }));
    const nutData = Object.entries(nutByDay).map(([d, v]) => ({
      label: d, y: round1(v.kcal)
    }));
    const sleepData = habits.filter(h => h.sleep_hours).map(h => ({
      label: h.log_date, y: round1(h.sleep_hours)
    }));

    box.innerHTML = `
      <!-- Stats rapides -->
      <div class="kcht-stat-row">
        <div class="kcht-stat">
          <b>${deltaPoids !== null ? (deltaPoids >= 0 ? "+" : "") + deltaPoids + " kg" : "—"}</b>
          <span>Poids (${days}j)</span>
        </div>
        <div class="kcht-stat">
          <b>${nbSeances || "—"}</b>
          <span>Séances</span>
        </div>
        <div class="kcht-stat">
          <b>${avgKcal || "—"}</b>
          <span>kcal/jour moy.</span>
        </div>
      </div>

      ${photosHtml}

      <!-- Poids -->
      <div class="kcht-section">
        <h4>⚖️ Évolution du poids (kg)</h4>
        ${lineChart({ data: weightData, label:"Poids", unit:"kg", color:"#34E0C8" })}
      </div>

      <!-- Charges par exercice -->
      ${exoNames.length ? `
      <div class="kcht-section">
        <h4>💪 Progression des charges</h4>
        <select class="kcht-exo-select" id="kchtExoSelect">
          ${exoNames.map(n => `<option value="${safe(n)}">${safe(n)}</option>`).join("")}
        </select>
        <div id="kchtExoChart"></div>
      </div>` : ""}

      <!-- Calories -->
      <div class="kcht-section">
        <h4>🍽 Calories / jour (kcal)</h4>
        ${barChart({ data: nutData, label:"Kcal par jour", unit:"kcal", color:"#E7D9C4" })}
      </div>

      <!-- Sommeil -->
      <div class="kcht-section">
        <h4>😴 Sommeil (heures)</h4>
        ${barChart({ data: sleepData, label:"Sommeil", unit:"h", color:"#8A9A93" })}
      </div>

      <!-- Mensurations -->
      ${measures.filter(m => m.waist_cm).length >= 2 ? `
      <div class="kcht-section">
        <h4>📏 Tour de taille (cm)</h4>
        ${lineChart({
          data: measures.filter(m => m.waist_cm).map(m => ({ label: m.log_date, y: round1(m.waist_cm) })),
          label:"Taille", unit:"cm", color:"#E8735B"
        })}
      </div>` : ""}
    `;

    // Hook sélecteur d'exercice
    const exoSel = $("kchtExoSelect");
    if (exoSel) {
      function renderExoChart() {
        const name = exoSel.value;
        const exoData = workouts.filter(w => w.exercise_name === name && w.load_kg)
          .map(w => ({ label: w.log_date, y: round1(w.load_kg) }));
        const chartBox = $("kchtExoChart");
        if (chartBox) chartBox.innerHTML = lineChart({ data: exoData, label: name, unit:"kg", color:"#34E0C8" });
      }
      exoSel.addEventListener("change", renderExoChart);
      renderExoChart();
    }
  }

  async function getSignedUrl(client, path) {
    try {
      const { data } = await client.storage.from("progress-photos").createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    } catch(e) { return null; }
  }

  /* ─── MISE À JOUR DE LA CARTE DU MENU ─────────────────────── */
  function addChartCard() {
    // Si la carte "Mon évolution" n'existe pas encore on l'ajoute
    if (qs('[data-goto="modKpsulCharts"]')) return;
    const tilesGrid = qs(".member-tiles");
    if (!tilesGrid) return;
    const card = document.createElement("div");
    card.className = "mtile";
    card.dataset.goto = "modKpsulCharts";
    card.setAttribute("role","button");
    card.setAttribute("tabindex","0");
    card.innerHTML = `<div class="tag">Progression</div><h4>Mes graphes</h4><p>Poids, charges, calories, sommeil dans le temps.</p><span class="mtile-go">Ouvrir →</span>`;
    tilesGrid.appendChild(card);
  }

  /* ─── INIT ─────────────────────────────────────────────────── */
  function init() {
    injectChartsModule();
    addChartCard();
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed")) init();
  }).observe(document.body, { attributeFilter: ["class"] });

  // Ouvrir via le router
  document.addEventListener("click", e => {
    const tile = e.target.closest("[data-goto]");
    if (tile?.dataset.goto === "modKpsulCharts") {
      setTimeout(() => { init(); loadChartsData(14); }, 200);
    }
  });

  if (document.body.classList.contains("authed")) init();
})();
