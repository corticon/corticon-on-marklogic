'use strict';

var OUTPUT_COLLECTION = 'http://example.com/data/eligibility-output';
var TRACE_COLLECTION  = 'http://example.com/data/eligibility-trace';

var MAX_RESULT_DOCS = 10;
var MAX_TRACE_ROWS_PER_PROGRAM = 10;
var MAX_EXCLUSION_FIELDS = 60;
var MAX_NOTE_CHARS = 1200;

var SERVICE_VERSION = 'chatbot-split-trace-2026-01-12-e';

var STOP_WORDS = {
  a:true, an:true, and:true, are:true, as:true, at:true, be:true, but:true, by:true,
  for:true, from:true, has:true, have:true, if:true, in:true, is:true, it:true, its:true,
  of:true, on:true, or:true, that:true, the:true, to:true, was:true, were:true, which:true,
  with:true, you:true, your:true
};

function normalize(value) {
  return (value === null || value === undefined) ? '' : String(value).trim().toLowerCase();
}

function clampText(value, maxChars) {
  var s = (value === null || value === undefined) ? '' : String(value);
  return s.length <= maxChars ? s : (s.slice(0, maxChars) + '\n...[truncated by MarkLogic chatbot]');
}

function docToObject(doc) {
  if (!doc) return null;
  try { if (typeof doc.toObject === 'function') return doc.toObject(); } catch (e1) {}
  try { if (doc.root && typeof doc.root.toObject === 'function') return doc.root.toObject(); } catch (e2) {}
  return doc.root || doc;
}

function parseNumericId(metaIdString, prefix) {
  if (!metaIdString) return null;
  var s = String(metaIdString);
  var idx = s.indexOf(prefix);
  if (idx < 0) return null;
  var tail = s.substring(idx + prefix.length);
  var m = /^\d+/.exec(tail);
  return m ? Number(m[0]) : null;
}

function questionWantsIncomeExclusions(q) {
  var s = normalize(q);
  return /(income|cola|pickle|exclu|disregard|countable|unearned|ssi|fpl)/.test(s);
}

function extractPersonNameFromQuestion(q) {
  if (!q) return null;
  var s = String(q);

  var m = s.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)'s\b/);
  if (m) return { first: m[1], last: m[2] };

  m = s.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  if (m) return { first: m[1], last: m[2] };

  return null;
}

function getApplicationFromOutputDoc(docObj) {
  if (!docObj) return null;
  return docObj.application || null;
}

function getHouseholdFromApplication(app) {
  if (!app) return null;
  return app.household || (app.payload && app.payload.household) || app.payload || app;
}

function getPersonsFromApplication(app) {
  var hh = getHouseholdFromApplication(app) || {};
  var persons = hh.person || hh.individual || hh.members || [];
  if (!Array.isArray(persons)) persons = persons ? [persons] : [];
  return persons;
}

function personName(p) {
  var first = p && p.first ? String(p.first).trim() : '';
  var last  = p && p.last  ? String(p.last).trim()  : '';
  var nm = (first + ' ' + last).trim();
  return nm || last || first || null;
}

function getPrograms(p) {
  var programs = (p && (p.classOfAssistance || p.programs)) ? (p.classOfAssistance || p.programs) : [];
  if (!Array.isArray(programs)) programs = programs ? [programs] : [];
  return programs;
}

function summarizePrograms(programs) {
  var items = [];
  for (var i = 0; i < programs.length; i++) {
    var pr = programs[i];
    if (!pr || typeof pr !== 'object') continue;
    var name = pr.name || pr.policyKey;
    if (!name) continue;

    var entityId = null;
    if (pr.__metadata && pr.__metadata['#id']) {
      entityId = parseNumericId(pr.__metadata['#id'], 'ClassOfAssistance_id_');
    }

    items.push({
      name: name,
      policyKey: pr.policyKey || null,
      programFamily: pr.programFamily || null,
      group: pr.group || null,
      eligibleViaPath: pr.eligibleViaPath,
      nonFinancialCriteriaMet: pr.nonFinancialCriteriaMet,
      incomeIneligible: pr.incomeIneligible,
      blanketIneligible: pr.blanketIneligible,
      requiresMedicaidIneligibility: pr.requiresMedicaidIneligibility,
      requiresQualifyingActivities: pr.requiresQualifyingActivities,
      isSelected: pr.isSelected === true,
      entityId: entityId
    });
  }
  return items;
}

