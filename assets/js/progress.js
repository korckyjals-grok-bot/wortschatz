/**
 * Local per-canonical-entry progress. Shared across categories (no double counting).
 * Sicher erkannt: 3 independent first-try successes across ≥2 contexts/modes + later-day review.
 */
(function (global) {
  'use strict';

  const KEY = (global.WortschatzConfig && global.WortschatzConfig.STORAGE_KEY) || 'wortschatz_progress_v1';
  const INTERVALS = (global.WortschatzConfig && global.WortschatzConfig.REVIEW_INTERVALS_DAYS) || [1, 3, 7, 14, 30];

  function now() {
    if (typeof global.__WORTSCHATZ_NOW === 'number') return global.__WORTSCHATZ_NOW;
    if (typeof global.__WORTSCHATZ_NOW === 'function') return global.__WORTSCHATZ_NOW();
    return Date.now();
  }

  function empty() {
    return {
      version: 1,
      contentVersion: null,
      updatedAt: now(),
      entries: {},
      meta: { storageOk: true }
    };
  }

  /**
   * Apply contentVersion migrations.
   * Supports legacy single-step {fromContentVersions, invalidateModes} and
   * multi-step {steps:[{fromContentVersions, invalidateModes, invalidateQuestionIds}]}.
   * Direct 1.0.0-F → 1.2.0-FCP applies every applicable step.
   */
  function applyMigrationStep(store, from, targetVersion, step) {
    if (!step) return { invalidatedModes: [], invalidatedQuestionIds: [] };
    const fromList = step.fromContentVersions || [];
    const applies = !from || fromList.indexOf(from) >= 0 || from !== targetVersion;
    if (!applies) return { invalidatedModes: [], invalidatedQuestionIds: [] };

    const modes = new Set(step.invalidateModes || []);
    const qids = new Set(step.invalidateQuestionIds || []);
    const payloadMap = step.questionPayloadVersions || {};

    Object.keys(store.entries || {}).forEach((eid) => {
      const e = store.entries[eid];
      if (!e) return;
      const before = (e.firstTryIndependent || []).slice();
      const drop = [];
      const keep = [];
      before.forEach((x) => {
        let invalidate = false;
        if (modes.has(x.mode)) invalidate = true;
        if (qids.has(x.questionId)) invalidate = true;
        // Stale payload version for a repaired question
        if (x.questionId && payloadMap[x.questionId] && x.questionPayloadVersion && x.questionPayloadVersion !== payloadMap[x.questionId]) {
          invalidate = true;
        }
        if (invalidate) drop.push(x);
        else keep.push(x);
      });
      e.firstTryIndependent = keep;
      if (drop.length) {
        e.invalidatedContextSuccesses = (e.invalidatedContextSuccesses || []).concat(
          drop.map((x) =>
            Object.assign({}, x, {
              invalidatedAt: now(),
              fromVersion: from,
              toVersion: targetVersion,
              reason: step.reason || 'content migration'
            })
          )
        );
      }
      modes.forEach((m) => {
        if (e.modalities && e.modalities[m]) {
          e.modalities[m].correctFirst = 0;
          e.modalities[m].invalidatedByMigration = true;
        }
      });
      recomputeStatus(e);
    });
    return {
      invalidatedModes: Array.from(modes),
      invalidatedQuestionIds: Array.from(qids),
      reason: step.reason || 'content semantic change'
    };
  }

  function migrateContentVersion(store, targetVersion, migration) {
    if (!store || !targetVersion) return store;
    const from = store.contentVersion || null;
    if (from === targetVersion) return store;

    // Normalize to steps
    let steps = [];
    if (migration && Array.isArray(migration.steps) && migration.steps.length) {
      steps = migration.steps;
    } else if (migration) {
      steps = [migration];
    } else {
      steps = [
        {
          fromContentVersions: ['1.0.0-F'],
          invalidateModes: ['context_to_meaning'],
          reason: 'contextual items repaired'
        }
      ];
    }

    store.meta = store.meta || {};
    store.meta.migrations = store.meta.migrations || [];
    steps.forEach((step) => {
      // Apply step if store is still on an older version that the step lists,
      // or when jumping directly (from is in fromContentVersions OR from is null/older).
      const fromList = step.fromContentVersions || [];
      const should =
        !from ||
        fromList.indexOf(from) >= 0 ||
        // direct jump: if coming from any earlier known version, still apply question-id invalidations
        (from !== targetVersion && (step.invalidateQuestionIds || []).length > 0);
      if (!should) return;
      // For mode invalidation, only apply when from is listed (avoid wiping new context mastery on pure 1.1→1.2)
      const stepEff = Object.assign({}, step);
      if (from && fromList.indexOf(from) < 0) {
        stepEff.invalidateModes = []; // 1.1→1.2: keep valid new word_to_situation unless question ID repaired
      }
      const result = applyMigrationStep(store, from, targetVersion, stepEff);
      store.meta.migrations.push({
        from: from,
        to: targetVersion,
        at: now(),
        invalidatedModes: result.invalidatedModes,
        invalidatedQuestionIds: result.invalidatedQuestionIds,
        reason: result.reason
      });
    });

    store.contentVersion = targetVersion;
    save(store);
    return store;
  }

  function load(opts) {
    opts = opts || {};
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.entries || typeof data.entries !== 'object') {
        return Object.assign(empty(), { meta: { storageOk: true, recoveredFromMalformed: true } });
      }
      data.meta = data.meta || { storageOk: true };
      if (opts.contentVersion && data.contentVersion !== opts.contentVersion) {
        return migrateContentVersion(data, opts.contentVersion, opts.migration);
      }
      return data;
    } catch (e) {
      const d = empty();
      d.meta = { storageOk: false, error: String(e && e.message) };
      return d;
    }
  }

  function save(data) {
    try {
      data.updatedAt = now();
      localStorage.setItem(KEY, JSON.stringify(data));
      data.meta = data.meta || {};
      data.meta.storageOk = true;
      return true;
    } catch (e) {
      if (data) {
        data.meta = data.meta || {};
        data.meta.storageOk = false;
        data.meta.error = String(e && e.message);
      }
      return false;
    }
  }

  function ensureEntry(store, entryId) {
    if (!store.entries[entryId]) {
      store.entries[entryId] = {
        exposures: 0,
        status: 'neu',
        modalities: {},
        firstTryIndependent: [],
        assistedEver: false,
        lastSeenAt: null,
        nextReviewAt: null,
        reviewStreak: 0
      };
    }
    return store.entries[entryId];
  }

  function contextKey(question) {
    const stim = question.stimulus || {};
    const sem = question.taskSemantics || question.mode || '';
    if (stim.kind === 'scene') return 'scene:' + stim.sceneId + ':' + JSON.stringify(stim.variant || {}) + '|sem:' + sem;
    return 'text:' + String(stim.textDe || '').slice(0, 120) + '|mode:' + question.mode + '|sem:' + sem;
  }

  function dayStart(ts) {
    const d = new Date(ts);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  function recordAttempt(opts) {
    const store = load({
      contentVersion: opts.contentVersion,
      migration: opts.migration
    });
    const entry = ensureEntry(store, opts.entryId);
    const mod = opts.mode || 'unknown';
    if (!entry.modalities[mod]) {
      entry.modalities[mod] = {
        attempts: 0,
        correctFirst: 0,
        assisted: 0,
        lastResult: null
      };
    }
    const m = entry.modalities[mod];
    m.attempts += 1;
    entry.exposures += 1;
    entry.lastSeenAt = now();

    const assisted = !!opts.assisted;
    if (assisted) {
      entry.assistedEver = true;
      m.assisted += 1;
    }

    const firstTry = !!opts.firstTry;
    const correct = !!opts.correct;
    const ck = opts.contextKey || (opts.questionId + ':' + mod);

    if (firstTry) {
      entry.firstTryIndependent = entry.firstTryIndependent || [];
      entry.firstTryIndependent.push({
        questionId: opts.questionId,
        mode: mod,
        contextKey: ck,
        correct: correct && !assisted,
        assisted: assisted,
        ts: now(),
        contentVersion: opts.contentVersion || store.contentVersion || null,
        questionPayloadVersion: opts.questionPayloadVersion || null
      });
      // keep last 40
      if (entry.firstTryIndependent.length > 40) {
        entry.firstTryIndependent = entry.firstTryIndependent.slice(-40);
      }
      if (correct && !assisted) m.correctFirst += 1;
    }

    m.lastResult = { correct: correct, assisted: assisted, ts: now(), questionId: opts.questionId };

    // Wrong revisit scheduling: sooner
    if (!correct) {
      entry.nextReviewAt = now() + 5 * 60 * 1000; // soon within session window conceptually; day intervals for durable
      entry.reviewStreak = 0;
      if (entry.status === 'sicher_erkannt') entry.status = 'in_uebung';
      else if (entry.status === 'neu') entry.status = assisted ? 'mit_hilfe' : 'in_uebung';
      else if (assisted) entry.status = 'mit_hilfe';
      else entry.status = 'in_uebung';
    } else if (assisted) {
      entry.status = entry.status === 'sicher_erkannt' ? 'sicher_erkannt' : 'mit_hilfe';
      entry.nextReviewAt = now() + INTERVALS[0] * 86400000;
    } else {
      recomputeStatus(entry);
      const idx = Math.min(entry.reviewStreak || 0, INTERVALS.length - 1);
      entry.nextReviewAt = now() + INTERVALS[idx] * 86400000;
      if (firstTry && correct && !assisted) entry.reviewStreak = (entry.reviewStreak || 0) + 1;
    }

    store.contentVersion = opts.contentVersion || store.contentVersion;
    save(store);
    return { store: store, entry: entry };
  }

  function recomputeStatus(entry) {
    const successes = (entry.firstTryIndependent || []).filter((x) => x.correct && !x.assisted);
    const contexts = new Set(successes.map((x) => x.contextKey));
    const modes = new Set(successes.map((x) => x.mode));
    const distinctContextsOrModes = new Set();
    successes.forEach((x) => distinctContextsOrModes.add(x.mode + '|' + x.contextKey));

    // Need ≥3 independent first-try successes across ≥2 different contexts/modes
    const enough = successes.length >= 3 && (contexts.size >= 2 || modes.size >= 2) && distinctContextsOrModes.size >= 2;

    // Later-day review: a successful first-try on a different UTC day than the earliest success
    let laterDay = false;
    if (successes.length >= 2) {
      const days = successes.map((x) => dayStart(x.ts));
      const minDay = Math.min.apply(null, days);
      laterDay = days.some((d) => d > minDay);
    }

    if (enough && laterDay) {
      entry.status = 'sicher_erkannt';
    } else if (entry.assistedEver && successes.length === 0) {
      entry.status = 'mit_hilfe';
    } else if (entry.exposures > 0) {
      entry.status = 'in_uebung';
    } else {
      entry.status = 'neu';
    }
    return entry.status;
  }

  function summarize(store, entryIds) {
    const ids = entryIds || Object.keys((store && store.entries) || {});
    const counts = { neu: 0, mit_hilfe: 0, in_uebung: 0, sicher_erkannt: 0, spaeter_wiederholen: 0, total: ids.length };
    const t = now();
    ids.forEach((id) => {
      const e = store.entries[id];
      if (!e) {
        counts.neu += 1;
        return;
      }
      let st = e.status || 'neu';
      if (st !== 'sicher_erkannt' && e.nextReviewAt && e.nextReviewAt <= t && e.exposures > 0) {
        st = 'spaeter_wiederholen';
      }
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }

  function dueForReview(store, entryIds) {
    const t = now();
    return (entryIds || Object.keys(store.entries)).filter((id) => {
      const e = store.entries[id];
      if (!e || !e.exposures) return false;
      if (e.status === 'sicher_erkannt' && e.nextReviewAt && e.nextReviewAt > t) return false;
      return !e.nextReviewAt || e.nextReviewAt <= t || e.status === 'in_uebung' || e.status === 'mit_hilfe';
    });
  }

  function resetAll() {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function nickname() {
    const k = (global.WortschatzConfig && global.WortschatzConfig.NICK_KEY) || 'sociales_nombre';
    try {
      const q = new URLSearchParams(location.search).get('nombre');
      if (q) {
        const clean = q.replace(/[<>"]/g, '').trim().slice(0, 20);
        if (clean) localStorage.setItem(k, clean);
      }
      return (localStorage.getItem(k) || '').replace(/[<>"]/g, '').trim().slice(0, 20) || null;
    } catch (e) {
      return null;
    }
  }

  global.WortschatzProgress = {
    load: load,
    save: save,
    recordAttempt: recordAttempt,
    ensureEntry: ensureEntry,
    summarize: summarize,
    dueForReview: dueForReview,
    resetAll: resetAll,
    nickname: nickname,
    now: now,
    contextKey: contextKey,
    recomputeStatus: recomputeStatus,
    migrateContentVersion: migrateContentVersion,
    KEY: KEY
  };
})(typeof window !== 'undefined' ? window : globalThis);
