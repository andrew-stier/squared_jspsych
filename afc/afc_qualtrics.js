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
var PRACTICE_ACC_THRESHOLD = 0.85;
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
                Qualtrics.SurveyEngine.setEmbeddedData('afc_data', JSON.stringify({
                    pid: subject,
                    relevant: relevantType,
                    frequent_relevant: frequentType,
                    frequent_irrelevant: secondFrequentType,
                    cpt: { cols: cptCols, rows: cptRows },
                    mem: { cols: memCols, rows: memRows },
                    mw:  { cols: mwCols,  rows: mwRows  }
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

// Practice — 4 separate fresh sets so retries get a new sequence.
var randomizedPracticeStimuli  = generatePracticeStimuli();
var randomizedPracticeStimuli1 = generatePracticeStimuli();
var randomizedPracticeStimuli2 = generatePracticeStimuli();
var randomizedPracticeStimuli3 = generatePracticeStimuli();
var randomizedPracticeStimuli4 = generatePracticeStimuli();
[randomizedPracticeStimuli, randomizedPracticeStimuli1, randomizedPracticeStimuli2,
 randomizedPracticeStimuli3, randomizedPracticeStimuli4].forEach(_prefixCPTArray);

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

// =========== INSTRUCTIONS =====================================================
var _mw_instr_block = '<p style="margin-top:14pt; padding:10pt; background:#f0f0f0; border-left:3px solid #888;">'
                    +     'Every so often (every 25–35 images), the task will pause and ask: '
                    +     '<em>"Just now, where was your attention?"</em><br>'
                    +     'Pick <b>On task</b> if your thoughts were focused on the task you were doing. '
                    +     'Pick <b>Off task</b> if you were experiencing task-unrelated thoughts.<br>'
                    +     'Be honest — there are no right or wrong answers, and this won\'t affect your score.'
                    + '</p>';

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scenes' : 'faces';
        return '<div class="afc-instr">'
             +     '<p>You will see images of faces overlaid on scenes.</p>'
             +     '<p>Your goal is to identify ' + target + ' that were <strong>not</strong> also presented two ' + target + ' ago and <strong>press the space bar</strong>.</p>'
             +     '<p>When you see a ' + target.replace(/s$/, '') + ' that is the same as the one two before it (i.e. there is one ' + target.replace(/s$/, '') + ' between the two presentations), do not press any buttons.</p>'
             +     '<p>There will be a dark gray dot in the center of the screen. If the dot changes to light gray, that means your response for that image has been recorded.</p>'
             +     '<p>Please respond as accurately as you can.</p>'
             +     _mw_instr_block
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'instructions1' }
};

var practice_instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scene' : 'face';
        return '<div class="afc-instr">'
             +     '<p>You will now practice the task. You will need to perform well during this practice to move on to the real task.</p>'
             +     '<p>Remember: when you see a ' + target + ' that was <strong>not</strong> also presented two ' + target + 's previously, press the <strong>spacebar</strong>.</p>'
             +     '<p>When you see a ' + target + ' that was presented two ' + target + 's previously, do not press any buttons.</p>'
             +     '<p>During practice you will also see one mind-wandering check (the "On task / Off task" question), so you can see what it looks like before the real task.</p>'
             + '</div>';
    },
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>'
};

// Practice-report screens (with retry-up-to-4 logic)
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
            var remember;
            if (relevantType === 'scene') {
                remember = '<br>Remember: when you see a scene that was <strong>not</strong> presented two scenes previously, press the <strong>spacebar</strong>.<br>'
                         + 'When you see a scene that was presented two scenes previously, do not press any buttons.';
            } else {
                remember = '<br>Remember: when you see a face that was <strong>not</strong> presented two faces previously, press the <strong>spacebar</strong>.<br>'
                         + 'When you see a face that was presented two faces previously, do not press any buttons.';
            }

            if (accuracy < PRACTICE_ACC_THRESHOLD) {
                if (isLastAttempt) {
                    jsPsych.endExperiment('You correctly responded to ' + pct + '% of images in the practice task. This was your last opportunity. The experiment will end now.');
                    return 'You correctly responded to ' + pct + '% of images in the practice task. This was your last opportunity. The experiment will end now.';
                }
                return '<div class="afc-instr">'
                     +    '<p>You correctly responded to ' + pct + '% of images in the practice task. To move on, you must respond correctly to '
                     +    (PRACTICE_ACC_THRESHOLD * 100) + '% of the images. Please repeat the practice.</p>'
                     +    remember
                     + '</div>';
            } else {
                return '<div class="afc-instr">'
                     +    '<p>Well done! You got ' + pct + '% correct. You will now move on to the real task.</p>'
                     +    remember
                     + '</div>';
            }
        },
        choices: ['Continue'],
        button_html: '<button class="afc-default-button">%choice%</button>',
        data: { task: reportName }
    };
}
var practice_report  = makePracticeReport('practice_report', false);
var practice_report3 = makePracticeReport('practice_report3', false);
var practice_report4 = makePracticeReport('practice_report4', true);

