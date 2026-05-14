/////////////////////////////////////////
// OVERLAP CPT + RECOGNITION MEMORY — Qualtrics-loadable build
/////////////////////////////////////////
// Source: Anna's afc.zip (task.js + generateStimuli.js), jsPsych v6 → v7.
// IMPORTANT: AFC_ASSET_ROOT must point at the server hosting the SUN-database
// scenes and Chicago-Face-Database faces in the layout the original task
// expects (images/indoor/sun_*.jpg, images/outdoor/sun_*.jpg,
// images/male/CFD-*.jpg, images/female/CFD-*.jpg). Replace the placeholder
// once Anna shares her stimulus URL.

// =========== CONFIG ===========================================================
// Cloudflare R2 bucket "stimuli", public dev URL.
var AFC_ASSET_ROOT = "https://pub-09abf098b7ab470c9ec4f75b3e689e87.r2.dev/";

var TOTAL_PRACTICE_TRIALS = 20;
var PRACTICE_ACC_THRESHOLD = 0.85;   // retry trigger + displayed target
var PRACTICE_FINAL_THRESHOLD = 0.70;  // last-attempt soft gate: if you reach this on attempt 8, you can still continue
var FACE_SIZE = 155;          // px. Matches Anna's value; with our scenes now uniformly re-processed to 800x600, 155/600 = 25.8% face-to-scene-height ratio (Anna's setup exactly).
var TRIAL_DUR_MS = 1000;
var MEM_TRIAL_DUR_MS = 20000;

