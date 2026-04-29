// ======================================================================
// SWITCH CPT — Qualtrics-loadable build
// ======================================================================
// Source: Monica/Mathieu's task.js (jsPsych v6) → jsPsych v7 with
// Qualtrics-loader wrapper, R2-hosted stimuli, dropped consent / prolific /
// demographics / SONA. 4-phase structure preserved (phase1, phase1_dup,
// phase2, phase2_dup); reward valence flips between block 1 and block 2.

// Cloudflare R2 bucket "stimuli", scpt/ prefix
var SCPT_ASSET_ROOT = "https://pub-09abf098b7ab470c9ec4f75b3e689e87.r2.dev/scpt/";

function initExp() {

function _median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function _round3(x) {
    if (x === null || isNaN(x) || typeof x !== 'number') return null;
    return Math.round(x * 1000) / 1000;
}

var jsPsych = initJsPsych({
    display_element: 'display_stage',
    on_finish: function () {
        var qHas = (typeof Qualtrics !== 'undefined');
        var data = jsPsych.data.get();
        // Filtering: practice trials are excluded from every dump below.
        //   - Main trials  have blockType='main-experiment-task' / task='switchCPT'
        //   - Practice trials have blockType='practice' / task='switchCPT'  ← EXCLUDED
        //   - Main feedback has blockType='main-experiment-task-feedback'
        //   - Practice feedback has blockType='practice-feedback'  ← EXCLUDED
        // Redundant filterCustom calls below make exclusion belt-and-suspenders.
        var main = data.filter({task: 'switchCPT', blockType: 'main-experiment-task'})
                       .filterCustom(function (r) { return r.blockType === 'main-experiment-task'; })
                       .values();
        var fb   = data.filter({blockType: 'main-experiment-task-feedback'})
                       .filterCustom(function (r) { return r.blockType === 'main-experiment-task-feedback'; })
                       .values();

        var trialCols = ['phase', 'mini_block_index', 'trial_index_in_mini_block',
                         'current_stimulus_focus_group', 'current_reward_type',
                         'current_cue_color_html', 'GoNoGoType', 'Frequent',
                         'response', 'correct', 'rt'];
        var rows = main.map(function (r) {
            return [r.phase, r.mini_block_index, r.trial_index_in_mini_block,
                    r.current_stimulus_focus_group, r.current_reward_type,
                    r.current_cue_color_html, r.GoNoGoType, r.Frequent,
                    r.response, r.correct, r.rt];
        });

        if (qHas) {
            try {
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_data', JSON.stringify({
                    pid: subject,
                    neutral_group: neutralGroupKey,
                    rewarded_group: rewardedGroupKey,
                    phase1_reward_type: phase1RewardType,
                    phase2_reward_type: phase2RewardType,
                    color_mappings: color_task_mappings,
                    cols: trialCols, rows: rows
                }));
            } catch (e) {
                console.warn('[scpt] setEmbeddedData failed:', e);
            }
        }

        function phaseStats(phaseLabel) {
            var p = main.filter(function (r) { return r.phase === phaseLabel; });
            var n = p.length;
            var corr = p.filter(function (r) { return r.correct === true; }).length;
            var rts = p.filter(function (r) { return r.correct === true && typeof r.rt === 'number'; })
                       .map(function (r) { return r.rt; });
            var rew = fb.filter(function (r) { return r.phase === phaseLabel; })
                        .reduce(function (a, b) { return a + (typeof b.reward === 'number' ? b.reward : 0); }, 0);
            return {
                n: n,
                accuracy: n ? corr / n : null,
                meanrt: rts.length ? rts.reduce(function (a, b) { return a + b; }, 0) / rts.length : null,
                medianrt: _median(rts),
                reward: rew
            };
        }
        var phaseSummaries = {
            phase1: phaseStats('phase1'),
            phase1_dup: phaseStats('phase1_dup'),
            phase2: phaseStats('phase2'),
            phase2_dup: phaseStats('phase2_dup')
        };
        var totalReward = phaseSummaries.phase1.reward + phaseSummaries.phase1_dup.reward
                        + phaseSummaries.phase2.reward + phaseSummaries.phase2_dup.reward;

        if (qHas) {
            Qualtrics.SurveyEngine.setEmbeddedData('scpt_total_reward', _round3(totalReward));
            Qualtrics.SurveyEngine.setEmbeddedData('scpt_neutral_group', neutralGroupKey);
            Qualtrics.SurveyEngine.setEmbeddedData('scpt_rewarded_group', rewardedGroupKey);
            Qualtrics.SurveyEngine.setEmbeddedData('scpt_block1_reward_type', phase1RewardType);
            Qualtrics.SurveyEngine.setEmbeddedData('scpt_block2_reward_type', phase2RewardType);
            Object.keys(phaseSummaries).forEach(function (lbl) {
                var s = phaseSummaries[lbl];
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_' + lbl + '_n_trials', s.n);
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_' + lbl + '_accuracy', _round3(s.accuracy));
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_' + lbl + '_meanrt',   s.meanrt   !== null ? Math.round(s.meanrt) : null);
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_' + lbl + '_medianrt', s.medianrt !== null ? Math.round(s.medianrt) : null);
                Qualtrics.SurveyEngine.setEmbeddedData('scpt_' + lbl + '_reward',   _round3(s.reward));
            });
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

// ----------------------------------------------------------------------
// CAPTURE-PHASE SPACE LISTENER (failsafe for Qualtrics)
// ----------------------------------------------------------------------
// In Qualtrics, jsPsych's bubble-phase document keydown listener can be
// suppressed by survey chrome (focused buttons, document-level handlers
// that stopImmediatePropagation, etc.). We install a *capture-phase*
// listener so we always see Space first, and recover the response in
// each trial's on_finish if jsPsych's own listener missed it.
//
// Idempotent: only install once even if scpt_qualtrics.js is loaded twice
// (which can happen with the Qualtrics getScript pattern).
if (typeof window !== 'undefined' && !window.__scpt_spaceListenerInstalled) {
    window.__scpt_spaceListenerInstalled = true;
    window.__scpt_spaceLog = [];
    document.addEventListener('keydown', function(e) {
        if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
            const t = performance.now();
            window.__scpt_spaceLog.push(t);
            console.log('[scpt SPACE@capture]', t.toFixed(0), 'target=' + (e.target && e.target.tagName) + (e.target && e.target.id ? '#' + e.target.id : ''));
            // Prevent Qualtrics' own bubble-phase handlers from advancing the
            // page on Space. We do NOT call stopImmediatePropagation, so jsPsych's
            // own document listener (if it fires correctly) still runs.
            if (e.target === document.body || (e.target && e.target.tagName === 'BUTTON')) {
                e.preventDefault();
            }
        }
    }, true); // capture phase — fires before any bubble listener
}

var subject = (typeof window !== 'undefined' && window.QUALTRICS_PID)
              ? window.QUALTRICS_PID
              : ('anon_' + Date.now());
jsPsych.data.addProperties({participant_id: subject});

// ======================================================================
// GLOBAL CONFIGURATION
// ======================================================================
const config = {
  // Experiment structure
  trialsBlocks: 24,              // total mini-blocks counted ACROSS phases. Each of 4 phases gets trialsBlocks/2 = 12 mini-blocks × 10 trials = 120 trials/phase → 480 trials total ≈ 20 min.
  trialsPerMiniBlock: 10,
  practiceAccuracyThreshold: 90,
  noGoProportion: 0.15,

  // 480 trials total (4 phases × 120 trials each)

  // Reward settings
  defaultRewardAmount: 10,
  goMissPenaltyAmount: 2,

  // Timing settings (ms)
  timing: {
    fixation: 0, // time before the stimulus comes out
    stimulus: 1000, // time for how long stimulus will stay
    postStimulusFixation: 1000, // time window for response after stimulus disappears
    feedback: 0,
    cue: 500, // how long the color block stays for
    endScreenDuration: 120000,
  },


  // Stimulus groups and their go/no-go pairs
  stimulus_groups_config: {
    numbers: {
      types: ['even', 'odd'],
      even_count: 16,
      odd_count: 16,
      paths: []
    },
    letters: {
      types: ['consonant', 'vowel'],
      consonant_count: 16,
      vowel_count: 16,
      paths: []
    }
  }
};


// ======================================================================
// ONE-TIME RANDOMIZATIONS (task rules + phase design + colors)
// ======================================================================

// Randomize Go/No-Go assignments for each stimulus group (unchanged pattern)
Object.keys(config.stimulus_groups_config).forEach(groupKey => {
  const types = config.stimulus_groups_config[groupKey].types;
  const shuffledTypes = jsPsych.randomization.shuffle(types);
  config.stimulus_groups_config[groupKey].go = shuffledTypes[0];
  config.stimulus_groups_config[groupKey].nogo = shuffledTypes[1];
});

// Dynamically populate image paths 
for (const groupName in config.stimulus_groups_config) {
  const group = config.stimulus_groups_config[groupName];

  for (let i = 1; i <= group[`${group.go}_count`]; i++) {
    group.paths.push(SCPT_ASSET_ROOT + `${group.go}/${group.go}_${i}.jpeg`);
  }
  for (let i = 1; i <= group[`${group.nogo}_count`]; i++) {
    group.paths.push(SCPT_ASSET_ROOT + `${group.nogo}/${group.nogo}_${i}.jpeg`);
  }
}

// ----------------------------------------------------------------------
//TASK STRUCTURE (2 tasks only):
// ----------------------------------------------------------------------
const groupKeys = Object.keys(config.stimulus_groups_config); // ['numbers','letters']

// Randomly pick which group is neutral (same across all phases)
const neutralGroupKey = jsPsych.randomization.sampleWithoutReplacement(groupKeys, 1)[0];

// The remaining group is the rewarded task (same across all phases)
const rewardedGroupKey = groupKeys.find(k => k !== neutralGroupKey);

// Randomize reward valence across blocks for the rewarded group (50/50):
// Either [ 'positive', 'penalty' ] or [ 'penalty', 'positive' ].
const rewardTypesByBlock = jsPsych.randomization.shuffle(['positive', 'penalty']);
const phase1RewardType = rewardTypesByBlock[0]; // Block 1 (phase1, phase1_dup)
const phase2RewardType = rewardTypesByBlock[1]; // Block 2 (phase2, phase2_dup)

// Randomize TWO cue colors, assign one to each group
const base_colors_shuffled = jsPsych.randomization.shuffle([
  { color_name: 'magenta', html_color: 'magenta' },
  { color_name: 'cyan',    html_color: 'cyan' }
]);

const color_task_mappings = [
  { ...base_colors_shuffled[0], stimulus_group_key: neutralGroupKey },
  { ...base_colors_shuffled[1], stimulus_group_key: rewardedGroupKey }
];

function getColorMappingForGroup(groupKey) {
  return color_task_mappings.find(m => m.stimulus_group_key === groupKey);
}

// Phase-specific "active condition mappings"
// Neutral mapping is identical across blocks; rewarded group flips valence between blocks.
const active_condition_mappings_phase1 = [
  { ...getColorMappingForGroup(neutralGroupKey),  reward_type_key: 'neutral' },
  { ...getColorMappingForGroup(rewardedGroupKey), reward_type_key: phase1RewardType }
];

const active_condition_mappings_phase2 = [
  { ...getColorMappingForGroup(neutralGroupKey),  reward_type_key: 'neutral' },
  { ...getColorMappingForGroup(rewardedGroupKey), reward_type_key: phase2RewardType }
];

// Convenience: neutral mapping (same for both phases)
const mappingNeutral = active_condition_mappings_phase1.find(m => m.reward_type_key === 'neutral');

console.log('Neutral group:', neutralGroupKey);
console.log('Rewarded group:', rewardedGroupKey);
console.log('Block 1 reward type for rewarded group:', phase1RewardType);
console.log('Block 2 reward type for rewarded group:', phase2RewardType);
console.log('Color-task mappings:', color_task_mappings.map(m => `${m.color_name} → ${m.stimulus_group_key}`));


// ======================================================================
// HELPERS
// ======================================================================
function shuffle(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

// Map duplicated phase labels -> correct active mappings
function getActiveMappingsForPhaseLabel(phaseLabel) {
  if (phaseLabel === 'phase1' || phaseLabel === 'phase1_dup') return active_condition_mappings_phase1;
  if (phaseLabel === 'phase2' || phaseLabel === 'phase2_dup') return active_condition_mappings_phase2;
  return active_condition_mappings_phase1;
}

// Cumulative points (MAIN TASK ONLY, all phases)
function computeCumulativePointsMainOnly() {
  const fb = jsPsych.data.get().filter({blockType: 'main-experiment-task-feedback'}).values();
  let total = 0;
  fb.forEach(t => { if (typeof t.reward === 'number') total += t.reward; });
  return total;
}

function computeCumulativePointsForPhases(phaseTags) {
  const fb = jsPsych.data
    .get()
    .filter({ blockType: 'main-experiment-task-feedback' })
    .values();

  let total = 0;
  fb.forEach(t => {
    if (phaseTags.includes(t.phase) && typeof t.reward === 'number') total += t.reward;
  });

  return total;
}

function makeBlockCumulativeTotalScreen(blockNumber, phaseTags) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const total = computeCumulativePointsForPhases(phaseTags);
      const formattedTotal = total.toFixed(2);

      return `
        <div style="text-align: center; color: white;">
          <p style="font-size: 28px;">Block ${blockNumber} Total</p>
          <p style="font-size: 48px; font-weight: bold;">${formattedTotal} points</p>
          <p style="font-size: 22px; margin-top: 30px;">Click 'Continue' to continue.</p>
        </div>
      `;
    },
    choices: ['Continue'],
    data: { task: 'block_total_display', block: blockNumber, phase_tags: phaseTags }
  };
}


