/////////////////////////////////////////
// CHANGE LOCALIZATION — Qualtrics-loadable build
/////////////////////////////////////////
// Reference: js_change_localization_Chong (https://osf.io/da78t)
// Click-response variant of Chong's task.js. Same timing as Chong; replace
// numbered-keyboard response with click-the-changed-square.

var CL_STAGE_SIZE     = 500;
var CL_STIM_SIZE      = 40;
var CL_MAX_RADIUS     = 150;
var CL_INNER_MARGIN   = 40;
var CL_N_ITEMS        = 6;
var CL_FIX_DUR        = 500;
var CL_SAMPLE_DUR     = 400;
var CL_INTRA_BLANK    = 250;
var CL_RETENTION_DUR  = 1000;
var CL_TEST_TIMEOUT   = 6000;
var CL_ITI            = 500;
var CL_N_PRACTICE     = 3;
var CL_N_MAIN_TRIALS  = 48;

function initExp() {

function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function round3(x) {
    if (x === null || isNaN(x)) return null;
    return Math.round(x * 1000) / 1000;
}

var jsPsych = initJsPsych({
    display_element: 'display_stage',
    on_finish: function () {
        var qHas = (typeof Qualtrics !== 'undefined');
        var data = jsPsych.data.get();

        var test = data.filter({task: 'cl', phase: 'test'}).values();
        var trialCols = ['change_index', 'change_color', 'sample_colors', 'positions',
                         'response', 'accuracy', 'rt', 'state'];
        var rows = test.map(function (r) {
            return [r.change_index, r.change_color, r.sample_colors, r.positions,
                    r.response, r.accuracy, r.rt, r.state];
        });

        if (qHas) {
            try {
                Qualtrics.SurveyEngine.setEmbeddedData('cl_data', JSON.stringify({
                    pid: subject, task: 'cl', cols: trialCols, rows: rows
                }));
            } catch (e) {
                console.warn('[cl] setEmbeddedData failed for cl_data:', e);
            }
        }

        var responded = test.filter(function (r) { return !r.timeout; });
        var correct = responded.filter(function (r) { return r.accuracy === 1; });
        var n_responses = responded.length;
        var n_correct = correct.length;
        var accuracy = n_responses ? n_correct / n_responses : null;
        var rts = correct.map(function (r) { return r.rt; });
        var meanRTc = rts.length ? rts.reduce(function (a, b) { return a + b; }, 0) / rts.length : null;
        var medianRTc = median(rts);
        // Chance-corrected K-score for change localization (set size N):
        //   K = (N * acc - 1) / (1 - 1/N), bounded [0, N]
        var k = (accuracy !== null)
            ? (CL_N_ITEMS * accuracy - 1) / (1 - 1 / CL_N_ITEMS)
            : null;

        if (qHas) {
            Qualtrics.SurveyEngine.setEmbeddedData('cl_n_trials',    test.length);
            Qualtrics.SurveyEngine.setEmbeddedData('cl_n_responses', n_responses);
            Qualtrics.SurveyEngine.setEmbeddedData('cl_accuracy',    round3(accuracy));
            Qualtrics.SurveyEngine.setEmbeddedData('cl_k_score',     round3(k));
            Qualtrics.SurveyEngine.setEmbeddedData('cl_meanrt',      meanRTc !== null ? Math.round(meanRTc) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('cl_medianrt',    medianRTc !== null ? Math.round(medianRTc) : null);
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

// Participant ID resolved from window.QUALTRICS_PID
var subject = (typeof window !== 'undefined' && window.QUALTRICS_PID)
              ? window.QUALTRICS_PID
              : ('anon_' + Date.now());
jsPsych.data.addProperties({participant_id: subject});

// 9-color palette (RGB), same as Chong
var CL_COLORS = [
    'rgb(255, 0, 0)',     // red
    'rgb(0, 255, 0)',     // green
    'rgb(0, 0, 255)',     // blue
    'rgb(255, 255, 0)',   // yellow
    'rgb(0, 255, 255)',   // cyan
    'rgb(255, 0, 255)',   // magenta
    'rgb(255, 128, 0)',   // orange
    'rgb(0, 0, 0)',       // black
    'rgb(255, 255, 255)'  // white
];

// 6 angular sectors (fractions of 2π), one square per sector. Matches Chong.
var CL_SECTORS = [
    [0,     0.11],
    [0.167, 0.273],
    [0.333, 0.44],
    [0.5,   0.617],
    [0.667, 0.763],
    [0.833, 0.93]
];

// Participant ID (standalone)
var subject;
// (no get_participant_id, no fullscreen — handled by Qualtrics + addOnload loader)

// ---------- helpers ----------
function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}

// Triangular-distributed radius peaking at MAX_RADIUS, plus inner margin.
function triRadius() {
    var u = CL_MAX_RADIUS * (Math.random() + Math.random());
    var r = (u > CL_MAX_RADIUS) ? (2 * CL_MAX_RADIUS - u) : u;
    return r + CL_INNER_MARGIN;
}

// Generate 6 positions, one per angular sector.
function generatePositions() {
    var positions = [];
    var center = CL_STAGE_SIZE / 2;
    var sectorOrder = shuffle(CL_SECTORS);   // shuffle so the same square isn't always in the same quadrant
    for (var i = 0; i < CL_N_ITEMS; i++) {
        var sector = sectorOrder[i];
        var theta = (sector[0] + Math.random() * (sector[1] - sector[0])) * 2 * Math.PI;
        var r = triRadius();
        var cx = center + r * Math.cos(theta);
        var cy = center + r * Math.sin(theta);
        positions.push({
            x: cx - CL_STIM_SIZE / 2,
            y: cy - CL_STIM_SIZE / 2,
            cx: cx, cy: cy
        });
    }
    return positions;
}

// Pick 6 distinct sample colors + 1 distinct change color = 7 colors total
function pickColors() {
    var perm = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    return {
        sample: perm.slice(0, CL_N_ITEMS),
        change: perm[CL_N_ITEMS]
    };
}

function makeOneTrial(phase) {
    var c = pickColors();
    return {
        positions: generatePositions(),
        sample_colors: c.sample,
        change_color: c.change,
        change_index: Math.floor(Math.random() * CL_N_ITEMS),
        phase: phase
    };
}

// ---------- per-trial engine ----------
function CLEngine(stage, td, on_end) {
    var fix = stage.querySelector('.cl-fix');
    var squares = [];
    var done = false;
    var responseTimer = null;

    // Build 6 square divs
    for (var i = 0; i < CL_N_ITEMS; i++) {
        var sq = document.createElement('div');
        sq.className = 'cl-sq';
        sq.dataset.idx = i;
        sq.style.left = td.positions[i].x + 'px';
        sq.style.top = td.positions[i].y + 'px';
        stage.appendChild(sq);
        squares.push(sq);
    }

    function paint(colorIdxList, visible) {
        for (var i = 0; i < CL_N_ITEMS; i++) {
            squares[i].style.backgroundColor = CL_COLORS[colorIdxList[i]];
            squares[i].style.visibility = visible ? 'visible' : 'hidden';
        }
    }
    function hideAll() { for (var i = 0; i < CL_N_ITEMS; i++) squares[i].style.visibility = 'hidden'; }
    function showFix()  { if (fix) fix.style.visibility = 'visible'; }
    function hideFix()  { if (fix) fix.style.visibility = 'hidden'; }

    var t_response_start = 0;

    function startTest() {
        // test colors: same as sample, but change_index gets change_color
        var testColors = td.sample_colors.slice();
        testColors[td.change_index] = td.change_color;
        paint(testColors, true);
        for (var i = 0; i < CL_N_ITEMS; i++) {
            squares[i].classList.add('responding');
            squares[i].onclick = onClick;
        }
        t_response_start = performance.now();
        responseTimer = setTimeout(onTimeout, CL_TEST_TIMEOUT);
    }
    function onClick(e) {
        if (done) return;
        done = true;
        clearTimeout(responseTimer);
        for (var i = 0; i < CL_N_ITEMS; i++) {
            squares[i].onclick = null;
            squares[i].classList.remove('responding');
        }
        var idx = parseInt(this.dataset.idx);
        var rt = performance.now() - t_response_start;
        finish({ response: idx, rt: Math.round(rt), state: 'click' });
    }
    function onTimeout() {
        if (done) return;
        done = true;
        for (var i = 0; i < CL_N_ITEMS; i++) {
            squares[i].onclick = null;
            squares[i].classList.remove('responding');
        }
        finish({ response: null, rt: null, state: 'timeout' });
    }
    function finish(result) {
        // Strip squares from DOM so they don't leak into the next trial.
        for (var i = 0; i < squares.length; i++) {
            if (squares[i].parentNode) squares[i].parentNode.removeChild(squares[i]);
        }
        if (typeof on_end === 'function') on_end(result);
    }

    // Phase 1: fix cross only (500 ms) — squares are hidden by default
    showFix(); hideAll();

    setTimeout(function () {
        // Phase 2: sample (400 ms) — fix cross + 6 colored squares
        paint(td.sample_colors, true);
    }, CL_FIX_DUR);

    setTimeout(function () {
        // Phase 3: in-trial blank with fix cross (250 ms)
        hideAll();
    }, CL_FIX_DUR + CL_SAMPLE_DUR);

    setTimeout(function () {
        // Phase 4: retention blank, no fix cross (1000 ms)
        hideFix();
    }, CL_FIX_DUR + CL_SAMPLE_DUR + CL_INTRA_BLANK);

    setTimeout(function () {
        // Phase 5: test array, accept clicks
        startTest();
    }, CL_FIX_DUR + CL_SAMPLE_DUR + CL_INTRA_BLANK + CL_RETENTION_DUR);
}

function makeCLTrial(td) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div id="cl-stage" class="cl-stage"><div class="cl-fix">+</div></div>',
        choices: 'NO_KEYS',
        trial_duration: null,
        post_trial_gap: CL_ITI,
        data: {
            task: 'cl',
            phase: td.phase,
            change_index: td.change_index,
            change_color: td.change_color,
            sample_colors: td.sample_colors.join(','),
            positions: td.positions.map(function (p) { return Math.round(p.cx) + ',' + Math.round(p.cy); }).join(';')
        },
        on_load: function () {
            new CLEngine(document.getElementById('cl-stage'), td, function (result) {
                jsPsych.finishTrial(result);
            });
        },
        on_finish: function (data) {
            data.accuracy = (data.response === data.change_index) ? 1 : 0;
            data.timeout  = (data.state === 'timeout') ? 1 : 0;
        }
    };
}

// ---------- screens ----------
var welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:24pt;"><b>Find the changed color</b></p>'
            + '<p style="font-size:14pt;">Click START to read the instructions.</p>',
    choices: ['START'],
    button_html: '<button class="cl-default-button">%choice%</button>'
};

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="cl-instr">'
            + '<p>Six colored squares will flash on the screen briefly.</p>'
            + '<p>After a short blank, the same six squares will reappear — but <b>one will have changed color</b>.</p>'
            + '<p><b>Click on the square that changed.</b></p>'
            + '<p>You have 6 seconds per trial. If you are not sure, just guess.</p>'
            + '<p>We will start with three practice trials with feedback.</p>'
            + '</div>',
    choices: ['Begin practice'],
    button_html: '<button class="cl-default-button">%choice%</button>'
};

// Practice trials with feedback
var practice_trials = [];
for (var p = 0; p < CL_N_PRACTICE; p++) {
    var pt = makeOneTrial('practice');
    practice_trials.push(makeCLTrial(pt));
    practice_trials.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: function () {
            var last = jsPsych.data.get().last(1).values()[0];
            if (last.timeout) {
                return '<div class="cl-feedback-wrong">Too slow</div>';
            }
            if (last.accuracy === 1) return '<div class="cl-feedback-correct">Correct</div>';
            return '<div class="cl-feedback-wrong">Incorrect</div>';
        },
        choices: 'NO_KEYS',
        trial_duration: 1200,
        post_trial_gap: 300
    });
}

var post_practice = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="cl-instr">'
            + '<p>Practice complete. The main test starts now.</p>'
            + '<p>You will see <b>' + CL_N_MAIN_TRIALS + ' trials</b> with no feedback. Just keep clicking the changed square as accurately as you can.</p>'
            + '</div>',
    choices: ['Start test'],
    button_html: '<button class="cl-default-button">%choice%</button>'
};

// Main trials
var main_trials = [];
for (var m = 0; m < CL_N_MAIN_TRIALS; m++) {
    main_trials.push(makeCLTrial(makeOneTrial('test')));
}

// Conclusion — button click triggers initJsPsych on_finish (writes embedded data + clicks Next)
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:22pt;"><b>Test complete</b></p>'
            + '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>',
    choices: ['Finish and submit'],
    button_html: '<button class="cl-default-button">%choice%</button>'
};

// Assemble timeline (skip get_participant_id and fullscreen; subject is set
// from window.QUALTRICS_PID and Qualtrics is the host frame).
var timeline = [];
timeline.push(welcome, instructions);
timeline = timeline.concat(practice_trials);
timeline.push(post_practice);
timeline = timeline.concat(main_trials);
timeline.push(conclusion);

jsPsych.run(timeline);

} // end initExp
