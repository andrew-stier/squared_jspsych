/////////////////////////////////////////
// DIGIT SYMBOL MATCHING (jsPsych v7 port of TMB DSM)
/////////////////////////////////////////
// Adapted from Test My Brain (Many Brains Project, McLean Hospital), LGPLv3.
// Source: https://github.com/manybrainsproject/TestMyBrainCodeRepo
// Reference: Wechsler 1981; Salthouse 1992; McLeod et al. 1982.
//
// Task: 6 symbols are paired with digits 1, 2, or 3 (each digit assigned to two
// symbols). A reference key is shown throughout. On each trial one symbol
// appears as a probe; participant presses 1, 2, or 3 to indicate the matching
// digit. Test runs for a fixed duration (default 90 s); score = number correct.
// Outcomes: num_correct, num_responses, accuracy, meanRTc, medianRTc, sdRTc, cvRTc.

var jsPsych = initJsPsych({});

// Asset references (relative for standalone; absolute Pages URL injected by Qualtrics build)
var DSM_ASSET_ROOT = "images/";
var DSM_DURATION_MS = 90000;       // main test duration
var DSM_PRACTICE_TIMEOUT_MS = 5000; // per-practice-trial timeout

function asset(name) { return DSM_ASSET_ROOT + name; }

// Use the original 6 symbols (1.png .. 6.png). Symbol→digit mapping:
//   symbols 1 & 4 → digit 1
//   symbols 2 & 5 → digit 2
//   symbols 3 & 6 → digit 3
// (Same as TMB: digit = symbol % 3 === 0 ? 3 : symbol % 3)
// Pool of all 30 available symbol images (1.png .. 30.png)
var SYMBOL_POOL = [];
for (var __s = 1; __s <= 30; __s++) SYMBOL_POOL.push(__s);

// TMB-standard build: fixed 6 symbols (norms apply). Flip to true to enable
// per-participant counterbalanced random 6-of-30 selection (off-norm).
var DSM_RANDOMIZE_SYMBOLS = false;
var chosenSymbols = [1, 2, 3, 4, 5, 6];

function digitForSymbol(symbol) {
    var idx = chosenSymbols.indexOf(symbol);
    return idx >= 0 ? (idx % 3) + 1 : (symbol % 3 === 0 ? 3 : symbol % 3);
}

// Participant ID
var subject;
var get_participant_id = {
    type: jsPsychSurveyText,
    questions: [{prompt: 'Please enter the participant ID:', required: true, name: 'participant_id'}],
    on_finish: function (data) {
        subject = data.response.participant_id;
        var props = {participant_id: subject};
        if (DSM_RANDOMIZE_SYMBOLS) {
            var _stringToSeed = function (str) {
                var h = 0;
                for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
                return Math.abs(h) || 1;
            };
            var _seededRandom = function (seed) {
                var state = seed | 0;
                return function () {
                    state = (state * 1103515245 + 12345) & 0x7fffffff;
                    return state / 0x7fffffff;
                };
            };
            var _seededShuffle = function (arr, rng) {
                var a = arr.slice();
                for (var i = a.length - 1; i > 0; i--) {
                    var j = Math.floor(rng() * (i + 1));
                    var t = a[i]; a[i] = a[j]; a[j] = t;
                }
                return a;
            };
            var seed = _stringToSeed(subject);
            chosenSymbols = _seededShuffle(SYMBOL_POOL, _seededRandom(seed)).slice(0, 6);
            props.dsm_chosen_symbols = chosenSymbols.join(',');
            props.dsm_seed = seed;
        }
        jsPsych.data.addProperties(props);
    }
};

var enter_fullscreen = { type: jsPsychFullscreen, fullscreen_mode: true };
var exit_fullscreen  = { type: jsPsychFullscreen, fullscreen_mode: false };