function makeCumulativeTotalScreen(phaseTag) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const total = computeCumulativePointsMainOnly();
      const formattedTotal = total.toFixed(2);
      return `
        <div style="text-align: center; color: white;">
          <p style="font-size: 28px;">Cumulative Total</p>
          <p style="font-size: 48px; font-weight: bold;">${formattedTotal} points</p>
          <p style="font-size: 22px; margin-top: 30px;">Click 'Continue' to continue.</p>
        </div>
      `;
    },
    choices: ['Continue'],
    data: { task: 'cumulative_total_display', phase_tag: phaseTag }
  };
}

function makeBetweenPhaseBreak(blockNumber) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div style="text-align:center; color:black;">
        <p style="font-size:28px;"><strong>Phase 2</strong></p>
        <p style="font-size:22px;">
          Click <strong>Continue</strong> for <strong>the last phase of block ${blockNumber}</strong>.
        </p>
      </div>
    `,
    choices: ['Continue'],
    data: { task: 'between_phase_break', block: blockNumber }
  };
}

// Phase total screen with accuracy and RT
function makePhaseTotalScreen(phaseLabel, phaseDisplayName) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      // Rewards for this phase
      const fb = jsPsych.data.get().filter({
        blockType: 'main-experiment-task-feedback',
        phase: phaseLabel
      }).values();
      let totalReward = 0;
      fb.forEach(t => { if (typeof t.reward === 'number') totalReward += t.reward; });
      const formattedTotal = totalReward.toFixed(2);

      // Main trials for this phase (accuracy + RT)
      const mainTrials = jsPsych.data.get().filter({
        task: 'switchCPT',
        blockType: 'main-experiment-task',
        phase: phaseLabel
      });

      const totalTrials = mainTrials.count();
      const correctTrials = mainTrials.filter({ correct: true }).count();
      const accuracy = totalTrials > 0 ? (correctTrials / totalTrials) * 100 : 0;
      const accuracyStr = totalTrials > 0 ? accuracy.toFixed(1) : 'N/A';

      const trialsArray = mainTrials.values();
      let rtSum = 0;
      let rtCount = 0;
      trialsArray.forEach(t => {
        if (typeof t.rt === 'number' && !Number.isNaN(t.rt)) {
          rtSum += t.rt;
          rtCount++;
        }
      });
      const avgRt = rtCount > 0 ? rtSum / rtCount : null;
      const avgRtStr = rtCount > 0 ? avgRt.toFixed(0) : 'N/A';

      return `
        <div style="text-align: center; color: white;">
          <p style="font-size: 28px;">${phaseDisplayName} Total</p>
          <p style="font-size: 48px; font-weight: bold;">${formattedTotal} points</p>
          <p style="font-size: 22px; margin-top: 20px;">Accuracy: <strong>${accuracyStr}%</strong></p>
          <p style="font-size: 22px; margin-top: 5px;">Average response time: <strong>${avgRtStr} ms</strong></p>
          <p style="font-size: 22px; margin-top: 30px;">Click 'Continue' to continue.</p>
        </div>
      `;
    },
    choices: ['Continue'],
    data: { task: 'phase_total_display', phase: phaseLabel, phase_display_name: phaseDisplayName }
  };
}


// ======================================================================
// PHASE-SPECIFIC STIMULUS GENERATION
// ======================================================================
function buildPhaseTrialsAndPractice(active_condition_mappings, phaseLabel) {
  // Main trials
  let main_experiment_mini_block_sequence_definitions = [];

  // Half of original total for this phase (mirrors your existing approach)
  const total_main_mini_blocks = Math.floor(config.trialsBlocks / 2);

  // Equal-ish distribution across the TWO active conditions
  const blocks_per_condition = Math.floor(total_main_mini_blocks / active_condition_mappings.length);
  let temp_main_mini_block_types_for_shuffling = [];
  for (let j = 0; j < blocks_per_condition; j++) {
    temp_main_mini_block_types_for_shuffling.push(...active_condition_mappings);
  }
  while (temp_main_mini_block_types_for_shuffling.length < total_main_mini_blocks) {
    temp_main_mini_block_types_for_shuffling.push(
      jsPsych.randomization.sampleWithoutReplacement(active_condition_mappings, 1)[0]
    );
  }
  main_experiment_mini_block_sequence_definitions =
    jsPsych.randomization.shuffle(temp_main_mini_block_types_for_shuffling);

  const all_experiment_trials = [];
  let previous_main_stim_group_key = null;
  let previous_main_lure_group_key = null;

  // Global go/nogo sequence
  const goNoGoSequence = [];
  const numNoGoTrials = Math.round(total_main_mini_blocks * config.trialsPerMiniBlock * config.noGoProportion);
  const numGoTrials = total_main_mini_blocks * config.trialsPerMiniBlock - numNoGoTrials;
  for (let g = 0; g < numGoTrials; g++) goNoGoSequence.push(true);
  for (let n = 0; n < numNoGoTrials; n++) goNoGoSequence.push(false);
  shuffle(goNoGoSequence);

  // Build mini-blocks
  for (let i = 0; i < total_main_mini_blocks; i++) {
    const current_mini_block_def = main_experiment_mini_block_sequence_definitions[i];
    const current_stim_group_key   = current_mini_block_def.stimulus_group_key;
    const current_reward_type_key  = current_mini_block_def.reward_type_key;
    const current_color_html       = current_mini_block_def.html_color;

    // Lure logic
    let lure_group_key_for_mini_block;
    if (i === 0) {
      const otherGroups = Object.keys(config.stimulus_groups_config).filter(name => name !== current_stim_group_key);
      lure_group_key_for_mini_block = jsPsych.randomization.sampleWithoutReplacement(otherGroups, 1)[0];
    } else {
      lure_group_key_for_mini_block =
        (current_stim_group_key === previous_main_stim_group_key)
          ? previous_main_lure_group_key
          : previous_main_stim_group_key;
    }

    const current_focus_group_config = config.stimulus_groups_config[current_stim_group_key];
    const current_lure_group_config  = config.stimulus_groups_config[lure_group_key_for_mini_block];
    if (!current_focus_group_config || !current_lure_group_config) continue;

    const allPossibleLurePaths = current_lure_group_config.paths;

    let mini_block_individual_trials = [];
    let shuffledLures = jsPsych.randomization.shuffle(allPossibleLurePaths);
    while (shuffledLures.length < config.trialsPerMiniBlock) {
      shuffledLures.push(...jsPsych.randomization.shuffle(allPossibleLurePaths));
    }

    for (let k = 0; k < config.trialsPerMiniBlock; k++) {
      const isTargetGo = goNoGoSequence[i * config.trialsPerMiniBlock + k];
      const targetType = isTargetGo ? current_focus_group_config.go : current_focus_group_config.nogo;

      const possibleTargetPaths = current_focus_group_config.paths.filter(path => path.includes(targetType));
      if (!possibleTargetPaths.length) continue;

      const targetImage = jsPsych.randomization.sampleWithoutReplacement(possibleTargetPaths, 1)[0];
      const lureImage   = shuffledLures[k % shuffledLures.length];

      mini_block_individual_trials.push({
        Target: targetImage,
        Type: current_stim_group_key,
        GoNoGoType: isTargetGo ? current_focus_group_config.go : current_focus_group_config.nogo,
        Lure: lureImage,
        LureCategory: lure_group_key_for_mini_block,
        Frequent: isTargetGo,
        blockType: 'main-experiment-task',
        isReminderOrControl: false,
        randomVariable: Math.floor(Math.random() * 2),
        current_reward_type: current_reward_type_key,
        current_stimulus_focus_group: current_stim_group_key,
        current_cue_color_html: current_color_html,
        mini_block_index: i,
        trial_index_in_mini_block: k,
        phase: phaseLabel
      });
    }

    all_experiment_trials.push(...mini_block_individual_trials);
    previous_main_stim_group_key = current_stim_group_key;
    previous_main_lure_group_key = lure_group_key_for_mini_block;
  }

  // Practice trials
  const practice_trials_data = [];
  let previous_practice_stim_group_key = null;
  let previous_practice_lure_group_key = null;

  const practice_mini_block_defs = jsPsych.randomization.shuffle([...active_condition_mappings]);
  while (practice_mini_block_defs.length < 3) {
    practice_mini_block_defs.push(
      jsPsych.randomization.sampleWithoutReplacement(active_condition_mappings, 1)[0]
    );
  }

  for (let i = 0; i < practice_mini_block_defs.length; i++) {
    const def = practice_mini_block_defs[i];
    const current_stim_group_key  = def.stimulus_group_key;
    const current_reward_type_key = def.reward_type_key;
    const current_color_html      = def.html_color;

    let lure_group_key_for_practice_mini_block;
    if (i === 0) {
      const otherGroups = Object.keys(config.stimulus_groups_config).filter(name => name !== current_stim_group_key);
      lure_group_key_for_practice_mini_block = jsPsych.randomization.sampleWithoutReplacement(otherGroups, 1)[0];
    } else {
      lure_group_key_for_practice_mini_block =
        (current_stim_group_key === previous_practice_stim_group_key)
          ? previous_practice_lure_group_key
          : previous_practice_stim_group_key;
    }

    const focusCfg = config.stimulus_groups_config[current_stim_group_key];
    const lureCfg  = config.stimulus_groups_config[lure_group_key_for_practice_mini_block];
    if (!focusCfg || !lureCfg) continue;

    const allPossibleLurePaths = lureCfg.paths;
    let shuffledPracticeLures = jsPsych.randomization.shuffle(allPossibleLurePaths);
    while (shuffledPracticeLures.length < config.trialsPerMiniBlock) {
      shuffledPracticeLures.push(...jsPsych.randomization.shuffle(allPossibleLurePaths));
    }

    const goNoGoSeqPractice = [];
    const numNoGoTrialsP = 1; // same as your original practice: 1 No-Go per mini-block
    const numGoTrialsP  = config.trialsPerMiniBlock - numNoGoTrialsP;
    for (let g = 0; g < numGoTrialsP; g++) goNoGoSeqPractice.push(true);
    for (let n = 0; n < numNoGoTrialsP; n++) goNoGoSeqPractice.push(false);
    shuffle(goNoGoSeqPractice);

    for (let k = 0; k < config.trialsPerMiniBlock; k++) {
      const isTargetGo = goNoGoSeqPractice[k];
      const targetType = isTargetGo ? focusCfg.go : focusCfg.nogo;
      const possibleTargetPaths = focusCfg.paths.filter(p => p.includes(targetType));
      if (!possibleTargetPaths.length) continue;

      const targetImage = jsPsych.randomization.sampleWithoutReplacement(possibleTargetPaths, 1)[0];
      const lureImage   = shuffledPracticeLures[k % shuffledPracticeLures.length];

      practice_trials_data.push({
        Target: targetImage,
        Type: current_stim_group_key,
        GoNoGoType: isTargetGo ? focusCfg.go : focusCfg.nogo,
        Lure: lureImage,
        LureCategory: lure_group_key_for_practice_mini_block,
        Frequent: isTargetGo,
        blockType: 'practice',
        isReminderOrControl: false,
        randomVariable: Math.floor(Math.random() * 2),
        current_reward_type: current_reward_type_key,
        current_stimulus_focus_group: current_stim_group_key,
        current_cue_color_html: current_color_html,
        mini_block_index: i,
        trial_index_in_mini_block: k,
        practice_phase: phaseLabel
      });
    }

    previous_practice_stim_group_key = current_stim_group_key;
    previous_practice_lure_group_key = lure_group_key_for_practice_mini_block;
  }

  return {
    all_experiment_trials,
    main_experiment_mini_block_sequence_definitions,
    total_main_mini_blocks,
    practice_trials_data
  };
}


// ======================================================================
// BUILD PHASE TRIALS (NOW 4 PHASES TOTAL)
// ======================================================================
const PHASE1 = buildPhaseTrialsAndPractice(active_condition_mappings_phase1, 'phase1');
const PHASE1_DUP = buildPhaseTrialsAndPractice(active_condition_mappings_phase1, 'phase1_dup');

const PHASE2 = buildPhaseTrialsAndPractice(active_condition_mappings_phase2, 'phase2');
const PHASE2_DUP = buildPhaseTrialsAndPractice(active_condition_mappings_phase2, 'phase2_dup');

console.log('Phase 1 Trials (Total):', PHASE1.all_experiment_trials.length);
console.log('Phase 1 DUP Trials (Total):', PHASE1_DUP.all_experiment_trials.length);
console.log('Phase 2 Trials (Total):', PHASE2.all_experiment_trials.length);
console.log('Phase 2 DUP Trials (Total):', PHASE2_DUP.all_experiment_trials.length);


// ======================================================================
// IMAGE PRELOADING
// ======================================================================
const preloadArray = [];
const uniquePreloadPaths = new Set();

// Add all group paths
for (const groupName in config.stimulus_groups_config) {
  config.stimulus_groups_config[groupName].paths.forEach(path => uniquePreloadPaths.add(path));
}

// Add example images from Block 1 active conditions (safe and minimal)
active_condition_mappings_phase1.forEach(mapping => {
  const group = config.stimulus_groups_config[mapping.stimulus_group_key];
  const goImage = group.paths.find(path => path.includes(`${group.go}_1.jpeg`));
  const noGoImage = group.paths.find(path => path.includes(`${group.nogo}_1.jpeg`));
  if (goImage) uniquePreloadPaths.add(goImage);
  if (noGoImage) uniquePreloadPaths.add(noGoImage);
});

preloadArray.push(...uniquePreloadPaths);

// ======================================================================
// EXPERIMENT SETUP
// ======================================================================
// Hardcode reward props that the original prolific_id trial wrote into data:
// the feedback computation uses jsPsych.data.get().filter({task:'id'}) to look
// these up. We populate via jsPsych.data.addProperties so they're attached to
// every record (filtered lookups still resolve).
jsPsych.data.addProperties({
    reward_value: config.defaultRewardAmount,
    go_miss_penalty: config.goMissPenaltyAmount,
    neutral_group: neutralGroupKey,
    rewarded_group: rewardedGroupKey,
    phase1_reward_type_for_rewarded_group: phase1RewardType,
    phase2_reward_type_for_rewarded_group: phase2RewardType,
    color_task_mappings: JSON.stringify(color_task_mappings)
});


// ======================================================================
// TASK TRIALS & FEEDBACK
// ======================================================================
const horizontal_task = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function(){
    let image1, image2;
    const d = jsPsych.timelineVariable('current_trial_data');
    if (d.randomVariable === 0){ image1 = d.Target; image2 = d.Lure; }
    else { image1 = d.Lure; image2 = d.Target; }
    return `
      <div id="stim-container" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display:flex; justify-content:center; align-items:center; height: clamp(100px, 18vh, 150px); max-width: 90vw;">
        <img src="${image1}" style="height: 100%; max-width: 18vw; width: auto; object-fit: contain; margin:5px">
        <span style="font-size: clamp(28px, 3.5vw, 44px); padding: 0 clamp(15px, 3vw, 30px); color:white; line-height:1;">&#9679;</span>
        <img src="${image2}" style="height: 100%; max-width: 18vw; width: auto; object-fit: contain; margin:5px">
      </div>`;
  },
  response_type: 'key',
  response_ends_trial: false,
  choices: [' '],
  trial_duration: function() {
    return config.timing.stimulus + config.timing.postStimulusFixation;
  },
  css_classes: ['hide_cursor', 'stimulus_size'],
  data: function() {
    const d = jsPsych.timelineVariable('current_trial_data');
    return {
      Target: d.Target, Type: d.Type, GoNoGoType: d.GoNoGoType,
      Lure: d.Lure, LureCategory: d.LureCategory, Frequent: d.Frequent,
      task: 'switchCPT', blockType: 'main-experiment-task', isReminder: d.isReminderOrControl,
      current_reward_type: d.current_reward_type,
      current_stimulus_focus_group: d.current_stimulus_focus_group,
      current_cue_color_html: d.current_cue_color_html,
      randomVariable: d.randomVariable,
      mini_block_index: d.mini_block_index,
      trial_index_in_mini_block: d.trial_index_in_mini_block,
      phase: d.phase
    };
  },
  on_load: function() {
    // Qualtrics chrome (e.g. hidden Next button) can hold keyboard focus
    // and swallow Space. Drop focus so jsPsych's listener wins.
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    try { window.focus(); } catch (e) {}
    // Mark trial start for capture-phase recovery.
    window.__scpt_trialStart = performance.now();
    // Per-trial capture-phase listener (extra failsafe).
    window.__scpt_perTrialSpaceTime = null;
    window.__scpt_perTrialHandler = function(e) {
      if (window.__scpt_perTrialSpaceTime !== null) return;
      if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
        window.__scpt_perTrialSpaceTime = performance.now();
      }
    };
    document.addEventListener('keydown', window.__scpt_perTrialHandler, true);
    jsPsych.pluginAPI.setTimeout(() => {
      const container = document.getElementById('stim-container');
      if (container) {
        container.innerHTML = '<span style="font-size:60px; color:white; line-height:1;">&#9679;</span>';
        // Layout already flex 300px from initial render; keep it.
      }
    }, config.timing.stimulus);
  },
  on_finish: function(data) {
    // Remove per-trial listener.
    try { document.removeEventListener('keydown', window.__scpt_perTrialHandler, true); } catch (e) {}

    // Recover Space (per-trial preferred, global as fallback).
    if (data.response === null && window.__scpt_perTrialSpaceTime !== null) {
      data.response = ' ';
      data.rt = window.__scpt_perTrialSpaceTime - window.__scpt_trialStart;
      data.recovered_from_capture = 'per-trial';
    } else if (data.response === null && Array.isArray(window.__scpt_spaceLog)) {
      const trialStart = window.__scpt_trialStart || (performance.now() - 2000);
      const trialEnd = performance.now();
      const presses = window.__scpt_spaceLog.filter(t => t >= trialStart && t <= trialEnd);
      if (presses.length > 0) {
        data.response = ' ';
        data.rt = presses[0] - trialStart;
        data.recovered_from_capture = 'global';
      }
    }

    data.correct_response = data.Frequent ? ' ' : null;
    data.correct = (data.response === data.correct_response);
    data.time = (new Date()).getTime();
    if (data.response === ' ') data.response_type = data.Frequent ? 'hit' : 'fa';
    else data.response_type = data.Frequent ? 'miss' : 'cr';
  }
};

// MAIN TASK FEEDBACK: no visible points, but reward still computed and stored
const _DOT_HTML_300 = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display:flex; justify-content:center; align-items:center; height: clamp(100px, 18vh, 150px); max-width: 90vw;"><span style="font-size: clamp(28px, 3.5vw, 44px); color:white; line-height:1;">&#9679;</span></div>';

const feedback = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: _DOT_HTML_300,
  on_finish: function(data){
    const last = jsPsych.data.get().filter({task: 'switchCPT', blockType: 'main-experiment-task'}).last().values()[0] || {};
    const prevType = last.response_type || null;
    const isGo = last.Frequent || false;
    const rType = last.current_reward_type || null;

    const id = jsPsych.data.get().filter({task: 'id'}).values()[0] || {};
    const reward_value = id.reward_value || config.defaultRewardAmount;
    const go_miss_penalty = id.go_miss_penalty || config.goMissPenaltyAmount;

    let trial_reward = 0;

    // neutral trials never apply go-miss penalty
    if (rType !== 'neutral' && isGo && prevType === 'miss') {
      trial_reward = -go_miss_penalty;
    } else if (!isGo) {
      if (rType === 'positive' && prevType === 'cr') trial_reward = reward_value;
      else if (rType === 'penalty' && prevType === 'fa') trial_reward = -reward_value;
    }

    data.reward = trial_reward;
    data.blockType = 'main-experiment-task-feedback';
    data.current_reward_type = rType;
    data.current_stimulus_focus_group = last.current_stimulus_focus_group || 'unknown';
    data.phase = last.phase || 'unknown';
  },
  css_classes: ['hide_cursor', 'stimulus_size'],
  choices: 'NO_KEYS',
  trial_duration: config.timing.feedback,
};

// Timing & fixation — all dot-only displays use the same 300px flex container so
// the dot stays in exactly the same vertical position throughout a mini-block.
const fixation = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: _DOT_HTML_300,
  css_classes: ['hide_cursor','stimulus_size'],
  choices: 'NO_KEYS',
  trial_duration: config.timing.fixation
};

// 4-second fixation that occurs after each color cue and before the first stimulus of each mini-block
const fixation_after_cue = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: _DOT_HTML_300,
  css_classes: ['hide_cursor','stimulus_size'],
  choices: 'NO_KEYS',
  trial_duration: 4000,
  data: { task: 'fixation_after_cue' }
};

const post_stimulus_fixation = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: _DOT_HTML_300,
  css_classes: ['hide_cursor','stimulus_size'],
  choices: 'NO_KEYS',
  trial_duration: config.timing.postStimulusFixation,
  data: { task: 'post_stimulus_fixation' }
};

// Cue square (NO points; color only, used in main + practice)
const mini_cue_square = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function(){
    const d = jsPsych.timelineVariable('current_trial_data');
    return `
      <div style="text-align:center;">
        <div style="width: 150px; height: 150px; background-color: ${d.current_cue_color_html}; margin: 0 auto; border-radius: 15px;"></div>
      </div>
    `;
  },
  choices: 'NO_KEYS',
  trial_duration: config.timing.cue,
  css_classes: ['hide_cursor','stimulus_size'],
  data: function(){
    const d = jsPsych.timelineVariable('current_trial_data');
    return {
      task:'mini_cue_square',
      current_reward_type: d.current_reward_type,
      current_stimulus_focus_group: d.current_stimulus_focus_group,
      current_cue_color_html: d.current_cue_color_html,
      mini_block_index: d.mini_block_index,
      trial_index_in_mini_block: d.trial_index_in_mini_block,
      phase: d.phase || d.practice_phase || 'unknown',
      blockType: d.blockType || 'unknown'
    };
  }
};

// New: score screen shown AFTER each miniblock (except the last one of the phase/practice)
const mini_block_score_screen = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: function () {
    const d = jsPsych.timelineVariable('current_trial_data');
    const blockType = d.blockType || 'unknown';

    let fb = [];
    let totalReward = 0;

    if (blockType === 'main-experiment-task') {
      const phaseLabel = d.phase;
      if (phaseLabel) {
        fb = jsPsych.data.get().filter({
          blockType: 'main-experiment-task-feedback',
          phase: phaseLabel
        }).values();
      }
    } else if (blockType === 'practice') {
      const practicePhaseLabel = d.practice_phase;
      const attempt = jsPsych.timelineVariable('practice_attempt');
      if (practicePhaseLabel) {
        const filterObj = {
          blockType: 'practice-feedback',
          practice_phase: practicePhaseLabel
        };
        if (typeof attempt !== 'undefined') {
          filterObj.practice_attempt = attempt;
        }
        fb = jsPsych.data.get().filter(filterObj).values();
      }
    }

    fb.forEach(t => {
      if (typeof t.reward === 'number') totalReward += t.reward;
    });

    const formattedTotal = totalReward.toFixed(2);

    return `
      <div style="text-align:center; color:white;">
        <p style="font-size:24px;">Points:</p>
        <p style="font-size:40px; font-weight:bold; margin-top:10px;">${formattedTotal}</p>
      </div>
    `;
  },
  choices: 'NO_KEYS',
  trial_duration: 1000, // brief screen before next miniblock cue
  css_classes: ['hide_cursor', 'stimulus_size'],
  data: function () {
    const d = jsPsych.timelineVariable('current_trial_data');
    const attempt = jsPsych.timelineVariable('practice_attempt');
    const out = {
      task: 'mini_block_score_screen',
      phase: d.phase || d.practice_phase || 'unknown',
      blockType: d.blockType || 'unknown',
      mini_block_index: d.mini_block_index,
      trial_index_in_mini_block: d.trial_index_in_mini_block,
      current_stimulus_focus_group: d.current_stimulus_focus_group,
      current_reward_type: d.current_reward_type
    };
    if (typeof attempt !== 'undefined') out.practice_attempt = attempt;
    return out;
  }
};


// ======================================================================
// Instruction page helper
// ======================================================================
function buildRewardDescription(mapping) {
  const group = config.stimulus_groups_config[mapping.stimulus_group_key];
  const goType  = group.go.replace("_", " ");
  const noGoType = group.nogo.replace("_", " ");

  const pts  = Number(config.defaultRewardAmount).toFixed(2);
  const miss = Number(config.goMissPenaltyAmount).toFixed(2);

  if (mapping.reward_type_key === 'neutral') {
    return `You will <strong>not earn or lose</strong> any points in these trials.`;
  }

  if (mapping.reward_type_key === 'positive') {
    return `
      If you forget to press the space bar on ${goType}s, you will lose <span style="color:red;">${miss} points</span>.<br>
      If you correctly don't press the space bar on ${noGoType}s, you will earn <span style="color:green;">${pts} points</span>.
    `;
  }

  if (mapping.reward_type_key === 'penalty') {
    return `
      If you forget to press the space bar on ${goType}s, you will lose <span style="color:red;">${miss} points</span>.<br>
      If you press the space bar on ${noGoType}s, you will lose <span style="color:red;">${pts} points</span>.
    `;
  }

  return '';
}


// ======================================================================
// PRACTICE + INSTRUCTIONS BUILDERS
// ======================================================================
function makePracticeIntro(activeMappings, phaseLabel) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const mkLine = (m) => {
        const groupKey = m.stimulus_group_key;
        const color    = m.html_color;
        const goType   = config.stimulus_groups_config[groupKey].go.replace("_", " ");
        const noGoType = config.stimulus_groups_config[groupKey].nogo.replace("_", " ");
        const rewardDesc = buildRewardDescription(m);

        return `
          <div style="margin-top:20px; color:${color};">
            ■ Press on ${goType}, but not ${noGoType} (${groupKey})
            <br><span>${rewardDesc}</span>
          </div>
        `;
      };

      const lines = activeMappings.map(mkLine).join('');

      return `
        <p>In this phase, you will complete ${3 * config.trialsPerMiniBlock} practice trials.</p>
        <p>You need to achieve <strong>${config.practiceAccuracyThreshold}% accuracy</strong> to proceed.</p>
        <p>If you don't achieve ${config.practiceAccuracyThreshold}% accuracy, you will repeat the practice trials.</p>
        ${lines}
        <p>Click 'Continue' to begin practice.</p>
      `;
    },
    choices: ['Continue'],
    data: { task: `practice_intro_instructions_${phaseLabel}` }
  };
}

function makePracticeAccuracyCheck(phaseLabel, getAttempt) {
  return {
    type: jsPsychCallFunction,
    func: function() {
      const attempt = getAttempt();

      const practice_data = jsPsych.data.get().filter({
        blockType: 'practice',
        task: 'switchCPT',
        practice_phase: phaseLabel,
        practice_attempt: attempt
      });

      const correct_trials = practice_data.filter({correct: true}).count();
      const total_trials = practice_data.count();
      const accuracy = (total_trials > 0) ? (correct_trials / total_trials) * 100 : 0;
      const accuracy_met = accuracy >= config.practiceAccuracyThreshold;

      jsPsych.data.addProperties({
        [`practice_accuracy_${phaseLabel}`]: accuracy,
        [`practice_correct_count_${phaseLabel}`]: correct_trials,
        [`practice_total_count_${phaseLabel}`]: total_trials,
        [`accuracy_met_${phaseLabel}`]: accuracy_met,
        [`practice_attempt_${phaseLabel}`]: attempt
      });

      return accuracy_met;
    },
    data: { task: `practice_accuracy_check_${phaseLabel}` }
  };
}



function makePracticeRepeatMessage(phaseLabel) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function() {
      const last = jsPsych.data.get().filter({task: `practice_accuracy_check_${phaseLabel}`}).last().values()[0];
      const accuracy = (last && last[`practice_accuracy_${phaseLabel}`] != null) ? last[`practice_accuracy_${phaseLabel}`].toFixed(0) : '0';
      return `
        <p style="color: red;">Practice complete: Your accuracy was ${accuracy}%. You need ${config.practiceAccuracyThreshold}% accuracy to proceed.</p>
        <p>Please review the task requirements and try again.</p>
        <p>Click 'Continue' to repeat practice.</p>
      `;
    },
    choices: ['Continue'],
    data: { task: `practice_repeat_message_${phaseLabel}` }
  };
}

function makePracticeSuccessfulCompletion(phaseLabel, total_main_mini_blocks, all_experiment_trials) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function(){
      const totalExperimentTimeSeconds = (
        (all_experiment_trials.length * (config.timing.fixation + config.timing.stimulus + config.timing.postStimulusFixation + config.timing.feedback)) +
        (total_main_mini_blocks * config.timing.cue)
      ) / 1000;
      const totalExperimentMinutes = Math.round(totalExperimentTimeSeconds / 60);

      const phaseText =
        (phaseLabel === 'phase1' || phaseLabel === 'phase1_dup') ? 'first phase' : 'second phase';

      return `
        <p><strong>Congratulations!</strong></p>
        <p>Let's move on to the ${phaseText} of the task.</p>
        <p>As a reminder, your goal is to be as <strong>accurate</strong> and <strong>fast</strong> as possible, while trying to score the <strong>maximum number of points</strong>.</p>
        <p>Please <strong>silence your phone</strong> and remove any nearby distractions to stay fully focused.</p>
        <p>The task will last approximately <strong>${totalExperimentMinutes} minutes</strong>.</p>
        <p>Click below to be reminded of the instructions.</p>
      `;
    },
    choices: ['See instructions again'],
    data: { task: `practice_successful_completion_${phaseLabel}` }
  };
}

function makeInstructionReminder(activeMappings, phaseLabel) {
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
      const mkLine = (m) => {
        const groupKey = m.stimulus_group_key;
        const color    = m.html_color;
        const goType   = config.stimulus_groups_config[groupKey].go.replace("_", " ");
        const noType   = config.stimulus_groups_config[groupKey].nogo.replace("_", " ");
        const rewardDesc = buildRewardDescription(m);

        return `
          <div style="margin:10px 0; color:${color};">
            ■ Press on ${goType}, but not ${noType} (${groupKey})
            <br><span style="color:inherit;">${rewardDesc}</span>
          </div>
        `;
      };

      const lines = activeMappings.map(mkLine).join('');
      return `
        ${lines}
        <p>Click below to begin the main task.</p>
      `;
    },
    choices: ['Start the task'],
    data: { task: `instruction_reminder_${phaseLabel}` }
  };
}


// ======================================================================
// INITIAL INSTRUCTIONS — BLOCK 1
// ======================================================================
const initial_instructions = {
  type: jsPsychInstructions,
  pages: [
    function() {
      return `
        <p><strong>Welcome!</strong></p>
        <p>This study consists of 2 main blocks with a short break between each block.</p>
        <p>Each block has 2 phases, so you will be doing 4 phases in total.</p>
        <p>In each phase, you will do a <strong>concentration task</strong> involving <strong>numbers</strong> and <strong>letters</strong>.</p>
      `;
    },
    function() {
      return `
        <p>In this study, your goal is to be as <strong>accurate</strong> and <strong>fast</strong> as possible, while trying to score the <strong>maximum number of points</strong>.</p>
        <p>Click Next to see what the task looks like:</p>
      `;
    },
    function() {
      const neutralColor = mappingNeutral.html_color;
      return `
        <p>Every few trials you will see a colored square like this one. Its meaning will be explained shortly.</p>
        <div style="width: 150px; height: 150px; background-color: ${neutralColor}; margin: 0 auto; border-radius: 15px;"></div>
      `;
    },
    function() {
      const mappingA = active_condition_mappings_phase1[0];
      const mappingB = active_condition_mappings_phase1[1];
      const group1 = config.stimulus_groups_config[mappingA.stimulus_group_key];
      const group2 = config.stimulus_groups_config[mappingB.stimulus_group_key];
      const image1 = group1.paths[0];
      const image2 = group2.paths[0];

      return `
        <p>You will then see several trials like this, with two images. You will be given instructions in a moment about how to respond to these trials.</p>
        <div style="display:flex; justify-content:center; align-items:center;"> 
          <img src="${image1}" style="height: clamp(100px, 18vh, 150px); max-width: 18vw; object-fit: contain; margin:5px;">
          <span style="font-size: clamp(28px, 3.5vw, 44px); padding: 0 clamp(15px, 3vw, 30px); color:white;">&#9679;</span>
          <img src="${image2}" style="height: clamp(100px, 18vh, 150px); max-width: 18vw; object-fit: contain; margin:5px;">
        </div>
      `;
    },
    function(){
      const A = active_condition_mappings_phase1[0]; // neutral
      const B = active_condition_mappings_phase1[1]; // rewarded (positive or penalty)
      const A_det = { color: A.html_color, group: A.stimulus_group_key };
      const B_det = { color: B.html_color, group: B.stimulus_group_key };

      const performOutcomeLine =
        B.reward_type_key === 'positive'
          ? `<p>You will <strong>earn extra points</strong> if you perform well in the <span style="color: ${B_det.color}">${B_det.group}</span> task.</p>`
          : `<p>You will <strong>lose extra points</strong> if you perform poorly in the <span style="color: ${B_det.color}">${B_det.group}</span> task.</p>`;

      return `
        <p>You will be shown a <strong>colored cue</strong>, followed by images of <strong>${A_det.group}</strong> or <strong>${B_det.group}</strong>.</p>
        <p>You will need to focus on <span style="color: ${A_det.color}">${A_det.group}</span> or <span style="color: ${B_det.color}">${B_det.group}</span> depending on the <strong>color of the cue</strong>.</p>
        ${performOutcomeLine}
        <p>You will <strong>neither earn nor lose</strong> any points in the <span style="color: ${A_det.color}">${A_det.group}</span> task.</p>
        <p>Click Next to learn how to perform each task:</p>
      `;
    },

    ...active_condition_mappings_phase1.map(mapping => function() {
      const group = config.stimulus_groups_config[mapping.stimulus_group_key];
      const goType  = group.go.replace("_", " ");
      const noGoType = group.nogo.replace("_", " ");
      const goMissPenaltyAmount = config.goMissPenaltyAmount.toFixed(2);

      // Show 4 examples per category — first 4 images, which are the 4
      // different digits/letters (the source layout is: digits A B C D
      // first, then alternate fonts; not "4 fonts of same digit"
      // sequentially as I'd previously assumed).
      const _imgRowStyle = 'display:flex; flex-wrap:nowrap; justify-content:center; max-width:90vw; gap:8px; margin:10px auto;';
      const _imgStyle = 'height: 24px !important; width: auto !important; max-height: 24px !important; flex: 0 0 auto; object-fit: contain; border: 1px solid #555; border-radius: 4px;';
      const _pickFirst4 = (arr) => arr.slice(0, 4);
      const goImagesHtml = '<div style="' + _imgRowStyle + '">'
        + _pickFirst4(group.paths.filter(p => p.includes(group.go)))
            .map(p => `<img src="${p}" style="${_imgStyle}">`).join('')
        + '</div>';
      const noGoImagesHtml = '<div style="' + _imgRowStyle + '">'
        + _pickFirst4(group.paths.filter(p => p.includes(group.nogo)))
            .map(p => `<img src="${p}" style="${_imgStyle}">`).join('')
        + '</div>';

      let rewardDesc = '';
      switch (mapping.reward_type_key) {
        case 'positive':
          rewardDesc = `
            If you forget to press the space bar on ${goType}s, you will lose <span style="color: red; font-weight: bold;">${goMissPenaltyAmount} points</span>.<br>
            If you correctly don't press the space bar on ${noGoType}s, you will earn <span style="color: green; font-weight: bold;">${config.defaultRewardAmount.toFixed(2)} points</span>.`;
          break;
        case 'penalty':
          rewardDesc = `
            If you forget to press the space bar on ${goType}s, you will lose <span style="color: red; font-weight: bold;">${goMissPenaltyAmount} points</span>.<br>
            If you press the space bar on ${noGoType}s, you will lose <span style="color: red; font-weight: bold;">${config.defaultRewardAmount.toFixed(2)} points</span>.`;
          break;
        case 'neutral':
          rewardDesc = `You will <strong>not earn or lose</strong> any points in these trials.`;
          break;
      }

      return `
        <div>
          <p>Every time the cue is <span style="color: ${mapping.html_color}">${mapping.color_name}</span>, you must focus on the <strong>${mapping.stimulus_group_key}</strong>.</p>
          <p>Press the <strong>space bar</strong> when you see <strong>${goType}s</strong>.</p>
          <div>${goImagesHtml}</div>
          <p>Do <strong>not</strong> press the space bar for <strong>${noGoType}s</strong>.</p>
          <div>${noGoImagesHtml}</div>
          <p>${rewardDesc}</p>
        </div>
      `;
    }),
  ],
  show_clickable_nav: true,
  allow_backward: true,
  button_label_next: 'Next',
  button_label_previous: 'Back',
  data: { task: 'initial_instructions_phase1' }
};