function initExp() {

// =========== HELPERS FOR OUTCOMES ============================================
function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function round3(x) {
    if (x === null || isNaN(x) || typeof x !== 'number') return null;
    return Math.round(x * 1000) / 1000;
}
// Inverse normal CDF (probit) using rational approximation. Used for d-prime.
function _qnorm(p) {
    if (p <= 0 || p >= 1) return null;
    var a = [-3.969683028665376e+01,  2.209460984245205e+02,
             -2.759285104469687e+02,  1.383577518672690e+02,
             -3.066479806614716e+01,  2.506628277459239e+00];
    var b = [-5.447609879822406e+01,  1.615858368580409e+02,
             -1.556989798598866e+02,  6.680131188771972e+01,
             -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01,
             -2.400758277161838e+00, -2.549732539343734e+00,
              4.374664141464968e+00,  2.938163982698783e+00];
    var d = [ 7.784695709041462e-03,  3.224671290700398e-01,
              2.445134137142996e+00,  3.754408661907416e+00];
    var pl = 0.02425, ph = 1 - pl, q, r;
    if (p < pl) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
               ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= ph) {
        q = p - 0.5; r = q * q;
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
               (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
                ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
}
function dprime(hits, total_signal, fas, total_noise) {
    // Hautus (1995) loglinear correction
    var hr = (hits + 0.5) / (total_signal + 1);
    var fr = (fas + 0.5)  / (total_noise + 1);
    var zh = _qnorm(hr), zf = _qnorm(fr);
    if (zh === null || zf === null) return null;
    return zh - zf;
}

// =========== JSPSYCH INIT =====================================================
var jsPsych = initJsPsych({
    display_element: 'display_stage',
    on_finish: function () {
        var qHas = (typeof Qualtrics !== 'undefined');
        var data = jsPsych.data.get();

        // ---- Filtering: practice trials are excluded from every dump below.
        //   - CPT main trials have task='faceOnTopTask'
        //   - CPT practice trials have task='faceOnTopPractice'  ← EXCLUDED
        //   - Memory test trials have task='memTest' (no practice equivalent)
        //   - Mind-wandering probes during main CPT have phase='main'
        //   - Mind-wandering probes during practice have phase='practice_<N>'  ← EXCLUDED
        // The redundant filterCustom calls below make the exclusion belt-and-suspenders.

        // ---- Mind-wandering probes (CPT phase only) ----
        var mw = data.filter({task: 'mindwander_probe', phase: 'main'})
                     .filterCustom(function (r) { return r.phase === 'main'; })
                     .values();
        var mw_n = mw.length;
        var mw_off = mw.filter(function (r) { return r.on_task === 0; }).length;
        var mw_offtask_rate = mw_n ? mw_off / mw_n : null;

        // ---- Practice outcomes (faceOnTopPractice trials across all retry attempts) ----
        // Added 2026-05-13 because most Prolific pilot participants were failing
        // practice and we had no trial-level data to see why. Each practice trial
        // carries the same fields as main CPT.
        var practice = data.filter({task: 'faceOnTopPractice'})
                           .filterCustom(function (r) { return r.task === 'faceOnTopPractice'; })
                           .values();
        var practice_n = practice.length;
        var practice_correct = practice.filter(function (r) { return r.correct === true; }).length;
        var practice_acc = practice_n ? practice_correct / practice_n : null;

        // ---- CPT outcomes (main trials only — faceOnTopTask) ----
        var cpt = data.filter({task: 'faceOnTopTask'})
                      .filterCustom(function (r) { return r.task === 'faceOnTopTask'; })
                      .values();
        var cpt_n = cpt.length;
        var cpt_correct = cpt.filter(function (r) { return r.correct === true; }).length;
        var cpt_acc = cpt_n ? cpt_correct / cpt_n : null;

        // signal = trial requires withhold (correct_response === null)
        // hit on signal = correctly withheld; FA on signal = pressed when shouldn't
        // For d-prime we treat "press" as the affirmative response, so:
        //   target = "go" (non-2-back-second) → press required
        //   noise  = "no-go" (2-back-second)  → withhold required
        var go_trials   = cpt.filter(function (r) { return r.correct_response === ' '; });
        var nogo_trials = cpt.filter(function (r) { return r.correct_response === null; });
        var go_hits = go_trials.filter(function (r) { return r.response === ' '; }).length;
        var nogo_fas = nogo_trials.filter(function (r) { return r.response === ' '; }).length;
        var cpt_dprime = dprime(go_hits, go_trials.length, nogo_fas, nogo_trials.length);

        // RT on correct go-trials
        var go_correct = go_trials.filter(function (r) { return r.correct === true && typeof r.rt === 'number'; });
        var rts = go_correct.map(function (r) { return r.rt; });
        var meanrt = rts.length ? rts.reduce(function (a, b) { return a + b; }, 0) / rts.length : null;
        var medrt  = median(rts);

        // ---- Memory outcomes (memTest trials only) ----
        var mem = data.filter({task: 'memTest'}).values();
        var mem_old = mem.filter(function (r) { return r.presented === true; });
        var mem_new = mem.filter(function (r) { return r.presented !== true; });
        var mem_hits = mem_old.filter(function (r) { return r.response === '3' || r.response === '4'; }).length;
        var mem_fas  = mem_new.filter(function (r) { return r.response === '3' || r.response === '4'; }).length;
        var mem_high_hits = mem_old.filter(function (r) { return r.response === '4'; }).length;
        var mem_high_fas  = mem_new.filter(function (r) { return r.response === '4'; }).length;
        var mem_hit_rate = mem_old.length ? mem_hits / mem_old.length : null;
        var mem_fa_rate  = mem_new.length ? mem_fas  / mem_new.length : null;
        var mem_dprime = dprime(mem_hits, mem_old.length, mem_fas, mem_new.length);
        var mem_dprime_high = dprime(mem_high_hits, mem_old.length, mem_high_fas, mem_new.length);
        // Mean confidence (1-4) per response; treat missing/null as null.
        var mem_resps = mem.filter(function (r) { return r.response !== null && r.response !== undefined; })
                          .map(function (r) { return parseInt(r.response, 10); });
        var mem_meanconf = mem_resps.length
            ? mem_resps.reduce(function (a, b) { return a + b; }, 0) / mem_resps.length
            : null;

        if (qHas) {
            // Trial-level dump (compact). CPT has many trials, memory has many; combine.
            try {
                var cptCols = ['Face', 'Scene', 'faceType', 'sceneType',
                               'relevant_two_back_type', 'relevant_presentation_number',
                               'response', 'correct_response', 'correct', 'rt', 'trial_number'];
                var cptRows = cpt.map(function (r) {
                    return [r.Face, r.Scene, r.faceType, r.sceneType,
                            r.relevant_two_back_type, r.relevant_presentation_number,
                            r.response, r.correct_response, r.correct, r.rt, r.trial_number];
                });
                var memCols = ['image', 'type', 'relevance', 'frequency', 'presented',
                               'response', 'correct', 'rt', 'trial_number'];
                var memRows = mem.map(function (r) {
                    return [r.image, r.type, r.relevance, r.frequency, r.presented,
                            r.response, r.correct, r.rt, r.trial_number];
                });
                var mwCols = ['phase', 'on_task', 'rt'];
                var mwRows = mw.map(function (r) {
                    return [r.phase, r.on_task, r.rt];
                });
                // Practice trial rows — same shape as cptCols but tagged with
                // attempt index so we can see per-attempt accuracy & error types.
                var practiceCols = ['attempt', 'Face', 'Scene', 'faceType', 'sceneType',
                                    'relevant_two_back_type', 'relevant_presentation_number',
                                    'response', 'correct_response', 'correct', 'rt'];
                // jsPsych v7 doesn't tag attempt; infer from order: every TOTAL_PRACTICE_TRIALS
                // (=20) trials starts a new attempt.
                var TOTAL_PRACTICE = 20;
                var practiceRows = practice.map(function (r, idx) {
                    return [Math.floor(idx / TOTAL_PRACTICE) + 1,
                            r.Face, r.Scene, r.faceType, r.sceneType,
                            r.relevant_two_back_type, r.relevant_presentation_number,
                            r.response, r.correct_response, r.correct, r.rt];
                });
                // Pilot CSV revealed the Qualtrics survey has three separate
                // trial-level fields (afc_cpt_data, afc_mem_data, afc_mw_data)
                // rather than a single combined afc_data. Write to each
                // separately so they actually land. Also keep afc_data as a
                // belt-and-suspenders combined dump in case a future survey
                // re-bundles them.
                var commonMeta = {
                    pid: subject,
                    relevant: relevantType,
                    frequent_relevant: frequentType,
                    frequent_irrelevant: secondFrequentType
                };
                Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_data', JSON.stringify(
                    Object.assign({}, commonMeta, { cols: cptCols, rows: cptRows })
                ));
                Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_data', JSON.stringify(
                    Object.assign({}, commonMeta, { cols: memCols, rows: memRows })
                ));
                Qualtrics.SurveyEngine.setEmbeddedData('afc_mw_data', JSON.stringify(
                    Object.assign({}, commonMeta, { cols: mwCols, rows: mwRows })
                ));
                Qualtrics.SurveyEngine.setEmbeddedData('afc_practice_data', JSON.stringify(
                    Object.assign({}, commonMeta, { cols: practiceCols, rows: practiceRows })
                ));
                Qualtrics.SurveyEngine.setEmbeddedData('afc_practice_n',   practice_n);
                Qualtrics.SurveyEngine.setEmbeddedData('afc_practice_acc', round3(practice_acc));
                Qualtrics.SurveyEngine.setEmbeddedData('afc_data', JSON.stringify({
                    pid: subject,
                    relevant: relevantType,
                    frequent_relevant: frequentType,
                    frequent_irrelevant: secondFrequentType,
                    cpt: { cols: cptCols, rows: cptRows },
                    mem: { cols: memCols, rows: memRows },
                    mw:  { cols: mwCols,  rows: mwRows  },
                    practice: { cols: practiceCols, rows: practiceRows }
                }));
            } catch (e) {
                console.warn('[afc] setEmbeddedData failed for afc_data:', e);
            }

            // Summary fields
            Qualtrics.SurveyEngine.setEmbeddedData('afc_relevant',          relevantType);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_frequent',          frequentType);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_frequent_irrel',    secondFrequentType);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_n',             cpt_n);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_accuracy',      round3(cpt_acc));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_dprime',        round3(cpt_dprime));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_meanrt',        meanrt !== null ? Math.round(meanrt) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_cpt_medianrt',      medrt !== null ? Math.round(medrt) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_n',             mem.length);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_hit_rate',      round3(mem_hit_rate));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_fa_rate',       round3(mem_fa_rate));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_dprime',        round3(mem_dprime));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_dprime_high',   round3(mem_dprime_high));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mem_meanconf',      round3(mem_meanconf));
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mw_n_probes',       mw_n);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mw_offtask_count',  mw_off);
            Qualtrics.SurveyEngine.setEmbeddedData('afc_mw_offtask_rate',   round3(mw_offtask_rate));
        }

        if (typeof jQuery !== 'undefined') {
            jQuery('#display_stage').remove();
            jQuery('#display_stage_background').remove();
        }
        if (typeof window.qthis !== 'undefined' && window.qthis && window.qthis.clickNextButton) {
            window.qthis.clickNextButton();
        }
    }
});

if (typeof window !== 'undefined') { window.jsPsych = jsPsych; }

// =========== CAPTURE-PHASE KEYBOARD FAILSAFE (for Qualtrics) ===================
// In Qualtrics, the SurveyEngine installs document-level keydown handlers that
// can swallow Space (and number keys) before jsPsych's bubble-phase listener
// fires. The browser's default Space-scrolls-page behavior also kicks in if no
// handler returns. Install a capture-phase listener (fires BEFORE any bubble
// listener regardless of registration order) so we always see keys first.
//
// Each press is timestamped into window.__afc_keyLog. Trial on_finish handlers
// recover the response by looking at presses that landed in the trial window.
//
// Idempotent — only installed once per page even if the script loads twice.
if (typeof window !== 'undefined' && !window.__afc_keyListenerInstalled) {
    window.__afc_keyListenerInstalled = true;
    window.__afc_keyLog = [];
    document.addEventListener('keydown', function (e) {
        var k = e.key;
        // Treat numeric keys uniformly across keyboard/numpad
        if (e.code && e.code.indexOf('Numpad') === 0) {
            k = e.code.replace('Numpad', '');
        }
        if (k === ' ' || k === 'Spacebar' || e.code === 'Space' || e.keyCode === 32) {
            window.__afc_keyLog.push({ key: ' ', t: performance.now() });
            // Stop browser default scroll. Don't stopPropagation — let other
            // listeners (e.g. jsPsych's) still run if they will.
            if (e.target === document.body || (e.target && e.target.tagName === 'BUTTON') ||
                (e.target && e.target.id === 'SurveyEngineBody')) {
                e.preventDefault();
            }
        } else if (k === '1' || k === '2' || k === '3' || k === '4') {
            window.__afc_keyLog.push({ key: k, t: performance.now() });
        }
    }, true); // capture phase
}

