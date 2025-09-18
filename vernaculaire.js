(function(){
  var root = document.querySelector('.gbif-inline');
  if (!root) return;

  var input = root.querySelector('.gbif-inline-input');
  var list  = root.querySelector('.gbif-inline-list');
  var targetSelector = root.getAttribute('data-target');

  var cfg = {
    language: (root.getAttribute('data-language') || 'fr').toLowerCase(),
    limit: parseInt(root.getAttribute('data-limit') || '12', 10),
    taxonClass: root.getAttribute('data-class') || 'Actinopterygii'
  };

  var state = { open:false, items:[], activeIndex:-1, lastQuery:'' };

  // ---------- UI helpers ----------
  function showList(){ if(!state.open){ state.open = true; list.style.display = 'block'; input.setAttribute('aria-expanded','true'); } }
  function hideList(){ if(state.open){ state.open = false; list.style.display = 'none'; input.setAttribute('aria-expanded','false'); state.activeIndex = -1; } }
  function debounce(fn, ms){ var t; return function(){ var a=arguments; clearTimeout(t); t=setTimeout(function(){ fn.apply(null,a); }, ms||250); }; }

  // ---------- Net helpers (fetch or XHR) ----------
  function fetchJson(url, onOk, onErr){
    if (window.fetch){
      fetch(url).then(function(r){
        if(!r.ok) throw new Error('HTTP '+r.status);
        return r.json();
      }).then(onOk).catch(onErr);
      return;
    }
    var x = new XMLHttpRequest();
    x.open('GET', url, true);
    x.onreadystatechange = function(){
      if (x.readyState === 4){
        if (x.status >= 200 && x.status < 300){
          try { onOk(JSON.parse(x.responseText)); }
          catch(e){ onErr(e); }
        } else { onErr(new Error('HTTP '+x.status)); }
      }
    };
    x.send();
  }

  // ---------- Rendu ----------
  function render(items, q){
    list.innerHTML = '';
    state.items = items || [];
    state.activeIndex = -1;

    if (!q){
      hideList(); return;
    }
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

  // ---------- Résolution du nom accepté si nécessaire ----------
  function resolveAcceptedNameIfNeeded(item, cb){
    var status = (item.status || '').toUpperCase();
    if (status === 'ACCEPTED' || !item.acceptedKey){
      cb(item.scientificName, item.key);
      return;
    }
    var url = 'https://api.gbif.org/v1/species/' + encodeURIComponent(item.acceptedKey);
    fetchJson(url, function(data){
      var name = (data && data.scientificName) ? data.scientificName : item.scientificName;
      var key  = (data && (data.key || data.acceptedKey || data.acceptedUsageKey)) ? (data.key || data.acceptedKey || data.acceptedUsageKey) : (item.acceptedKey || item.key);
      cb(name, key);
    }, function(){
      cb(item.scientificName, item.key);
    });
  }

  function selectIndex(i){
    if (i < 0 || i >= state.items.length) return;
    var item = state.items[i];

    resolveAcceptedNameIfNeeded(item, function(acceptedName, resolvedKey){
      // Remplit un champ cible si demandé
      if (targetSelector){
        var target = document.querySelector(targetSelector);
        if (target) target.value = acceptedName;
      }
      // Événement global
      try {
        var ev = new CustomEvent('gbif-select', { detail: { scientificName: acceptedName, key: resolvedKey } });
        document.dispatchEvent(ev);
      } catch(e){}
      // Remplit le champ de recherche
      input.value = acceptedName;
      hideList();
    });
  }

  // ---------- Recherche avec ACCEPTED + fallback ----------
  function buildUrl(q, acceptedOnly){
    var params = 'q=' + encodeURIComponent(q) +
                 '&qField=VERNACULAR&rank=species' +
                 (acceptedOnly ? '&status=ACCEPTED' : '') +
                 '&limit=' + encodeURIComponent(cfg.limit) +
                 '&language=' + encodeURIComponent(cfg.language) +
                 (cfg.taxonClass ? ('&class=' + encodeURIComponent(cfg.taxonClass)) : '');
    return 'https://api.gbif.org/v1/species/search?' + params;
  }

  function doSearch(q, acceptedOnly){
    var url = buildUrl(q, acceptedOnly);
    fetchJson(url, function(data){
      var results = (data && data.results) ? data.results : [];
      // Fallback si on a filtré ACCEPTED et qu'il n'y a rien
      if (acceptedOnly && results.length === 0){
        doSearch(q, false);
        return;
      }
      // Trie: ACCEPTED d'abord
      results.sort(function(a,b){
        var sa = ((a.status || a.taxonomicStatus) === 'ACCEPTED') ? 0 : 1;
        var sb = ((b.status || b.taxonomicStatus) === 'ACCEPTED') ? 0 : 1;
        return sa - sb;
      });
      // Map minimal pour l'UI
      var out = [];
      for (var i=0;i<results.length;i++){
        var r = results[i];
        if (!r.scientificName) continue;
        out.push({
          scientificName: r.scientificName,
          key: r.key,
          status: (r.status || r.taxonomicStatus || ''),
          acceptedKey: r.acceptedKey || r.acceptedUsageKey || null
        });
      }
      render(out, q);
    }, function(err){
      list.innerHTML = '<div class="gbif-inline-error">Erreur reseau. Reessaye.</div>';
      showList();
      if (window.console) console.error(err);
    });
  }

  function search(q){
    q = (q || '').replace(/^\s+|\s+$/g,'');
    state.lastQuery = q;
    if (!q){
      render([], '');
      return;
    }
    list.innerHTML = '<div class="gbif-inline-loading">Recherche...</div>';
    showList();
    doSearch(q, true); // on commence par ACCEPTED
  }

  var debounced = debounce(search, 300);

  // ---------- Events ----------
  input.addEventListener('input', function(e){ debounced(e.target.value); });
  input.addEventListener('focus', function(){ if (state.items.length) showList(); });
  input.addEventListener('blur', function(){ setTimeout(hideList, 120); });

  input.addEventListener('keydown', function(e){
    var items = list.querySelectorAll('.gbif-inline-item');
    var key = e.key || '';
    var code = e.keyCode || 0;

    if (key === 'ArrowDown' || code === 40){
      e.preventDefault();
      if (!state.open) showList();
      setActive(state.activeIndex + 1 >= items.length ? 0 : state.activeIndex + 1);
    } else if (key === 'ArrowUp' || code === 38){
      e.preventDefault();
      if (!state.open) showList();
      setActive(state.activeIndex - 1 < 0 ? items.length - 1 : state.activeIndex - 1);
    } else if (key === 'Enter' || code === 13){
      if (state.open && state.activeIndex >= 0){
        e.preventDefault();
        selectIndex(state.activeIndex);
      }
    } else if (key === 'Escape' || code === 27){
      hideList();
    }
  });
})();