// ======================================================================
// INITIAL INSTRUCTIONS — BLOCK 2
// ======================================================================
const initial_instructions_p2 = {
  type: jsPsychInstructions,
  pages: [
    function () {
      return `
        <p><strong>Block 2</strong></p>
        <p>Take a 2 minute break if you need.</p>
        <p>In the next phase, you will use the <strong>same number and letter task</strong> as before.</p>
        <p>Please read the <strong>new set of instructions.</strong></p>
      `;
    },
    function () {
      const neutralColor = mappingNeutral.html_color;
      return `
        <p>As before, a colored cue appears before a short sequence of trials. The cue color tells you which category to focus on.</p>
        <div style="width: 150px; height: 150px; background-color: ${neutralColor}; margin: 0 auto; border-radius: 15px;"></div>
      `;
    },
    function () {
      const mappingA = active_condition_mappings_phase2[0];
      const mappingB = active_condition_mappings_phase2[1];
      const group1 = config.stimulus_groups_config[mappingA.stimulus_group_key];
      const group2 = config.stimulus_groups_config[mappingB.stimulus_group_key];
      const image1 = group1.paths[0];
      const image2 = group2.paths[0];

      return `
        <p>You will then see several trials like this, with two images.</p>
        <div style="display:flex; justify-content:center; align-items:center;">
          <img src="${image1}" style="height: clamp(100px, 18vh, 150px); max-width: 18vw; object-fit: contain; margin:5px;">
          <span style="font-size: clamp(28px, 3.5vw, 44px); padding: 0 clamp(15px, 3vw, 30px); color:white;">&#9679;</span>
          <img src="${image2}" style="height: clamp(100px, 18vh, 150px); max-width: 18vw; object-fit: contain; margin:5px;">
        </div>
      `;
    },
    function () {
      const A = active_condition_mappings_phase2[0]; // neutral
      const B = active_condition_mappings_phase2[1]; // rewarded (opposite valence of Block 1)
      const A_det = { color: A.html_color, group: A.stimulus_group_key };
      const B_det = { color: B.html_color, group: B.stimulus_group_key };

      const performOutcomeLine =
        B.reward_type_key === 'positive'
          ? `<p>You will <strong>earn extra reward</strong> if you perform well in the <span style="color: ${B_det.color}">${B_det.group}</span> task.</p>`
          : `<p>You will <strong>lose extra reward</strong> if you perform poorly in the <span style="color: ${B_det.color}">${B_det.group}</span> task.</p>`;

      return `
        <p>You will need to focus on <span style="color: ${A_det.color}">${A_det.group}</span> or <span style="color: ${B_det.color}">${B_det.group}</span> depending on the <strong>color of the cue</strong>.</p>
        ${performOutcomeLine}
        <p>You will neither earn nor lose points in the <span style="color: ${A_det.color}">${A_det.group}</span> task.</p>
        <p>Click Next to learn the responses.</p>
      `;
    },

    ...active_condition_mappings_phase2.map(mapping => function () {
      const group = config.stimulus_groups_config[mapping.stimulus_group_key];
      const goType  = group.go.replace("_", " ");
      const noGoType = group.nogo.replace("_", " ");
      const goMissPenaltyAmount = config.goMissPenaltyAmount.toFixed(2);

      // Show 4 examples per category — first 4 images, which are the 4
      // different digits/letters (the source layout is: digits A B C D
      // first, then alternate fonts; not "4 fonts of same digit"
      // sequentially as I'd previously assumed).
      const _imgRowStyle = 'display:flex; flex-wrap:nowrap; justify-content:center; max-width:90vw; gap:8px; margin:10px auto;';
      const _imgStyle = 'height: 24px !important; width: auto !important; max-height: 24px !important; flex: 0 0 auto; object-fit: contain; border: 1px solid #555; border-radius: 4px;';
      const _pickFirst4 = (arr) => arr.slice(0, 4);
      const goImagesHtml = '<div style="' + _imgRowStyle + '">'
        + _pickFirst4(group.paths.filter(p => p.includes(group.go)))
            .map(p => `<img src="${p}" style="${_imgStyle}">`).join('')
        + '</div>';
      const noGoImagesHtml = '<div style="' + _imgRowStyle + '">'
        + _pickFirst4(group.paths.filter(p => p.includes(group.nogo)))
            .map(p => `<img src="${p}" style="${_imgStyle}">`).join('')
        + '</div>';

      let rewardDesc = '';
      switch (mapping.reward_type_key) {
        case 'positive':
          rewardDesc = `
            If you forget to press the space bar on ${goType}s, you will lose <span style="color: red; font-weight: bold;">${goMissPenaltyAmount} points</span>.<br>
            If you correctly don't press the space bar on ${noGoType}s, you will earn <span style="color: green; font-weight: bold;">${config.defaultRewardAmount.toFixed(2)} points</span>.`;
          break;
        case 'penalty':
          rewardDesc = `
            If you forget to press the space bar on ${goType}s, you will lose <span style="color: red; font-weight: bold;">${goMissPenaltyAmount} points</span>.<br>
            If you press the space bar on ${noGoType}s, you will lose <span style="color: red; font-weight: bold;">${config.defaultRewardAmount.toFixed(2)} points</span>.`;
          break;
        case 'neutral':
          rewardDesc = `You will <strong>not earn or lose</strong> any points in these trials.`;
          break;
      }

      return `
        <div>
          <p>Every time the cue is <span style="color: ${mapping.html_color}">${mapping.color_name}</span>, focus on <strong>${mapping.stimulus_group_key}</strong>.</p>
          <p>Press the <strong>space bar</strong> for <strong>${goType}s</strong>.</p>
          <div>${goImagesHtml}</div>
          <p>Do <strong>not</strong> press for <strong>${noGoType}s</strong>.</p>
          <div>${noGoImagesHtml}</div>
          <p>${rewardDesc}</p>
        </div>
      `;
    }),
  ],
  show_clickable_nav: true,
  allow_backward: true,
  button_label_next: 'Next',
  button_label_previous: 'Back',
  data: { task: 'initial_instructions_phase2' }
};