// =========== PARTICIPANT ID (from Qualtrics) ==================================
var subject = (typeof window !== 'undefined' && window.QUALTRICS_PID)
              ? window.QUALTRICS_PID
              : ('anon_' + Date.now());
jsPsych.data.addProperties({participant_id: subject});

// =========== RANDOMIZE TASK ASSIGNMENTS =======================================
// Match the original task.js logic (lines 140-191).
var relevant = Math.random() < 0.5 ? 0 : 1;
var frequent = Math.floor(Math.random() * 2);
var secondFrequent = Math.floor(Math.random() * 2);
var relevantType, irrelevantType, frequentType, targetType, secondFrequentType;
if (relevant === 0) {
    relevantType = "face"; irrelevantType = "scene";
    if (frequent === 0)      { frequentType = "female"; targetType = "male"; }
    else                     { frequentType = "male";   targetType = "female"; }
    secondFrequentType = (secondFrequent === 0) ? "indoor" : "outdoor";
} else {
    relevantType = "scene"; irrelevantType = "face";
    if (frequent === 0)      { frequentType = "indoor"; targetType = "outdoor"; }
    else                     { frequentType = "outdoor"; targetType = "indoor"; }
    secondFrequentType = (secondFrequent === 0) ? "male" : "female";
}

// Expose to global scope: generateStimuli.js was written for jsPsych v6 where
// these were free top-level globals. In our v7 build everything lives inside
// initExp(), so generateStimuli.js's implicit-global reference (e.g. inside
// generatePracticeStimuli) needs them on window to resolve.
window.relevantType = relevantType;
window.irrelevantType = irrelevantType;
window.frequentType = frequentType;
window.targetType = targetType;
window.secondFrequentType = secondFrequentType;

// =========== STIMULI ==========================================================
// generateStimuli.js (loaded before this script) provides generateRandomStimuli,
// generatePracticeStimuli, returnArrays, etc. — using their hardcoded paths
// like "images/indoor/sun_xxx.jpg". We prepend AFC_ASSET_ROOT to all of them
// so they resolve against the hosted bucket.
// Cache-bust suffix. Bump this whenever scene/face files on R2 are re-uploaded
// so browsers (and Cloudflare edge) refetch instead of serving the year-old
// cached copy (we set CacheControl: max-age=31536000 on uploads).
var AFC_ASSET_VERSION = 'v2';

function _prefixPath(p) {
    if (typeof p !== 'string') return p;
    if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) return p;
    var sep = p.indexOf('?') >= 0 ? '&' : '?';
    return AFC_ASSET_ROOT + p + sep + 'v=' + AFC_ASSET_VERSION;
}
function _prefixCPTArray(arr) {
    arr.forEach(function (s) {
        if (s.Face) s.Face = _prefixPath(s.Face);
        if (s.Scene) s.Scene = _prefixPath(s.Scene);
    });
}
function _prefixMemArray(arr) {
    arr.forEach(function (s) {
        if (s.path) s.path = _prefixPath(s.path);
        if (s.otherImage) s.otherImage = _prefixPath(s.otherImage);
    });
}

var opacity = 0.5;
var _allStimuli = generateRandomStimuli(relevantType, frequentType, secondFrequentType, 'uniform');
var randomizedStimuli = _allStimuli[0];
var memStimuli = _allStimuli[1];
_prefixCPTArray(randomizedStimuli);
_prefixMemArray(memStimuli);

// Practice — 8 separate fresh sets so retries get a new sequence.
var randomizedPracticeStimuli  = generatePracticeStimuli();
var randomizedPracticeStimuli1 = generatePracticeStimuli();
var randomizedPracticeStimuli2 = generatePracticeStimuli();
var randomizedPracticeStimuli3 = generatePracticeStimuli();
var randomizedPracticeStimuli4 = generatePracticeStimuli();
var randomizedPracticeStimuli5 = generatePracticeStimuli();
var randomizedPracticeStimuli6 = generatePracticeStimuli();
var randomizedPracticeStimuli7 = generatePracticeStimuli();
[randomizedPracticeStimuli, randomizedPracticeStimuli1, randomizedPracticeStimuli2,
 randomizedPracticeStimuli3, randomizedPracticeStimuli4, randomizedPracticeStimuli5,
 randomizedPracticeStimuli6, randomizedPracticeStimuli7].forEach(_prefixCPTArray);

// =========== PRELOAD ==========================================================
var preloadArray = [];
randomizedStimuli.forEach(function (s) { preloadArray.push(s.Face, s.Scene); });
randomizedPracticeStimuli.forEach(function (s) { preloadArray.push(s.Face, s.Scene); });
memStimuli.forEach(function (s) { preloadArray.push(s.path); });

var preload = {
    type: jsPsychPreload,
    message: 'Loading',
    images: preloadArray,
    max_load_time: 1200000,
    show_detailed_errors: true,
    continue_after_error: false
};

// =========== TRIAL HTML BUILDERS ==============================================
// One self-contained centered container holding scene (background, contained
// to fit), face overlay (fixed-size on top), and the response dot. Avoids the
// original Pavlovia-style position:fixed-inset:0 approach because that relies
// on the scene being smaller than the viewport — which broke once we capped
// SUN scenes at 1024 px (taller than some Qualtrics display areas), letting
// the scene overflow display_stage's overflow:auto box.
function makeOverlayStimulus(scenePath, facePath, dotColor) {
    // Render scenes at NATIVE pixel size (no upscaling). Anna did the same and
    // it's why her layout worked — our SUN images are 314x235 to 600x399, so
    // upscaling them to a fixed 800x600 box made them blurry and made the
    // sharp-rendered face look disproportionately big.
    //
    // The container is the bounded outer box (so faces are anchored at its
    // visual center). max-width/max-height + width:auto/height:auto on the
    // scene <img> means it shows native size unless that exceeds the bound.
    return '<div class="afc-stim-container" '
         +      'style="position: relative; '
         +             'display: flex; align-items: center; justify-content: center; '
         +             'width: min(800px, 95vw); '
         +             'height: min(600px, 80vh); '
         +             'margin: 0 auto;">'
         +     '<img src="' + scenePath + '" '
         +          'class="afc-stim-scene" '
         +          'style="max-width: 100%; max-height: 100%; '
         +                 'width: auto; height: auto; '
         +                 'z-index: 1;">'
         +     '<img src="' + facePath + '" '
         +          'class="afc-stim-face" '
         +          'style="position: absolute; top: 50%; left: 50%; '
         +                 'transform: translate(-50%, -50%); '
         +                 'height: ' + FACE_SIZE + 'px !important; '
         +                 'width: auto !important; '
         +                 'max-height: ' + FACE_SIZE + 'px !important; '
         +                 'z-index: 2;">'
         +     '<span class="afc-stim-dot" '
         +           'style="position: absolute; top: 50%; left: 50%; '
         +                  'transform: translate(-50%, -50%); '
         +                  'color: ' + dotColor + '; '
         +                  'font-size: 28px; line-height: 1; '
         +                  'z-index: 3;">&#9679;</span>'
         + '</div>';
}

