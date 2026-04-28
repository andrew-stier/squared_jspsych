/////////////////////////////////////////
// ATTENTIONAL BLINK (10-min Qualtrics-friendly version)
/////////////////////////////////////////
// Adapted from Sharabas, Varlet & Grootswagers (2023). PLOS ONE 18(8), e0289623.
// Original 40-min replication: https://osf.io/atjpe/
// Stimuli are 8 boat targets, 10 strong distractors, 32 mask fillers.
// Per trial: 16-image RSVP at 100 ms/item, 8-AFC boat recall.
//
// 10-min design rationale (see /tmp/ab_analysis/ for the supporting reliability work):
//   - 24 lag-2 strong-distractor trials   (peak AB deficit)
//   - 24 lag-4 strong-distractor trials   (recovery / baseline within paradigm)
//   - 8  mask-only trials                 (no-distractor control, baseline)
//   - 4  practice trials with feedback
//   = 60 trials total; main block ~5 min at ~5 s / trial.

var jsPsych = initJsPsych({});

// Asset references (relative for standalone use; absolute URL injected by qualtrics build)
var AB_ASSET_ROOT = "stimuli/";

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

// participant ID
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

// Conclusion (after main block completes)
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var d = jsPsych.data.get().filter({task: 'ab', practice: 0});
        var lag2_strong = d.filter({lag: 2, distractortype: 'strong'}).select('accuracy').mean();
        var lag4_strong = d.filter({lag: 4, distractortype: 'strong'}).select('accuracy').mean();
        var mask = d.filter({distractortype: 'mask'}).select('accuracy').mean();
        var ab_magnitude = lag4_strong - lag2_strong;
        return '<p style="font-size:20pt;">Task complete.</p>'
             + '<p style="font-size:16pt;">Accuracy at lag 2 (strong distractor): ' + Math.round(100 * lag2_strong) + '%</p>'
             + '<p style="font-size:16pt;">Accuracy at lag 4 (strong distractor): ' + Math.round(100 * lag4_strong) + '%</p>'
             + '<p style="font-size:16pt;">Accuracy on mask-only baseline: '       + Math.round(100 * mask) + '%</p>'
             + '<p style="font-size:14pt; margin-top:20px;">Click below to finish.</p>';
    },
    choices: ["Finish"],
    button_html: '<button class="ab-default-button">%choice%</button>'
};

// Assemble timeline
var timeline = [];
timeline.push(preload, get_participant_id, welcome, enter_fullscreen, instructions);

var practice_trials = makePracticeTrials();
for (var p = 0; p < practice_trials.length; p++) {
    timeline = timeline.concat(buildTrialTimeline(practice_trials[p]));
}

timeline.push(post_practice);

var main_trials = makeMainTrials();
for (var t = 0; t < main_trials.length; t++) {
    timeline = timeline.concat(buildTrialTimeline(main_trials[t]));
}

timeline.push(conclusion, exit_fullscreen);

jsPsych.run(timeline);