// ======================================================================
// PRELOAD
// ======================================================================
const preload = {
  type: jsPsychPreload,
  message: 'Loading',
  images: function(){ return preloadArray; },
  max_load_time: 1200000,
  show_detailed_errors: true,
  continue_after_error: true,
};


// ======================================================================
// PRACTICE TIMELINE BUILDER (with cues) — parameterized by phase
// ======================================================================
function buildPracticeWithCues(practice_trials_data, phaseLabel) {
  const activeMappings = getActiveMappingsForPhaseLabel(phaseLabel);

  // Practice attempt counter (so retries re-calculate from scratch)
  let practiceAttempt = 1;
  const getAttempt = () => practiceAttempt;

  const practice_intro_instructions = makePracticeIntro(activeMappings, phaseLabel);
  const practice_accuracy_check = makePracticeAccuracyCheck(phaseLabel, getAttempt);
  const practice_repeat_message = makePracticeRepeatMessage(phaseLabel);

  // time estimate only (does not affect scoring)
  const phaseObjForTime =
    (phaseLabel === 'phase1' || phaseLabel === 'phase1_dup') ? PHASE1 : PHASE2;

  const practice_successful_completion = makePracticeSuccessfulCompletion(
    phaseLabel,
    phaseObjForTime.total_main_mini_blocks,
    phaseObjForTime.all_experiment_trials
  );

  const inner = [practice_intro_instructions];

  // find last practice miniblock index
  const practiceMiniBlockIndices = practice_trials_data.map(t => t.mini_block_index);
  const lastPracticeMiniBlockIndex = Math.max(...practiceMiniBlockIndices);

  for (let i = 0; i < practice_trials_data.length; i++) {
    const d = practice_trials_data[i];

    if (i % config.trialsPerMiniBlock === 0) {
      // Color cue at the start of each mini-block
      inner.push({ timeline: [mini_cue_square], timeline_variables: [{ current_trial_data: d }] });

      // 4-second fixation after the color cue and before the FIRST stimulus of this mini-block
      inner.push({ timeline: [fixation_after_cue], timeline_variables: [{ current_trial_data: d }] });
    }

    inner.push({
      timeline: [
        fixation,
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: function(){
            const t = jsPsych.timelineVariable('current_trial_data');
            const [image1, image2] = (t.randomVariable === 0) ? [t.Target, t.Lure] : [t.Lure, t.Target];
            return `
              <div id="stim-container-practice" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display:flex; justify-content:center; align-items:center; height: clamp(100px, 18vh, 150px); max-width: 90vw;">
                <img src="${image1}" style="height: 100%; max-width: 18vw; width: auto; object-fit: contain; margin:5px">
                <span style="font-size: clamp(28px, 3.5vw, 44px); padding: 0 clamp(15px, 3vw, 30px); color:white; line-height:1;">&#9679;</span>
                <img src="${image2}" style="height: 100%; max-width: 18vw; width: auto; object-fit: contain; margin:5px">
              </div>`;
          },
          response_type: 'key',
          response_ends_trial: false,
          choices: [' '],
          trial_duration: function() {
            return config.timing.stimulus + config.timing.postStimulusFixation;
          },
          css_classes: ['hide_cursor', 'stimulus_size'],
          data: function() {
            const t = jsPsych.timelineVariable('current_trial_data');
            return {
              Target: t.Target, Type: t.Type, GoNoGoType: t.GoNoGoType,
              Lure: t.Lure, LureCategory: t.LureCategory, Frequent: t.Frequent,
              task: 'switchCPT', blockType: 'practice', isReminder: t.isReminderOrControl,
              randomVariable: t.randomVariable,
              current_reward_type: t.current_reward_type,
              current_stimulus_focus_group: t.current_stimulus_focus_group,
              current_cue_color_html: t.current_cue_color_html,
              mini_block_index: t.mini_block_index,
              trial_index_in_mini_block: t.trial_index_in_mini_block,
              practice_phase: t.practice_phase,
              practice_attempt: getAttempt()
            };
          },
          on_load: function() {
            // Qualtrics chrome (e.g. hidden Next button) can hold keyboard
            // focus and swallow Space. Drop focus so jsPsych's listener wins.
            try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
            try { window.focus(); } catch (e) {}
            // Mark trial start for capture-phase recovery.
            window.__scpt_trialStart = performance.now();
            // Per-trial capture-phase listener (extra failsafe — fires even if
            // global listener somehow gets unbound by Qualtrics page navigation).
            window.__scpt_perTrialSpaceTime = null;
            window.__scpt_perTrialHandler = function(e) {
              if (window.__scpt_perTrialSpaceTime !== null) return;
              if (e.key === ' ' || e.code === 'Space' || e.keyCode === 32) {
                window.__scpt_perTrialSpaceTime = performance.now();
              }
            };
            document.addEventListener('keydown', window.__scpt_perTrialHandler, true);
            jsPsych.pluginAPI.setTimeout(() => {
              const container = document.getElementById('stim-container-practice');
              if (container) {
                container.innerHTML = '<span style="font-size:60px; color:white; line-height:1;">&#9679;</span>';
                // Layout already flex 300px from initial render; keep it.
              }
            }, config.timing.stimulus);
          },
          on_finish: function(data) {
            // Remove per-trial listener.
            try { document.removeEventListener('keydown', window.__scpt_perTrialHandler, true); } catch (e) {}

            // Recover Space if jsPsych's listener missed it. Prefer per-trial
            // listener (most reliable, fresh for this trial), fall back to
            // global capture log.
            if (data.response === null && window.__scpt_perTrialSpaceTime !== null) {
              data.response = ' ';
              data.rt = window.__scpt_perTrialSpaceTime - window.__scpt_trialStart;
              data.recovered_from_capture = 'per-trial';
            } else if (data.response === null && Array.isArray(window.__scpt_spaceLog)) {
              const trialStart = window.__scpt_trialStart || (performance.now() - 2000);
              const trialEnd = performance.now();
              const presses = window.__scpt_spaceLog.filter(t => t >= trialStart && t <= trialEnd);
              if (presses.length > 0) {
                data.response = ' ';
                data.rt = presses[0] - trialStart;
                data.recovered_from_capture = 'global';
              }
            }

            data.correct_response = data.Frequent ? ' ' : null;
            data.correct = (data.response === data.correct_response);
            data.time = (new Date()).getTime();
            if (data.response === ' ') data.response_type = data.Frequent ? 'hit' : 'fa';
            else data.response_type = data.Frequent ? 'miss' : 'cr';
            console.log('[scpt practice trial]',
              'phase=' + phaseLabel,
              'attempt=' + getAttempt(),
              'mb=' + data.mini_block_index,
              'k=' + data.trial_index_in_mini_block,
              'GoNoGo=' + data.GoNoGoType,
              'Frequent=' + data.Frequent,
              'rType=' + data.current_reward_type,
              'response=' + JSON.stringify(data.response),
              'rt=' + data.rt,
              (data.recovered_from_capture ? '[RECOVERED]' : ''),
              '→ ' + data.response_type);
          }
        },
        {
          type: jsPsychHtmlKeyboardResponse,
          stimulus: _DOT_HTML_300,
          on_finish: function(data){
            const last = jsPsych.data.get().filter({
              blockType: 'practice',
              task: 'switchCPT',
              practice_phase: phaseLabel,
              practice_attempt: getAttempt()
            }).last().values()[0] || {};

            const prevType = last.response_type || null;
            const isGo = last.Frequent || false;
            const rType = last.current_reward_type || null;

            const id = jsPsych.data.get().filter({task: 'id'}).values()[0] || {};
            const reward_value = id.reward_value || config.defaultRewardAmount;
            const go_miss_penalty = id.go_miss_penalty || config.goMissPenaltyAmount;

            let trial_reward = 0;

            // match main rules: neutral trials never apply go-miss penalty
            if (rType !== 'neutral' && isGo && prevType === 'miss') { trial_reward = -go_miss_penalty; }
            else if (!isGo) {
              if (rType === 'positive' && prevType === 'cr') trial_reward = reward_value;
              else if (rType === 'penalty' && prevType === 'fa') trial_reward = -reward_value;
            }

            data.reward = trial_reward;
            data.blockType = 'practice-feedback';
            data.current_reward_type = rType;
            data.current_stimulus_focus_group = last.current_stimulus_focus_group || 'unknown';
            data.practice_phase = phaseLabel;
            data.practice_attempt = getAttempt();
            console.log('[scpt practice fb] ',
              'phase=' + phaseLabel,
              'attempt=' + getAttempt(),
              'isGo=' + isGo,
              'prevType=' + prevType,
              'rType=' + rType,
              'reward=' + trial_reward);
          },
          css_classes: ['hide_cursor','stimulus_size'],
          choices: 'NO_KEYS',
          trial_duration: config.timing.feedback,
        }
      ],
      timeline_variables: [{ current_trial_data: d }]
    });

    // After the LAST trial of a miniblock (but not the last miniblock of practice),
    // show the miniblock score screen
    const isLastTrialInMiniBlock = ((i + 1) % config.trialsPerMiniBlock === 0);
    const isLastPracticeMiniBlock = d.mini_block_index === lastPracticeMiniBlockIndex;

    if (isLastTrialInMiniBlock && !isLastPracticeMiniBlock) {
      inner.push({
        timeline: [mini_block_score_screen],
        timeline_variables: [{ current_trial_data: d, practice_attempt: getAttempt() }]
      });
    }
  }

  inner.push(practice_accuracy_check);

  inner.push({
    timeline: [practice_repeat_message],
    conditional_function: function(){
      const last = jsPsych.data.get().filter({task: `practice_accuracy_check_${phaseLabel}`}).last().values()[0];
      return !last[`accuracy_met_${phaseLabel}`];
    }
  });

  inner.push({
    timeline: [practice_successful_completion],
    conditional_function: function(){
      const last = jsPsych.data.get().filter({task: `practice_accuracy_check_${phaseLabel}`}).last().values()[0];
      return last[`accuracy_met_${phaseLabel}`];
    }
  });

  return {
    timeline: inner,
    loop_function: function() {
      const last = jsPsych.data.get().filter({task: `practice_accuracy_check_${phaseLabel}`}).last().values()[0];
      if (!last[`accuracy_met_${phaseLabel}`]) {
        jsPsych.data.get().filter({blockType: 'practice', practice_phase: phaseLabel}).ignore();
        jsPsych.data.get().filter({blockType: 'practice-feedback', practice_phase: phaseLabel}).ignore();

        // Increment attempt so next run is calculated from scratch
        practiceAttempt += 1;

        return true;
      }
      return false;
    },
    data: { task: `practice_loop_container_${phaseLabel}` }
  };
}