// Preload only the 6 symbols actually used in the TMB-standard build.
// If you flip DSM_RANDOMIZE_SYMBOLS, change this to preload the full SYMBOL_POOL.
var preload = {
    type: jsPsychPreload,
    images: chosenSymbols.map(function (s) { return asset(s + ".png"); }),
    show_progress_bar: true,
    message: '<p>Loading the task. Should take a couple of seconds.</p>'
};

// Dynamic key (3 columns × 2 rows + digit row)
function buildKeyHtml(scale) {
    scale = scale || 1.0;
    var sz = Math.round(50 * scale);
    function cell(i) {
        return '<img class="dsm-key-img" src="' + asset(chosenSymbols[i] + '.png') + '" '
             + 'style="width:' + sz + 'px; height:' + sz + 'px;">';
    }
    return '<div class="dsm-key-grid" style="display:inline-grid; '
         + 'grid-template-columns: repeat(3, 1fr); grid-gap:6px; '
         + 'border:1px solid #999; padding:8px; background:#fafafa;">'
         + cell(0) + cell(1) + cell(2)
         + cell(3) + cell(4) + cell(5)
         + '<div class="dsm-key-digit">1</div>'
         + '<div class="dsm-key-digit">2</div>'
         + '<div class="dsm-key-digit">3</div>'
         + '</div>';
}

// Per-trial display: probe at top, dynamic key below
function dsmDisplay(symbol, extraHtml) {
    return '<div class="dsm-display">'
         + '<img class="dsm-probe" src="' + asset(symbol + ".png") + '" alt="symbol">'
         + buildKeyHtml(1.0)
         + '<div class="dsm-prompt">Press <b>1</b>, <b>2</b>, or <b>3</b></div>'
         + (extraHtml || '')
         + '</div>';
}

// State for picking next symbol with 1-back repetition avoidance
var dsm_current_symbol = null;
function pickNextSymbol() {
    var s;
    do {
        s = chosenSymbols[Math.floor(Math.random() * chosenSymbols.length)];
    } while (s === dsm_current_symbol);
    dsm_current_symbol = s;
    return s;
}

// Welcome + instructions (stimulus is a function so the key reflects the
// post-participant-id chosen set)
var welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        return '<p style="font-size:24pt;"><b>Matching Shapes And Numbers</b></p>'
             + '<p>' + buildKeyHtml(1.0) + '</p>'
             + '<p style="font-size:14pt;">Click START to read the instructions.</p>';
    },
    choices: ["START"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        return '<div class="dsm-instr">'
             + '<p>Each <b>symbol</b> in the key below is paired with the <b>number</b> in its column.</p>'
             + '<p style="text-align:center;">' + buildKeyHtml(1.0) + '</p>'
             + '<p>When a symbol appears at the top of the screen, press <b>its number on the keyboard</b>.</p>'
             + '<p style="text-align:center;">'
             + '<img src="' + asset(chosenSymbols[0] + ".png") + '" alt="" style="width:60px; vertical-align:middle;"> '
             + '<span style="font-size:14pt;">→ press <b>1</b></span></p>'
             + '<p>You will have <b>' + Math.round(DSM_DURATION_MS / 1000) + ' seconds</b>. Be <b>quick</b> and <b>accurate</b>.</p>'
             + '<p>Three practice trials with feedback first, then the timed test.</p>'
             + '</div>';
    },
    choices: ["Begin practice"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

// Practice — same logical positions as TMB original (digits 1, 3, 2)
var practice_positions = [0, 2, 4];
var practice_trials_timeline = practice_positions.map(function (pos) {
    return {
        timeline: [
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: function () {
                    return dsmDisplay(chosenSymbols[pos], '<div class="dsm-progress">Practice</div>');
                },
                choices: ['1', '2', '3'],
                trial_duration: DSM_PRACTICE_TIMEOUT_MS,
                data: function () {
                    var sym = chosenSymbols[pos];
                    return {task: 'dsm', phase: 'practice', symbol: sym, correct_digit: digitForSymbol(sym)};
                },
                on_finish: function (data) {
                    data.accuracy = (data.response === ('' + data.correct_digit)) ? 1 : 0;
                    data.timeout = (data.response === null) ? 1 : 0;
                }
            },
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: function () {
                    var last = jsPsych.data.get().last(1).values()[0];
                    if (last.timeout) {
                        return '<div class="dsm-feedback-wrong">Too slow</div>'
                             + '<p style="margin-top:14px; font-size:14pt;">For symbol '
                             + '<img src="' + asset(last.symbol + '.png') + '" style="width:50px; vertical-align:middle;">'
                             + ' press <b>' + last.correct_digit + '</b>.</p>';
                    } else if (last.accuracy === 1) {
                        return '<div class="dsm-feedback-correct">Correct</div>';
                    } else {
                        return '<div class="dsm-feedback-wrong">Incorrect</div>'
                             + '<p style="margin-top:14px; font-size:14pt;">The right answer for '
                             + '<img src="' + asset(last.symbol + '.png') + '" style="width:50px; vertical-align:middle;">'
                             + ' is <b>' + last.correct_digit + '</b>.</p>';
                    }
                },
                choices: 'NO_KEYS',
                trial_duration: 1500
            }
        ]
    };
});

