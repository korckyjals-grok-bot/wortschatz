/**
 * Loads CURRENT pointer + lexicon/questions/manifest/scenes. Extensible for C/P snapshots.
 * Do not treat category.level as a content filter — it is the default start level only.
 */
(function (global) {
  'use strict';

  function dataUrl(name) {
    return new URL('data/' + name, location.href.replace(/[^/]*$/, '')).href;
  }

  let cache = null;

  async function fetchJson(name) {
    const res = await fetch(dataUrl(name), { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + name);
    return res.json();
  }

  function indexById(list, key) {
    key = key || 'id';
    const map = Object.create(null);
    (list || []).forEach((item) => {
      map[item[key]] = item;
    });
    return map;
  }

  function displayLemma(entry) {
    if (!entry) return '';
    if (entry.displayDe) return entry.displayDe;
    if (entry.pos === 'noun' && entry.article) {
      if (entry.numberUsage === 'plural_only') return entry.article + ' ' + entry.lemma;
      if (entry.numberUsage === 'proper_singular') return entry.lemma;
      return entry.article + ' ' + entry.lemma;
    }
    return entry.lemma;
  }

  function studyGrammarLine(entry) {
    if (!entry) return '';
    const forms = entry.forms || {};
    if (entry.pos === 'chunk') return 'Redemittel';
    if (entry.pos !== 'noun' && entry.numberUsage === 'not_applicable') return '';

    if (entry.numberUsage === 'plural_only') {
      return (entry.article || 'die') + ' ' + entry.lemma + ' (nur Plural)';
    }
    if (entry.numberUsage === 'mass_in_selected_sense') {
      return (entry.article ? entry.article + ' ' : '') + entry.lemma + ' (ohne Plural in dieser Bedeutung)';
    }
    if (entry.numberUsage === 'proper_singular') {
      return (entry.displayDe || entry.lemma) + ' (Eigenname' + (forms.articleNormallyOmitted ? ', meist ohne Artikel' : '') + ')';
    }
    if (entry.numberUsage === 'nominalized_singular') {
      return (entry.displayDe || forms.definite || entry.lemma) + ' (nominalisiert)';
    }
    if (entry.numberUsage === 'nominalized_adjective') {
      const def = forms.pluralDefinite || (entry.plural ? 'die ' + String(entry.plural).replace(/^die\s+/i, '') : '');
      const line = entry.displayDe || forms.definite || entry.lemma;
      return def ? line + ' — ' + def : line + ' (nominalisiert)';
    }
    if (entry.pos !== 'noun') return '';
    const art = entry.article || '';
    const pluralRaw = entry.plural ? String(entry.plural).replace(/^die\s+/i, '') : '';
    const plural = pluralRaw ? 'die ' + pluralRaw : '';
    if (art && plural) return art + ' ' + entry.lemma + ' — ' + plural;
    return displayLemma(entry);
  }

  /** Entry IDs of one category at one level. Hub and end-of-round summary both use this. */
  function levelEntryIds(cat, level) {
    if (!cat) return [];
    const cov = cat.perLevelCoverage && level && cat.perLevelCoverage[level];
    return (cov && cov.entryIds) || cat.entryIds || [];
  }

  function availableLevels(current, manifest) {
    const fromCur = (current && current.availableLevels) || null;
    const fromMan = (manifest && manifest.availableLevels) || null;
    return fromCur || fromMan || ['F'];
  }

  function levelLabel(code, current) {
    const labels = (current && current.levelLabelsDe) || (global.WortschatzConfig && global.WortschatzConfig.LEVEL_LABELS) || {};
    return labels[code] || code;
  }

  function modeLabel(question) {
    const labels = (global.WortschatzConfig && global.WortschatzConfig.MODE_LABELS) || {};
    const sem = question && question.taskSemantics;
    if (sem === 'word_to_situation') return labels.word_to_situation || 'Wort → Situation';
    if (sem === 'meaning_to_word') return labels.meaning_to_word || 'Bedeutung → Wort';
    if (question && question.mode === 'context_to_meaning') return labels.word_to_situation || 'Wort → Situation';
    return labels[question && question.mode] || (question && question.mode) || '';
  }

  async function loadAll() {
    if (cache) return cache;
    const current = await fetchJson('CURRENT.json');
    const sceneFile = current.sceneContracts || current.optionalSceneContracts || 'scene_contracts_F_202611081412.json';
    // Runtime closure only: lexicon/questions/manifest/scenes/images/sceneStatus/sources.
    // Do not fetch authoring QA, ledgers, schemas, category module duplicates, or historical snapshots.
    const [lexicon, questions, manifest, scenes, imageQuestions, sceneStatus, sources] = await Promise.all([
      fetchJson(current.lexicon),
      fetchJson(current.questions),
      fetchJson(current.manifest),
      fetchJson(sceneFile),
      fetchJson(current.imageQuestions || 'image_questions_runtime_202611081420.json').catch(() => ({ questions: [] })),
      fetchJson(current.sceneRuntimeStatus || 'scene_runtime_status_202611081420.json').catch(() => ({ contracts: [] })),
      current.sources
        ? fetchJson(current.sources).catch(() => ({ sources: [], records: [] }))
        : Promise.resolve({ sources: [], records: [] })
    ]);
    const validation = { skippedAtRuntime: true };

    const entries = lexicon.entries || [];
    const textQuestions = questions.questions || [];
    const imgQuestions = imageQuestions.questions || [];
    const allQuestions = textQuestions.concat(imgQuestions);
    const levels = availableLevels(current, manifest);

    cache = {
      current: current,
      lexicon: lexicon,
      questionsDoc: questions,
      imageQuestionsDoc: imageQuestions,
      manifest: manifest,
      scenes: scenes,
      sceneStatus: sceneStatus,
      sources: sources,
      validation: validation,
      entriesById: indexById(entries),
      questionsById: indexById(allQuestions),
      scenesById: indexById(scenes.contracts || []),
      categoriesById: indexById(manifest.categories || []),
      textQuestionCount: textQuestions.length,
      imageQuestionCount: imgQuestions.length,
      entryCount: entries.length,
      availableLevels: levels,
      unavailableLevels: current.unavailableLevels || [],
      displayLemma: displayLemma,
      studyGrammarLine: studyGrammarLine,
      modeLabel: modeLabel,
      levelEntryIds: levelEntryIds,
      levelLabel: function (code) {
        return levelLabel(code, current);
      },
      questionsForCategory: function (categoryId, level) {
        const cat = this.categoriesById[categoryId];
        if (level && cat && cat.perLevelCoverage && cat.perLevelCoverage[level] && cat.perLevelCoverage[level].questionIds) {
          const ids = new Set(cat.perLevelCoverage[level].questionIds);
          // include runtime image questions for that category+level separately
          return allQuestions.filter(
            (q) => q.categoryId === categoryId && ((ids.has(q.id) || (q.runtimeGenerated && q.level === level)))
          );
        }
        return allQuestions.filter((q) => q.categoryId === categoryId && (!level || q.level === level));
      },
      entriesForCategory: function (categoryId, level) {
        const cat = this.categoriesById[categoryId];
        if (!cat) return [];
        let ids = cat.entryIds || [];
        if (level && cat.perLevelCoverage && cat.perLevelCoverage[level] && cat.perLevelCoverage[level].entryIds) {
          ids = cat.perLevelCoverage[level].entryIds;
        }
        return ids
          .map((id) => this.entriesById[id])
          .filter(Boolean)
          .filter((e) => !level || e.level === level);
      },
      sceneEligible: function (sceneId) {
        const st = (sceneStatus.contracts || []).find((c) => c.id === sceneId);
        return !!(st && st.rendered && st.visuallyReviewed);
      }
    };
    return cache;
  }

  global.WortschatzData = {
    loadAll: loadAll,
    dataUrl: dataUrl,
    displayLemma: displayLemma,
    studyGrammarLine: studyGrammarLine,
    modeLabel: modeLabel,
    levelEntryIds: levelEntryIds,
    getCache: function () {
      return cache;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
