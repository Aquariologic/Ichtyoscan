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

    var state = { open:false, items:[], activeIndex:-1 };

    function showList(){ if(!state.open){ state.open = true; list.style.display = 'block'; input.setAttribute('aria-expanded','true'); } }
    function hideList(){ if(state.open){ state.open = false; list.style.display = 'none'; input.setAttribute('aria-expanded','false'); state.activeIndex = -1; } }

    function debounce(fn, ms){
      var t; return function(){ var args = arguments; clearTimeout(t); t = setTimeout(function(){ fn.apply(null, args); }, ms||250); };
    }

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

        var vern = document.createElement('div');
        vern.className = 'gbif-vern';
        vern.appendChild(document.createTextNode('"' + q + '"'));

        div.appendChild(sci);
        div.appendChild(vern);

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

    function selectIndex(i){
      if (i < 0 || i >= state.items.length) return;
      var d = state.items[i];
      var scientificName = d.scientificName;
      var key = d.key;

      if (targetSelector){
        var target = document.querySelector(targetSelector);
        if (target) target.value = scientificName;
      }

      try {
        var ev = new CustomEvent('gbif-select', { detail: { scientificName: scientificName, key: key } });
        document.dispatchEvent(ev);
      } catch(e){}

      input.value = scientificName;
      hideList();
    }

    function search(q){
      q = (q || '').replace(/^\s+|\s+$/g,'');
      if (!q){
        render([], '');
        return;
      }

      list.innerHTML = '<div class="gbif-inline-loading">Recherche...</div>';
      showList();

      var params = 'q=' + encodeURIComponent(q) +
                   '&qField=VERNACULAR&rank=species' +
                   '&limit=' + encodeURIComponent(cfg.limit) +
                   '&language=' + encodeURIComponent(cfg.language) +
                   (cfg.taxonClass ? ('&class=' + encodeURIComponent(cfg.taxonClass)) : '');
      var url = 'https://api.gbif.org/v1/species/search?' + params;

      if (window.fetch){
        fetch(url).then(function(r){
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function(data){
          var results = data && data.results ? data.results : [];
          var out = [];
          for (var i=0;i<results.length;i++){
            if (results[i].scientificName){
              out.push({ scientificName: results[i].scientificName, key: results[i].key });
            }
          }
          render(out, q);
        }).catch(function(err){
          list.innerHTML = '<div class="gbif-inline-error">Erreur reseau. Reessaye.</div>';
          showList();
          if (window.console) console.error(err);
        });
      } else {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = function(){
          if (xhr.readyState === 4){
            if (xhr.status >= 200 && xhr.status < 300){
              try {
                var data = JSON.parse(xhr.responseText);
                var results = data && data.results ? data.results : [];
                var out = [];
                for (var i=0;i<results.length;i++){
                  if (results[i].scientificName){
                    out.push({ scientificName: results[i].scientificName, key: results[i].key });
                  }
                }
                render(out, q);
              } catch(e){
                list.innerHTML = '<div class="gbif-inline-error">Parse JSON error</div>';
              }
            } else {
              list.innerHTML = '<div class="gbif-inline-error">Erreur reseau. Reessaye.</div>';
            }
            showList();
          }
        };
        xhr.send();
      }
    }

    var debounced = debounce(search, 300);

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