var post_practice = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="dsm-instr">'
            + '<p>Practice complete. The main test starts now and runs for <b>'
            + Math.round(DSM_DURATION_MS / 1000) + ' seconds</b>.</p>'
            + '<p>You will <b>not</b> get feedback during the main test — just keep going as fast as you can.</p>'
            + '</div>',
    choices: ["Start test"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

// Main test — loop_function based timing. Test ends when DSM_DURATION_MS elapsed.
var dsm_test_start = null;
var dsm_main_trial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function () {
        if (dsm_test_start === null) dsm_test_start = Date.now();
        var sym = pickNextSymbol();
        // stash on data via closure
        dsm_main_trial._current_sym = sym;
        return dsmDisplay(sym);
    },
    choices: ['1', '2', '3'],
    trial_duration: function () {
        var remaining = DSM_DURATION_MS - (Date.now() - (dsm_test_start || Date.now()));
        return Math.max(150, remaining);
    },
    data: function () {
        var sym = dsm_main_trial._current_sym;
        return {task: 'dsm', phase: 'test', symbol: sym, correct_digit: digitForSymbol(sym)};
    },
    on_finish: function (data) {
        data.accuracy = (data.response === ('' + data.correct_digit)) ? 1 : 0;
        data.timeout = (data.response === null) ? 1 : 0;
    }
};

var dsm_test_block = {
    timeline: [dsm_main_trial],
    loop_function: function () {
        return (Date.now() - dsm_test_start) < DSM_DURATION_MS;
    }
};

// Conclusion — show score and outcomes
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var d = jsPsych.data.get().filter({task: 'dsm', phase: 'test'});
        var correct = d.filter({accuracy: 1, timeout: 0}).count();
        var responded = d.filterCustom(function (r) { return r.timeout === 0; }).count();
        var rts = d.filter({accuracy: 1, timeout: 0}).select('rt').values;
        var meanrt = rts && rts.length ? Math.round(rts.reduce(function(a,b){return a+b;}, 0) / rts.length) : null;
        return '<p style="font-size:22pt;"><b>Test complete</b></p>'
             + '<p style="font-size:16pt;">Correct responses: <b>' + correct + '</b></p>'
             + '<p style="font-size:16pt;">Accuracy: <b>' + (responded ? Math.round(100 * correct / responded) : 0) + '%</b></p>'
             + (meanrt !== null ? '<p style="font-size:16pt;">Mean RT (correct trials): <b>' + meanrt + ' ms</b></p>' : '')
             + '<p style="font-size:14pt; margin-top:20px;">Click below to finish.</p>';
    },
    choices: ["Finish"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

// Assemble timeline
var timeline = [];
timeline.push(preload, get_participant_id, welcome, enter_fullscreen, instructions);
timeline = timeline.concat(practice_trials_timeline);
timeline.push(post_practice, dsm_test_block, conclusion, exit_fullscreen);

jsPsych.run(timeline);