function findTraceDocByHouseholdId(householdId) {
  if (!householdId) return null;
  var hh = String(householdId);

  var query = cts.andQuery([
    cts.collectionQuery(TRACE_COLLECTION),
    cts.jsonPropertyValueQuery('householdId', hh)
  ]);

  var doc = fn.head(cts.search(query));
  if (!doc) return null;

  return docToObject(doc);
}

function traceRowsForProgram(traceDoc, entityId, question) {
  if (!traceDoc || !traceDoc.trace || !Array.isArray(traceDoc.trace)) return [];
  if (entityId === null || entityId === undefined) return [];

  var wantsIncome = questionWantsIncomeExclusions(question);

  var keyAttrs = {
    isSelected: true,
    eligibleViaPath: true,
    nonFinancialCriteriaMet: true,
    incomeIneligible: true,
    blanketIneligible: true,
    requiresMedicaidIneligibility: true,
    requiresQualifyingActivities: true,
    programFamily: true,
    policyKey: true,
    name: true,
    incomeThreshold: true
  };

  var rows = [];
  for (var i = 0; i < traceDoc.trace.length; i++) {
    var r = traceDoc.trace[i];
    if (!r) continue;
    if (String(r.entityType) !== 'ClassOfAssistance') continue;
    if (Number(r.entityId) !== Number(entityId)) continue;

    var attr = r.attributeName ? String(r.attributeName) : '';
    var attrNorm = normalize(attr);
    var valNorm = normalize(r.newValue);

    var include = false;
    if (!attr) include = true;
    if (attr && keyAttrs[attr] === true) include = true;

    if (wantsIncome && (
      /(income|cola|exclude|pickle|ssi|countable|disregard|unearned|earned)/.test(attrNorm) ||
      /(income|cola|exclude|pickle|ssi|countable|disregard|unearned|earned)/.test(valNorm)
    )) include = true;

    if (!include) continue;

    rows.push({
      sequence: r.sequence,
      rulesheetName: r.rulesheetName || null,
      ruleNumber: r.ruleNumber || null,
      location: r.location || null,
      attributeName: r.attributeName || null,
      newValue: r.newValue || null
    });

    if (rows.length >= MAX_TRACE_ROWS_PER_PROGRAM) break;
  }
  return rows;
}

function extractExclusionEvidenceFromPerson(person) {
  var evidence = {};
  if (!person || typeof person !== 'object') return evidence;

  var knownPersonKeys = [
    'wasSSIRecipient',
    'lostSSIDueToCOLA',
    'lostSSIDueToSSATitleIIBenefit',
    'excludedCOLAIncreases',
    'colaIncreaseAmount',
    'colaIncrease',
    'countableIncome',
    'totalIncome',
    'earnedIncome',
    'unearnedIncome',
    'ssiIncome',
    'incomeExclusions',
    'incomeExclusionAmount',
    'incomeExclusionReason',
    'incomeNotes',
    'eligibilityNote',
    'monthlyIncome'
  ];

  for (var i = 0; i < knownPersonKeys.length; i++) {
    var k = knownPersonKeys[i];
    if (person[k] !== null && person[k] !== undefined) evidence[k] = person[k];
  }

  if (person.financialProfile && typeof person.financialProfile === 'object') {
    var fp = person.financialProfile;
    var fpKeys = Object.keys(fp);
    for (var j = 0; j < fpKeys.length; j++) {
      var fk = fpKeys[j];
      var fkNorm = normalize(fk);
      if (/(income|cola|exclude|exclusion|pickle|ssi|countable|disregard|unearned|earned|fpl|poverty)/.test(fkNorm)) {
        var v = fp[fk];
        if (v !== null && v !== undefined) evidence['financialProfile.' + fk] = v;
      }
    }
  }

  // include any additional person-level income/exclusion-looking keys (capped)
  var keys = Object.keys(person);
  var added = 0;
  for (var z = 0; z < keys.length; z++) {
    var pk = keys[z];
    if (evidence.hasOwnProperty(pk)) continue;
    var pkNorm = normalize(pk);
    if (/(income|cola|exclude|exclusion|pickle|ssi|countable|disregard|unearned|earned|fpl|poverty)/.test(pkNorm)) {
      var pv = person[pk];
      if (pv !== null && pv !== undefined) {
        evidence[pk] = pv;
        added++;
        if (added >= MAX_EXCLUSION_FIELDS) break;
      }
    }
  }

  return evidence;
}