// =========== CPT TRIAL BLOCK ==================================================
// Two sub-trials per timeline-variable iteration:
//   (1) face_on_top_task: dark-gray dot, accepts space, ends on response.
//   (2) face_on_top_fill_in: light-gray dot, no response, fills the rest of
//       the 1000 ms window when the participant did respond.
// If they did NOT respond (timeout = null), the fill-in is skipped.

function makeCPTBlock(taskName, fillTaskName) {
    var face_on_top_task = {
        timeline: [{
            type: jsPsychHtmlKeyboardResponse,
            stimulus: function () {
                return makeOverlayStimulus(
                    jsPsych.timelineVariable('Scene'),
                    jsPsych.timelineVariable('Face'),
                    '#303030'
                );
            },
            response_ends_trial: true,
            choices: [' '],
            trial_duration: TRIAL_DUR_MS,
            css_classes: ['hide_cursor', 'stimulus_size'],
            data: function () {
                return {
                    Face: jsPsych.timelineVariable('Face'),
                    faceType: jsPsych.timelineVariable('faceType'),
                    Scene: jsPsych.timelineVariable('Scene'),
                    sceneType: jsPsych.timelineVariable('sceneType'),
                    relevant_two_back_type: jsPsych.timelineVariable('relevant_two_back_type'),
                    relevant_presentation_number: jsPsych.timelineVariable('relevant_presentation_number'),
                    relevant: relevantType,
                    frequent: frequentType,
                    task: taskName
                };
            },
            on_load: function () {
                // Drop focus from any Qualtrics chrome that might intercept Space
                try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
                try { window.focus(); } catch (e) {}
                // Mark trial start
                window.__afc_trialStart = performance.now();
                window.__afc_perTrialEnded = false;

                // Per-trial capture-phase listener that ENDS the trial
                // synchronously on first Space press by calling
                // jsPsych.finishTrial. Capture phase fires before any of
                // Qualtrics' bubble-phase handlers, so we always see the
                // press first. Calling finishTrial inline:
                //   1. clears the trial_duration setTimeout (no double-end)
                //   2. populates data.response and data.rt early
                //   3. advances to the fill-in trial, which sees rt != null
                //      and plays the gray dot for the remaining time —
                //      exactly Anna's intended UX.
                window.__afc_perTrialHandler = function (e) {
                    if (window.__afc_perTrialEnded) return;
                    if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
                        var rt = performance.now() - window.__afc_trialStart;
                        window.__afc_perTrialEnded = true;
                        // Stop browser default scroll-on-space.
                        try { e.preventDefault(); } catch (err) {}
                        // Clean up jsPsych's own bubble-phase keyboard
                        // listeners (the plugin's getKeyboardResponse) so
                        // they don't fire later and try to end_trial again.
                        try { jsPsych.pluginAPI.cancelAllKeyboardResponses(); } catch (err) {}
                        try {
                            jsPsych.finishTrial({ response: ' ', rt: rt });
                        } catch (err) {
                            console.warn('[afc] finishTrial failed:', err);
                        }
                    }
                };
                document.addEventListener('keydown', window.__afc_perTrialHandler, true);
            },
            on_finish: function (data) {
                // Remove per-trial listener
                try { document.removeEventListener('keydown', window.__afc_perTrialHandler, true); } catch (e) {}

                // Fallback: if per-trial listener didn't fire (e.g., timing
                // edge case where event fires after on_finish has been
                // invoked by trial_duration timeout), recover from the
                // global capture log. Tagged with recovered_from_capture so
                // the fill-in conditional knows to skip (trial already ran
                // its full duration).
                if (data.response === null && Array.isArray(window.__afc_keyLog)) {
                    var trialStart = window.__afc_trialStart || (performance.now() - TRIAL_DUR_MS);
                    var trialEnd = performance.now();
                    for (var i = 0; i < window.__afc_keyLog.length; i++) {
                        var k = window.__afc_keyLog[i];
                        if (k.key === ' ' && k.t >= trialStart && k.t <= trialEnd) {
                            data.response = ' ';
                            data.rt = k.t - trialStart;
                            data.recovered_from_capture = true;
                            break;
                        }
                    }
                }

                if (data.relevant_two_back_type === 'two_back' && data.relevant_presentation_number === 'second') {
                    data.correct_response = null;     // withhold
                } else {
                    data.correct_response = ' ';      // press space
                }
                data.correct = (data.response === data.correct_response);
                data.rtt = (new Date()).getTime();
                data.trial_number = jsPsych.data.get().filter({task: taskName}).count();
            }
        }]
    };

    var face_on_top_fill_in = {
        timeline: [{
            type: jsPsychHtmlKeyboardResponse,
            stimulus: function () {
                return makeOverlayStimulus(
                    jsPsych.timelineVariable('Scene'),
                    jsPsych.timelineVariable('Face'),
                    'gray'
                );
            },
            response_ends_trial: false,
            choices: 'NO_KEYS',
            trial_duration: function () {
                var prior = jsPsych.data.get().filter({task: taskName}).values();
                var prevRt = prior[prior.length - 1].rt;
                return TRIAL_DUR_MS - prevRt;
            },
            css_classes: ['hide_cursor', 'stimulus_size'],
            data: function () {
                return {
                    Face: jsPsych.timelineVariable('Face'),
                    faceType: jsPsych.timelineVariable('faceType'),
                    Scene: jsPsych.timelineVariable('Scene'),
                    sceneType: jsPsych.timelineVariable('sceneType'),
                    relevant: relevantType,
                    frequent: frequentType,
                    task: fillTaskName
                };
            }
        }]
    };

    var fill_in_if_node = {
        timeline: [face_on_top_fill_in],
        conditional_function: function () {
            var prior = jsPsych.data.get().filter({task: taskName}).values();
            var last = prior[prior.length - 1];
            // Skip fill-in if response was recovered after the fact via the
            // capture-phase listener: in that case jsPsych ran the trial for
            // the full TRIAL_DUR_MS already (it never saw the key), so adding
            // fill-in would push total trial time past 1000 ms and slow the
            // task by ~50%. The trade-off: the dot stays dark instead of
            // briefly going gray to confirm response — but in Qualtrics
            // jsPsych never sees Space so this confirmation never happened
            // either way.
            if (last.recovered_from_capture) return false;
            return last.rt !== null;
        }
    };

    return { trial: face_on_top_task, fillIn: fill_in_if_node };
}

// =========== MIND-WANDERING PROBE =============================================
// Binary on-task / off-task probe inserted at jittered intervals during the CPT.
// Wording matches McVay & Kane / standard MW research conventions.
var MW_MIN_GAP = 25;            // min trials between probes
var MW_MAX_GAP = 35;            // max trials between probes
var MW_PRACTICE_AT_TRIAL = 10;  // single probe in each practice attempt at trial #10