var get_ready = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '<p>Get ready</p>',
    choices: 'NO_KEYS',
    trial_duration: 3000
};

var practice_loop_first = {
    timeline: [get_ready, face_on_top_practice_setup, practice_report]
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
    timeline: [get_ready, face_on_top_practice_setup1, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_2 = {
    timeline: [get_ready, face_on_top_practice_setup2, practice_report],
    conditional_function: _shouldRunRetry
};
var conditional_3 = {
    timeline: [get_ready, face_on_top_practice_setup3, practice_report3],
    conditional_function: _shouldRunRetry
};
var conditional_4 = {
    timeline: [get_ready, face_on_top_practice_setup4, practice_report4],
    conditional_function: _shouldRunRetry
};

// =========== MEMORY PHASE =====================================================
var mem_instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="afc-instr">'
            +     '<p>Great Job! The next part of the experiment will be a memory test for the images you saw earlier.</p>'
            +     '<p>Press the number key with your response for each image, indicating whether you remember seeing it in the previous part of the study. Some of the images will have previously appeared (<strong>old</strong>) and some will have not (<strong>new</strong>).</p>'
            +     '<p><strong>1</strong> Definitely new<br><strong>2</strong> Maybe new<br><strong>3</strong> Maybe old<br><strong>4</strong> Definitely old</p>'
            + '</div>',
    choices: ['Continue'],
    button_html: '<button class="afc-default-button">%choice%</button>',
    data: { task: 'mem_vis_instructions' }
};

var memtest_vis_setup = {
    timeline: [{
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            return '<img src="' + jsPsych.timelineVariable('path') + '" '
                 + 'style="height: 255px; filter: grayscale(100%); opacity: 1;">';
        },
        choices: ['1', '2', '3', '4'],
        prompt: '<br><strong>1</strong> Definitely new'
              + '<br><strong>2</strong> Maybe new'
              + '<br><strong>3</strong> Maybe old'
              + '<br><strong>4</strong> Definitely old',
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
        },
        on_finish: function (data) {
            // Recover 1/2/3/4 if jsPsych missed it but capture-phase listener saw one
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

// Brief 500-ms feedback flash highlighting which key was pressed
var memtest_vis_response = {
    type: jsPsychHtmlKeyboardResponse,
    css_classes: ['hide_cursor', 'stimulus_size'],
    stimulus: function () {
        return '<img src="' + jsPsych.timelineVariable('path') + '" '
             + 'style="height: 255px; filter: grayscale(100%); opacity: 1;">';
    },
    trial_duration: 500,
    prompt: function () {
        var last = jsPsych.data.get().last(1).values()[0];
        var lines = [
            '<strong>1</strong> Definitely new',
            '<strong>2</strong> Maybe new',
            '<strong>3</strong> Maybe old',
            '<strong>4</strong> Definitely old'
        ];
        var idx = ['1', '2', '3', '4'].indexOf(last.response);
        if (idx >= 0) {
            lines[idx] = '<strong>' + (idx + 1) + ' '
                       + ['Definitely new', 'Maybe new', 'Maybe old', 'Definitely old'][idx] + '</strong>';
        }
        return '<br>' + lines.join('<br>');
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

var memtest_vis = {
    timeline: [memtest_vis_setup, if_node_mem],
    timeline_variables: memStimuli
};

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
timeline.push(practice_instructions);
timeline.push(practice_loop_first, conditional_1, conditional_2, conditional_3, conditional_4);
timeline.push(get_ready, face_on_top_setup);
timeline.push(mem_instructions, memtest_vis);
timeline.push(end);

// Stamp condition info on every record so analysis is easier
jsPsych.data.addProperties({
    afc_relevant_dimension: relevantType,
    afc_frequent_relevant: frequentType,
    afc_frequent_irrelevant: secondFrequentType
});

jsPsych.run(timeline);

} // end initExp