// ======================================================================
// REWARD TOTAL & END
// ======================================================================
const display_reward_total = {
  type: jsPsychHtmlButtonResponse,
  stimulus: function() {
    const fb = jsPsych.data.get().filter({blockType: 'main-experiment-task-feedback'}).values();
    let totalReward = 0;
    fb.forEach(t => { if (typeof t.reward === 'number') totalReward += t.reward; });
    const formattedTotal = totalReward.toFixed(2);
    return `
      <div style="text-align: center; color: white;">
        <p style="font-size: 28px;">Final Total</p>
        <p style="font-size: 48px; font-weight: bold;">${formattedTotal} points</p>
        <p style="font-size: 22px; margin-top: 30px;">Click 'Continue' to continue.</p>
      </div>
    `;
  },
  choices: ['Continue'],
  data: { task: 'reward_total_display', display_type: 'final_total' }
};

// End screen — button click triggers initJsPsych on_finish (writes embedded data + clicks Qualtrics next)
const end = {
  type: jsPsychHtmlButtonResponse,
  stimulus: '<div style="font-size: 22px; text-align: center;">'
          +    '<p>You have now completed this part of the study. Thank you for your participation!</p>'
          +    '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>'
          + '</div>',
  choices: ['Finish and submit'],
  button_html: '<button class="scpt-default-button">%choice%</button>'
};


