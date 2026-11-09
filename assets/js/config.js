/**
 * Child-facing German labels and hub metadata. No internal F/C/P codes shown raw.
 */
(function (global) {
  'use strict';

  const LEVEL_LABELS = {
    F: 'Fundamente',
    C: 'Festigen',
    P: 'Schulbrücke'
  };

  const LEVEL_BLURBS = {
    F: 'Grundworte für den Alltag und den Schulstart.',
    C: 'Festigen: mehr Alltag und Schulworte.',
    P: 'Schulbrücke: Wörter für den Unterricht in der 4. Klasse.'
  };

  const GROUPS = {
    alltag: {
      id: 'alltag',
      titleDe: 'Alltag',
      categoryIds: [
        'familie', 'koerper', 'gefuehle', 'wohnen', 'schule', 'essen', 'kleidung',
        'alltag', 'freizeit', 'zeit', 'wetter', 'tiere', 'pflanzen', 'stadt', 'verkehr', 'merkmale'
      ]
    },
    schule: {
      id: 'schule',
      titleDe: 'Schule & Fächer',
      categoryIds: [
        'auftraege', 'beziehungen', 'denken', 'zahlen', 'rechnen', 'geometrie', 'messen',
        'daten', 'forschen', 'geografie', 'geschichte', 'lesen', 'gestalten'
      ]
    }
  };

  const CATEGORY_EMOJI = {
    familie: '👨‍👩‍👧‍👦', koerper: '🧍', gefuehle: '💛', wohnen: '🏠', schule: '🏫',
    essen: '🍎', kleidung: '🧥', alltag: '⏰', freizeit: '⚽', zeit: '📅',
    wetter: '☔', tiere: '🐐', pflanzen: '🌳', stadt: '🏙️', verkehr: '🚌',
    merkmale: '🎨', auftraege: '📝', beziehungen: '↔️', denken: '🔗', zahlen: '🔢',
    rechnen: '➕', geometrie: '△', messen: '📏', daten: '📊', forschen: '🔬',
    geografie: '🗺️', geschichte: '⏳', lesen: '📖', gestalten: '✂️'
  };

  const MODE_LABELS = {
    entdecken: 'Entdecken',
    meaning_to_word: 'Bedeutung → Wort',
    // Legacy mode string context_to_meaning now means word → situation
    context_to_meaning: 'Wort → Situation',
    word_to_situation: 'Wort → Situation',
    picture_to_word: 'Bild → Wort',
    word_to_scene: 'Wort → Bild',
    review: 'Wiederholen'
  };

  const STORAGE_KEY = 'wortschatz_progress_v1';
  const NICK_KEY = 'sociales_nombre';

  const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30];

  const UI = {
    hubTitle: 'Wortschatz',
    hubHello: 'Hallo',
    hubSub: 'Wörter erkennen und verstehen — ohne Schreiben und ohne Noten.',
    availableOnly: 'Verfügbare Stufe',
    allCategories: 'Alle Kategorien',
    guidedRoute: 'Geführte Route',
    searchPlaceholder: 'Kategorie suchen…',
    filterEveryday: 'Alltag',
    filterSchool: 'Schule & Fächer',
    filterLevel: 'Stufe',
    play: 'Spielen',
    study: 'Entdecken',
    about: 'Hinweis für Erwachsene',
    backHub: 'Zur Übersicht',
    helpEs: 'Hilfe auf Spanisch',
    hideHelp: 'Hilfe schließen',
    hear: 'Vorlesen',
    next: 'Weiter',
    check: 'Fertig',
    correct: 'Richtig!',
    incorrect: 'Noch nicht. Schau:',
    assistedNote: 'Mit Hilfe geübt — zählt nicht als sicher erkannt.',
    sessionDone: 'Runde fertig',
    sicher: 'Sicher erkannt',
    inUebung: 'Noch in Übung',
    mitHilfe: 'Mit Hilfe',
    neu: 'Neu',
    reset: 'Fortschritt löschen',
    resetConfirm: 'Wirklich allen Wortschatz-Fortschritt auf diesem Gerät löschen?',
    noVoice: 'Keine deutsche Stimme gefunden. Wir üben mit Text und Bild.',
    draftBadge: 'Fundamente · Festigen · Schulbrücke',
    backGerman: 'Deutsch',
    inThisLevel: 'In dieser Kategorie',
    again: 'Nochmal'
  };

  global.WortschatzConfig = {
    LEVEL_LABELS,
    LEVEL_BLURBS,
    GROUPS,
    CATEGORY_EMOJI,
    MODE_LABELS,
    STORAGE_KEY,
    NICK_KEY,
    REVIEW_INTERVALS_DAYS,
    UI
  };
})(typeof window !== 'undefined' ? window : globalThis);