function extractNotesFromApplication(app) {
  var notes = [];
  if (!app || typeof app !== 'object') return notes;

  if (app.eligibilityNote) notes.push(app.eligibilityNote);
  if (app.notes) notes.push(app.notes);

  var msgs = null;
  if (app.Messages && app.Messages.Message) msgs = app.Messages.Message;
  else if (app.messages) msgs = app.messages;

  if (msgs && !Array.isArray(msgs)) msgs = [msgs];

  if (Array.isArray(msgs)) {
    for (var i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (!m) continue;
      var txt = m.text || m.message || m.detail || null;
      if (txt) notes.push(String(txt));
    }
  }

  // flatten to strings and de-dupe
  var flat = [];
  for (var j = 0; j < notes.length; j++) {
    if (notes[j] === null || notes[j] === undefined) continue;
    if (typeof notes[j] === 'string') flat.push(notes[j]);
    else {
      try { flat.push(JSON.stringify(notes[j])); } catch (e) { flat.push(String(notes[j])); }
    }
  }

  var uniq = {};
  var out = [];
  for (var k = 0; k < flat.length; k++) {
    var t = String(flat[k]).trim();
    if (!t) continue;
    if (uniq[t]) continue;
    uniq[t] = true;
    out.push(t);
  }

  var joined = out.join('\n');
  if (joined.length > MAX_NOTE_CHARS) joined = joined.slice(0, MAX_NOTE_CHARS) + '\n...[notes truncated]';

  return joined ? [joined] : [];
}

// ---------- NEW: Find output docs by householdId / familyName ----------

function normalizeHouseholdId(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  return (/^\d+$/).test(s) ? s : null;
}

function findOutputDocByHouseholdId(householdId) {
  var hh = normalizeHouseholdId(householdId);
  if (!hh) return null;

  var query = cts.andQuery([
    cts.collectionQuery(OUTPUT_COLLECTION),
    cts.jsonPropertyValueQuery('householdId', hh)
  ]);

  return fn.head(cts.search(query));
}

function findOutputDocByFamilyName(familyName) {
  if (!familyName) return null;
  var ln = String(familyName).trim();
  if (!ln) return null;

  var query = cts.andQuery([
    cts.collectionQuery(OUTPUT_COLLECTION),
    cts.jsonPropertyValueQuery('familyName', ln)
  ]);

  return fn.head(cts.search(query));
}

// ---------- Existing strict-person search (still useful) ----------

function strictPersonNameDocs(person) {
  var first = person && person.first ? String(person.first).trim() : '';
  var last  = person && person.last ? String(person.last).trim() : '';
  if (!first || !last) return [];

  var query = cts.andQuery([
    cts.collectionQuery(OUTPUT_COLLECTION),
    cts.wordQuery(first, ['case-insensitive']),
    cts.wordQuery(last,  ['case-insensitive'])
  ]);

  var candidates = fn.subsequence(cts.search(query), 1, 50).toArray();

  var filtered = [];
  var f = normalize(first);
  var l = normalize(last);

  for (var i = 0; i < candidates.length; i++) {
    var docObj = docToObject(candidates[i]);
    var app = docObj && docObj.application ? docObj.application : null;
    if (!app) continue;

    var persons = getPersonsFromApplication(app);
    var ok = false;
    for (var p = 0; p < persons.length; p++) {
      var pf = persons[p] && persons[p].first ? normalize(persons[p].first) : '';
      var pl = persons[p] && persons[p].last  ? normalize(persons[p].last)  : '';
      if (pf === f && pl === l) { ok = true; break; }
    }
    if (ok) filtered.push(candidates[i]);
    if (filtered.length >= MAX_RESULT_DOCS) break;
  }

  return filtered;
}

