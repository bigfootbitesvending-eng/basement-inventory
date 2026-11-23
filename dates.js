    // Basement Inventory and Location Dates share this file (PRD-006 item 4, step 0: moved out of index.html v3.6.0, text unchanged).
    // It is a plain script, loaded before each page's own script. Its functions use these globals from the page that loads it:
    // currentProduct, datePlace, datePlaceName, apiGetJson, apiPostJson, mapProduct, escapeHtml, showBanner, showProductMessage,
    // playErrorBuzz, onDatesRefreshed (called with the product after its dates are read again), and (Basement Inventory only) stopScanner. Markup ids: docs/specs/prd-006-step0-shared-dates.md
    // in bigfoot-bites-repo. The indentation is the page's, kept so the page tests' mutations still match this text.

    // ============================================
    // DATES (PRD-006). Every change goes through Dated Stock — Write; the page never ends a date by itself.
    // ============================================
    var DATE_WRITE = '/dated-stock/write';
    var BASEMENT = 'Basement';

    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dateBusy = false;

    // "2026-11-28" -> "Sat Nov 28, 2026". Dates always show the year (PRD rule).
    function showDate(iso) {
      var d = new Date(iso + 'T00:00:00Z');
      return DAYS[d.getUTCDay()] + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
    }
    function todayIso() {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
    function isTracked(product) {
      return !!product && !product.retiredAt && !product.noDateNeeded;
    }

    // One row's fields as "YYYY-MM-DD", '' when blank, or null when filled in but not a real date.
    // The year is never filled in for the person (PRD rule: typed entry asks for month, day and year).
    function rowDate(row) {
      var m = row.querySelector('.date-month').value;
      var d = row.querySelector('.date-day').value.trim();
      var y = row.querySelector('.date-year').value.trim();
      if (!m && !d) return '';   // the year always has a value: the pulldown starts on this year (Randy, 2026-11-19)
      if (!m || !/^[0-9]{1,2}$/.test(d) || !/^[0-9]{4}$/.test(y)) return null;
      var iso = y + '-' + m + '-' + String(Number(d)).padStart(2, '0');
      var check = new Date(iso + 'T00:00:00Z');
      if (Number(y) < 2000 || Number(y) > 2099 || isNaN(check) || check.toISOString().slice(0, 10) !== iso) return null;
      return iso;
    }
    function updateReadback(row) {
      var out = row.querySelector('.date-readback');
      var iso = rowDate(row);
      if (iso === '') { out.textContent = 'Month and day as printed, and check the year'; out.className = 'date-readback blank'; return; }
      if (iso === null) { out.textContent = 'Not a full date yet'; out.className = 'date-readback blank'; return; }
      var past = iso < todayIso();
      // A past date on this year's default is most often next year's date with the year left alone.
      var onDefault = iso.slice(0, 4) === String(new Date().getFullYear());
      out.textContent = showDate(iso) + (past ? ' · Already expired' + (onDefault ? '. Is the year right?' : '') : '');
      out.className = 'date-readback' + (past ? ' warn' : '');
    }
    // One date's fields and its read-back line: the date form's rows, and Wrong date on Location Dates.
    function dateFieldsHtml() {
      var opts = '<option value="">Month</option>';
      for (var i = 0; i < 12; i++) opts += '<option value="' + String(i + 1).padStart(2, '0') + '">' + MONTHS[i] + '</option>';
      // Years: two back (stale stock does arrive) to five ahead (cans run to 2030); this year is chosen.
      var thisYear = new Date().getFullYear(), years = '';
      for (var yr = thisYear - 2; yr <= thisYear + 5; yr++) years += '<option value="' + yr + '"' + (yr === thisYear ? ' selected' : '') + '>' + yr + '</option>';
      return '<div class="date-fields">' +
          '<label class="date-month-label">Month<select class="date-month">' + opts + '</select></label>' +
          '<label>Day<input class="date-day" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="2" autocomplete="off"></label>' +
          '<label class="date-year-label">Year<select class="date-year">' + years + '</select></label>' +
        '</div>' +
        '<div class="date-readback blank"></div>';
    }
    function addDateRow() {
      var rows = document.getElementById('dateRows');
      var row = document.createElement('div');
      row.className = 'date-row';
      row.innerHTML = dateFieldsHtml() +
        (photoOn() ? photoRowHtml() : '') +
        (rows.children.length ? '<button type="button" class="date-row-remove">Remove this date</button>' : '');
      row.addEventListener('input', function(e) { if (e.target && e.target.classList) e.target.classList.remove('date-unclear'); updateReadback(row); });
      row.addEventListener('change', function(e) { if (e.target && e.target.classList) e.target.classList.remove('date-unclear'); updateReadback(row); });
      wirePhotoRow(row);
      var remove = row.querySelector('.date-row-remove');
      if (remove) remove.onclick = function() { row.remove(); updateSaveLabel(); };
      rows.appendChild(row);
      updateReadback(row);
      updateSaveLabel();
    }
    function updateSaveLabel() {
      var n = document.querySelectorAll('#dateRows .date-row').length;
      document.getElementById('dateSaveBtn').textContent = n > 1 ? 'Save ' + n + ' dates' : 'Save date';
    }
    // source 'in': offered after an IN, so it ends in a date or a Skip (an offer outcome).
    // source 'button': the person chose "Add a date" for stock already here; Cancel sends nothing and the count is untouched.
    var dateOfferSource = null;
    function offerDate(source) {
      if (!isTracked(currentProduct)) return;
      var offer = document.getElementById('dateOffer');
      // An IN while the form is already open keeps what was typed; it only becomes an offer that can be skipped.
      if (offer.classList.contains('hidden') || !document.querySelector('#dateRows .date-row')) {
        document.getElementById('dateRows').innerHTML = '';
        addDateRow();
      }
      dateOfferSource = source === 'button' && !(dateOfferSource === 'in' && !offer.classList.contains('hidden')) ? 'button' : 'in';
      document.getElementById('dateSkipBtn').textContent = dateOfferSource === 'in' ? 'Skip' : 'Cancel';
      setDateBusy(false);
      offer.classList.remove('hidden');
      document.getElementById('addDateBtn').classList.add('hidden');
    }
    function openDateForm() { offerDate('button'); }
    function hideDateOffer() {
      dateBusy = false;   // BUG-094: a closed form is never busy, or Remove, Pulled it and settings wait on it
      document.getElementById('dateOffer').classList.add('hidden');
      document.getElementById('dateRows').innerHTML = '';
      dateOfferSource = null;
      var btn = document.getElementById('addDateBtn');
      if (btn) btn.classList.toggle('hidden', !isTracked(currentProduct));
    }
    function setDateBusy(busy, label) {
      dateBusy = busy;
      ['dateSaveBtn', 'dateSkipBtn', 'dateNeverBtn'].forEach(function(id) { document.getElementById(id).disabled = busy; });
      if (busy && label) document.getElementById('dateSaveBtn').textContent = label;
      if (!busy) updateSaveLabel();
    }

    function saveDates() {
      if (dateBusy || !currentProduct) return;
      var rows = document.querySelectorAll('#dateRows .date-row');
      var dates = [], entries = [], seen = {}, printFormat = null;
      for (var i = 0; i < rows.length; i++) {
        var iso = rowDate(rows[i]);
        if (iso === '') continue;
        if (iso === null) { showBanner('Nothing saved. Date ' + (i + 1) + ' isn\'t a full date: it needs the month, day and year.', 'error'); return; }
        if (seen[iso]) continue;
        seen[iso] = true; dates.push(iso);
        var entry = photoEntry(rows[i], iso);
        entries.push(entry);
        // The product remembers how it prints its date only from a read the person accepted (PRD Behavior 11), or (BUG-093)
        // a no-year read the page refused where the person typed exactly the date the year would have been chosen as: the
        // print really has no year (milk). A typed date in another year means the print had one, so nothing is learned.
        var pr = rows[i].__photo && rows[i].__photo.response;
        if (!printFormat && pr && pr.print_format) {
          if (entry.answer === 'accepted') printFormat = pr.print_format;
          else if (entry.answer === 'typed' && pr.result === 'reject' && pr.no_year && pr.no_year.date === iso && pr.print_format.year_missing === true) printFormat = pr.print_format;
        }
      }
      if (!dates.length) { showBanner('Nothing saved. Enter the date on the package, or tap ' + (dateOfferSource === 'in' ? 'Skip' : 'Cancel') + '.', 'error'); return; }
      var product = currentProduct;
      var what = product.name + ', ' + dates.map(showDate).join('; ');
      setDateBusy(true, 'Saving…');
      var place = datePlace, placeName = datePlaceName;
      var payload = { action: 'add_dates', upc: product.upc, place: place, offered_from: 'scan', dates: entries };
      if (printFormat) payload.print_format = printFormat;
      apiPostJson(DATE_WRITE, payload).then(function(res) {
        var b = res.body || {};
        if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
        var added = Array.isArray(b.added) ? b.added : [];
        hideDateOffer();
        if (added.length) showBanner('Saved' + (place !== BASEMENT ? ' at ' + placeName : '') + ': ' + product.name + ', ' + added.map(showDate).join('; ') +
          (added.length < dates.length ? '. The rest were already on file.' : '.'), 'success');
        else showBanner('Already on file' + (place !== BASEMENT ? ' at ' + placeName : '') + ': ' + what + '. Nothing added.', 'success');
        refreshDates(product.upc);
      }).catch(function(err) {
        setDateBusy(false);
        playErrorBuzz();
        showBanner('Nothing saved. Couldn\'t save ' + what + '. (' + err.message + ')', 'error');
      });
    }

    function skipDates() {
      if (dateBusy || !currentProduct) return;
      answerUnsavedReads();   // a photo that gave no usable date reaches the monthly review either way
      if (dateOfferSource !== 'in') { hideDateOffer(); return; }   // Cancel on "Add a date": not an offer, nothing to record
      var product = currentProduct;
      setDateBusy(true);
      apiPostJson(DATE_WRITE, { action: 'add_dates', upc: product.upc, place: datePlace, offered_from: 'scan', dates: [], outcome: 'skipped' })
        .then(function(res) {
          var b = res.body || {};
          if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
          hideDateOffer();
        }).catch(function(err) {
          setDateBusy(false);
          showBanner('Couldn\'t record the skip for ' + product.name + '. No date was saved either way. (' + err.message + ')', 'error');
        });
    }

    // "Never ask for this one": switches the product to no date needed from the form that asked. After an IN the offer
    // is recorded as skipped first, so the offer count stays whole; then the switch. Asks first, since every scan stops asking.
    function neverAskDate() {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct;
      if (!confirm('Stop asking for a date on ' + product.name + '? You can switch it back under Product settings.')) return;
      answerUnsavedReads();
      setDateBusy(true);
      var skip = dateOfferSource === 'in'
        ? apiPostJson(DATE_WRITE, { action: 'add_dates', upc: product.upc, place: datePlace, offered_from: 'scan', dates: [], outcome: 'skipped' })
        : Promise.resolve({ ok: true, body: { ok: true } });
      skip.then(function(res) {
        var b = res.body || {};
        if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
        return apiPostJson(DATE_WRITE, { action: 'set_product', upc: product.upc, no_date_needed: true });
      }).then(function(res) {
        var b = res.body || {};
        if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
        product.noDateNeeded = true;
        hideDateOffer();
        showBanner('No date needed: ' + product.name + '. Scans won\'t ask for a date.', 'success');
        refreshDates(product.upc);
      }).catch(function(err) {
        setDateBusy(false);
        showBanner('Nothing changed. Couldn\'t switch ' + product.name + ' to no date needed. (' + err.message + ')', 'error');
      });
    }

    // The chosen place's dates on file, oldest first. A basement date has Remove; a location date has "Pulled it" and
    // "None there" (PRD-006: a location date is marked found, never removed).
    function renderDates(product) {
      var box = document.getElementById('datesOnFile');
      var settings = document.getElementById('productSettings');
      if (settings.classList.contains('hidden') || currentProduct !== settings.__product) settings.open = false;   // closed each time a product opens
      settings.__product = currentProduct;
      // On every screen, folded, with Retire inside it (Randy, 2026-11-19, reversing PRD-003 Behavior 5's Inventory-only rule).
      settings.classList.remove('hidden');
      document.getElementById('dateSettings').classList.toggle('hidden', !!product.retiredAt);   // a retired product takes no dates
      document.getElementById('addDateBtn').classList.toggle('hidden', !isTracked(product) || !document.getElementById('dateOffer').classList.contains('hidden'));
      document.getElementById('noDateNeeded').checked = product.noDateNeeded;
      document.getElementById('pullDays').value = product.pullDays;
      document.getElementById('leadDays').value = product.leadDays;
      var mine = product.openDates.filter(function(d) { return d.place === datePlace; })
        .sort(function(a, b) { return a.expiry_date < b.expiry_date ? -1 : a.expiry_date > b.expiry_date ? 1 : a.id - b.id; });
      if (!mine.length && product.noDateNeeded) {
        box.innerHTML = '<div class="date-hint" style="margin:0">No date needed for this product. Change it under Product settings.</div>';
        box.classList.remove('hidden');
        return;
      }
      if (!mine.length) { box.innerHTML = ''; box.classList.add('hidden'); return; }
      var today = todayIso();
      var here = atLocation();
      box.innerHTML = '<div class="dates-title">' + escapeHtml(datePlaceName) + ' dates on file</div>' + mine.map(function(d) {
        var at = ' data-id="' + escapeHtml(d.id) + '" data-date="' + escapeHtml(d.expiry_date) + '"';
        return '<div class="date-line"><span>' + escapeHtml(showDate(d.expiry_date)) + (d.expiry_date < today ? ' · <b>Expired</b>' : '') + '</span>' +
          (here ? '<span class="found-btns"><button type="button"' + at + ' data-found="pulled">Pulled it</button>' +
                  '<button type="button" class="none-there"' + at + ' data-found="none_there">None there</button></span>' +
                  '<button type="button" class="wrong-date"' + at + ' data-wrong="1">Wrong date</button>'
                : '<button type="button"' + at + '>Remove</button>') + '</div>';
      }).join('');
      box.classList.remove('hidden');
      Array.prototype.forEach.call(box.querySelectorAll('button[data-id]'), function(btn) {
        btn.onclick = function() { if (btn.getAttribute('data-wrong')) openWrongDate(btn); else if (btn.getAttribute('data-found')) markFound(btn); else removeDate(btn); };
      });
    }

    function removeDate(btn) {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct;
      var label = showDate(btn.getAttribute('data-date'));
      if (!confirm('Remove the basement date ' + label + ' for ' + product.name + '?')) return;
      dateBusy = true;
      btn.disabled = true;
      btn.textContent = 'Removing…';
      apiPostJson(DATE_WRITE, { action: 'remove_date', id: Number(btn.getAttribute('data-id')) })
        .then(function(res) {
          var b = res.body || {};
          if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
          dateBusy = false;
          showBanner('Removed: ' + product.name + ', ' + label + '.', 'success');
          refreshDates(product.upc);
        }).catch(function(err) {
          dateBusy = false;
          btn.disabled = false;
          btn.textContent = 'Remove';
          showBanner('Nothing changed. Couldn\'t remove ' + label + ' for ' + product.name + '. (' + err.message + ')', 'error');
        });
    }

    // A location date found on the shelf and pulled, or not there at all. The server files a pull as expired or near date.
    function markFound(btn) {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct, placeName = datePlaceName;
      var found = btn.getAttribute('data-found');
      var label = showDate(btn.getAttribute('data-date'));
      var ask = found === 'pulled' ? 'Pulled ' + product.name + ', ' + label + ', off the shelf at ' + placeName + '?'
                                   : 'None of ' + product.name + ', ' + label + ', on the shelf at ' + placeName + '?';
      if (!confirm(ask)) return;
      dateBusy = true;
      var both = btn.parentNode.querySelectorAll('button');
      Array.prototype.forEach.call(both, function(b) { b.disabled = true; });
      btn.textContent = 'Saving…';
      apiPostJson(DATE_WRITE, { action: 'mark_found', id: Number(btn.getAttribute('data-id')), found: found })
        .then(function(res) {
          var b = res.body || {};
          if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
          dateBusy = false;
          var filed = b.end_kind === 'expired' ? ' Filed as expired.' : b.end_kind === 'near_date' ? ' Filed as pulled before its date.' : '';
          showBanner((found === 'pulled' ? 'Pulled: ' : 'None there: ') + product.name + ', ' + label + ', at ' + placeName + '.' + filed, 'success');
          refreshDates(product.upc);
        }).catch(function(err) {
          dateBusy = false;
          Array.prototype.forEach.call(both, function(b) { b.disabled = false; });
          btn.textContent = found === 'pulled' ? 'Pulled it' : 'None there';
          showBanner('Nothing changed. Couldn\'t mark ' + label + ' for ' + product.name + '. (' + err.message + ')', 'error');
        });
    }

    // Wrong date (Randy, 2026-11-23): a record at a location that isn't what is printed, or was never there. Change keeps the record
    // (the server merges it with one already on file); Remove files it "removed", so it never counts as pulled, expired or none there.
    function openWrongDate(btn) {
      if (dateBusy || !currentProduct) return;
      var id = Number(btn.getAttribute('data-id')), iso = btn.getAttribute('data-date');
      var box = btn.parentNode;
      box.innerHTML = '<div class="date-edit"><div class="dates-title">Wrong date: ' + escapeHtml(showDate(iso)) + '</div>' + dateFieldsHtml() +
        '<div class="date-edit-acts"><button type="button" class="btn btn-in wrong-change">Change the date</button>' +
        '<button type="button" class="btn wrong-remove">Remove it</button>' +
        '<button type="button" class="btn btn-secondary wrong-cancel">Cancel</button></div></div>';
      var year = box.querySelector('.date-year');
      box.querySelector('.date-month').value = iso.slice(5, 7);
      box.querySelector('.date-day').value = String(Number(iso.slice(8)));
      year.value = iso.slice(0, 4);
      if (year.value !== iso.slice(0, 4)) {   // a year outside the pulldown
        var o = document.createElement('option'); o.value = o.textContent = iso.slice(0, 4); year.insertBefore(o, year.firstChild); year.value = o.value;
      }
      updateReadback(box);
      box.addEventListener('input', function() { if (box.querySelector('.date-edit')) updateReadback(box); });
      box.addEventListener('change', function() { if (box.querySelector('.date-edit')) updateReadback(box); });
      box.querySelector('.wrong-change').onclick = function() { changeWrongDate(box, id, iso); };
      box.querySelector('.wrong-remove').onclick = function() { removeWrongDate(box, id, iso); };
      box.querySelector('.wrong-cancel').onclick = function() { renderDates(currentProduct); };
    }
    function setWrongBusy(box, busy) {
      dateBusy = busy;
      Array.prototype.forEach.call(box.querySelectorAll('button'), function(b) { b.disabled = busy; });
      if (!busy) { box.querySelector('.wrong-change').textContent = 'Change the date'; box.querySelector('.wrong-remove').textContent = 'Remove it'; }
    }
    function sendWrongDate(box, body, done, failed) {
      var product = currentProduct;
      setWrongBusy(box, true);
      apiPostJson(DATE_WRITE, body).then(function(res) {
        var b = res.body || {};
        if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
        dateBusy = false;
        if (b.changed === false) showBanner('Nothing changed. That date was already marked.', 'warning');
        else showBanner(done(b), 'success');
        refreshDates(product.upc);
      }).catch(function(err) {
        setWrongBusy(box, false);
        showBanner('Nothing changed. ' + failed + ' (' + err.message + ')', 'error');
      });
    }
    function changeWrongDate(box, id, iso) {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct, placeName = datePlaceName, next = rowDate(box);
      if (!next) { showBanner('Nothing changed. The date needs the month, day and year.', 'error'); return; }
      if (next === iso) { showBanner('Nothing changed. That\'s the date on file.', 'warning'); return; }
      box.querySelector('.wrong-change').textContent = 'Saving…';
      sendWrongDate(box, { action: 'correct_date', id: id, date: next }, function(b) {
        return 'Changed at ' + placeName + ': ' + product.name + ', ' + showDate(iso) + ' is now ' + showDate(next) + '.' +
          (b.merged_into ? ' ' + showDate(next) + ' was already on file, so there\'s one date now.' : '');
      }, 'Couldn\'t change ' + showDate(iso) + ' for ' + product.name + '.');
    }
    function removeWrongDate(box, id, iso) {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct, placeName = datePlaceName, label = showDate(iso);
      if (!confirm('Remove ' + product.name + ', ' + label + ', at ' + placeName + '? For a date that was never there. If you pulled it, use Pulled it.')) return;
      box.querySelector('.wrong-remove').textContent = 'Removing…';
      sendWrongDate(box, { action: 'remove_date', id: id }, function() {
        return 'Removed: ' + product.name + ', ' + label + ', at ' + placeName + '.';
      }, 'Couldn\'t remove ' + label + ' for ' + product.name + '.');
    }

    function saveDateSettings() {
      if (dateBusy || !currentProduct) return;
      var product = currentProduct;
      var pull = document.getElementById('pullDays').value.trim();
      var lead = document.getElementById('leadDays').value.trim();
      var okDays = function(v) { return /^[0-9]{1,3}$/.test(v) && Number(v) <= 365; };
      if (!okDays(pull) || !okDays(lead)) { showBanner('Nothing saved. Pull days and lead days are whole numbers from 0 to 365.', 'error'); return; }
      var change = { action: 'set_product', upc: product.upc };
      var noDate = document.getElementById('noDateNeeded').checked;
      if (noDate !== product.noDateNeeded) change.no_date_needed = noDate;
      if (Number(pull) !== product.pullDays) change.pull_days = Number(pull);
      if (Number(lead) !== product.leadDays) change.basement_lead_days = Number(lead);
      if (Object.keys(change).length === 2) { showBanner('Nothing to save: the date settings are unchanged.', 'success'); return; }
      var btn = document.getElementById('dateSettingsBtn');
      dateBusy = true;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      apiPostJson(DATE_WRITE, change).then(function(res) {
        var b = res.body || {};
        if (!res.ok || b.ok !== true) throw new Error(b.error || ('status ' + res.status));
        dateBusy = false;
        btn.disabled = false;
        btn.textContent = 'Save date settings';
        showBanner('Saved date settings for ' + product.name + '.', 'success');
        refreshDates(product.upc);
      }).catch(function(err) {
        dateBusy = false;
        btn.disabled = false;
        btn.textContent = 'Save date settings';
        showBanner('Nothing saved. Couldn\'t save the date settings for ' + product.name + '. (' + err.message + ')', 'error');
      });
    }

    // ============================================
    // PHOTO DATES (PRD-006). On for everyone (Randy, 2026-11-19, after the first basement run). Opening the page once with
    // ?photo=off turns them off in that browser only, and ?photo=on turns them back on.
    // The camera shows a guide box; only the box and a small margin are sent to Dated Stock — Photo Read. The read fills the
    // row's month, day and year for the person to check against the crop; nothing saves until they tap Save.
    // ============================================
    var PHOTO_READ = '/dated-stock/photo-read';
    var PHOTO_KEY = 'bb.photoDates';
    var READ_LIMIT_MS = 20000;   // one photo's reads, turns included, stop at 20 seconds (PRD Behavior 14)
    var MAX_SIDE = 1568, MAX_BYTES = 1000000;
    var camStream = null, camRow = null;

    (function setPhotoSwitchFromUrl() {
      try {
        var v = new URLSearchParams(window.location.search).get('photo');
        if (v === 'on') localStorage.removeItem(PHOTO_KEY);
        if (v === 'off') localStorage.setItem(PHOTO_KEY, 'off');
      } catch (e) { /* storage blocked: photo dates stay on */ }
    })();
    function photoOn() {
      try { return localStorage.getItem(PHOTO_KEY) !== 'off'; } catch (e) { return true; }
    }

    // The photo parts of one date row, added by addDateRow when the switch is on.
    function photoRowHtml() {
      return '<button type="button" class="btn btn-secondary date-photo-btn">📷 Take photo</button>' +
        '<div class="date-photo hidden"><img class="date-crop" alt="The date as photographed">' +
          '<div class="date-photo-status"></div>' +
          '<div class="date-photo-acts hidden"></div></div>';
    }
    function wirePhotoRow(row) {
      var btn = row.querySelector('.date-photo-btn');
      if (btn) btn.onclick = function() { openCamera(row); };
      var img = row.querySelector('.date-crop');
      if (img) img.onclick = function() { if (row.__photo && row.__photo.full) showFullPhoto(row.__photo.full); };
    }

    // ---- Camera
    function cameraEl() {
      var el = document.getElementById('camera');
      if (el) return el;
      el = document.createElement('div');
      el.id = 'camera';
      el.className = 'camera hidden';
      el.innerHTML =
        '<video id="camVideo" playsinline muted autoplay></video>' +
        '<div class="cam-box" aria-hidden="true"></div>' +
        '<div class="cam-hint">Fit the date in the box. Sideways? Turn the photo after. Clear bottle? Put something white behind it.</div>' +
        '<div class="cam-ctrl"><button type="button" class="btn btn-secondary" id="camCancel">Cancel</button>' +
          '<button type="button" class="cam-shutter" id="camShutter" aria-label="Take photo"></button><span></span></div>';
      document.body.appendChild(el);
      document.getElementById('camCancel').onclick = closeCamera;
      document.getElementById('camShutter').onclick = takePhoto;
      return el;
    }
    function openCamera(row) {
      if (typeof stopScanner === 'function') stopScanner();
      camRow = row;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { cameraRefused(row, 'this browser has no camera access'); return; }
      var el = cameraEl();
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
        .then(function(stream) {
          camStream = stream;
          var v = document.getElementById('camVideo');
          v.srcObject = stream;
          el.classList.remove('hidden');
          return v.play();
        })
        .catch(function(err) { closeCamera(); cameraRefused(row, err && err.name ? err.name : String(err)); });
    }
    function closeCamera() {
      if (camStream) camStream.getTracks().forEach(function(t) { t.stop(); });
      camStream = null;
      // Let go of the stopped stream, so a second photo never captures a frame from the first.
      var v = document.getElementById('camVideo');
      if (v) v.srcObject = null;
      var el = document.getElementById('camera');
      if (el) el.classList.add('hidden');
    }
    // A refused camera opens typed entry with one line on allowing it; the photo button never does nothing (PRD Behavior 14).
    function cameraRefused(row, why) {
      showBanner('The camera is off for this page. Type the date below, or allow the camera in the browser\'s site settings. (' + why + ')', 'error');
      var m = row && row.querySelector('.date-month');
      if (m) m.focus();
    }

    // The guide box on screen, mapped onto the video's own pixels (the video fills the screen, cropped at the edges).
    function boxInVideo(v) {
      var box = document.querySelector('#camera .cam-box').getBoundingClientRect();
      var r = v.getBoundingClientRect();
      var scale = Math.max(r.width / v.videoWidth, r.height / v.videoHeight);
      var offX = (r.width - v.videoWidth * scale) / 2, offY = (r.height - v.videoHeight * scale) / 2;
      var mx = box.width * 0.04, my = box.height * 0.08;   // a small margin around the box
      var x = (box.left - r.left - mx - offX) / scale, y = (box.top - r.top - my - offY) / scale;
      var w = (box.width + 2 * mx) / scale, h = (box.height + 2 * my) / scale;
      x = Math.max(0, x); y = Math.max(0, y);
      return { x: x, y: y, w: Math.min(w, v.videoWidth - x), h: Math.min(h, v.videoHeight - y) };
    }
    function takePhoto() {
      var v = document.getElementById('camVideo');
      if (!v || !v.videoWidth || !camStream) return;   // no live picture yet: the tap does nothing until the camera shows
      var full = document.createElement('canvas');
      full.width = v.videoWidth; full.height = v.videoHeight;
      full.getContext('2d').drawImage(v, 0, 0);
      var b = boxInVideo(v);
      var crop = document.createElement('canvas');
      var k = Math.min(1, MAX_SIDE / Math.max(b.w, b.h));
      crop.width = Math.round(b.w * k); crop.height = Math.round(b.h * k);
      crop.getContext('2d').drawImage(full, b.x, b.y, b.w, b.h, 0, 0, crop.width, crop.height);
      var row = camRow;
      closeCamera();
      if (!row || !row.isConnected) return;
      // The whole frame stays in this page only, for the zoom view; it is never sent or stored (PRD rule).
      row.__photo = { source: crop, turned: 0, full: full.toDataURL('image/jpeg', 0.85), review_id: null, response: null, filled: null, attempt: 0 };
      readRowPhoto(row, null);
    }

    // The crop turned clockwise by quarters, as a JPEG under 1 MB, base64 without the data: prefix.
    function cropJpeg(p) {
      var t = ((p.turned % 360) + 360) % 360;
      var c = document.createElement('canvas');
      var w = p.source.width, h = p.source.height;
      c.width = t % 180 ? h : w; c.height = t % 180 ? w : h;
      var g = c.getContext('2d');
      g.translate(c.width / 2, c.height / 2);
      g.rotate(t * Math.PI / 180);
      g.drawImage(p.source, -w / 2, -h / 2);
      var url = '';
      for (var q = 9; q >= 5; q--) {
        url = c.toDataURL('image/jpeg', q / 10);
        if (url.length * 0.75 < MAX_BYTES) break;
      }
      return url;
    }
    function showFullPhoto(url) {
      var o = document.createElement('div');
      o.className = 'photo-full';
      o.innerHTML = '<img alt="The whole photo"><button type="button" class="btn btn-secondary">Close</button>';
      o.querySelector('img').src = url;
      o.querySelector('button').onclick = function() { o.remove(); };
      document.body.appendChild(o);
    }

    // ---- The read
    function photoStatus(row, html, kind) {
      var s = row.querySelector('.date-photo-status');
      s.innerHTML = html;
      s.className = 'date-photo-status' + (kind ? ' ' + kind : '');
    }
    function photoActs(row, buttons) {
      var a = row.querySelector('.date-photo-acts');
      a.innerHTML = '';
      buttons.forEach(function(bt) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ' + (bt.primary ? 'btn-in' : 'btn-secondary'); b.textContent = bt.label;
        b.onclick = bt.run;
        a.appendChild(b);
      });
      a.classList.toggle('hidden', !buttons.length);
    }
    function clearUnclear(row) {
      Array.prototype.forEach.call(row.querySelectorAll('.date-unclear'), function(el) { el.classList.remove('date-unclear'); });
    }
    // One photo's reads. started is when the first read went out: the 20 seconds cover every turn and retry.
    function readRowPhoto(row, started, lastTurnAsked) {
      var p = row.__photo;
      if (!p) return;
      started = started || Date.now();
      var token = ++p.attempt;
      var url = cropJpeg(p);
      row.querySelector('.date-photo').classList.remove('hidden');
      row.querySelector('.date-crop').src = url;
      clearUnclear(row);
      photoActs(row, []);
      photoStatus(row, '<span class="spin" aria-hidden="true"></span>Reading the date…');
      var left = READ_LIMIT_MS - (Date.now() - started);
      var timer = new Promise(function(res) { setTimeout(function() { res({ timedOut: true }); }, Math.max(0, left)); });
      var call = apiPostJson(PHOTO_READ, { upc: currentProduct.upc, place: datePlace, crop: url.split(',')[1], crop_type: 'image/jpeg', turned: p.turned });
      Promise.race([call, timer]).then(function(res) {
        if (row.__photo !== p || p.attempt !== token) return;   // a newer photo or read took over
        if (res.timedOut) { readFailed(row, 'Took too long to read. Type the date instead.', false); return; }
        var b = res.body || {};
        if (res.status === 429 || b.code === 'daily_cap') { readFailed(row, escapeHtml(b.error || 'Photo reads are done for today.') , false); return; }
        if (!res.ok || b.ok !== true) { readFailed(row, 'Couldn\'t read the date. Nothing saved. <i>(' + escapeHtml(b.error || ('status ' + res.status)) + ')</i>', true); return; }
        p.review_id = b.review_id || null;
        p.response = b; p.readings = null;
        // A turned read: turn the crop the way it says and read again; a quarter turn that stays turned tries the other quarter once.
        if (b.result === 'no_date' && b.reason === 'turned' && b.turn) {
          var delta = { clockwise: 90, counterclockwise: 270, half: 180 }[b.turn];
          if (!lastTurnAsked) { p.turned += delta; readRowPhoto(row, started, b.turn); return; }
          if (lastTurnAsked !== 'half' && b.turn !== 'half') { p.turned += 180; readRowPhoto(row, started, 'half'); return; }
          photoStatus(row, 'The date still reads sideways. Tap ↻ until it reads left to right, or type it below.', 'warn');
          photoActs(row, [{ label: '↻ Turn and read again', primary: true, run: function() { p.turned += 90; readRowPhoto(row, null, 'manual'); } }, retakeButton(row)]);
          return;
        }
        applyRead(row, b);
      }).catch(function(err) {
        if (row.__photo !== p || p.attempt !== token) return;
        readFailed(row, 'Couldn\'t read the date. Nothing saved. <i>(' + escapeHtml(err.message) + ')</i>', true);
      });
    }
    function retakeButton(row) { return { label: 'Retake', run: function() { openCamera(row); } }; }
    // A failed read is not "no date": it offers Try again with the same crop, or typed entry (PRD Behavior 14).
    function readFailed(row, html, canRetry) {
      var p = row.__photo;
      if (p) { p.response = null; p.review_id = null; }
      photoStatus(row, html, 'err');
      photoActs(row, (canRetry ? [{ label: 'Try again', primary: true, run: function() { readRowPhoto(row, null); } }] : []).concat([retakeButton(row)]));
      var m = row.querySelector('.date-month'); if (m) m.focus();
    }
    function setField(row, cls, value) {
      var el = row.querySelector(cls);
      if (cls === '.date-year' && value && !Array.prototype.some.call(el.options, function(o) { return o.value === String(value); })) {
        var o = document.createElement('option'); o.value = String(value); o.textContent = String(value); el.appendChild(o);
      }
      el.value = value === null || value === undefined ? '' : String(value);
    }
    // Fill the row from the read, mark what to check, and remember what the read said so Save can tell accepted from corrected.
    function applyRead(row, b) {
      var p = row.__photo;
      var PART = { month: '.date-month', day: '.date-day', year: '.date-year' };
      var pad2 = function(n) { return String(n).padStart(2, '0'); };
      if (b.result === 'date') {
        var parts = b.date.split('-');
        setField(row, '.date-year', parts[0]); setField(row, '.date-month', parts[1]); setField(row, '.date-day', String(Number(parts[2])));
        p.filled = { y: parts[0], m: parts[1], d: String(Number(parts[2])) };
        var notes = [];
        (b.highlight || []).forEach(function(h) {
          (h.parts || []).forEach(function(part) { var el = row.querySelector(PART[part]); if (el) el.classList.add('date-unclear'); });
          notes.push('the ' + escapeHtml(h.char) + ' could be ' + escapeHtml(h.could_be));
        });
        var msg = 'Read: <b>' + escapeHtml(b.printed_text || '') + '</b>. Check it against the photo, then Save.';
        if (b.yearChosen) msg += ' No year is printed: ' + escapeHtml(parts[0]) + ' is the nearest. Check the year.';
        if (notes.length) msg += ' Check the marked part: ' + notes.join('; ') + '.';
        photoStatus(row, msg, notes.length || b.yearChosen ? 'warn' : 'ok');
        photoActs(row, [retakeButton(row)]);
      } else if (b.result === 'month_only') {
        // Only the month and year are printed: the day starts on the month's last day (Randy, 2026-11-19). The day isn't part
        // of the read, so changing it still counts the read as accepted (d: null).
        var lastDay = new Date(Date.UTC(Number(b.year), Number(b.month), 0)).getUTCDate();
        setField(row, '.date-year', b.year); setField(row, '.date-month', pad2(b.month)); setField(row, '.date-day', String(lastDay));
        p.filled = { y: String(b.year), m: pad2(b.month), d: null };
        photoStatus(row, 'Read: <b>' + escapeHtml(b.printed_text || '') + '</b>. Only the month and year are printed, so the day is the last of the month. Check it against the photo, then Save.', 'ok');
        photoActs(row, [retakeButton(row)]);
      } else if (b.result === 'ambiguous_order') {
        photoStatus(row, 'Read: <b>' + escapeHtml(b.printed_text || '') + '</b>. Which part is the month? If you can\'t tell, pick the earlier date.', 'warn');
        // Where the year sits in the print, so the pick can be remembered as the product's order (PRD Behavior 11: an
        // unclear order is asked once per product). a is the first of the two numbers in print order, b the second.
        var nums = (b.printed_text || '').match(/[0-9]+/g) || [];
        var yearAt = function(s) { return s === String(b.year) || s === String(b.year).slice(2); };
        var yearLast = nums.length >= 3 && yearAt(nums[nums.length - 1]), yearFirst = !yearLast && nums.length >= 3 && yearAt(nums[nums.length - 3]);
        var orderFor = function(aIsMonth) { return yearLast ? (aIsMonth ? 'MDY' : 'DMY') : yearFirst && aIsMonth ? 'YMD' : null; };
        // Both readings, so Save can tell a date the person typed or edited to is one of them (photoEntry).
        p.filled = null;
        p.readings = [{ iso: b.year + '-' + pad2(b.a) + '-' + pad2(b.b), order: orderFor(true) },
                      { iso: b.year + '-' + pad2(b.b) + '-' + pad2(b.a), order: orderFor(false) }];
        // A tap only fills the fields; Save decides from the date saved which reading it was (photoEntry).
        var pick = function(month, day) { return function() {
          setField(row, '.date-year', b.year); setField(row, '.date-month', pad2(month)); setField(row, '.date-day', String(day));
          p.filled = { y: String(b.year), m: pad2(month), d: String(day) };
          photoStatus(row, 'Check it against the photo, then Save.', 'ok');
          photoActs(row, [retakeButton(row)]); updateReadback(row);
        }; };
        // The earlier date first, marked as the safer pick: pulling early costs less than selling late.
        var aFirst = Date.UTC(b.year, b.a - 1, b.b) <= Date.UTC(b.year, b.b - 1, b.a);
        var asMonthA = { label: MONTHS[b.a - 1] + ' ' + b.b, run: pick(b.a, b.b) }, asMonthB = { label: MONTHS[b.b - 1] + ' ' + b.a, run: pick(b.b, b.a) };
        var earlier = aFirst ? asMonthA : asMonthB, later = aFirst ? asMonthB : asMonthA;
        earlier.label += ' (earlier, safer)';
        photoActs(row, [earlier, later, retakeButton(row)]);
      } else {
        // no_date or reject: typed entry, with a turn offered first for "no date" (PRD Behavior 2).
        p.filled = null;
        photoStatus(row, b.result === 'no_date' ? 'No date found in the photo. Turn it and try again, or type it below.' : 'Couldn\'t use this read. Type the date below.', 'warn');
        photoActs(row, (b.result === 'no_date' ? [{ label: '↻ Turn it and try again', primary: true, run: function() { p.turned += 90; readRowPhoto(row, null, 'manual'); } }] : []).concat([retakeButton(row)]));
        row.querySelector('.date-month').focus();
      }
      updateReadback(row);
    }

    // What Save sends for one row: a photo date accepted or corrected, or a typed date over a read that gave none.
    // A crop is kept only for a corrected or typed-over read (Threat model Decision 2); an accepted read keeps none.
    function photoEntry(row, iso) {
      var p = row.__photo;
      if (!p || !p.review_id) return { date: iso, source: 'typed' };
      // "Which is the month?": a saved date that is exactly one of the two readings answers the question, however it got
      // into the fields (a tap, a tap then an edit to the other reading, or typed with no tap). It is accepted, and the
      // product keeps that reading's order (BUG-091; Randy, 2026-11-20, Quest at Livano). Any other date is a correction.
      var reading = (p.readings || []).filter(function(r) { return r.iso === iso; })[0];
      if (reading) {
        if (p.response) p.response.print_format = reading.order ? { order: reading.order, year_missing: false, sideways: p.turned !== 0 } : null;
        return { date: iso, source: 'photo', review_id: p.review_id, answer: 'accepted' };
      }
      var crop = cropJpeg(p).split(',')[1];
      if (!p.filled) return { date: iso, source: 'typed', review_id: p.review_id, answer: 'typed', crop: crop, crop_type: 'image/jpeg' };
      var parts = iso.split('-');
      var same = parts[0] === p.filled.y && parts[1] === p.filled.m && (p.filled.d === null || String(Number(parts[2])) === p.filled.d);
      return same ? { date: iso, source: 'photo', review_id: p.review_id, answer: 'accepted' }
        : { date: iso, source: 'photo', review_id: p.review_id, answer: 'corrected', crop: crop, crop_type: 'image/jpeg' };
    }
    // A read that ended with nothing saved (Skip, Cancel) is answered "rejected" when it gave no usable date, so the miss
    // reaches the monthly review with its crop. A good read left unsaved stays unanswered: unconfirmed is a valid ending.
    function answerUnsavedReads() {
      Array.prototype.forEach.call(document.querySelectorAll('#dateRows .date-row'), function(row) {
        var p = row.__photo;
        if (!p || !p.review_id || p.filled) return;
        apiPostJson(DATE_WRITE, { action: 'answer_read', review_id: p.review_id, answer: 'rejected', crop: cropJpeg(p).split(',')[1], crop_type: 'image/jpeg' })
          .catch(function() { /* the read stays unanswered; nothing else depends on it */ });
      });
    }

    // After a date change, read the product again so the list shows what the server holds, with each date's id.
    function refreshDates(upc) {
      apiGetJson('/inventory/product', { upc: upc }).then(function(res) {
        if (!res.ok || !currentProduct || currentProduct.upc !== upc) return;
        var fresh = mapProduct(res.body);
        currentProduct.noDateNeeded = fresh.noDateNeeded;
        currentProduct.pullDays = fresh.pullDays;
        currentProduct.leadDays = fresh.leadDays;
        currentProduct.openDates = fresh.openDates;
        renderDates(currentProduct);
        if (typeof onDatesRefreshed === 'function') onDatesRefreshed(currentProduct);   // what else on the page shows its dates
      }).catch(function() {
        showProductMessage('Saved, but the date list couldn\'t refresh. Scan it again to see it.', 'warning');
      });
    }