// ======================================================================
// MAIN TIMELINE
// ======================================================================
const instruction_reminder_phase1 = makeInstructionReminder(active_condition_mappings_phase1, 'phase1');
const instruction_reminder_phase2 = makeInstructionReminder(active_condition_mappings_phase2, 'phase2');
const instruction_reminder_phase1_dup = makeInstructionReminder(active_condition_mappings_phase1, 'phase1_dup');
const instruction_reminder_phase2_dup = makeInstructionReminder(active_condition_mappings_phase2, 'phase2_dup');

// Phase-total screens (phase-specific only)
const phase1_total_screen      = makePhaseTotalScreen('phase1',      'Block 1 – Phase 1');
const phase1_dup_total_screen  = makePhaseTotalScreen('phase1_dup',  'Block 1 – Phase 2');
const phase2_total_screen      = makePhaseTotalScreen('phase2',      'Block 2 – Phase 1');
const phase2_dup_total_screen  = makePhaseTotalScreen('phase2_dup',  'Block 2 – Phase 2');

// Drop fullscreen / consent / prolific_id / demographics — handled by Qualtrics.
const timeline_order = [
  preload,

  // Block 1 — Phase 1
  initial_instructions,
  buildPracticeWithCues(PHASE1.practice_trials_data, 'phase1'),
  instruction_reminder_phase1,
];

