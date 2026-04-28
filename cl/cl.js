/////////////////////////////////////////
// CHANGE LOCALIZATION (jsPsych v7 port of Chong's task.js)
/////////////////////////////////////////
// Reference: js_change_localization_Chong (https://osf.io/da78t)
// This build matches the Chong protocol on every parameter EXCEPT the
// response modality: click the changed square instead of pressing 1-6.
// (The numbered-overlay → keyboard-press response and its 1 s "preview"
// window are dropped because they were keyboard-driven scaffolding;
// click-to-localize is the more natural response for the same paradigm.)
//
// Per-trial sequence (matches Chong):
//   500 ms   fixation cross only
//   400 ms   sample array (6 colored squares + fix cross)
//   250 ms   in-trial blank with fix cross
//  1000 ms   retention blank (no fix cross)
//   ≤6000 ms test array (6 squares, one changed; click to identify; auto-advance on timeout)
//   ~500 ms  inter-trial gap

var jsPsych = initJsPsych({});

// ---------- params ----------
var CL_STAGE_SIZE     = 500;     // px; matches Chong's canvas size
var CL_STIM_SIZE      = 40;      // px; matches Chong
var CL_MAX_RADIUS     = 150;     // px; matches Chong
var CL_INNER_MARGIN   = 40;      // px; matches Chong's "+40" minimum offset
var CL_N_ITEMS        = 6;
var CL_FIX_DUR        = 500;
var CL_SAMPLE_DUR     = 400;
var CL_INTRA_BLANK    = 250;
var CL_RETENTION_DUR  = 1000;
var CL_TEST_TIMEOUT   = 6000;
var CL_ITI            = 500;
var CL_N_PRACTICE     = 3;
var CL_N_MAIN_TRIALS  = 48;      // Chong's task.js uses 60; instruction text says 48; we use 48 to fit ~5 min budget

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
var get_participant_id = {
    type: jsPsychSurveyText,
    questions: [{prompt: 'Please enter the participant ID:', required: true, name: 'participant_id'}],
    on_finish: function (data) {
        subject = data.response.participant_id;
        jsPsych.data.addProperties({participant_id: subject});
    }
};
var enter_fullscreen = { type: jsPsychFullscreen, fullscreen_mode: true };
var exit_fullscreen  = { type: jsPsychFullscreen, fullscreen_mode: false };

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

var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var d = jsPsych.data.get().filter({task: 'cl', phase: 'test'});
        var n = d.count();
        var nc = d.filter({accuracy: 1}).count();
        var acc = n ? nc / n : 0;
        var k = (CL_N_ITEMS * acc - 1) / (1 - 1 / CL_N_ITEMS);
        return '<p style="font-size:22pt;"><b>Test complete</b></p>'
             + '<p style="font-size:16pt;">Accuracy: <b>' + Math.round(100 * acc) + '%</b> (' + nc + '/' + n + ')</p>'
             + '<p style="font-size:16pt;">K-score (chance-corrected items in WM): <b>' + (Math.round(k * 100) / 100) + '</b> of ' + CL_N_ITEMS + '</p>'
             + '<p style="font-size:14pt; margin-top:20px;">Click below to finish.</p>';
    },
    choices: ['Finish'],
    button_html: '<button class="cl-default-button">%choice%</button>'
};

var timeline = [];
timeline.push(get_participant_id, welcome, enter_fullscreen, instructions);
timeline = timeline.concat(practice_trials);
timeline.push(post_practice);
timeline = timeline.concat(main_trials);
timeline.push(conclusion, exit_fullscreen);

jsPsych.run(timeline);