var mindwander_probe = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div style="font-size:18pt; max-width:600px; margin:50px auto;">'
            +    '<p>Just now, where was your attention?</p>'
            + '</div>',
    choices: [
        '<b>On task</b><br><span style="font-size:11pt; color:#555;">thoughts focused on the task</span>',
        '<b>Off task</b><br><span style="font-size:11pt; color:#555;">task-unrelated thoughts</span>'
    ],
    button_html: '<button class="afc-default-button" style="width:240px; height:90px; margin: 20px;">%choice%</button>',
    data: function () {
        return {
            task: 'mindwander_probe',
            phase: window.__afc_current_phase || 'unknown'
        };
    },
    on_finish: function (data) {
        // 0 → on task (response = 1), 1 → off task (response = 0)
        data.on_task = (data.response === 0) ? 1 : 0;
    }
};

// Probe positions at jittered intervals across n_trials. Returns sorted indices
// of the trial AFTER which a probe fires (0-indexed).
function generateProbePositions(n_trials, min_gap, max_gap) {
    var positions = [];
    var pos = min_gap + Math.floor(Math.random() * (max_gap - min_gap + 1));
    while (pos <= n_trials) {
        positions.push(pos);
        pos += min_gap + Math.floor(Math.random() * (max_gap - min_gap + 1));
    }
    return positions;
}

// Build a timeline of [stimulus → fillIn (× n_stim)] with mind-wandering probes
// interleaved at the given trial indices.
function buildCPTWithProbes(blocks, stimuli, probe_positions, phase_label) {
    var inner = [];
    for (var i = 0; i < stimuli.length; i++) {
        inner.push({
            timeline: [blocks.trial, blocks.fillIn],
            timeline_variables: [stimuli[i]],
            on_timeline_start: function () { window.__afc_current_phase = phase_label; }
        });
        if (probe_positions.indexOf(i + 1) >= 0) {
            inner.push(mindwander_probe);
        }
    }
    return { timeline: inner };
}

// Main task block — probes every 25–35 trials → ~10 probes for 300 trials
var _mainBlocks = makeCPTBlock('faceOnTopTask', 'faceOnTopTaskfillIn');
var _mainProbePositions = generateProbePositions(randomizedStimuli.length, MW_MIN_GAP, MW_MAX_GAP);
var face_on_top_setup = buildCPTWithProbes(_mainBlocks, randomizedStimuli, _mainProbePositions, 'main');

// Practice blocks — single probe at trial 10 of each attempt (familiarization)
var _practiceBlocks = makeCPTBlock('faceOnTopPractice', 'faceOnTopTaskPracticeFillIn');
function makePracticeSetup(stimuli, attempt_label) {
    return buildCPTWithProbes(_practiceBlocks, stimuli, [MW_PRACTICE_AT_TRIAL], 'practice_' + attempt_label);
}
var face_on_top_practice_setup  = makePracticeSetup(randomizedPracticeStimuli,  '0');
var face_on_top_practice_setup1 = makePracticeSetup(randomizedPracticeStimuli1, '1');
var face_on_top_practice_setup2 = makePracticeSetup(randomizedPracticeStimuli2, '2');
var face_on_top_practice_setup3 = makePracticeSetup(randomizedPracticeStimuli3, '3');
var face_on_top_practice_setup4 = makePracticeSetup(randomizedPracticeStimuli4, '4');
var face_on_top_practice_setup5 = makePracticeSetup(randomizedPracticeStimuli5, '5');
var face_on_top_practice_setup6 = makePracticeSetup(randomizedPracticeStimuli6, '6');
var face_on_top_practice_setup7 = makePracticeSetup(randomizedPracticeStimuli7, '7');

// =========== INSTRUCTIONS =====================================================
// Reframed 2026-05-13 after Prolific pilot showed 90%+ of participants failing
// practice. Per-trial breakdown revealed naive participants applying an
// "oddball" heuristic (press on the rare event) when the rule actually requires
// pressing on the COMMON event (~75% of trials are 2-back-different = press).
// New framing: press is the DEFAULT action; withholding is the SPECIAL case.
// Also added base-rate hint so participants know what to expect.
function _ruleCard(target) {
    var t = target.replace(/s$/, '');
    return '<div style="display:flex; gap: 16px; flex-wrap: wrap; '
         +              'justify-content: center; margin: 18pt 0;">'
         // LEFT card — the DEFAULT action, big & green
         +     '<div style="flex: 1 1 320px; max-width: 380px; '
         +                  'border: 3px solid #2a8d3a; border-radius: 8px; '
         +                  'background: #eaf7ec; padding: 16pt;">'
         +         '<div style="font-size: 13pt; font-weight: 700; color: #1f6d2c; '
         +                      'margin-bottom: 6pt;">PRESS SPACEBAR — most of the time</div>'
         +         '<div>Press for <strong>every</strong> ' + t + '.</div>'
         +         '<div style="font-size: 10pt; color: #555; margin-top: 4pt;">'
         +              'About 3 out of every 4 ' + target + ' need a press.</div>'
         +     '</div>'
         // RIGHT card — the SPECIAL exception, orange to signal "watch for this"
         +     '<div style="flex: 1 1 320px; max-width: 380px; '
         +                  'border: 3px solid #c97600; border-radius: 8px; '
         +                  'background: #fff3e0; padding: 16pt;">'
         +         '<div style="font-size: 13pt; font-weight: 700; color: #a85f00; '
         +                      'margin-bottom: 6pt;">EXCEPTION — withhold (do nothing)</div>'
         +         '<div>Only when the current ' + t + ' is the <strong>same</strong> as the ' + t + ' shown <strong>two ' + target + ' ago</strong>.</div>'
         +         '<div style="font-size: 10pt; color: #555; margin-top: 4pt;">'
         +              'About 1 in 4 ' + target + ' — keep watching for matches.</div>'
         +     '</div>'
         + '</div>';
}

// Worked-example walkthrough of the 2-back lag, shown once on the main
// instructions screen. Demonstrates what "two ago" actually means.
function _twoBackExample(target) {
    var t = target.replace(/s$/, '');
    var letters = ['A', 'B', 'C', 'B', 'D'];
    var notes = [
        'first ' + t + ' — nothing to compare to yet, no decision',
        'second ' + t + ' — still nothing to compare to, no decision',
        'compare to ' + t + ' #1 (A) → <strong>different</strong> → <span style="color:#1f6d2c; font-weight:700;">PRESS</span>',
        'compare to ' + t + ' #2 (B) → <strong>same</strong> → <span style="color:#a85f00; font-weight:700;">WITHHOLD</span>',
        'compare to ' + t + ' #3 (C) → <strong>different</strong> → <span style="color:#1f6d2c; font-weight:700;">PRESS</span>'
    ];
    var html = '<div style="margin: 14pt 0; padding: 12pt 14pt; '
             +              'background: #f7f7f7; border-left: 4px solid #888; border-radius: 4px;">'
             +     '<div style="font-weight: 700; margin-bottom: 8pt;">How "two ago" works</div>'
             +     '<table style="width: 100%; border-collapse: collapse; font-size: 11pt;">'
             +         '<tr style="border-bottom: 1px solid #ddd;">'
             +             '<th style="text-align:left; padding: 4pt 8pt;">#</th>'
             +             '<th style="text-align:center; padding: 4pt 8pt;">' + t + '</th>'
             +             '<th style="text-align:left; padding: 4pt 8pt;">what to do</th>'
             +         '</tr>';
    for (var i = 0; i < letters.length; i++) {
        html += '<tr style="border-bottom: 1px solid #eee;">'
             +     '<td style="padding: 4pt 8pt; color:#888;">' + (i + 1) + '</td>'
             +     '<td style="text-align:center; padding: 4pt 8pt; '
             +              'font-family: monospace; font-size: 16pt; font-weight:700;">' + letters[i] + '</td>'
             +     '<td style="padding: 4pt 8pt;">' + notes[i] + '</td>'
             +  '</tr>';
    }
    html += '</table></div>';
    return html;
}

