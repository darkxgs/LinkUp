/**
 * مزود جولات المعالم — بنك JSON محلي فقط (بدون Wikidata)
 */
(function (global) {
  function fetchRound(opts) {
    if (!global.LandmarksQuizBank) {
      return Promise.reject(new Error('LandmarksQuizBank not loaded'));
    }
    return global.LandmarksQuizBank.fetchRound(opts);
  }

  function loadCountries() {
    if (!global.LandmarksQuizBank) return Promise.resolve([]);
    return global.LandmarksQuizBank.loadCountries();
  }

  function renderRound(viewport, item, options) {
    if (global.FlagGuessMedia && typeof global.FlagGuessMedia.render === 'function') {
      global.FlagGuessMedia.render(viewport, item, options);
      return;
    }
    if (!viewport || !item) return;
    var img = document.createElement('img');
    img.className = 'landmark-img';
    img.alt = item.landmarkName || 'معلم';
    img.src = item.localImage || item.imageUrl || '';
    viewport.innerHTML = '';
    viewport.appendChild(img);
  }

  global.LandmarkQuizProvider = {
    fetchRound: fetchRound,
    loadCountries: loadCountries,
    renderRound: renderRound,
  };
})(window);