// Block 1 – Phase 1 main trials
PHASE1.all_experiment_trials.forEach((d, i) => {
  if (i % config.trialsPerMiniBlock === 0) {
    // Color cue at the start of each mini-block
    timeline_order.push({ timeline: [mini_cue_square], timeline_variables: [{ current_trial_data: d }] });

    // 4-second fixation after cue and before FIRST stimulus in this mini-block
    timeline_order.push({ timeline: [fixation_after_cue], timeline_variables: [{ current_trial_data: d }] });
  }

  timeline_order.push({ timeline: [fixation, horizontal_task, feedback], timeline_variables: [{ current_trial_data: d }] });

  // After last trial of miniblock (but not last miniblock in this phase), show miniblock score
  const isLastTrialInMiniBlock = ((i + 1) % config.trialsPerMiniBlock === 0);
  const isLastMiniBlockPhase1 = d.mini_block_index === (PHASE1.total_main_mini_blocks - 1);

  if (isLastTrialInMiniBlock && !isLastMiniBlockPhase1) {
    timeline_order.push({
      timeline: [mini_block_score_screen],
      timeline_variables: [{ current_trial_data: d }]
    });
  }
});

// End of Block 1 – Phase 1 total (points + accuracy + RT)
timeline_order.push(phase1_total_screen);