var _mw_instr_block = '<div style="margin-top: 18pt; padding: 12pt 14pt; '
                    +              'background: #fff8e1; border-left: 4px solid #c9a227; '
                    +              'border-radius: 4px;">'
                    +     '<div style="font-weight: 700; margin-bottom: 4pt;">Mind-wandering check-in</div>'
                    +     '<p style="margin: 0;">Every 25–35 images the task pauses and asks: '
                    +     '<em>"Just now, where was your attention?"</em></p>'
                    +     '<ul style="margin: 6pt 0 0 0; padding-left: 20pt;">'
                    +         '<li><strong>On task</strong> — your thoughts were focused on the task.</li>'
                    +         '<li><strong>Off task</strong> — you were experiencing task-unrelated thoughts.</li>'
                    +     '</ul>'
                    +     '<p style="margin: 8pt 0 0 0;"><strong>Please answer honestly.</strong> '
                    +     'Mind-wandering is normal. We are genuinely interested in when this happens.</p>'
                    +     '<p style="margin: 6pt 0 0 0; font-size: 11pt; color: #555;">'
                    +     '<strong>Your answers to these check-ins will <u>not</u> be used to '
                    +     'reject your submission</strong> and will not affect your payment or rating. '
                    +     'They are not "attention checks" — they\'re a window into your experience '
                    +     'that we use for science.</p>'
                    + '</div>';

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scenes' : 'faces';
        var t = target.replace(/s$/, '');
        return '<div class="afc-instr">'
             +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Recognition Task</h2>'
             +     '<p>You will see a series of images, each showing a <strong>face overlaid on a scene</strong>. '
             +     'Focus only on the <strong>' + target + '</strong>.</p>'
             +     '<p style="margin-top: 14pt; font-size: 14pt;"><strong>The rule:</strong> '
             +     '<span style="color:#1f6d2c; font-weight:700;">Press space on every ' + t + '</span> '
             +     '— <strong>unless</strong> the current ' + t + ' is the same as the ' + t + ' you saw '
             +     '<em>two ' + target + ' ago</em>, in which case <strong>do nothing</strong>.</p>'
             +     _ruleCard(target)
             +     _twoBackExample(target)
             +     '<div style="margin-top: 14pt; padding: 10pt 14pt; background: #eef4ff; '
             +                'border-left: 4px solid #4477cc; border-radius: 4px;">'
             +         '<div style="font-weight: 700; margin-bottom: 4pt;">Visual feedback</div>'
             +         '<p style="margin: 0;">A dark gray dot sits in the center of every image. '
             +         'When you press, it briefly turns <span style="color:#aaa;">light gray</span> to confirm your response.</p>'
             +     '</div>'
             +     '<p style="margin-top: 14pt;">Respond as <strong>accurately</strong> as you can. '
             +     'Most ' + target + ' need a press — the "do nothing" exception is the rare case.</p>'
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'instructions1' }
};

var mw_instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        return '<div class="afc-instr">'
             +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">One more thing</h2>'
             +     _mw_instr_block
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'mw_instructions' }
};

var practice_instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scenes' : 'faces';
        var t = target.replace(/s$/, '');
        return '<div class="afc-instr">'
             +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Practice round</h2>'
             +     '<p>You\'ll now do a short practice. You need to reach <strong>' + Math.round(PRACTICE_ACC_THRESHOLD * 100) + '% accuracy</strong> to move on to the real task.</p>'
             +     '<p style="margin-top: 12pt; font-size: 14pt;">Reminder: '
             +     '<span style="color:#1f6d2c; font-weight:700;">press space on every ' + t + '</span>, '
             +     '<strong>except</strong> when it matches the ' + t + ' shown two ' + target + ' ago.</p>'
             +     _ruleCard(target)
             +     '<p style="margin-top: 14pt; font-size: 11pt; color: #555;">'
             +     'During practice you\'ll also see one mind-wandering check-in, so you know what it looks like. '
             +     'Your answers to these are <strong>not</strong> used to evaluate your work.</p>'
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>'
};

// Practice-report screens (with retry-up-to-8 logic)
function makePracticeReport(reportName, isLastAttempt) {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: function () {
            var prior = jsPsych.data.get().filter({task: 'faceOnTopPractice'}).values();
            var n = TOTAL_PRACTICE_TRIALS;
            var sum = 0;
            for (var i = prior.length - n; i < prior.length; i++) {
                if (prior[i].correct === true) sum += 1;
            }
            var accuracy = sum / n;
            var pct = (accuracy * 100).toFixed(0);
            var target = (relevantType === 'scene') ? 'scenes' : 'faces';
            var threshold = Math.round(PRACTICE_ACC_THRESHOLD * 100);

            // Last attempt has a softer floor: anyone reaching PRACTICE_FINAL_THRESHOLD
            // can still proceed to the real task; only those below it are gated out.
            if (isLastAttempt) {
                if (accuracy < PRACTICE_FINAL_THRESHOLD) {
                    jsPsych.endExperiment(
                        '<div class="afc-instr" style="text-align: center;">'
                      +     '<h2 style="font-size: 20pt;">Practice incomplete</h2>'
                      +     '<p style="font-size: 16pt;">You scored <strong>' + pct + '%</strong> on the practice task.</p>'
                      +     '<p>This was your last opportunity. The experiment will end now.</p>'
                      + '</div>'
                    );
                    return '';
                }
                // >=70% on last attempt: proceed
                return '<div class="afc-instr">'
                     +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Nice work!</h2>'
                     +     '<div style="font-size: 36pt; font-weight: 700; color: #2a8d3a; '
                     +                  'text-align: center; margin: 12pt 0;">' + pct + '%</div>'
                     +     '<p>You\'re ready for the real task. Same rule:</p>'
                     +     _ruleCard(target)
                     + '</div>';
            }

            if (accuracy < PRACTICE_ACC_THRESHOLD) {
                return '<div class="afc-instr">'
                     +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Practice score</h2>'
                     +     '<div style="font-size: 36pt; font-weight: 700; color: #c9542b; '
                     +                  'text-align: center; margin: 12pt 0;">' + pct + '%</div>'
                     +     '<p>You need <strong>' + threshold + '%</strong> to move on. Please try the practice again.</p>'
                     +     _ruleCard(target)
                     + '</div>';
            } else {
                return '<div class="afc-instr">'
                     +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Nice work!</h2>'
                     +     '<div style="font-size: 36pt; font-weight: 700; color: #2a8d3a; '
                     +                  'text-align: center; margin: 12pt 0;">' + pct + '%</div>'
                     +     '<p>You\'re ready for the real task. Same rule:</p>'
                     +     _ruleCard(target)
                     + '</div>';
            }
        },
        choices: ['Continue'],
        button_html: '<button class="afc-default-button">%choice%</button>',
        data: { task: reportName }
    };
}
var practice_report  = makePracticeReport('practice_report', false);
var practice_report6 = makePracticeReport('practice_report6', false);
var practice_report7 = makePracticeReport('practice_report7', true);

