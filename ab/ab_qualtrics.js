/////////////////////////////////////////
// ATTENTIONAL BLINK — Qualtrics-loadable build (10-min design)
/////////////////////////////////////////
// Adapted from Sharabas, Varlet & Grootswagers (2023). PLOS ONE 18(8), e0289623.
// 60 trials total: 24 × lag-2 + 24 × lag-4 (strong distractor) + 8 mask-only
// + 4 practice with feedback. Designed to run in ~10 min inside Qualtrics.

// Absolute Pages URL so stimuli load no matter where the script is injected
var AB_ASSET_ROOT = "https://andrew-stier.github.io/squared_jspsych/ab/stimuli/";

function initExp() {

function round3(x) {
    if (typeof x !== 'number' || isNaN(x)) return null;
    return Math.round(x * 1000) / 1000;
}

var jsPsych = initJsPsych({
    display_element: 'display_stage',
    on_finish: function () {
        var data = jsPsych.data.get();
        var qHas = (typeof Qualtrics !== 'undefined');

        // Compact trial-level dump; only real recall trials (have an accuracy field).
        var trialCols = ['practice','lag','distractortype','target','distractor',
                         'target_loc','distractor_loc','correct_response','response',
                         'accuracy','rt'];
        var trials = data.filter({task: 'ab'}).filterCustom(function (r) {
            return typeof r.accuracy !== 'undefined';
        }).values();
        var rows = trials.map(function (r) {
            return [r.practice, r.lag, r.distractortype,
                    r.target, r.distractor,
                    r.target_loc, r.distractor_loc, r.correct_response,
                    r.response, r.accuracy, r.rt];
        });

        if (qHas) {
            try {
                Qualtrics.SurveyEngine.setEmbeddedData('ab_data', JSON.stringify({
                    pid: subject, task: 'ab', cols: trialCols, rows: rows
                }));
            } catch (e) {
                console.warn('[ab] setEmbeddedData failed for ab_data:', e);
            }
        }

        // Summary fields: per-condition mean accuracy + AB magnitude
        var main        = data.filter({task: 'ab', practice: 0});
        var lag2_strong = main.filter({lag: 2, distractortype: 'strong'}).select('accuracy').mean();
        var lag4_strong = main.filter({lag: 4, distractortype: 'strong'}).select('accuracy').mean();
        var mask_acc    = main.filter({distractortype: 'mask'}).select('accuracy').mean();
        var meanrt      = main.select('rt').mean();
        var ab_mag      = lag4_strong - lag2_strong;

        if (qHas) {
            Qualtrics.SurveyEngine.setEmbeddedData('ab_lag2_acc',  round3(lag2_strong));
            Qualtrics.SurveyEngine.setEmbeddedData('ab_lag4_acc',  round3(lag4_strong));
            Qualtrics.SurveyEngine.setEmbeddedData('ab_mask_acc',  round3(mask_acc));
            Qualtrics.SurveyEngine.setEmbeddedData('ab_magnitude', round3(ab_mag));
            Qualtrics.SurveyEngine.setEmbeddedData('ab_meanrt',    isNaN(meanrt) ? null : Math.round(meanrt));
            Qualtrics.SurveyEngine.setEmbeddedData('ab_n_trials',  main.count());
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

var BOATS = [
    "stim201_targets_object_boats_1.png",
    "stim202_targets_object_boats_2.png",
    "stim203_targets_object_boats_3.png",
    "stim204_targets_object_boats_4.png",
    "stim205_targets_object_boats_1.png",
    "stim206_targets_object_boats_2.png",
    "stim207_targets_object_boats_3.png",
    "stim208_targets_object_boats_4.png"
];
var DISTRACTORS = [
    "stim015_animate_aquatic_shark_3.png",
    "stim047_animate_human_child_3.png",
    "stim050_animate_human_clown_2.png",
    "stim051_animate_human_clown_3.png",
    "stim054_animate_human_faces_2.png",
    "stim055_animate_human_faces_3.png",
    "stim109_inanimate_clothing_jeans_1.png",
    "stim155_inanimate_furniture_sofa_3.png",
    "stim161_inanimate_plants_bush_1.png",
    "stim193_inanimate_tools_scissors_1.png"
];
var MASKS = [];
for (var m = 1; m <= 32; m++) {
    MASKS.push("stim" + (300 + m) + "_mask_" + m + ".png");
}

function asset(name) { return AB_ASSET_ROOT + name; }

// Participant ID resolved from window.QUALTRICS_PID (set by the loader's
// addOnload before this script is loaded). Fall back to anon timestamp.
var subject = (typeof window !== 'undefined' && window.QUALTRICS_PID)
              ? window.QUALTRICS_PID
              : ('anon_' + Date.now());
jsPsych.data.addProperties({participant_id: subject});

// Preload all images
var preload = {
    type: jsPsychPreload,
    images: BOATS.map(asset).concat(DISTRACTORS.map(asset)).concat(MASKS.map(asset)),
    show_progress_bar: true,
    message: '<p style="color:white;">Loading images. This usually takes under 10 seconds.</p>'
};

var welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:24pt;"><b>Attention to Sequences</b></p>'
            + '<p style="font-size:18pt;">Click START to read the instructions.</p>',
    choices: ["START"],
    button_html: '<button class="ab-default-button">%choice%</button>'
};

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="ab-instr">'
            + '<p>You will see fast sequences of images.</p>'
            + '<p>Each sequence contains <b>one image of a boat</b>. Other images will be objects, animals, '
            + 'people, and abstract patterns.</p>'
            + '<p>The images go by very quickly. Just try to spot the boat.</p>'
            + '<p>At the end of each sequence, eight boats will appear. <b>Click on the boat you saw</b>. '
            + 'If you are not sure, just guess your best.</p>'
            + '<p>We will start with a short practice round so you can see what the trials look like. '
            + 'You will get feedback during practice only.</p>'
            + '</div>',
    choices: ["Begin practice"],
    button_html: '<button class="ab-default-button">%choice%</button>'
};

var post_practice = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="ab-instr">'
            + '<p>Practice complete. The main task starts now and runs continuously for about 5 minutes.</p>'
            + '<p>You will <b>not</b> get feedback during the main task — just respond as accurately as you can.</p>'
            + '<p>Try to keep your eyes on the center of the screen the whole time.</p>'
            + '</div>',
    choices: ["Start main task"],
    button_html: '<button class="ab-default-button">%choice%</button>'
};

// Trial generation ---------------------------------------------------------
function makeOneTrial(lag, distractortype, practice_flag) {
    var target          = jsPsych.randomization.sampleWithoutReplacement(BOATS, 1)[0];
    var target_loc      = jsPsych.randomization.sampleWithoutReplacement([10, 11, 12, 13], 1)[0];
    var distractor_loc  = target_loc - lag;
    var stream          = jsPsych.randomization.sampleWithoutReplacement(MASKS, 16);
    stream[target_loc]  = target;
    var distractor      = null;
    if (distractortype === 'strong') {
        distractor = jsPsych.randomization.sampleWithoutReplacement(DISTRACTORS, 1)[0];
        stream[distractor_loc] = distractor;
    }
    return {
        stream: stream, target: target, distractor: distractor,
        target_loc: target_loc, distractor_loc: distractor_loc,
        lag: lag, distractortype: distractortype, practice: practice_flag
    };
}

function makeMainTrials() {
    var trials = [];
    var i;
    for (i = 0; i < 24; i++) trials.push(makeOneTrial(2, 'strong', 0));
    for (i = 0; i < 24; i++) trials.push(makeOneTrial(4, 'strong', 0));
    for (i = 0; i < 8; i++)  trials.push(makeOneTrial(i % 2 === 0 ? 2 : 4, 'mask', 0));
    return jsPsych.randomization.shuffle(trials);
}

function makePracticeTrials() {
    return [
        makeOneTrial(4, 'strong', 1),
        makeOneTrial(2, 'strong', 1),
        makeOneTrial(4, 'mask',   1),
        makeOneTrial(2, 'strong', 1)
    ];
}

// Build a per-trial sub-timeline (fixation → 16 RSVP frames → recall [+ feedback if practice])
function buildTrialTimeline(trial) {
    var sub = [];

    sub.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<span class="ab-fixation">+</span>',
        choices: "NO_KEYS",
        trial_duration: 500
    });

    for (var i = 0; i < trial.stream.length; i++) {
        sub.push({
            type: jsPsychImageKeyboardResponse,
            stimulus: asset(trial.stream[i]),
            choices: "NO_KEYS",
            trial_duration: 100,
            stimulus_height: 224
        });
    }

    sub.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '',
        choices: "NO_KEYS",
        trial_duration: 200
    });

    var recall_choices = jsPsych.randomization.shuffle(BOATS.slice());
    var correct_idx = recall_choices.indexOf(trial.target);
    sub.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: '<p style="font-size:16pt; margin: 10px 0 18px 0;">Click on the boat you saw</p>',
        choices: recall_choices,
        button_html: '<button class="ab-recall-button"><img src="' + AB_ASSET_ROOT + '%choice%"></button>',
        margin_horizontal: '0px',
        margin_vertical: '0px',
        post_trial_gap: 200,
        data: {
            task: 'ab',
            lag: trial.lag,
            distractortype: trial.distractortype,
            target: trial.target,
            distractor: trial.distractor,
            target_loc: trial.target_loc,
            distractor_loc: trial.distractor_loc,
            correct_response: correct_idx,
            practice: trial.practice
        },
        on_finish: function (data) {
            data.accuracy = (data.response === data.correct_response) ? 1 : 0;
        }
    });

    if (trial.practice === 1) {
        sub.push({
            type: jsPsychHtmlKeyboardResponse,
            stimulus: function () {
                var last = jsPsych.data.get().filter({task: 'ab'}).last(1).values()[0];
                if (!last) return '';
                if (last.accuracy === 1) {
                    return '<div class="ab-feedback-correct">Correct!</div>';
                }
                return '<div class="ab-feedback-wrong">Incorrect</div>'
                     + '<p style="margin-top:18px; font-size:14pt;">The boat in that trial was:</p>'
                     + '<img src="' + asset(last.target) + '" style="width:120px; margin-top:10px;">';
            },
            choices: "NO_KEYS",
            trial_duration: 1500
        });
    }

    return sub;
}

// Conclusion — button click triggers the experiment-level on_finish, which
// writes embedded data and clicks Qualtrics' next button.
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:20pt;">Task complete.</p>'
            + '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>',
    choices: ["Finish and submit"],
    button_html: '<button class="ab-default-button">%choice%</button>'
};

// Assemble timeline. Skip get_participant_id (PID injected via QUALTRICS_PID)
// and skip enter/exit_fullscreen (often blocked inside Qualtrics iframes).
var timeline = [];
timeline.push(preload, welcome, instructions);

var practice_trials = makePracticeTrials();
for (var p = 0; p < practice_trials.length; p++) {
    timeline = timeline.concat(buildTrialTimeline(practice_trials[p]));
}

timeline.push(post_practice);

var main_trials = makeMainTrials();
for (var t = 0; t < main_trials.length; t++) {
    timeline = timeline.concat(buildTrialTimeline(main_trials[t]));
}

timeline.push(conclusion);

jsPsych.run(timeline);

} // end initExp
