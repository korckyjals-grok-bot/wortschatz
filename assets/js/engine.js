/**
 * Category game runtime: Entdecken, meaning/context modes, picture modes, review.
 * Child UI entirely German; Spanish only after explicit Hilfe.
 */
(function (global) {
  'use strict';

  const UI = (global.WortschatzConfig && global.WortschatzConfig.UI) || {};
  const MODE_LABELS = (global.WortschatzConfig && global.WortschatzConfig.MODE_LABELS) || {};

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((rng || Math.random)() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeHelp(help) {
    if (!help) return { meaning: '', instruction: '', revealPolicy: 'explicit_request_only', marksAssisted: true };
    if (typeof help === 'string') return { meaning: help, instruction: 'Elige una opción. No tienes que escribir.', revealPolicy: 'explicit_request_only', marksAssisted: true };
    return help;
  }

  function createSession(data, categoryId, level, opts) {
    opts = opts || {};
    level = level || 'F';
    const cat = data.categoriesById[categoryId];
    if (!cat) throw new Error('Unbekannte Kategorie: ' + categoryId);
    if (!data.availableLevels.includes(level)) {
      throw new Error('Stufe nicht verfügbar: ' + level);
    }

    const store = WortschatzProgress.load({
      contentVersion: data.current.contentVersion,
      migration: data.current.progressMigration
    });
    const textQs = data
      .questionsForCategory(categoryId, level)
      .filter((q) => q.mode === 'meaning_to_word' || q.mode === 'context_to_meaning' || q.taskSemantics === 'word_to_situation');
    const imgQs = data.questionsForCategory(categoryId, level).filter((q) => q.mode === 'picture_to_word' || q.mode === 'word_to_scene');
    // Prefer perLevelCoverage entry IDs; never treat category.level as a content filter
    const entryIds =
      (cat.perLevelCoverage && cat.perLevelCoverage[level] && cat.perLevelCoverage[level].entryIds) ||
      data.entriesForCategory(categoryId, level).map((e) => e.id) ||
      cat.entryIds ||
      [];

    const due = WortschatzProgress.dueForReview(store, entryIds);
    const unseen = entryIds.filter((id) => !store.entries[id] || !store.entries[id].exposures);

    const newCount = opts.newCount || 6;
    const reviewCount = opts.reviewCount || 6;
    const pickNew = shuffle(unseen.length ? unseen : entryIds).slice(0, newCount);
    const pickReview = shuffle(due.filter((id) => pickNew.indexOf(id) < 0)).slice(0, reviewCount);
    const focusIds = shuffle(pickNew.concat(pickReview));

    // Build mixed items: study cards for new, then assessment questions
    const items = [];

    // Entdecken for new (or first few)
    pickNew.slice(0, Math.min(6, pickNew.length)).forEach((eid) => {
      const entry = data.entriesById[eid];
      if (!entry) return;
      items.push({ kind: 'study', entryId: eid, entry: entry, mode: 'entdecken' });
    });

    focusIds.forEach((eid) => {
      const qs = textQs.filter((q) => q.targetEntryId === eid);
      const imgs = imgQs.filter((q) => q.targetEntryId === eid);
      // Prefer one text mode, optionally one image if available
      const pool = shuffle(qs);
      if (pool[0]) items.push({ kind: 'question', question: pool[0], mode: pool[0].mode });
      // second context if available and session not too long
      if (pool[1] && items.filter((x) => x.kind === 'question').length < 14) {
        items.push({ kind: 'question', question: pool[1], mode: pool[1].mode });
      }
      if (
        imgs.length &&
        items.filter(
          (x) =>
            x.kind === 'question' &&
            (x.mode === 'picture_to_word' || x.mode === 'word_to_scene')
        ).length < 4
      ) {
        const imgPick = shuffle(imgs)[0];
        items.push({ kind: 'question', question: imgPick, mode: imgPick.mode });
      }
    });

    // Cap session length ~12–16 interactive items
    const study = items.filter((i) => i.kind === 'study').slice(0, 6);
    let questions = items.filter((i) => i.kind === 'question');
    // Ensure both modes appear when category has them
    const hasM = questions.some((q) => q.mode === 'meaning_to_word');
    const hasC = questions.some((q) => q.mode === 'context_to_meaning');
    if (!hasM) {
      const m = textQs.find((q) => q.mode === 'meaning_to_word');
      if (m) questions.unshift({ kind: 'question', question: m, mode: m.mode });
    }
    if (!hasC) {
      const c = textQs.find((q) => q.mode === 'context_to_meaning');
      if (c) questions.unshift({ kind: 'question', question: c, mode: c.mode });
    }
    const seenQ = {};
    questions = questions.filter((it) => {
      if (seenQ[it.question.id]) return false;
      seenQ[it.question.id] = true;
      return true;
    });
    questions = shuffle(questions).slice(0, 10);

    // Wrong revisit queue filled during play
    return {
      categoryId: categoryId,
      level: level,
      cat: cat,
      queue: study.concat(questions),
      revisit: [],
      index: 0,
      answered: [],
      locked: false,
      helpOpen: false,
      assistedThisItem: false,
      firstAttemptDone: false,
      answeredIds: {}
    };
  }

  function renderShell(root, state, data) {
    const nick = WortschatzProgress.nickname();
    const levelName = data.levelLabel(state.level);
    root.innerHTML =
      '<header class="wz-top">' +
      '<a class="wz-back" href="' + hubHref(state) + '">← ' +
      UI.backHub +
      '</a>' +
      '<div class="wz-top-main">' +
      '<h1 class="wz-cat-title">' +
      escapeHtml(state.cat.titleDe) +
      '</h1>' +
      '<p class="wz-cat-sub"><span class="wz-pill">' +
      escapeHtml(levelName) +
      '</span> ' +
      (nick ? 'Hallo, ' + escapeHtml(nick) + '!' : 'Hallo!') +
      '</p>' +
      '</div>' +
      '<div class="wz-progress-mini" id="wzSessionProg"></div>' +
      '</header>' +
      '<main class="wz-stage" id="wzStage" aria-live="polite"></main>' +
      '<div class="wz-help-panel" id="wzHelp" hidden></div>' +
      '<footer class="wz-actions" id="wzActions"></footer>';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function levelEntryIds(data, state) {
    return data.levelEntryIds ? data.levelEntryIds(state.cat, state.level) : (state.cat.entryIds || []);
  }

  function hubHref(state) {
    return 'index.html?stufe=' + encodeURIComponent(state.level);
  }

  function updateProg(state) {
    const el = $('#wzSessionProg');
    if (!el) return;
    const total = state.queue.length + state.revisit.length;
    const done = state.answered.length;
    el.textContent = done + ' / ' + Math.max(total, done);
  }

  function currentItem(state) {
    if (state.index < state.queue.length) return state.queue[state.index];
    const rIdx = state.index - state.queue.length;
    if (rIdx < state.revisit.length) return state.revisit[rIdx];
    return null;
  }

  function speakCancel() {
    if (global.WortschatzSpeech) WortschatzSpeech.cancel();
  }

  function makeSpeakBtn(text) {
    const st = WortschatzSpeech.status();
    if (st.unsupported) return '';
    if (st.ready && !st.hasGerman) {
      return '<p class="wz-voice-note">' + escapeHtml(UI.noVoice) + '</p>';
    }
    return (
      '<button type="button" class="wz-btn wz-btn-secondary wz-speak" data-speak="' +
      escapeHtml(text) +
      '">🔊 ' +
      UI.hear +
      '</button>'
    );
  }

  function renderStudy(stage, item, state, data) {
    const e = item.entry;
    const grammar = data.studyGrammarLine(e);
    const scene = (data.scenes.contracts || []).find((c) => c.targetEntryId === e.id);
    let sceneHtml = '';
    if (scene && data.sceneEligible(scene.id)) {
      sceneHtml = '<div class="wz-scene" data-scene="' + escapeHtml(scene.id) + '"></div>';
    }
    stage.innerHTML =
      '<section class="wz-card wz-study">' +
      '<p class="wz-mode-label">' +
      MODE_LABELS.entdecken +
      '</p>' +
      '<p class="wz-lemma">' +
      escapeHtml(data.displayLemma(e)) +
      '</p>' +
      (grammar ? '<p class="wz-grammar">' + escapeHtml(grammar) + '</p>' : '') +
      sceneHtml +
      '<p class="wz-def">' +
      escapeHtml(e.definitionDe) +
      '</p>' +
      '<p class="wz-example">' +
      escapeHtml(/[„“]/.test(e.exampleDe || '') ? e.exampleDe : '„' + e.exampleDe + '“') +
      '</p>' +
      makeSpeakBtn([data.displayLemma(e), e.definitionDe, e.exampleDe].join('. ')) +
      '</section>';
    // Study-only: never inject definition/example into later assessment stimulus
    if (sceneHtml) {
      const mount = stage.querySelector('.wz-scene');
      WortschatzScenes.mount(mount, data.scenesById[scene.id]);
    }
    $('#wzActions').innerHTML =
      '<button type="button" class="wz-btn wz-btn-primary" id="wzNext">' +
      UI.next +
      '</button>' +
      '<button type="button" class="wz-btn wz-btn-ghost" id="wzHelpBtn">' +
      UI.helpEs +
      '</button>';
    wireCommon(state, data, item, { study: true });
  }

  function renderChoices(question, data, shuffled) {
    return shuffled
      .map((ch) => {
        let body = '';
        if (ch.sceneId) {
          body =
            '<div class="wz-choice-scene" data-scene="' +
            escapeHtml(ch.sceneId) +
            '" data-variant=\'' +
            escapeHtml(JSON.stringify(ch.variant || {})) +
            '\'></div>';
        } else {
          body = '<span class="wz-choice-text">' + escapeHtml(ch.textDe) + '</span>';
        }
        return (
          '<button type="button" class="wz-choice" data-choice-id="' +
          escapeHtml(ch.id) +
          '" aria-pressed="false">' +
          body +
          '</button>'
        );
      })
      .join('');
  }

  function choicesAreScenes(question) {
    return !!(question && question.choices && question.choices.some((c) => c.sceneId));
  }

  /** Pure scoring helper for tests and future reuse. */
  function scoreChoice(question, choiceId, opts) {
    opts = opts || {};
    const correct = choiceId === question.correctChoiceId;
    const assisted = !!opts.assisted;
    return {
      correct: correct,
      assisted: assisted,
      independentSuccess: correct && !assisted,
      correctChoiceId: question.correctChoiceId,
      selectedChoiceId: choiceId
    };
  }

  function renderQuestion(stage, item, state, data) {
    const q = item.question;
    const seed = hashSeed(q.id + ':' + (state.answered.length || 0));
    const rng = mulberry32(seed);
    const shuffled = shuffle(q.choices, rng);
    state._shuffledChoiceIds = shuffled.map((c) => c.id);
    state.locked = false;
    state.helpOpen = false;
    state.assistedThisItem = false;
    state.answeredIds = state.answeredIds || {};
    // 1.2.1: a missed question that comes back (revisit) or any question already answered
    // in this round was seen with its solution -> it can never count as a first try.
    state.firstAttemptDone = !!item.revisit || !!state.answeredIds[q.id];
    state._selected = null;
    state._itemCorrect = null;

    let stimulusHtml = '';
    const stim = q.stimulus || {};
    if (stim.kind === 'scene') {
      stimulusHtml = '<div class="wz-scene wz-stim-scene" data-scene="' + escapeHtml(stim.sceneId) + '" data-variant=\'' + escapeHtml(JSON.stringify(stim.variant || {})) + '\'></div>';
    } else {
      stimulusHtml = '<p class="wz-stimulus">' + escapeHtml(stim.textDe || '').replace(/\n/g, '<br>') + '</p>';
    }

    const speakText =
      q.mode === 'word_to_scene'
        ? stim.textDe
        : q.mode === 'picture_to_word'
          ? q.promptDe
          : [q.promptDe, stim.textDe].filter(Boolean).join('. ');

    // Assessment: render ONLY stored prompt + stimulus text/scene. Never append definitionDe/exampleDe.
    const label = (data.modeLabel && data.modeLabel(q)) || MODE_LABELS[q.taskSemantics] || MODE_LABELS[q.mode] || q.mode;

    stage.innerHTML =
      '<section class="wz-card wz-question" data-qid="' +
      escapeHtml(q.id) +
      '" data-task-semantics="' +
      escapeHtml(q.taskSemantics || q.mode || '') +
      '">' +
      '<p class="wz-mode-label">' +
      escapeHtml(label) +
      '</p>' +
      '<h2 class="wz-prompt">' +
      escapeHtml(q.promptDe) +
      '</h2>' +
      stimulusHtml +
      '<div class="wz-choices' +
      (choicesAreScenes(q) ? ' wz-choices--scenes' : '') +
      '" role="group" aria-label="Antworten">' +
      renderChoices(q, data, shuffled) +
      '</div>' +
      '<div class="wz-feedback" id="wzFeedback" hidden></div>' +
      makeSpeakBtn(speakText || '') +
      '</section>';

    // Mount scenes
    $all('[data-scene]', stage).forEach((el) => {
      const sid = el.getAttribute('data-scene');
      let variant = {};
      try {
        variant = JSON.parse(el.getAttribute('data-variant') || '{}');
      } catch (e) {}
      WortschatzScenes.mount(el, data.scenesById[sid], variant);
    });

    $('#wzHelp').hidden = true;
    $('#wzHelp').innerHTML = '';

    $('#wzActions').innerHTML =
      '<button type="button" class="wz-btn wz-btn-primary" id="wzCheck" disabled>' +
      UI.check +
      '</button>' +
      '<button type="button" class="wz-btn wz-btn-ghost" id="wzHelpBtn">' +
      UI.helpEs +
      '</button>';

    wireCommon(state, data, item, { study: false });
  }

  function wireCommon(state, data, item, flags) {
    updateProg(state);
    speakCancel();

    $all('.wz-speak').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-speak') || '';
        const ok = WortschatzSpeech.speak(text, {
          onError: function () {
            btn.insertAdjacentHTML('afterend', '<p class="wz-voice-note">' + escapeHtml(UI.noVoice) + '</p>');
          }
        });
        if (!ok) {
          /* status already handled */
        }
      });
    });

    const helpBtn = $('#wzHelpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        state.helpOpen = !state.helpOpen;
        state.assistedThisItem = true;
        const panel = $('#wzHelp');
        if (!state.helpOpen) {
          panel.hidden = true;
          panel.innerHTML = '';
          helpBtn.textContent = UI.helpEs;
          return;
        }
        helpBtn.textContent = UI.hideHelp;
        const help = normalizeHelp(item.question ? item.question.helpEsLatam : item.entry && item.entry.helpEsLatam);
        panel.hidden = false;
        panel.innerHTML =
          '<div class="wz-help-box" lang="es">' +
          '<p><strong>Ayuda:</strong> ' +
          escapeHtml(help.meaning || '') +
          '</p>' +
          '<p>' +
          escapeHtml(help.instruction || '') +
          '</p>' +
          '<p class="wz-help-warn">Con ayuda no cuenta como „sicher erkannt“.</p>' +
          '</div>';
      });
    }

    if (flags.study) {
      $('#wzNext').addEventListener('click', () => {
        // Study exposure only — not mastery
        WortschatzProgress.recordAttempt({
          entryId: item.entryId,
          mode: 'entdecken',
          questionId: 'study-' + item.entryId,
          correct: true,
          firstTry: false,
          assisted: state.assistedThisItem,
          contentVersion: data.current.contentVersion,
          migration: data.current.progressMigration,
          contextKey: 'study:' + item.entryId
        });
        advance(state, data);
      });
      return;
    }

    const q = item.question;
    $all('.wz-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (state.locked) return;
        $all('.wz-choice').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        state._selected = btn.getAttribute('data-choice-id');
        const check = $('#wzCheck');
        if (check) check.disabled = false;
      });
    });

    $('#wzCheck').addEventListener('click', () => {
      if (state.locked || !state._selected) return;
      state.locked = true;
      const firstTry = !state.firstAttemptDone;
      state.firstAttemptDone = true;
      const correct = state._selected === q.correctChoiceId;
      state._itemCorrect = correct;

      $all('.wz-choice').forEach((btn) => {
        const id = btn.getAttribute('data-choice-id');
        btn.disabled = true;
        if (id === q.correctChoiceId) btn.classList.add('is-correct');
        if (id === state._selected && !correct) btn.classList.add('is-wrong');
      });

      const fb = $('#wzFeedback');
      fb.hidden = false;
      if (correct && !state.assistedThisItem) {
        fb.className = 'wz-feedback is-ok';
        fb.textContent = UI.correct;
      } else if (correct && state.assistedThisItem) {
        fb.className = 'wz-feedback is-assist';
        fb.innerHTML = UI.correct + ' <span>' + UI.assistedNote + '</span>';
      } else {
        fb.className = 'wz-feedback is-bad';
        const right = q.choices.find((c) => c.id === q.correctChoiceId);
        const rightLabel = (right && right.textDe) || data.displayLemma(data.entriesById[q.targetEntryId]) || '';
        const expl = q.explanationDe || '';
        // Avoid repeating the same definition phrase twice in feedback
        const explClean = expl && rightLabel && expl.indexOf(rightLabel) === 0 ? expl : (rightLabel ? rightLabel + '. ' : '') + expl;
        fb.innerHTML = UI.incorrect + ' ' + escapeHtml(explClean);
      }

      const payloadVersions =
        (data.current.progressMigration &&
          data.current.progressMigration.steps &&
          data.current.progressMigration.steps.reduce(function (acc, step) {
            return Object.assign(acc, step.questionPayloadVersions || {});
          }, {})) ||
        {};
      WortschatzProgress.recordAttempt({
        entryId: q.targetEntryId,
        mode: q.mode,
        questionId: q.id,
        correct: correct,
        firstTry: firstTry,
        revisit: !!item.revisit,
        assisted: state.assistedThisItem,
        contentVersion: data.current.contentVersion,
        migration: data.current.progressMigration,
        questionPayloadVersion: payloadVersions[q.id] || null,
        contextKey: WortschatzProgress.contextKey(q)
      });

      state.answeredIds = state.answeredIds || {};
      state.answeredIds[q.id] = true;
      state.answered.push({
        questionId: q.id,
        entryId: q.targetEntryId,
        correct: correct,
        assisted: state.assistedThisItem,
        firstTry: firstTry,
        selected: state._selected
      });

      // Wrong revisit after intervening items (once; do not re-queue forever)
      if (!correct && !item.revisit) {
        state.revisit.push({ kind: 'question', question: q, mode: q.mode, revisit: true });
      }

      $('#wzActions').innerHTML =
        '<button type="button" class="wz-btn wz-btn-primary" id="wzNext">' +
        UI.next +
        '</button>';
      $('#wzNext').addEventListener('click', () => advance(state, data));
    });
  }

  function advance(state, data) {
    // Reset help each next item
    state.helpOpen = false;
    state.assistedThisItem = false;
    state.firstAttemptDone = false;
    state.locked = false;
    const panel = $('#wzHelp');
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = '';
    }
    speakCancel();
    state.index += 1;
    const item = currentItem(state);
    if (!item) {
      renderResults(state, data);
      return;
    }
    const stage = $('#wzStage');
    if (item.kind === 'study') renderStudy(stage, item, state, data);
    else renderQuestion(stage, item, state, data);
  }

  function renderResults(state, data) {
    const store = WortschatzProgress.load();
    const summary = WortschatzProgress.summarize(store, levelEntryIds(data, state));
    const indep = state.answered.filter((a) => a.correct && a.firstTry && !a.assisted).length;
    const assisted = state.answered.filter((a) => a.assisted).length;
    const wrong = state.answered.filter((a) => !a.correct).length;

    $('#wzStage').innerHTML =
      '<section class="wz-card wz-results">' +
      '<h2>' +
      UI.sessionDone +
      '</h2>' +
      '<ul class="wz-stats">' +
      '<li><strong>' +
      indep +
      '</strong> ohne Hilfe richtig (erster Versuch)</li>' +
      '<li><strong>' +
      assisted +
      '</strong> mit Hilfe</li>' +
      '<li><strong>' +
      wrong +
      '</strong> noch üben</li>' +
      '</ul>' +
      '<h3>' +
      UI.inThisLevel +
      ' · ' +
      escapeHtml(data.levelLabel(state.level)) +
      '</h3>' +
      '<ul class="wz-stats">' +
      '<li>' +
      UI.sicher +
      ': <strong>' +
      summary.sicher_erkannt +
      '</strong></li>' +
      '<li>' +
      UI.inUebung +
      ': <strong>' +
      (summary.in_uebung + summary.spaeter_wiederholen) +
      '</strong></li>' +
      '<li>' +
      UI.mitHilfe +
      ': <strong>' +
      summary.mit_hilfe +
      '</strong></li>' +
      '<li>' +
      UI.neu +
      ': <strong>' +
      summary.neu +
      '</strong></li>' +
      '</ul>' +
      '<p class="wz-note">Karten gesehen ≠ sicher erkannt. Kein A1-Zertifikat, keine Schulnote.</p>' +
      '</section>';

    $('#wzActions').innerHTML =
      '<a class="wz-btn wz-btn-primary" href="spielen.html?kategorie=' +
      encodeURIComponent(state.categoryId) +
      '&stufe=' +
      encodeURIComponent(state.level) +
      '">' +
      (UI.again || 'Nochmal') +
      '</a>' +
      '<a class="wz-btn wz-btn-secondary" href="' +
      hubHref(state) +
      '">' +
      UI.backHub +
      '</a>';
    updateProg(state);
  }

  async function start(root) {
    const params = new URLSearchParams(location.search);
    const categoryId = params.get('kategorie');
    const level = params.get('stufe') || 'F';
    const demoFrage = params.get('demoFrage');
    if (!categoryId) {
      root.innerHTML = '<p class="wz-error">Keine Kategorie. <a href="index.html">' + UI.backHub + '</a></p>';
      return;
    }
    root.innerHTML = '<p class="wz-loading">Laden…</p>';
    let data;
    try {
      data = await WortschatzData.loadAll();
    } catch (e) {
      root.innerHTML = '<p class="wz-error">Daten konnten nicht geladen werden.</p>';
      console.error(e);
      return;
    }
    if (!data.availableLevels.includes(level)) {
      root.innerHTML =
        '<p class="wz-error">Stufe „' +
        escapeHtml(data.levelLabel(level)) +
        '“ ist noch nicht verfügbar. Verfügbar: ' +
        escapeHtml(data.availableLevels.map((lv) => data.levelLabel(lv)).join(', ')) +
        '.</p><p><a href="index.html">Zur Übersicht</a></p>';
      return;
    }
    // Apply progress migration once when opening a category
    WortschatzProgress.load({
      contentVersion: data.current.contentVersion,
      migration: data.current.progressMigration
    });
    if (!data.categoriesById[categoryId]) {
      root.innerHTML = '<p class="wz-error">Unbekannte Kategorie.</p>';
      return;
    }

    let state;
    if (demoFrage) {
      const q = data.questionsById[demoFrage];
      if (!q || q.categoryId !== categoryId) {
        root.innerHTML = '<p class="wz-error">Frage nicht gefunden.</p>';
        return;
      }
      state = {
        categoryId: categoryId,
        level: level,
        cat: data.categoriesById[categoryId],
        queue: [{ kind: 'question', question: q, mode: q.mode }],
        revisit: [],
        index: 0,
        answered: [],
        locked: false,
        helpOpen: false,
        assistedThisItem: false,
        firstAttemptDone: false,
        answeredIds: {}
      };
    } else {
      state = createSession(data, categoryId, level);
    }
    renderShell(root, state, data);
    const item = currentItem(state);
    const stage = $('#wzStage');
    if (!item) {
      renderResults(state, data);
      return;
    }
    if (item.kind === 'study') renderStudy(stage, item, state, data);
    else renderQuestion(stage, item, state, data);

    window.addEventListener('pagehide', speakCancel);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) speakCancel();
    });
  }

  global.WortschatzEngine = {
    start: start,
    createSession: createSession,
    scoreChoice: scoreChoice,
    choicesAreScenes: choicesAreScenes
  };
})(typeof window !== 'undefined' ? window : globalThis);
