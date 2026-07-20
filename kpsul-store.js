/* ============================================================
   KPSUL STORE — NOYAU DE DONNÉES CENTRAL
   Une seule source de vérité pour tout le client.
   • charge les données UNE fois, les garde en mémoire
   • tous les modules lisent depuis le store (plus de requêtes en double)
   • quand une donnée change, le store prévient TOUS les modules
   • couche additive : n'écrase aucun module existant
   API :  window.KpsulStore
     .ready()                 -> Promise résolue quand les données sont chargées
     .get(key)                -> données en cache (workouts, meals, habits, measures, goals, score…)
     .getLatest('weight')     -> raccourci vers la dernière valeur connue
     .subscribe(key, fn)      -> écoute les changements d'une clé ('*' = tout)
     .refresh(key?)           -> recharge depuis Supabase (une clé ou tout)
     .notifyChange(key, opts) -> à appeler après une écriture pour propager
   ============================================================ */
(() => {
  "use strict";

  const sb = () => window.sb || null;
  const today = () => new Date().toISOString().slice(0, 10);
  const daysBack = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  // Définition des sources : clé -> requête Supabase (bornée à l'utilisateur)
  const SOURCES = {
    workouts: (c, uid) => c.from("workout_exercise_logs").select("*")
      .eq("user_id", uid).gte("log_date", daysBack(120)).order("log_date", { ascending: false }),
    meals: (c, uid) => c.from("nutrition_logs").select("*")
      .eq("user_id", uid).gte("log_date", daysBack(120)).order("log_date", { ascending: false }),
    habits: (c, uid) => c.from("habit_logs").select("*")
      .eq("user_id", uid).gte("log_date", daysBack(120)).order("log_date", { ascending: false }),
    measures: (c, uid) => c.from("body_measurements").select("*")
      .eq("user_id", uid).order("log_date", { ascending: true }),
    goals: (c, uid) => c.from("client_goals").select("*")
      .eq("user_id", uid).order("created_at", { ascending: false }),
    score: (c, uid) => c.from("kpsul_score_daily").select("*")
      .eq("user_id", uid).order("score_date", { ascending: false }).limit(60),
    bookings: (c, uid) => c.from("bookings").select("*")
      .eq("user_id", uid).order("jour", { ascending: false }),
    profile: (c, uid) => c.from("profiles").select("*").eq("id", uid).limit(1),
  };

  // Quelle source une table alimente (pour propager après écriture)
  const TABLE_TO_KEY = {
    workout_exercise_logs: "workouts",
    nutrition_logs: "meals",
    habit_logs: "habits",
    body_measurements: "measures",
    client_goals: "goals",
    kpsul_score_daily: "score",
    bookings: "bookings",
    profiles: "profile",
  };

  const cache = {};                 // key -> array de lignes
  const subscribers = new Map();    // key -> Set(fn)
  let uid = null;
  let readyResolve;
  const readyPromise = new Promise(r => { readyResolve = r; });
  let loadedOnce = false;
  let loading = false;

  /* ─── LECTURE ──────────────────────────────────────────────── */
  function get(key) {
    return cache[key] ? (Array.isArray(cache[key]) ? cache[key].slice() : cache[key]) : [];
  }

  // Raccourcis métier : la dernière valeur connue d'une donnée transversale
  function getLatest(what) {
    switch (what) {
      case "weight": {
        const m = (cache.measures || []).filter(x => x.weight_kg != null);
        return m.length ? Number(m[m.length - 1].weight_kg) : null;
      }
      case "weightDate": {
        const m = (cache.measures || []).filter(x => x.weight_kg != null);
        return m.length ? m[m.length - 1].log_date : null;
      }
      case "sleep": {
        const h = (cache.habits || []).filter(x => x.sleep_hours != null);
        return h.length ? Number(h[0].sleep_hours) : null;
      }
      case "calories": {
        const t = (cache.meals || []).filter(x => x.log_date === today());
        return t.length ? t.reduce((a, b) => a + Number(b.calories || 0), 0) : null;
      }
      case "lastWorkout": {
        const w = cache.workouts || [];
        return w.length ? (w[0].exercise_name || null) : null;
      }
      case "score": {
        const s = cache.score || [];
        return s.length ? Number(s[0].global_score) : null;
      }
      case "goalWeight": {
        const g = (cache.goals || [])[0];
        return g?.target_weight_kg != null ? Number(g.target_weight_kg) : null;
      }
      default: return null;
    }
  }

  /* ─── ABONNEMENTS ──────────────────────────────────────────── */
  function subscribe(key, fn) {
    if (typeof fn !== "function") return () => {};
    if (!subscribers.has(key)) subscribers.set(key, new Set());
    subscribers.get(key).add(fn);
    // Si déjà chargé, notifier tout de suite pour un premier rendu
    if (loadedOnce && key !== "*" && cache[key] !== undefined) {
      try { fn({ key, data: get(key), reason: "subscribe" }); } catch (e) { console.warn(e); }
    }
    return () => subscribers.get(key)?.delete(fn);
  }

  function publish(key, reason) {
    const payload = { key, data: get(key), reason };
    subscribers.get(key)?.forEach(fn => { try { fn(payload); } catch (e) { console.warn("KpsulStore sub", e); } });
    subscribers.get("*")?.forEach(fn => { try { fn(payload); } catch (e) { console.warn("KpsulStore sub*", e); } });
  }

  /* ─── CHARGEMENT ───────────────────────────────────────────── */
  async function ensureUid() {
    if (uid) return uid;
    const c = sb(); if (!c) return null;
    const { data } = await c.auth.getSession();
    uid = data?.session?.user?.id || null;
    return uid;
  }

  async function loadKey(key) {
    const c = sb(); if (!c || !uid || !SOURCES[key]) return;
    try {
      const { data, error } = await SOURCES[key](c, uid);
      if (error) { console.warn("KpsulStore load " + key, error.message); return; }
      cache[key] = data || [];
      publish(key, "load");
    } catch (e) { console.warn("KpsulStore load " + key, e); }
  }

  async function loadAll() {
    if (loading) return readyPromise;
    loading = true;
    if (!(await ensureUid())) { loading = false; return; }
    await Promise.all(Object.keys(SOURCES).map(loadKey));
    loadedOnce = true;
    loading = false;
    readyResolve();
    publish("*", "ready");
  }

  async function refresh(key) {
    if (!(await ensureUid())) return;
    if (key && SOURCES[key]) { await loadKey(key); }
    else { await Promise.all(Object.keys(SOURCES).map(loadKey)); }
  }

  /* ─── PROPAGATION APRÈS ÉCRITURE ───────────────────────────── */
  // Un module appelle ceci après avoir inséré/modifié une donnée.
  // On recharge la clé concernée et tout le monde est prévenu.
  async function notifyChange(tableOrKey) {
    const key = TABLE_TO_KEY[tableOrKey] || tableOrKey;
    if (!SOURCES[key]) return;
    await loadKey(key);
    // Le score dépend de presque tout : on le rafraîchit en cascade
    if (["workouts","meals","habits","measures","goals"].includes(key)) {
      window.KpsulScoreV2?.refresh?.();
    }
  }

  /* ─── TEMPS RÉEL (best-effort) ─────────────────────────────── */
  function connectRealtime() {
    const c = sb(); if (!c || !uid) return;
    try {
      c.channel("kpsul_store_" + uid)
        .on("postgres_changes",
          { event: "*", schema: "public", filter: `user_id=eq.${uid}` },
          payload => {
            const key = TABLE_TO_KEY[payload.table];
            if (key) loadKey(key);
          })
        .subscribe();
    } catch (e) { /* realtime optionnel : l'ouverture des modules rafraîchira */ }
  }

  /* ─── API PUBLIQUE ─────────────────────────────────────────── */
  window.KpsulStore = Object.freeze({
    ready: () => readyPromise,
    get,
    getLatest,
    subscribe,
    refresh,
    notifyChange,
    isReady: () => loadedOnce,
    _debug: () => ({ uid, keys: Object.keys(cache), sizes: Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1])) }),
  });

  /* ─── ÉCOUTEUR UNIVERSEL D'ÉCRITURES ───────────────────────── */
  // Intercepte insert/update/delete sur les tables suivies et propage
  // au store après succès — AUCUNE modification des modules requise.
  let hookInstalled = false;
  function installWriteHook() {
    const c = sb();
    if (!c || hookInstalled || typeof c.from !== "function") return;
    hookInstalled = true;
    const originalFrom = c.from.bind(c);
    c.from = function (table) {
      const builder = originalFrom(table);
      if (!TABLE_TO_KEY[table]) return builder;
      ["insert", "update", "delete", "upsert"].forEach(op => {
        if (typeof builder[op] !== "function") return;
        const orig = builder[op].bind(builder);
        builder[op] = function (...args) {
          const q = orig(...args);
          if (q && typeof q.then === "function") {
            const propagate = () => { try { notifyChange(table); } catch (_) {} };
            // .then sans casser la chaîne d'origine
            const origThen = q.then.bind(q);
            q.then = (onOk, onErr) => origThen(res => {
              if (!res?.error) propagate();
              return onOk ? onOk(res) : res;
            }, onErr);
          }
          return q;
        };
      });
      return builder;
    };
  }

  /* ─── DÉMARRAGE ────────────────────────────────────────────── */
  async function boot() {
    installWriteHook();
    if (!(await ensureUid())) return;
    await loadAll();
    connectRealtime();
  }

  new MutationObserver(() => {
    if (document.body.classList.contains("authed") && !loadedOnce && !loading) boot();
  }).observe(document.body, { attributeFilter: ["class"] });

  // Reset propre à la déconnexion
  const c0 = sb();
  if (c0?.auth) {
    c0.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        uid = null; loadedOnce = false;
        Object.keys(cache).forEach(k => delete cache[k]);
      }
    });
  }

  if (document.body.classList.contains("authed")) boot();
})();
