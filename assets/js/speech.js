/**
 * Optional German speechSynthesis. User gesture required. Cancel on navigation/next.
 * Read-aloud of visible text is a reading aid — never listening mastery.
 */
(function (global) {
  'use strict';

  let voice = null;
  let ready = false;
  let unsupported = false;
  let listeners = [];

  function isGermanVoice(v) {
    if (!v) return false;
    const lang = String(v.lang || '');
    const name = String(v.name || '');
    // Never accept English (or other) voices for German read-aloud
    if (/^en([-_]|$)/i.test(lang)) return false;
    return /^de([-_]|$)/i.test(lang) || /german|deutsch/i.test(name);
  }

  function pickGermanVoice() {
    if (!global.speechSynthesis) {
      unsupported = true;
      voice = null;
      ready = true;
      return null;
    }
    unsupported = false;
    const voices = speechSynthesis.getVoices() || [];
    const de = voices.filter(isGermanVoice);
    // Prefer de-DE local if marked
    de.sort((a, b) => {
      const al = (a.localService ? 0 : 1) - (b.localService ? 0 : 1);
      if (al) return al;
      return (b.lang || '').localeCompare(a.lang || '');
    });
    voice = de[0] || null;
    ready = true;
    listeners.forEach((fn) => {
      try {
        fn(voice);
      } catch (e) {}
    });
    return voice;
  }

  function init() {
    if (!global.speechSynthesis) {
      unsupported = true;
      ready = true;
      return;
    }
    pickGermanVoice();
    if (typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', pickGermanVoice);
    } else {
      speechSynthesis.onvoiceschanged = pickGermanVoice;
    }
    // Delayed re-check for browsers that populate voices late
    setTimeout(pickGermanVoice, 250);
    setTimeout(pickGermanVoice, 1000);
  }

  function onReady(fn) {
    listeners.push(fn);
    if (ready) fn(voice);
  }

  function hasGermanVoice() {
    return !!voice;
  }

  function status() {
    return {
      unsupported: unsupported,
      ready: ready,
      hasGerman: !!voice,
      voiceName: voice ? voice.name : null,
      voiceLang: voice ? voice.lang : null
    };
  }

  function cancel() {
    try {
      if (global.speechSynthesis) speechSynthesis.cancel();
    } catch (e) {}
  }

  function speak(text, opts) {
    opts = opts || {};
    if (!global.speechSynthesis) {
      if (opts.onError) opts.onError(new Error('no speechSynthesis'));
      return false;
    }
    if (!voice) pickGermanVoice();
    if (!voice || !isGermanVoice(voice)) {
      voice = null;
      if (opts.onError) opts.onError(new Error('no German voice'));
      return false;
    }
    cancel();
    try {
      const u = new SpeechSynthesisUtterance(String(text || ''));
      u.voice = voice;
      u.lang = voice.lang || 'de-DE';
      // Force German language tag — never inherit page/en default
      if (!/^de/i.test(u.lang)) u.lang = 'de-DE';
      u.rate = opts.rate || 0.92;
      u.pitch = 1;
      if (opts.onEnd) u.onend = opts.onEnd;
      if (opts.onError) u.onerror = opts.onError;
      speechSynthesis.speak(u);
      return true;
    } catch (e) {
      if (opts.onError) opts.onError(e);
      return false;
    }
  }

  function resetForTests() {
    voice = null;
    ready = false;
    unsupported = false;
    listeners = [];
  }

  init();

  global.WortschatzSpeech = {
    init: init,
    onReady: onReady,
    hasGermanVoice: hasGermanVoice,
    status: status,
    speak: speak,
    cancel: cancel,
    pickGermanVoice: pickGermanVoice,
    isGermanVoice: isGermanVoice,
    resetForTests: resetForTests
  };
})(typeof window !== 'undefined' ? window : globalThis);