// Transition to Block 1 – Phase 2 (Phase 1_DUP)
timeline_order.push(makeBetweenPhaseBreak(1));
timeline_order.push(instruction_reminder_phase1_dup);

// Block 1 — Phase 2 (Phase 1_DUP)
PHASE1_DUP.all_experiment_trials.forEach((d, i) => {
  if (i % config.trialsPerMiniBlock === 0) {
    timeline_order.push({ timeline: [mini_cue_square], timeline_variables: [{ current_trial_data: d }] });
    timeline_order.push({ timeline: [fixation_after_cue], timeline_variables: [{ current_trial_data: d }] });
  }

  timeline_order.push({ timeline: [fixation, horizontal_task, feedback], timeline_variables: [{ current_trial_data: d }] });

  const isLastTrialInMiniBlock = ((i + 1) % config.trialsPerMiniBlock === 0);
  const isLastMiniBlockPhase1Dup = d.mini_block_index === (PHASE1_DUP.total_main_mini_blocks - 1);

  if (isLastTrialInMiniBlock && !isLastMiniBlockPhase1Dup) {
    timeline_order.push({
      timeline: [mini_block_score_screen],
      timeline_variables: [{ current_trial_data: d }]
    });
  }
});

// End of Block 1 – Phase 2 total
timeline_order.push(phase1_dup_total_screen);

// Block 2 — Phase 1
timeline_order.push(
  initial_instructions_p2,
  buildPracticeWithCues(PHASE2.practice_trials_data, 'phase2'),
  instruction_reminder_phase2
);

// Block 2 – Phase 1 main trials
PHASE2.all_experiment_trials.forEach((d, i) => {
  if (i % config.trialsPerMiniBlock === 0) {
    timeline_order.push({ timeline: [mini_cue_square], timeline_variables: [{ current_trial_data: d }] });
    timeline_order.push({ timeline: [fixation_after_cue], timeline_variables: [{ current_trial_data: d }] });
  }

  timeline_order.push({ timeline: [fixation, horizontal_task, feedback], timeline_variables: [{ current_trial_data: d }] });

  const isLastTrialInMiniBlock = ((i + 1) % config.trialsPerMiniBlock === 0);
  const isLastMiniBlockPhase2 = d.mini_block_index === (PHASE2.total_main_mini_blocks - 1);

  if (isLastTrialInMiniBlock && !isLastMiniBlockPhase2) {
    timeline_order.push({
      timeline: [mini_block_score_screen],
      timeline_variables: [{ current_trial_data: d }]
    });
  }
});

// End of Block 2 – Phase 1 total
timeline_order.push(phase2_total_screen);

// Transition to Block 2 – Phase 2 (Phase 2_DUP)
timeline_order.push(makeBetweenPhaseBreak(2));
timeline_order.push(instruction_reminder_phase2_dup);

// Block 2 — Phase 2 (Phase 2_DUP)
PHASE2_DUP.all_experiment_trials.forEach((d, i) => {
  if (i % config.trialsPerMiniBlock === 0) {
    timeline_order.push({ timeline: [mini_cue_square], timeline_variables: [{ current_trial_data: d }] });
    timeline_order.push({ timeline: [fixation_after_cue], timeline_variables: [{ current_trial_data: d }] });
  }

  timeline_order.push({ timeline: [fixation, horizontal_task, feedback], timeline_variables: [{ current_trial_data: d }] });

  const isLastTrialInMiniBlock = ((i + 1) % config.trialsPerMiniBlock === 0);
  const isLastMiniBlockPhase2Dup = d.mini_block_index === (PHASE2_DUP.total_main_mini_blocks - 1);

  if (isLastTrialInMiniBlock && !isLastMiniBlockPhase2Dup) {
    timeline_order.push({
      timeline: [mini_block_score_screen],
      timeline_variables: [{ current_trial_data: d }]
    });
  }
});

// End of Block 2 – Phase 2 total
timeline_order.push(phase2_dup_total_screen);

// Final end screen
timeline_order.push(end);

jsPsych.run(timeline_order);

} // end initExp