// ---------- NEW: find person in a household doc (exact, then fuzzy) ----------

function findPersonInApp(app, first, last) {
  var persons = getPersonsFromApplication(app);
  var f = normalize(first);
  var l = normalize(last);

  // exact
  for (var i = 0; i < persons.length; i++) {
    var pf = persons[i] && persons[i].first ? normalize(persons[i].first) : '';
    var pl = persons[i] && persons[i].last  ? normalize(persons[i].last)  : '';
    if (pf === f && pl === l) return persons[i];
  }

  // fuzzy: startsWith on first, exact last
  for (var j = 0; j < persons.length; j++) {
    var pf2 = persons[j] && persons[j].first ? normalize(persons[j].first) : '';
    var pl2 = persons[j] && persons[j].last  ? normalize(persons[j].last)  : '';
    if (pl2 === l && pf2 && f && pf2.indexOf(f) === 0) return persons[j];
  }

  // fuzzy: last name only if unique in household
  var hits = [];
  for (var k = 0; k < persons.length; k++) {
    var pl3 = persons[k] && persons[k].last ? normalize(persons[k].last) : '';
    if (pl3 === l) hits.push(persons[k]);
  }
  if (hits.length === 1) return hits[0];

  return null;
}

// ---------- Render ----------

function renderPlainText(hhId, fam, personSummary, question, includeTrace) {
  if (!hhId || !personSummary) return 'I found 0 eligibility records for that request.';

  var lines = [];
  lines.push(fam ? ('Household ' + hhId + ' (' + fam + ').') : ('Household ' + hhId + '.'));

  var nm = personSummary.name || (personSummary.first + ' ' + personSummary.last);
  lines.push(nm + ': ' + (personSummary.determination || 'Eligibility outcome present.'));

  if (personSummary.selected && personSummary.selected.length) {
    lines.push('Selected best coverage: ' + personSummary.selected.join(', ') + '.');
  }

  if (questionWantsIncomeExclusions(question)) {
    var evKeys = Object.keys(personSummary.exclusionEvidence || {});
    if (evKeys.length) {
      lines.push('');
      lines.push('Income exclusion evidence (from output fields):');
      evKeys.sort();
      for (var i = 0; i < evKeys.length; i++) {
        var k = evKeys[i];
        var v = personSummary.exclusionEvidence[k];
        var vs;
        try { vs = (typeof v === 'string') ? v : JSON.stringify(v); }
        catch (e) { vs = String(v); }
        if (vs.length > 300) vs = vs.slice(0, 300) + '...[truncated]';
        lines.push('- ' + k + ': ' + vs);
      }
    } else {
      lines.push('');
      lines.push('Income exclusion evidence: No explicit exclusion fields were found on the person record in this dataset snapshot.');
    }
  }

  if (personSummary.notes && personSummary.notes.length) {
    lines.push('');
    lines.push('Eligibility notes/messages:');
    lines.push(personSummary.notes[0]);
  }

  if (includeTrace && personSummary.traceEvidence && personSummary.traceEvidence.length) {
    lines.push('');
    lines.push('Trace evidence (selected + exclusion-related programs):');
    for (var e = 0; e < personSummary.traceEvidence.length; e++) {
      var item = personSummary.traceEvidence[e];
      if (!item || !item.rows || !item.rows.length) continue;
      lines.push('- ClassOfAssistance entityId ' + item.entityId + ':');
      for (var r = 0; r < item.rows.length; r++) {
        var row = item.rows[r];
        var loc = row.rulesheetName && row.ruleNumber
          ? (row.rulesheetName + ' : ' + row.ruleNumber)
          : (row.location || 'Trace');
        var attr = row.attributeName ? row.attributeName : 'attribute';
        var val  = (row.newValue !== null && row.newValue !== undefined) ? String(row.newValue) : '';
        lines.push('  * ' + loc + ' set ' + attr + ' to ' + val + ' (seq ' + row.sequence + ').');
      }
    }
  }

  return lines.join('\n').trim();
}

