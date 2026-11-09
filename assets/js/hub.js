(function () {
  'use strict';

  const UI = WortschatzConfig.UI;
  const GROUPS = WortschatzConfig.GROUPS;
  const EMOJI = WortschatzConfig.CATEGORY_EMOJI;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function groupOf(id) {
    if (GROUPS.alltag.categoryIds.indexOf(id) >= 0) return 'alltag';
    if (GROUPS.schule.categoryIds.indexOf(id) >= 0) return 'schule';
    return 'alltag';
  }

  async function boot() {
    const root = document.getElementById('wzHub');
    if (!root) return;
    root.innerHTML = '<p class="wz-loading">Laden…</p>';
    let data;
    try {
      data = await WortschatzData.loadAll();
    } catch (e) {
      root.innerHTML = '<p class="wz-error">Datenfehler. Bitte Seite neu laden.</p>';
      console.error(e);
      return;
    }

    WortschatzProgress.load({
      contentVersion: data.current.contentVersion,
      migration: data.current.progressMigration
    });

    const nick = WortschatzProgress.nickname();
    const store = WortschatzProgress.load();
    const cats = (data.manifest.categories || []).slice().sort((a, b) => a.routeOrder - b.routeOrder);
    const avail = data.availableLevels;
    const per = data.manifest.perLevelCoverage || {};
    const fCount = (per.F && per.F.uniqueEntries) || 528;
    const cCount = (per.C && per.C.uniqueEntries) || 566;
    const pCount = (per.P && per.P.uniqueEntries) || 391;
    let selectedLevel = data.current.defaultLevel || 'F';
    if (avail.indexOf(selectedLevel) < 0) selectedLevel = avail[0] || 'F';

    root.innerHTML =
      '<header class="wz-hero">' +
      '<p class="wz-draft">' +
      esc(UI.draftBadge) +
      '</p>' +
      '<h1 class="wz-brand">Wortschatz</h1>' +
      '<p class="wz-hello">' +
      esc(UI.hubHello) +
      (nick ? ', <span class="nm">' + esc(nick) + '</span>' : '') +
      '!</p>' +
      '<p class="wz-lead">' +
      esc(UI.hubSub) +
      '</p>' +
      '<p class="wz-counts">Jetzt verfügbar: <strong>' +
      data.entryCount +
      '</strong> Wörter (F ' +
      fCount +
      ' · C ' +
      cCount +
      ' · P ' +
      pCount +
      ') · <strong>' +
      data.textQuestionCount +
      '</strong> Textfragen · <strong>' +
      data.imageQuestionCount +
      '</strong> Bildfragen · 29 Kategorien</p>' +
      '</header>' +
      '<section class="wz-controls" aria-label="Filter">' +
      '<label class="wz-search-wrap"><span class="visually-hidden">Suche</span>' +
      '<input id="wzSearch" type="search" placeholder="' +
      esc(UI.searchPlaceholder) +
      '" autocomplete="off"/></label>' +
      '<div class="wz-filters">' +
      '<button type="button" class="wz-chip is-on" data-filter="all">Alle</button>' +
      '<button type="button" class="wz-chip" data-filter="alltag">' +
      esc(UI.filterEveryday) +
      '</button>' +
      '<button type="button" class="wz-chip" data-filter="schule">' +
      esc(UI.filterSchool) +
      '</button>' +
      '</div>' +
      '<div class="wz-level-row" id="wzLevelRow">' +
      '<span>' +
      esc(UI.filterLevel) +
      ':</span> ' +
      avail
        .map(
          (lv) =>
            '<button type="button" class="wz-pill is-available wz-level-chip' +
            (lv === selectedLevel ? ' is-selected' : '') +
            '" data-level="' +
            esc(lv) +
            '">' +
            esc(data.levelLabel(lv)) +
            '</button>'
        )
        .join(' ') +
      '</div>' +
      '</section>' +
      '<section class="wz-route">' +
      '<h2>' +
      esc(UI.guidedRoute) +
      '</h2>' +
      '<p>Alle Kategorien sind offen. Empfohlen: Fundamente → Festigen → Schulbrücke.</p>' +
      '<ol class="wz-route-list" id="wzRoute"></ol>' +
      '</section>' +
      '<section class="wz-doors">' +
      '<h2>' +
      esc(UI.allCategories) +
      '</h2>' +
      '<div class="wz-door-grid" id="wzDoors"></div>' +
      '</section>' +
      '<section class="wz-adult">' +
      '<details><summary>' +
      esc(UI.about) +
      '</summary>' +
      '<div class="wz-adult-body" lang="es">' +
      '<p>Wortschatz <strong>1.2.0</strong>: Fundamente + Festigen + Schulbrücke — ' +
      data.entryCount +
      ' sentidos, ' +
      data.textQuestionCount +
      ' preguntas de texto (+ ' +
      data.imageQuestionCount +
      ' de imagen). No es lista oficial del colegio ni certificación A1/CEFR.</p>' +
      '<p>Revisión léxica (notas para adultos): 101 consultadas / 1 parcial / resto editorial. Sin certificación nativa. Progreso local; Español solo con «Hilfe auf Spanisch».</p>' +

      '<p><button type="button" class="wz-btn wz-btn-ghost" id="wzReset">' +
      esc(UI.reset) +
      '</button></p>' +
      '</div></details></section>' +
      '<p class="wz-footer-nav"><a href="../aleman/index.html">← Alemán</a></p>';

    const doors = document.getElementById('wzDoors');
    const route = document.getElementById('wzRoute');

    function renderDoors() {
      doors.innerHTML = '';
      route.innerHTML = '';
      cats.forEach((cat) => {
        const cov = (cat.perLevelCoverage && cat.perLevelCoverage[selectedLevel]) || {};
        const nEnt = cov.primaryEntries || cov.membershipCount || cat.actualPrimaryEntries;
        const nQ = cov.questionCount || (cov.questionIds || []).length || (cat.questionIds || []).length;
        const ids = cov.entryIds || cat.entryIds || [];
        const sum = WortschatzProgress.summarize(store, ids);
        const g = groupOf(cat.id);
        const card =
          '<a class="wz-door" data-group="' +
          g +
          '" data-title="' +
          esc(cat.titleDe.toLowerCase()) +
          '" href="spielen.html?kategorie=' +
          encodeURIComponent(cat.id) +
          '&stufe=' +
          encodeURIComponent(selectedLevel) +
          '">' +
          '<span class="wz-door-emoji" aria-hidden="true">' +
          (EMOJI[cat.id] || '📚') +
          '</span>' +
          '<span class="wz-door-body">' +
          '<span class="wz-door-title">' +
          esc(cat.titleDe) +
          '</span>' +
          '<span class="wz-door-meta">' +
          nEnt +
          ' Wörter · ' +
          nQ +
          ' Textfragen · ' +
          esc(data.levelLabel(selectedLevel)) +
          '</span>' +
          '<span class="wz-door-prog">Sicher ' +
          sum.sicher_erkannt +
          ' · in Übung ' +
          (sum.in_uebung + sum.spaeter_wiederholen) +
          ' · neu ' +
          sum.neu +
          '</span>' +
          '</span></a>';
        doors.insertAdjacentHTML('beforeend', card);
        if (cat.routeOrder <= 8) {
          route.insertAdjacentHTML(
            'beforeend',
            '<li><a href="spielen.html?kategorie=' +
              encodeURIComponent(cat.id) +
              '&stufe=' +
              encodeURIComponent(selectedLevel) +
              '">' +
              esc(cat.titleDe) +
              '</a></li>'
          );
        }
      });
      applyFilter();
    }

    let filter = 'all';
    function applyFilter() {
      const q = (document.getElementById('wzSearch').value || '').trim().toLowerCase();
      document.querySelectorAll('.wz-door').forEach((el) => {
        const g = el.getAttribute('data-group');
        const title = el.getAttribute('data-title') || '';
        const okGroup = filter === 'all' || filter === g;
        const okSearch = !q || title.indexOf(q) >= 0;
        el.hidden = !(okGroup && okSearch);
      });
    }
    document.querySelectorAll('.wz-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wz-chip').forEach((b) => b.classList.remove('is-on'));
        btn.classList.add('is-on');
        filter = btn.getAttribute('data-filter');
        applyFilter();
      });
    });
    document.querySelectorAll('.wz-level-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedLevel = btn.getAttribute('data-level');
        document.querySelectorAll('.wz-level-chip').forEach((b) => b.classList.toggle('is-selected', b === btn));
        renderDoors();
      });
    });
    document.getElementById('wzSearch').addEventListener('input', applyFilter);
    document.getElementById('wzReset').addEventListener('click', () => {
      if (confirm(UI.resetConfirm)) {
        WortschatzProgress.resetAll();
        location.reload();
      }
    });
    renderDoors();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
