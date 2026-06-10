/////////////////////////////////////////
// OVERLAP CPT + RECOGNITION MEMORY (jsPsych v7 port of Anna's afc task)
/////////////////////////////////////////
// Source: afc.zip (task.js + generateStimuli.js).
// Phase 1: 300 trials of face-overlaid-on-scene, 2-back rule on the relevant
// dimension. Press space when relevant image is NOT a 2-back repeat; withhold
// when it IS. Each trial = 1 s total (response window + filler).
// Phase 2: Recognition memory. Each previously-presented image (face or scene)
// plus new lures shown one at a time, judged on a 4-point old/new confidence
// scale (1 = def new ... 4 = def old).
//
// Per-participant randomization:
//   - relevantType: 'face' or 'scene'
//   - frequentType (within relevant): 'male'/'female' or 'indoor'/'outdoor'
//   - secondFrequentType (within irrelevant): same options
//
// Practice has up to 8 attempts, each with 70% accuracy threshold. Failure
// on attempt 4 ends the experiment.
//
// IMPORTANT: AFC_ASSET_ROOT must point at a server hosting the SUN-database
// scenes and Chicago-Face-Database faces in the layout the original task
// expects (images/indoor/sun_*.jpg, images/outdoor/sun_*.jpg,
// images/male/CFD-*.jpg, images/female/CFD-*.jpg). Replace the placeholder
// below with the real URL once stimuli are hosted.

// =========== CONFIG ============================================================
// Cloudflare R2 bucket "stimuli", public dev URL.
var AFC_ASSET_ROOT = "https://pub-09abf098b7ab470c9ec4f75b3e689e87.r2.dev/";

var TOTAL_PRACTICE_TRIALS = 20;
var PRACTICE_ACC_THRESHOLD = 0.85;   // retry trigger + displayed target
var PRACTICE_FINAL_THRESHOLD = 0.70;  // last-attempt soft gate: anyone reaching this on attempt 8 still proceeds
var FACE_SIZE = 110;          // px (was 155 in Anna's source; smaller here so face occupies <25% of the scene area)
var TRIAL_DUR_MS = 1200;      // total per CPT trial (response + fill-in)
var MEM_TRIAL_DUR_MS = 20000; // max per memory-test trial

// =========== JSPSYCH INIT =====================================================
var jsPsych = initJsPsych({});

// =========== PARTICIPANT ID ===================================================
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

// =========== STIMULI ==========================================================
// generateStimuli.js (loaded before this script) provides generateRandomStimuli,
// generatePracticeStimuli, returnArrays, etc. — using their hardcoded paths
// like "images/indoor/sun_xxx.jpg". We prepend AFC_ASSET_ROOT to all of them
// so they resolve against the hosted bucket.
function _prefixPath(p) {
    if (typeof p !== 'string') return p;
    if (p.indexOf('http://') === 0 || p.indexOf('https://') === 0) return p;
    return AFC_ASSET_ROOT + p;
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
function makeOverlayStimulus(scenePath, facePath, dotColor) {
    return '<div class="afc-stim-container" '
         +      'style="position: relative; '
         +             'width: min(800px, 95vw); '
         +             'height: min(600px, 85vh); '
         +             'margin: 0 auto;">'
         +     '<img src="' + scenePath + '" '
         +          'style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; z-index: 1;">'
         +     '<img src="' + facePath + '" '
         +          'style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); height: ' + FACE_SIZE + 'px; z-index: 2;">'
         +     '<span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ' + dotColor + '; font-size: 36px; line-height: 1; z-index: 3;">&#9679;</span>'
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
            on_finish: function (data) {
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
            return prior[prior.length - 1].rt !== null;
        }
    };

    return { trial: face_on_top_task, fillIn: fill_in_if_node };
}

// =========== MIND-WANDERING PROBE =============================================
var MW_MIN_GAP = 25;
var MW_MAX_GAP = 35;
var MW_PRACTICE_AT_TRIAL = 10;

var mindwander_probe = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div style="font-size:18pt; max-width:600px; margin:50px auto;">'
            +    '<p>Just before this question, where was your attention?</p>'
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
        data.on_task = (data.response === 0) ? 1 : 0;
    }
};

function generateProbePositions(n_trials, min_gap, max_gap) {
    var positions = [];
    var pos = min_gap + Math.floor(Math.random() * (max_gap - min_gap + 1));
    while (pos <= n_trials) {
        positions.push(pos);
        pos += min_gap + Math.floor(Math.random() * (max_gap - min_gap + 1));
    }
    return positions;
}

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

