(function () {
  var root = document.querySelector('.gbif-inline');
  if (!root) return;

  var input = root.querySelector('.gbif-inline-input');
  var list  = root.querySelector('.gbif-inline-list');
  var targetSelector = root.getAttribute('data-target');

  // ===== Constantes GBIF =====
  var GBIF_BACKBONE_DATASET   = 'd7dddbf4-2cf0-4f39-9b2a-bb099caae36c';
  var ACTINOPTERYGII_CLASSKEY = 204;

  // ===== Config =====
  var cfg = {
    language: (root.getAttribute('data-language') || 'fr').toLowerCase(),
    limit: parseInt(root.getAttribute('data-limit') || '12', 10),
    taxonClassKey: parseInt(root.getAttribute('data-classkey') || ACTINOPTERYGII_CLASSKEY, 10)
  };

  // ===== Aliases (chargés via JSON) =====
  var ALIASES = {};   // { "nom commun": "NomScientifique" }
  var FR2EN   = {};   // { "nom commun fr": "common name en" }
  var mapsReady = false;

  // Détermine le dossier du script pour charger les JSON voisins
  function getScriptBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i=scripts.length-1;i>=0;i--) {
      var src = scripts[i].getAttribute('src') || '';
      if (src && src.indexOf('vernaculaire.js') !== -1) {
        return src.split('/').slice(0,-1).join('/') || '.';
      }
    }
    return '.';
  }
  var BASE = getScriptBase();

  function fetchJson(url, onOk, onErr){
    if (window.fetch){
      fetch(url, { cache: 'no-store' })
        .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
        .then(onOk).catch(onErr);
      return;
    }
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onreadystatechange = function(){
      if (x.readyState === 4){
        if (x.status >= 200 && x.status < 300){
          try { onOk(JSON.parse(x.responseText)); } catch(e){ onErr(e); }
        } else { onErr(new Error('HTTP '+x.status)); }
      }
    };
    x.send();
  }

  // Charge aliases.json et fr_to_en.json (si absents : on continue silencieusement)
  function loadMaps(done){
    var pending = 2;
    function next(){ pending--; if (pending<=0){ mapsReady = true; if (done) done(); } }

    fetchJson(BASE + '/aliases.json', function(data){
      if (data && typeof data === 'object') ALIASES = data;
      next();
    }, function(){ next(); });

    fetchJson(BASE + '/fr_to_en.json', function(data){
      if (data && typeof data === 'object') FR2EN = data;
      next();
    }, function(){ next(); });
  }

  var state = { open:false, items:[], activeIndex:-1, lastQuery:'' };

  // ===== UI helpers =====
  function showList(){ if(!state.open){ state.open = true; list.style.display = 'block'; input.setAttribute('aria-expanded','true'); } }
  function hideList(){ if(state.open){ state.open = false; list.style.display = 'none'; input.setAttribute('aria-expanded','false'); state.activeIndex = -1; } }
  function debounce(fn, ms){ var t; return function(){ var a=arguments; clearTimeout(t); t=setTimeout(function(){ fn.apply(null,a); }, ms||250); }; }

  // ===== Rendu =====
  function render(items, q){
    list.innerHTML = '';
    state.items = items || [];
    state.activeIndex = -1;

    if (!q){ hideList(); return; }
    if (!items || !items.length){
      list.innerHTML = '<div class="gbif-inline-empty">Aucun resultat</div>';
      showList(); return;
    }

    for (var i=0;i<items.length;i++){
      var d = items[i];
      var div = document.createElement('div');
      div.className = 'gbif-inline-item';
      div.setAttribute('role','option');
      div.setAttribute('data-index', String(i));

      var sci = document.createElement('div');
      sci.className = 'gbif-sci';
      sci.appendChild(document.createTextNode(d.scientificName));

      var meta = document.createElement('div');
      meta.className = 'gbif-vern';
      var badge = (d.status === 'ACCEPTED') ? '[ACCEPTED]' : (d.status ? '['+d.status+']' : '');
      var info = '"' + q + '"' + (badge ? ' ' + badge : '');
      meta.appendChild(document.createTextNode(info));

      div.appendChild(sci);
      div.appendChild(meta);

      div.addEventListener('mousedown', function(e){
        e.preventDefault();
        selectIndex(parseInt(this.getAttribute('data-index'), 10));
      });

      list.appendChild(div);
    }
    showList();
  }

  function setActive(i){
    var items = list.querySelectorAll('.gbif-inline-item');
    for (var k=0;k<items.length;k++){ items[k].setAttribute('aria-selected','false'); }
    if (i >= 0 && i < items.length){
      items[i].setAttribute('aria-selected','true');
      if (items[i].scrollIntoView){ items[i].scrollIntoView({ block:'nearest' }); }
      state.activeIndex = i;
    } else {
      state.activeIndex = -1;
    }
  }

  // ===== Sélection / résolution nom accepté =====
  function resolveAcceptedNameIfNeeded(item, cb){
    var status = (item.status || '').toUpperCase();
    if (status === 'ACCEPTED' || !item.acceptedKey){
      cb(item.scientificName, item.key);
      return;
    }
    var url = 'https://api.gbif.org/v1/species/' + encodeURIComponent(item.acceptedKey);
    fetchJson(url, function(data){
      var cleanSci = function(s){ if (!s) return ''; var p = s.split(' '); return (p[0]||'') + ' ' + (p[1]||''); };
      var name = (data && (data.canonicalName || data.scientificName)) ?
                 (data.canonicalName || cleanSci(data.scientificName)) :
                 item.scientificName;
      var key  = (data && (data.key || data.acceptedKey || data.acceptedUsageKey)) ?
                 (data.key || data.acceptedKey || data.acceptedUsageKey) :
                 (item.acceptedKey || item.key);
      cb(name, key);
    }, function(){
      cb(item.scientificName, item.key);
    });
  }

  function selectIndex(i){
    if (i < 0 || i >= state.items.length) return;
    var item = state.items[i];

    resolveAcceptedNameIfNeeded(item, function(acceptedName, resolvedKey){
      if (targetSelector){
        var target = document.querySelector(targetSelector);
        if (target) target.value = acceptedName;
      }
      try {
        var ev = new CustomEvent('gbif-select', { detail: { scientificName: acceptedName, key: resolvedKey } });
        document.dispatchEvent(ev);
      } catch(e){}
      input.value = acceptedName;
      hideList();
    });
  }

  // ===== Recherche GBIF (paliers) =====
  function buildUrl(q, acceptedOnly, opts){
    // opts = { useDatasetKey: true/false, useQField: true/false }
    var params = [];
    params.push('q=' + encodeURIComponent(q));
    if (!opts || opts.useQField !== false) params.push('qField=VERNACULAR');
    params.push('rank=species');
    if (acceptedOnly) params.push('status=ACCEPTED');
    if (!opts || opts.useDatasetKey !== false) params.push('datasetKey=' + GBIF_BACKBONE_DATASET);
    params.push('classKey=' + encodeURIComponent(cfg.taxonClassKey));
    params.push('limit=' + encodeURIComponent(cfg.limit));
    return 'https://api.gbif.org/v1/species/search?' + params.join('&');
  }

  function doSearch(q, acceptedOnly){
    var stages = [
      { useDatasetKey:true,  useQField:true  },
      { useDatasetKey:false, useQField:true  },
      { useDatasetKey:true,  useQField:false }
    ];
    var idx = 0;

    function tryStage(){
      var url = buildUrl(q, acceptedOnly, stages[idx]);
      fetchJson(url, function(data){
        var results = (data && data.results) ? data.results : [];

        // Sécurité : poissons seulement (classKey=204 ou class='Actinopterygii')
        results = results.filter(function(r){
          var ck = (r.classKey != null) ? String(r.classKey) : '';
          var cname = r.class ? String(r.class).toLowerCase() : '';
          return ck === String(cfg.taxonClassKey) || cname === 'actinopterygii';
        });

        if (!results.length){
          idx++;
          if (idx < stages.length){ tryStage(); return; }
          if (acceptedOnly){
            // Fallback EN avant d'ouvrir status
            var en = translateFrToEn(q);
            if (en && en !== q){ doSearch(en, true); return; }
            doSearch(q, false);
            return;
          }
          var en2 = translateFrToEn(q);
          if (en2 && en2 !== q){ doSearch(en2, false); return; }
          render([], q);
          return;
        }

        // Tri: ACCEPTED d'abord
        results.sort(function(a,b){
          var sa = ((a.status || a.taxonomicStatus) === 'ACCEPTED') ? 0 : 1;
          var sb = ((b.status || b.taxonomicStatus) === 'ACCEPTED') ? 0 : 1;
          return sa - sb;
        });

        var out = [];
        for (var i=0;i<results.length;i++){
          var r = results[i];
          if (!r.scientificName && !r.canonicalName) continue;
          var name = r.canonicalName;
          if (!name && r.scientificName){
            var p = r.scientificName.split(' ');
            name = (p[0] || '') + ' ' + (p[1] || '');
          }
          out.push({
            scientificName: name,
            key: r.key,
            status: (r.status || r.taxonomicStatus || ''),
            acceptedKey: r.acceptedKey || r.acceptedUsageKey || null
          });
        }

        render(out, q);
      }, function(){
        idx++;
        if (idx < stages.length){ tryStage(); return; }
        if (acceptedOnly){ doSearch(q, false); return; }
        list.innerHTML = '<div class="gbif-inline-error">Erreur reseau. Reessaye.</div>';
        showList();
      });
    }

    tryStage();
  }

  // ===== Aliases & traduction =====
  function lookupAlias(q){
    if (!q) return null;
    var k = String(q).toLowerCase().trim();
    return ALIASES[k] || null;
  }
  function translateFrToEn(q){
    if (!q) return null;
    var k = String(q).toLowerCase().trim();
    return FR2EN[k] || null;
  }

  // ===== Search wrapper =====
  function search(q){
    q = (q || '').replace(/^\s+|\s+$/g,'');
    state.lastQuery = q;
    if (!q){ render([], ''); return; }

    // 0) alias direct depuis JSON
    var aliasSci = lookupAlias(q);
    if (aliasSci){
      render([{ scientificName: aliasSci, key: null, status: 'ALIAS', acceptedKey: null }], q);
      return;
    }

    list.innerHTML = '<div class="gbif-inline-loading">Recherche...</div>';
    showList();
    doSearch(q, true); // commence par ACCEPTED
  }

  var debounced = debounce(search, 300);

  // ===== Events =====
  input.addEventListener('input', function(e){ if(!mapsReady) return; debounced(e.target.value); });
  input.addEventListener('focus', function(){ if (state.items.length) showList(); });
  input.addEventListener('blur',  function(){ setTimeout(hideList, 120); });
  input.addEventListener('keydown', function(e){
    var items = list.querySelectorAll('.gbif-inline-item');
    var key = e.key || '';
    var code = e.keyCode || 0;
    if (key === 'ArrowDown' || code === 40){ e.preventDefault(); if (!state.open) showList(); setActive(state.activeIndex + 1 >= items.length ? 0 : state.activeIndex + 1); }
    else if (key === 'ArrowUp' || code === 38){ e.preventDefault(); if (!state.open) showList(); setActive(state.activeIndex - 1 < 0 ? items.length - 1 : state.activeIndex - 1); }
    else if (key === 'Enter' || code === 13){ if (state.open && state.activeIndex >= 0){ e.preventDefault(); selectIndex(state.activeIndex); } }
    else if (key === 'Escape' || code === 27){ hideList(); }
  });

  // ===== Démarrage : charger les JSON puis activer la recherche =====
  loadMaps(function(){
    // Si tu veux une valeur initiale, déclenche ici : search(input.value);
  });
})();