// ---------- Main summarizer (now supports householdId) ----------

function buildPersonSummary(question, app, traceDoc, targetPersonObj, targetFirst, targetLast, includeTrace) {
  var programs = summarizePrograms(getPrograms(targetPersonObj));
  var evaluated = [];
  var assigned = [];
  var selected = [];

  for (var j = 0; j < programs.length; j++) {
    evaluated.push(programs[j].name);
    if (programs[j].eligibleViaPath || programs[j].nonFinancialCriteriaMet) assigned.push(programs[j].name);
    if (programs[j].isSelected) selected.push(programs[j].name);
  }

  var determination = (targetPersonObj && targetPersonObj.determination && targetPersonObj.determination.status)
    ? String(targetPersonObj.determination.status)
    : null;

  var evidence = [];
  if (includeTrace) {
    // selected programs
    for (var k = 0; k < programs.length; k++) {
      var pr = programs[k];
      if (pr && pr.isSelected && pr.entityId) {
        evidence.push({ entityType: 'ClassOfAssistance', entityId: pr.entityId, rows: traceRowsForProgram(traceDoc, pr.entityId, question) });
      }
    }
    // include Pickle if asking about exclusions
    if (questionWantsIncomeExclusions(question)) {
      for (var x = 0; x < programs.length; x++) {
        var pr2 = programs[x];
        if (pr2 && pr2.policyKey === 'GA_PICKLE' && pr2.entityId) {
          evidence.push({ entityType: 'ClassOfAssistance', entityId: pr2.entityId, rows: traceRowsForProgram(traceDoc, pr2.entityId, question) });
          break;
        }
      }
    }
  }

  var exclusionEvidence = extractExclusionEvidenceFromPerson(targetPersonObj);
  var notes = extractNotesFromApplication(app);

  return {
    first: targetFirst,
    last: targetLast,
    name: personName(targetPersonObj),
    determination: determination,
    evaluated: evaluated,
    assigned: assigned,
    selected: selected,
    programs: programs,
    traceEvidence: evidence,
    exclusionEvidence: exclusionEvidence,
    notes: notes
  };
}


function summarizeHouseholdAllPeople(question, docObj, includeTrace) {
  var app = getApplicationFromOutputDoc(docObj);
  var hhId = docObj && docObj.householdId !== undefined && docObj.householdId !== null ? String(docObj.householdId) : null;
  var fam  = docObj && docObj.familyName ? String(docObj.familyName) : null;

  if (!app || !hhId) return null;

  var traceDoc = includeTrace ? findTraceDocByHouseholdId(hhId) : null;
  var persons = getPersonsFromApplication(app);

  var peopleSummaries = [];
  for (var i = 0; i < persons.length; i++) {
    var p = persons[i];
    if (!p) continue;

    var programs = summarizePrograms(getPrograms(p));
    var selected = [];
    var evaluated = [];
    for (var j = 0; j < programs.length; j++) {
      evaluated.push(programs[j].name);
      if (programs[j].isSelected) selected.push(programs[j].name);
    }

    // evidence: only selected + (if income/exclusion question) pickle
    var evidence = [];
    if (includeTrace) {
      for (var k = 0; k < programs.length; k++) {
        var pr = programs[k];
        if (pr && pr.isSelected && pr.entityId) {
          evidence.push({ entityType: 'ClassOfAssistance', entityId: pr.entityId, rows: traceRowsForProgram(traceDoc, pr.entityId, question) });
        }
      }
      if (questionWantsIncomeExclusions(question)) {
        for (var x = 0; x < programs.length; x++) {
          var pr2 = programs[x];
          if (pr2 && pr2.policyKey === 'GA_PICKLE' && pr2.entityId) {
            evidence.push({ entityType: 'ClassOfAssistance', entityId: pr2.entityId, rows: traceRowsForProgram(traceDoc, pr2.entityId, question) });
            break;
          }
        }
      }
    }

    peopleSummaries.push({
      name: personName(p),
      determination: (p.determination && p.determination.status) ? String(p.determination.status) : null,
      selected: selected,
      evaluated: evaluated,
      // show exclusion evidence if asked (nice demo)
      exclusionEvidence: questionWantsIncomeExclusions(question) ? extractExclusionEvidenceFromPerson(p) : {},
      traceEvidence: evidence
    });
  }

  return { householdId: hhId, familyName: fam, people: peopleSummaries };
}

