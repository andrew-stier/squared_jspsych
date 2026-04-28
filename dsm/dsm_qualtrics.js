/////////////////////////////////////////
// DIGIT SYMBOL MATCHING — Qualtrics-loadable build
/////////////////////////////////////////
// Adapted from Test My Brain (Many Brains Project, McLean Hospital), LGPLv3.
// Source: https://github.com/manybrainsproject/TestMyBrainCodeRepo
// Standard 90-second timed test with 3 practice trials. Score = #correct.

var DSM_ASSET_ROOT = "https://andrew-stier.github.io/squared_jspsych/dsm/images/";
var DSM_DURATION_MS = 90000;
var DSM_PRACTICE_TIMEOUT_MS = 5000;

function initExp() {

function asset(name) { return DSM_ASSET_ROOT + name; }

// Helpers for outcome stats
function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function sd(arr) {
    if (arr.length < 2) return null;
    var mean = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
    var v = arr.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / (arr.length - 1);
    return Math.sqrt(v);
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

        // Per-trial dump (test phase only)
        var test = data.filter({task: 'dsm', phase: 'test'}).values();
        var trialCols = ['symbol', 'correct_digit', 'response', 'accuracy', 'rt', 'timeout'];
        var rows = test.map(function (r) {
            return [r.symbol, r.correct_digit, r.response, r.accuracy, r.rt, r.timeout];
        });

        if (qHas) {
            try {
                Qualtrics.SurveyEngine.setEmbeddedData('dsm_data', JSON.stringify({
                    pid: subject, task: 'dsm', cols: trialCols, rows: rows
                }));
            } catch (e) {
                console.warn('[dsm] setEmbeddedData failed for dsm_data:', e);
            }
        }

        // Outcomes
        var responded     = test.filter(function (r) { return !r.timeout; });
        var correct       = responded.filter(function (r) { return r.accuracy === 1; });
        var correct_rts   = correct.map(function (r) { return r.rt; });
        var num_correct   = correct.length;
        var num_responses = responded.length;
        var accuracy      = num_responses ? num_correct / num_responses : null;
        var meanRTc       = correct_rts.length ? correct_rts.reduce(function (a, b) { return a + b; }, 0) / correct_rts.length : null;
        var medianRTc     = median(correct_rts);
        var sdRTc         = sd(correct_rts);
        var cvRTc         = (sdRTc !== null && medianRTc) ? sdRTc / medianRTc : null;

        if (qHas) {
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_score',         num_correct);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_n_responses',   num_responses);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_n_trials',      test.length);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_accuracy',      round3(accuracy));
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_meanrt',        meanRTc !== null ? Math.round(meanRTc) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_medianrt',      medianRTc !== null ? Math.round(medianRTc) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_sdrt',          sdRTc !== null ? Math.round(sdRTc) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('dsm_cvrt',          round3(cvRTc));
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

// Use the original 6 symbols (1.png .. 6.png). Symbol→digit mapping:
//   symbols 1 & 4 → digit 1
//   symbols 2 & 5 → digit 2
//   symbols 3 & 6 → digit 3
// (Same as TMB: digit = symbol % 3 === 0 ? 3 : symbol % 3)
var SYMBOLS = [1, 2, 3, 4, 5, 6];
function digitForSymbol(symbol) {
    return symbol % 3 === 0 ? 3 : symbol % 3;
}

// Participant ID resolved from window.QUALTRICS_PID
var subject = (typeof window !== 'undefined' && window.QUALTRICS_PID)
              ? window.QUALTRICS_PID
              : ('anon_' + Date.now());
jsPsych.data.addProperties({participant_id: subject});

// Preload symbols + key images
var preload = {
    type: jsPsychPreload,
    images: SYMBOLS.map(function (s) { return asset(s + ".png"); })
        .concat([asset("key.png"), asset("keySmall.png"),
                 asset("resp1.png"), asset("resp2.png"), asset("resp3.png")]),
    show_progress_bar: true,
    message: '<p>Loading the task. Should take a couple of seconds.</p>'
};

// Build the per-trial display HTML — probe symbol on top, full key below
function dsmDisplay(symbol, extraHtml) {
    return '<div class="dsm-display">'
         + '<img class="dsm-probe" src="' + asset(symbol + ".png") + '" alt="symbol">'
         + '<img class="dsm-key" src="' + asset("key.png") + '" alt="key">'
         + '<div class="dsm-prompt">Press <b>1</b>, <b>2</b>, or <b>3</b></div>'
         + (extraHtml || '')
         + '</div>';
}

// State for picking next symbol with 1-back repetition avoidance
var dsm_current_symbol = null;
function pickNextSymbol() {
    var s;
    do {
        s = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    } while (s === dsm_current_symbol);
    dsm_current_symbol = s;
    return s;
}

// Welcome + instructions
var welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:24pt;"><b>Matching Shapes And Numbers</b></p>'
            + '<p><img src="' + asset("key.png") + '" alt="key"></p>'
            + '<p style="font-size:14pt;">Click START to read the instructions.</p>',
    choices: ["START"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="dsm-instr">'
            + '<p>Each <b>symbol</b> in the key has a <b>number</b> next to it.</p>'
            + '<p><img src="' + asset("key.png") + '" alt="key" style="max-width:320px;"></p>'
            + '<p>When a symbol appears at the top of the screen, press <b>its number on the keyboard</b>.</p>'
            + '<p><img src="' + asset("1.png") + '" alt="" style="width:60px; vertical-align:middle;"> <span style="font-size:14pt;">→ press <b>1</b></span></p>'
            + '<p>You will have <b>' + Math.round(DSM_DURATION_MS / 1000) + ' seconds</b>. Try to get as many correct as you can — be <b>quick</b> and <b>accurate</b>.</p>'
            + '<p>We will start with three practice trials so you can see how it works.</p>'
            + '</div>',
    choices: ["Begin practice"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

// Practice block — 3 fixed practice trials (symbols 1, 3, 5; digits 1, 3, 2)
var practice_symbols = [1, 3, 5];
var practice_trials_timeline = practice_symbols.map(function (sym) {
    return {
        timeline: [
            {
                type: jsPsychHtmlKeyboardResponse,
                stimulus: function () { return dsmDisplay(sym, '<div class="dsm-progress">Practice</div>'); },
                choices: ['1', '2', '3'],
                trial_duration: DSM_PRACTICE_TIMEOUT_MS,
                data: {task: 'dsm', phase: 'practice', symbol: sym, correct_digit: digitForSymbol(sym)},
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

// Conclusion — button click triggers initJsPsych on_finish (writes embedded data + clicks Next)
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:22pt;"><b>Test complete</b></p>'
            + '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>',
    choices: ["Finish and submit"],
    button_html: '<button class="dsm-default-button">%choice%</button>'
};

// Assemble timeline (skip get_participant_id and fullscreen)
var timeline = [];
timeline.push(preload, welcome, instructions);
timeline = timeline.concat(practice_trials_timeline);
timeline.push(post_practice, dsm_test_block, conclusion);

jsPsych.run(timeline);

} // end initExp