var get_ready = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p>Get ready</p>',
    choices: 'NO_KEYS',
    trial_duration: 3000
};

var practice_loop_first = {
    timeline: [get_ready, face_on_top_practice_setup, practice_report]
};

// Re-shown after a failed first practice attempt. People who miss the 2-back
// rule on attempt 1 didn't read or didn't absorb the full instructions, so we
// surface them again with a header that acknowledges the retry.
var instructions_reshow = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scenes' : 'faces';
        var t = target.replace(/s$/, '');
        return '<div class="afc-instr">'
             +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Let\'s review the rule before trying again</h2>'
             +     '<p>You will see a series of images, each showing a <strong>face overlaid on a scene</strong>. '
             +     'Focus only on the <strong>' + target + '</strong>.</p>'
             +     '<p style="margin-top: 14pt; font-size: 14pt;"><strong>The rule:</strong> '
             +     '<span style="color:#1f6d2c; font-weight:700;">Press space on every ' + t + '</span> '
             +     '— <strong>unless</strong> the current ' + t + ' is the same as the ' + t + ' you saw '
             +     '<em>two ' + target + ' ago</em>, in which case <strong>do nothing</strong>.</p>'
             +     _ruleCard(target)
             +     _twoBackExample(target)
             +     '<p style="margin-top: 14pt;">Respond as <strong>accurately</strong> as you can. '
             +     'Most ' + target + ' need a press — the "do nothing" exception is the rare case.</p>'
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'instructions_reshow' }
};