function renderHouseholdPlainText(hhSummary, question, includeTrace) {
  if (!hhSummary) return 'I found 0 eligibility records for that household.';

  var lines = [];
  lines.push(hhSummary.familyName
    ? ('Household ' + hhSummary.householdId + ' (' + hhSummary.familyName + ').')
    : ('Household ' + hhSummary.householdId + '.')
  );

  for (var i = 0; i < hhSummary.people.length; i++) {
    var p = hhSummary.people[i];
    var nm = p.name || ('Person ' + (i + 1));

    if (p.selected && p.selected.length) {
      lines.push(nm + ' selected best coverage: ' + p.selected.join(', ') + '.');
    } else {
      lines.push(nm + ': No selected coverage was marked in the record.');
    }

    // optional: why selected (priority fields are in COA list; you can add later)
    if (p.determination) lines.push('  Determination: ' + p.determination);

    if (includeTrace && p.traceEvidence && p.traceEvidence.length) {
      for (var e = 0; e < p.traceEvidence.length; e++) {
        var ev = p.traceEvidence[e];
        if (!ev || !ev.rows || !ev.rows.length) continue;
        lines.push('  Trace (entityId ' + ev.entityId + '):');
        for (var r = 0; r < ev.rows.length; r++) {
          var row = ev.rows[r];
          var loc = row.rulesheetName && row.ruleNumber
            ? (row.rulesheetName + ' : ' + row.ruleNumber)
            : (row.location || 'Trace');
          var attr = row.attributeName ? row.attributeName : 'attribute';
          var val  = (row.newValue !== null && row.newValue !== undefined) ? String(row.newValue) : '';
          lines.push('   - ' + loc + ' set ' + attr + ' to ' + val + ' (seq ' + row.sequence + ').');
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

function post(context, params, input) {
  var body = (input && typeof input.toObject === 'function') ? input.toObject() : (input || {});
  var question = (body && typeof body.query === 'string') ? String(body.query).trim() : '';
  var mode = (body && body.mode) ? String(body.mode).trim().toLowerCase() : 'summary';
  var debugEnabled = (body && (body.debug === true || body.debug === 'true'));
  var includeTrace = (mode === 'trace');

  if (!question) return { error: 'query is required', serviceVersion: SERVICE_VERSION };

  // Determine target person
  var person = null;
  if (body && body.personName) {
    var parts = String(body.personName).trim().split(/\s+/);
    if (parts.length >= 2) person = { first: parts[0], last: parts[parts.length - 1] };
  }
  if (!person) person = extractPersonNameFromQuestion(question);

// If no person was provided, but householdId/familyName was provided, do a household summary.
var hasHouseholdAnchor = (body && (body.householdId || body.familyName));

if ((!person || !person.first || !person.last) && hasHouseholdAnchor) {
  var docNode2 = null;
  var used2 = body.householdId ? 'householdId' : 'familyName';

  if (body.householdId) docNode2 = findOutputDocByHouseholdId(body.householdId);
  else docNode2 = findOutputDocByFamilyName(body.familyName);

  if (!docNode2) {
    return {
      output: 'I found 0 eligibility records for that household.',
      citations: [],
      matches: [],
      serviceVersion: SERVICE_VERSION
    };
  }

  var docObj2 = docToObject(docNode2);
  var includeTrace2 = (mode === 'trace'); // allow trace mode for household summary
  var hhSummary = summarizeHouseholdAllPeople(question, docObj2, includeTrace2);

  var outText = renderHouseholdPlainText(hhSummary, question, includeTrace2);
  outText = clampText(outText, 20000);

  return {
    output: outText,
    citations: hhSummary ? [{
      citationId: String(hhSummary.householdId),
      citationLabel: hhSummary.familyName
        ? ('Household ' + hhSummary.householdId + ' (' + hhSummary.familyName + ')')
        : ('Household ' + hhSummary.householdId)
    }] : [],
    matches: hhSummary ? [hhSummary] : [],
    serviceVersion: SERVICE_VERSION,
    debug: (body && (body.debug === true || body.debug === 'true'))
      ? { searchModeUsed: used2, includeTrace: includeTrace2 }
      : undefined
  };
}

// Otherwise: person is required for person-deep explanation
if (!person || !person.first || !person.last) {
  return { error: 'Please include a personName (e.g., "Rudolf Irons") in the question or filters.', serviceVersion: SERVICE_VERSION };
}


  // Find the output doc (householdId > familyName > strict person)
  var docNode = null;
  var used = 'strict-person';

  if (body && body.householdId) {
    docNode = findOutputDocByHouseholdId(body.householdId);
    used = 'householdId';
  } else if (body && body.familyName) {
    docNode = findOutputDocByFamilyName(body.familyName);
    used = 'familyName';
  }

  if (!docNode) {
    var docs = strictPersonNameDocs(person);
    docNode = docs.length ? docs[0] : null;
    used = docs.length ? 'strict-person' : 'none';
  }

  if (!docNode) {
    return {
      output: 'I found 0 eligibility records for ' + person.first + ' ' + person.last + '.',
      citations: [],
      matches: [],
      serviceVersion: SERVICE_VERSION,
      debug: debugEnabled ? { searchModeUsed: used } : undefined
    };
  }

  var docObj = docToObject(docNode);
  var app = getApplicationFromOutputDoc(docObj);
  var hhId = docObj && docObj.householdId !== undefined && docObj.householdId !== null ? String(docObj.householdId) : null;
  var fam = docObj && docObj.familyName ? docObj.familyName : null;

  if (!app || !hhId) {
    return { error: 'Malformed output document; missing application/householdId.', serviceVersion: SERVICE_VERSION };
  }

  // Find person inside that household
  var target = findPersonInApp(app, person.first, person.last);

  if (!target) {
    return {
      output: person.first + ' ' + person.last + ' is not present in the Household JSON for householdId ' + hhId + '. Please verify the name.',
      citations: [{ citationId: hhId, citationLabel: fam ? ('Household ' + hhId + ' (' + fam + ')') : ('Household ' + hhId) }],
      matches: [],
      serviceVersion: SERVICE_VERSION,
      debug: debugEnabled ? { searchModeUsed: used, householdId: hhId, familyName: fam } : undefined
    };
  }

  var traceDoc = includeTrace ? findTraceDocByHouseholdId(hhId) : null;
  var pSummary = buildPersonSummary(question, app, traceDoc, target, person.first, person.last, includeTrace);

  var output = renderPlainText(hhId, fam, pSummary, question, includeTrace);
  output = clampText(output, 20000);

  var resp = {
    output: output,
    citations: [{ citationId: hhId, citationLabel: fam ? ('Household ' + hhId + ' (' + fam + ')') : ('Household ' + hhId) }],
    matches: [{ householdId: hhId, familyName: fam, person: pSummary }],
    serviceVersion: SERVICE_VERSION
  };

  if (debugEnabled) {
    resp.debug = {
      serviceVersion: SERVICE_VERSION,
      searchModeUsed: used,
      mode: mode,
      includeTrace: includeTrace,
      detectedPerson: person,
      householdId: hhId,
      familyName: fam
    };
  }

  return resp;
}

exports.POST = post;