// Main task block — probes every 25–35 trials
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
var _mw_instr_block = '<p style="margin-top:14pt; padding:10pt; background:#f0f0f0; border-left:3px solid #888;">'
                    +     '<strong>Mind-wandering check-in.</strong> Every 25–35 images, the task will pause and ask: '
                    +     '<em>"Just before this question, where was your attention?"</em><br>'
                    +     'Pick <b>On task</b> if your thoughts were focused on the task. '
                    +     'Pick <b>Off task</b> if you were experiencing task-unrelated thoughts.<br>'
                    +     '<strong>Please answer honestly.</strong> Mind-wandering is normal. '
                    +     'We are genuinely interested in when this happens. '
                    +     '<strong>Your answers will not be used to reject your submission</strong> '
                    +     'and will not affect your payment. These are not "attention checks" — they\'re '
                    +     'data about your experience that we use for science.'
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
             +     '<h2 style="margin: 0 0 10pt 0;">One more thing</h2>'
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
            var remember;
            if (relevantType === 'scene') {
                remember = '<br>Remember: when you see a scene that was <strong>not</strong> presented two scenes previously, press the <strong>spacebar</strong>.<br>'
                         + 'When you see a scene that was presented two scenes previously, do not press any buttons.';
            } else {
                remember = '<br>Remember: when you see a face that was <strong>not</strong> presented two faces previously, press the <strong>spacebar</strong>.<br>'
                         + 'When you see a face that was presented two faces previously, do not press any buttons.';
            }

            // Last attempt has a softer floor: anyone reaching PRACTICE_FINAL_THRESHOLD
            // can still proceed; only those below it are gated out.
            if (isLastAttempt) {
                if (accuracy < PRACTICE_FINAL_THRESHOLD) {
                    jsPsych.endExperiment('You correctly responded to ' + pct + '% of images in the practice task. This was your last opportunity. The experiment will end now.');
                    return 'You correctly responded to ' + pct + '% of images in the practice task. This was your last opportunity. The experiment will end now.';
                }
                return '<div class="afc-instr">'
                     +    '<p>Well done! You got ' + pct + '% correct. You will now move on to the real task.</p>'
                     +    remember
                     + '</div>';
            }

            if (accuracy < PRACTICE_ACC_THRESHOLD) {
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

// Re-shown after a failed first practice attempt to give participants who
// missed the 2-back rule a second look at the full instructions.
var instructions_reshow = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var target = (relevantType === 'scene') ? 'scenes' : 'faces';
        return '<div class="afc-instr">'
             +     '<h2 style="margin: 0 0 10pt 0;">Let\'s review the rule before trying again</h2>'
             +     '<p>You will see images of faces overlaid on scenes. Focus only on the <strong>' + target + '</strong>.</p>'
             +     '<p>Your goal is to identify ' + target + ' that were <strong>not</strong> also presented two ' + target + ' ago and <strong>press the space bar</strong>.</p>'
             +     '<p>When you see a ' + target.replace(/s$/, '') + ' that is the same as the one two before it (i.e. there is one ' + target.replace(/s$/, '') + ' between the two presentations), do not press any buttons.</p>'
             +     '<p>There will be a dark gray dot in the center of the screen. If the dot changes to light gray, that means your response for that image has been recorded.</p>'
             +     '<p>Please respond as accurately as you can.</p>'
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
        on_finish: function (data) {
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

// =========== END SCREEN =======================================================
var end = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div style="font-size: 22px; text-align: center;">'
            +     '<p>Thank you for participating. The study is now complete.</p>'
            + '</div>',
    choices: ['Finish'],
    button_html: '<button class="afc-default-button">%choice%</button>'
};

// =========== TIMELINE =========================================================
var timeline = [];
timeline.push(preload, get_participant_id, enter_fullscreen, instructions);
timeline.push(mw_instructions);
timeline.push(practice_instructions);
timeline.push(practice_loop_first, conditional_1, conditional_2, conditional_3,
              conditional_4, conditional_5, conditional_6, conditional_7);
timeline.push(get_ready, face_on_top_setup);
timeline.push(mem_instructions, memtest_vis);
timeline.push(end, exit_fullscreen);

// Stamp condition info on every record so analysis is easier
jsPsych.data.addProperties({
    afc_relevant_dimension: relevantType,
    afc_frequent_relevant: frequentType,
    afc_frequent_irrelevant: secondFrequentType
});

jsPsych.run(timeline);