function _accuracyMet() {
    var prior = jsPsych.data.get().filter({task: 'faceOnTopPractice'}).values();
    if (prior.length === 0) return false;
    var n = TOTAL_PRACTICE_TRIALS;
    var sum = 0;
    for (var i = prior.length - n; i < prior.length; i++) {
        if (prior[i].correct === true) sum += 1;
    }
    return (sum / n) >= PRACTICE_ACC_THRESHOLD;
}
function _shouldRunRetry() {
    var prior = jsPsych.data.get().filter({task: 'faceOnTopPractice'}).values();
    if (prior.length === 0) return true;
    return !_accuracyMet();
}
var conditional_1 = {
    timeline: [instructions_reshow, get_ready, face_on_top_practice_setup1, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_2 = {
    timeline: [get_ready, face_on_top_practice_setup2, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_3 = {
    timeline: [get_ready, face_on_top_practice_setup3, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_4 = {
    timeline: [get_ready, face_on_top_practice_setup4, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_5 = {
    timeline: [get_ready, face_on_top_practice_setup5, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_6 = {
    timeline: [get_ready, face_on_top_practice_setup6, practice_report6],
    conditional_function: _shouldRunRetry
};
var conditional_7 = {
    timeline: [get_ready, face_on_top_practice_setup7, practice_report7],
    conditional_function: _shouldRunRetry
};

// =========== MEMORY PHASE =====================================================
var mem_instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="afc-instr">'
            +     '<h2 style="margin: 0 0 10pt 0; font-size: 20pt;">Memory test</h2>'
            +     '<p>Great job! Now you\'ll be shown a series of images, one at a time. Some will have appeared in the earlier task (<strong>old</strong>), and some will be brand new (<strong>new</strong>).</p>'
            +     '<p style="margin-top: 12pt;">For each image, press the number key that matches your confidence:</p>'
            +     '<div style="display: flex; flex-wrap: wrap; gap: 10px; '
            +                'justify-content: center; margin: 14pt 0;">'
            +         _memKeyCard('1', 'Definitely new', '#c9542b')
            +         _memKeyCard('2', 'Maybe new', '#d9985c')
            +         _memKeyCard('3', 'Maybe old', '#7a9e6e')
            +         _memKeyCard('4', 'Definitely old', '#2a8d3a')
            +     '</div>'
            +     '<p style="font-size: 11pt; color: #555;">'
            +     'Trust your gut — there\'s no penalty for guessing.</p>'
            + '</div>',
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'mem_vis_instructions' }
};

function _memKeyCard(num, label, color) {
    return '<div style="flex: 1 1 130px; max-width: 170px; '
         +              'border: 2px solid ' + color + '; border-radius: 8px; '
         +              'padding: 10pt; text-align: center; background: white;">'
         +     '<div style="font-size: 24pt; font-weight: 700; color: ' + color + ';">' + num + '</div>'
         +     '<div style="font-size: 11pt;">' + label + '</div>'
         + '</div>';
}

var memtest_vis_setup = {
    timeline: [{
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            return '<img src="' + jsPsych.timelineVariable('path') + '" '
                 + 'style="height: clamp(180px, 32vh, 255px); filter: grayscale(100%); opacity: 1; display:block; margin: 0 auto;">';
        },
        choices: ['1', '2', '3', '4'],
        prompt: '<div style="display:flex; flex-wrap:wrap; gap: 24px; '
              +              'justify-content: center; align-items: center; '
              +              'margin-top: 16px; font-size: 14pt;">'
              +     '<span><strong>1</strong> Definitely new</span>'
              +     '<span><strong>2</strong> Maybe new</span>'
              +     '<span><strong>3</strong> Maybe old</span>'
              +     '<span><strong>4</strong> Definitely old</span>'
              + '</div>',
        trial_duration: MEM_TRIAL_DUR_MS,
        css_classes: ['hide_cursor', 'stimulus_size'],
        data: function () {
            return {
                task: 'memTest',
                type: jsPsych.timelineVariable('type'),
                image: jsPsych.timelineVariable('path'),
                relevance: jsPsych.timelineVariable('relevance'),
                frequency: jsPsych.timelineVariable('frequency'),
                presented: jsPsych.timelineVariable('presented')
            };
        },
        on_load: function () {
            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
            try { window.focus(); } catch (e) {}
            window.__afc_trialStart = performance.now();
            window.__afc_memPerTrialEnded = false;

            // Per-trial capture-phase listener that ENDS the memory trial
            // synchronously on first 1/2/3/4 press by calling
            // jsPsych.finishTrial. Without this the trial sits for the full
            // MEM_TRIAL_DUR_MS (20 s) on every item because Qualtrics
            // intercepts the key before jsPsych's bubble-phase listener
            // sees it.
            window.__afc_memPerTrialHandler = function (e) {
                if (window.__afc_memPerTrialEnded) return;
                var k = e.key;
                if (e.code && e.code.indexOf('Numpad') === 0) {
                    k = e.code.replace('Numpad', '');
                }
                if (k === '1' || k === '2' || k === '3' || k === '4') {
                    var rt = performance.now() - window.__afc_trialStart;
                    window.__afc_memPerTrialEnded = true;
                    try { e.preventDefault(); } catch (err) {}
                    try { jsPsych.pluginAPI.cancelAllKeyboardResponses(); } catch (err) {}
                    try {
                        jsPsych.finishTrial({ response: k, rt: rt });
                    } catch (err) {
                        console.warn('[afc] memtest finishTrial failed:', err);
                    }
                }
            };
            document.addEventListener('keydown', window.__afc_memPerTrialHandler, true);
        },
        on_finish: function (data) {
            // Remove per-trial listener
            try { document.removeEventListener('keydown', window.__afc_memPerTrialHandler, true); } catch (e) {}

            // Fallback: if per-trial listener didn't fire, recover from
            // global capture log.
            if (data.response === null && Array.isArray(window.__afc_keyLog)) {
                var trialStart = window.__afc_trialStart || (performance.now() - MEM_TRIAL_DUR_MS);
                var trialEnd = performance.now();
                for (var i = 0; i < window.__afc_keyLog.length; i++) {
                    var k = window.__afc_keyLog[i];
                    if ((k.key === '1' || k.key === '2' || k.key === '3' || k.key === '4') &&
                        k.t >= trialStart && k.t <= trialEnd) {
                        data.response = k.key;
                        data.rt = k.t - trialStart;
                        data.recovered_from_capture = true;
                        break;
                    }
                }
            }

            if (data.presented) {
                data.trial_presented = jsPsych.timelineVariable('trialIndex');
                data.otherImage = jsPsych.timelineVariable('otherImage');
                data.paired_image_frequency = jsPsych.timelineVariable('otherImageFrequency');
            }
            data.trial_number = jsPsych.data.get().filter({task: 'memTest'}).count();
            if (data.presented === true) {
                data.correct_response = '4';
                data.correct = (data.response === '4');
            } else {
                data.correct_response = ['1', '2', '3'];
                data.correct = ['1', '2', '3'].indexOf(data.response) >= 0;
            }
        }
    }]
};

// Brief 500-ms feedback flash highlighting which key was pressed.
// Layout matches the setup prompt: single horizontal row of four options
// below the image, with the selected one outlined.
//
// Fix for the scene-bolding bug: use filter({task:'memTest'}) before last(1)
// rather than jsPsych.data.get().last(1) on its own. The unfiltered lookup
// could pick up an unrelated record between trials and report the wrong
// response, especially in the second half of the memory test where a
// boundary or break screen had snuck into the "last trial" slot.
var memtest_vis_response = {
    type: jsPsychHtmlKeyboardResponse,
    css_classes: ['hide_cursor', 'stimulus_size'],
    stimulus: function () {
        return '<img src="' + jsPsych.timelineVariable('path') + '" '
             + 'style="height: clamp(180px, 32vh, 255px); filter: grayscale(100%); opacity: 1; display:block; margin: 0 auto;">';
    },
    trial_duration: 500,
    prompt: function () {
        var memTrials = jsPsych.data.get().filter({task: 'memTest'}).values();
        var last = memTrials[memTrials.length - 1];
        var selected = last && last.response;
        var opts = [
            { key: '1', label: 'Definitely new', color: '#c9542b' },
            { key: '2', label: 'Maybe new',      color: '#d9985c' },
            { key: '3', label: 'Maybe old',      color: '#7a9e6e' },
            { key: '4', label: 'Definitely old', color: '#2a8d3a' }
        ];
        var html = '<div style="display:flex; flex-wrap:wrap; gap:24px; '
                 +              'justify-content:center; align-items:center; '
                 +              'margin-top:16px; font-size:14pt;">';
        opts.forEach(function (o) {
            if (o.key === selected) {
                html += '<span style="font-weight:700; color:#000; '
                      +              'background:#fff7d6; border:2px solid ' + o.color + '; '
                      +              'padding:4px 12px; border-radius:6px;">'
                      +     '<strong>' + o.key + '</strong> ' + o.label
                      + '</span>';
            } else {
                html += '<span style="color:#888;">'
                      +     '<strong>' + o.key + '</strong> ' + o.label
                      + '</span>';
            }
        });
        html += '</div>';
        return html;
    },
    choices: 'NO_KEYS',
    data: { task: 'memTestFillIn' }
};

var if_node_mem = {
    timeline: [memtest_vis_response],
    conditional_function: function () {
        var prior = jsPsych.data.get().filter({task: 'memTest'}).values();
        return prior[prior.length - 1].rt !== null;
    }
};

// Memory test broken into chunks with self-paced break screens between
// each chunk. Per Andrew's 2026-04-30 note: every ~20 trials.
var MEMTEST_BREAK_EVERY = 20;

function _makeMemBreakScreen(done, total) {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: '<div class="afc-instr" style="text-align: center;">'
                +     '<h2 style="margin: 0 0 12pt 0; font-size: 20pt;">Quick break</h2>'
                +     '<p>You\'ve seen <strong>' + done + ' of ' + total + '</strong> images.</p>'
                +     '<p>Take a moment if you\'d like. Click Continue when you\'re ready.</p>'
                + '</div>',
        choices: ['Continue'],
        button_html: '<button class="afc-default-button">%choice%</button>',
        data: { task: 'memTestBreak', completed: done, total: total }
    };
}

function _buildMemtestNodes(stimuli, blockSize) {
    var nodes = [];
    for (var i = 0; i < stimuli.length; i += blockSize) {
        nodes.push({
            timeline: [memtest_vis_setup, if_node_mem],
            timeline_variables: stimuli.slice(i, i + blockSize)
        });
        var done = Math.min(i + blockSize, stimuli.length);
        if (done < stimuli.length) {
            nodes.push(_makeMemBreakScreen(done, stimuli.length));
        }
    }
    return nodes;
}

var memtest_nodes = _buildMemtestNodes(memStimuli, MEMTEST_BREAK_EVERY);

// =========== END SCREEN — triggers initJsPsych on_finish (writes embedded data) ===
var end = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div style="font-size: 22px; text-align: center;">'
            +     '<p>Thank you for participating. The study is now complete.</p>'
            +     '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>'
            + '</div>',
    choices: ['Finish and submit'],
    button_html: '<button class="afc-default-button">%choice%</button>'
};

// =========== TIMELINE =========================================================
// Drop get_participant_id (subject from QUALTRICS_PID) and fullscreen (often
// blocked in Qualtrics iframes).
var timeline = [];
timeline.push(preload, instructions);
timeline.push(mw_instructions);
timeline.push(practice_instructions);
timeline.push(practice_loop_first, conditional_1, conditional_2, conditional_3,
              conditional_4, conditional_5, conditional_6, conditional_7);
timeline.push(get_ready, face_on_top_setup);
timeline.push(mem_instructions);
memtest_nodes.forEach(function (n) { timeline.push(n); });
timeline.push(end);

// Stamp condition info on every record so analysis is easier
jsPsych.data.addProperties({
    afc_relevant_dimension: relevantType,
    afc_frequent_relevant: frequentType,
    afc_frequent_irrelevant: secondFrequentType
});

jsPsych.run(timeline);

} // end initExp
