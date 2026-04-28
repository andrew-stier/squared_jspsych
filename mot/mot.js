/////////////////////////////////////////
// MULTIPLE OBJECT TRACKING (jsPsych v7 port of TMB MOT)
/////////////////////////////////////////
// Adapted from Test My Brain (Many Brains Project, McLean Hospital), LGPLv3.
// Source: https://github.com/manybrainsproject/TestMyBrainCodeRepo
//
// Test design (matches the standard TMB protocol):
//   - 10 black dots on a 500×500 px canvas
//   - 3 blocks of 6 trials each: 3 / 4 / 5 targets
//   - Within each block, dot speed increases: 1, 2, 3, 4, 5, 6 px/frame at 60 Hz
//   - On each trial: targets flash 5× (100 ms on/off) before motion starts
//   - 5 s of random-walk motion with collision avoidance and elastic walls
//   - Participant clicks dots to identify which were the targets
//   - Score = total target hits across 18 trials (max = 6×(3+4+5) = 72)
//
// Implementation: pure HTML5 canvas (no Snap.svg). Trajectory is computed
// frame-by-frame (rAF) rather than pre-computed; collision avoidance done
// online via lookahead.

var jsPsych = initJsPsych({});

// ---------- params ----------
var MOT_NUM_CIRCLES   = 10;
var MOT_RADIUS        = 15;
var MOT_REPULSION     = 4;            // multiples of radius
var MOT_NOISE_DEG     = 15;           // direction noise
var MOT_DURATION_MS   = 5000;         // motion duration per trial
var MOT_FLASH_CYCLES  = 5;
var MOT_FLASH_MS      = 100;
var MOT_PRE_HIDE_MS   = 1500;
var MOT_RESPONSE_TIMEOUT_MS = 15000;
var MOT_CANVAS_SIZE   = 500;

// Variant selector. Affects only test_trials assembly + summary display.
//   'ema_2x' : 12 trials, set size 5, speeds 2..7 each twice, randomized.   ← default for the city-size study
//   'ema'    : 6 trials, set size 5, speeds 2..7 (TMB EMA standard).
//   'full'   : 18 trials, set sizes 3/4/5, speeds 1..6 each (TMB lab standard).
var MOT_VARIANT = 'ema_2x';

// Per-variant trial schedule. Each entry is { n_targets, speed }.
function buildTestSchedule(variant) {
    var sched = [];
    if (variant === 'full') {
        [3, 4, 5].forEach(function (n) {
            [1, 2, 3, 4, 5, 6].forEach(function (s) { sched.push({n_targets: n, speed: s}); });
        });
    } else if (variant === 'ema') {
        [2, 3, 4, 5, 6, 7].forEach(function (s) { sched.push({n_targets: 5, speed: s}); });
    } else if (variant === 'ema_2x') {
        var speeds = [2, 3, 4, 5, 6, 7];
        speeds.forEach(function (s) { sched.push({n_targets: 5, speed: s}); });
        speeds.forEach(function (s) { sched.push({n_targets: 5, speed: s}); });
        // shuffle so the two replications are interleaved
        for (var i = sched.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = sched[i]; sched[i] = sched[j]; sched[j] = t;
        }
    }
    return sched;
}

// Participant ID (standalone version)
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

// ---------- core engine ----------
function MOTEngine(canvas, options) {
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var R = MOT_RADIUS;
    var REP = MOT_REPULSION * R;
    var NOISE = MOT_NOISE_DEG * Math.PI / 180;
    var SPEED = options.speed;
    var N_TARGETS = options.n_targets;
    var DURATION = options.duration_ms;
    var ON_END = options.on_end;
    var IS_PRACTICE = options.is_practice || false;
    var promptDiv = options.promptDiv;
    var statusDiv = options.statusDiv;

    var circles = [];     // {x, y, dir, isTarget, hit, wrong}
    var motion_t0 = 0;
    var rt_t0 = 0;
    var clicks = 0;
    var target_hits = 0;
    var responseTimer = null;
    var animationId = null;
    var done = false;

    // ---- init random non-overlapping positions ----
    function init() {
        circles = [];
        for (var i = 0; i < MOT_NUM_CIRCLES; i++) {
            var ok = false, attempts = 0;
            var x, y;
            while (!ok && attempts < 1000) {
                attempts++;
                x = R + Math.random() * (W - 2 * R);
                y = R + Math.random() * (H - 2 * R);
                ok = true;
                for (var j = 0; j < circles.length; j++) {
                    var dx = x - circles[j].x, dy = y - circles[j].y;
                    if (dx * dx + dy * dy < (5 * R) * (5 * R)) { ok = false; break; }
                }
            }
            circles.push({
                x: x, y: y,
                dir: Math.random() * 2 * Math.PI,
                isTarget: i < N_TARGETS,
                hit: false, wrong: false
            });
        }
    }

    function draw(targetsVisible) {
        ctx.clearRect(0, 0, W, H);
        for (var i = 0; i < circles.length; i++) {
            var c = circles[i];
            // body
            ctx.beginPath();
            ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
            ctx.fillStyle = 'black';
            ctx.fill();
            // border for hits/wrongs/flash
            if (c.hit) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#22c55e';
                ctx.stroke();
            } else if (c.wrong) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#ef4444';
                ctx.stroke();
            } else if (targetsVisible && c.isTarget) {
                ctx.lineWidth = 5;
                ctx.strokeStyle = '#22c55e';
                ctx.stroke();
            }
        }
    }

    // ---- update one motion frame, scaled by elapsed time ----
    // SPEED is interpreted as px-per-frame at the canonical 60 Hz baseline.
    // dt_factor = (dt_ms / 16.667), so 1.0 on 60 Hz, ~0.5 on 120 Hz, ~0.42 on 144 Hz.
    // This keeps real-world speed (px/sec) constant across refresh rates.
    function step(dt_factor) {
        var stepSpeed = SPEED * dt_factor;
        for (var i = 0; i < circles.length; i++) {
            var c = circles[i];
            var newDir = c.dir + (Math.random() * 2 - 1) * NOISE;
            var vx = Math.cos(newDir) * stepSpeed;
            var vy = Math.sin(newDir) * stepSpeed;
            var nx = c.x + vx, ny = c.y + vy;

            // collision avoidance via lookahead
            var sign = Math.random() < 0.5 ? -1 : 1;
            var tries = 0;
            while (tries < 50) {
                var collided = false;
                for (var j = 0; j < circles.length; j++) {
                    if (j === i) continue;
                    var dx = nx - circles[j].x, dy = ny - circles[j].y;
                    if (dx * dx + dy * dy < REP * REP) { collided = true; break; }
                }
                if (!collided) break;
                newDir += sign * 0.05 * Math.PI;
                vx = Math.cos(newDir) * stepSpeed;
                vy = Math.sin(newDir) * stepSpeed;
                nx = c.x + vx;
                ny = c.y + vy;
                tries++;
            }

            // bounce off walls
            if (nx >= W - R || nx <= R) { vx = -vx; nx = c.x + vx; }
            if (ny >= H - R || ny <= R) { vy = -vy; ny = c.y + vy; }

            c.x = nx; c.y = ny;
            c.dir = Math.atan2(vy, vx);
        }
    }

    var lastFrameTime = 0;
    function animationLoop() {
        var nowMs = performance.now();
        var elapsed = nowMs - motion_t0;
        if (elapsed >= DURATION) {
            startResponse();
            return;
        }
        // Compute dt since previous frame; clamp [0, 50ms] to keep big tab-switch
        // pauses from teleporting circles across the canvas.
        var dt_ms = lastFrameTime ? Math.min(50, nowMs - lastFrameTime) : 16.667;
        lastFrameTime = nowMs;
        var dt_factor = dt_ms / 16.667;
        step(dt_factor);
        draw(false);
        animationId = requestAnimationFrame(animationLoop);
    }

    // ---- target flash sequence then motion ----
    function flashAndMove() {
        if (canvas.classList) canvas.classList.add('moving');
        var i = 0;
        function tick() {
            if (i >= MOT_FLASH_CYCLES * 2) {
                draw(false);
                setTimeout(function () {
                    motion_t0 = performance.now();
                    animationId = requestAnimationFrame(animationLoop);
                }, MOT_PRE_HIDE_MS);
                return;
            }
            var visible = (i % 2 === 0);
            draw(visible);
            i++;
            setTimeout(tick, MOT_FLASH_MS);
        }
        tick();
    }

    // ---- response phase ----
    function startResponse() {
        if (canvas.classList) {
            canvas.classList.remove('moving');
            canvas.classList.add('responding');
        }
        rt_t0 = performance.now();
        clicks = 0;
        target_hits = 0;
        if (promptDiv) promptDiv.textContent = IS_PRACTICE
            ? 'Click the ' + N_TARGETS + ' dots that flashed!'
            : 'Click ' + N_TARGETS + ' dots';
        canvas.addEventListener('click', onClick);
        responseTimer = setTimeout(onTimeout, MOT_RESPONSE_TIMEOUT_MS);
    }

    function onClick(e) {
        if (done) return;
        var rect = canvas.getBoundingClientRect();
        // Map page coords to canvas coords (accounts for CSS scaling).
        var cx = (e.clientX - rect.left) * (canvas.width / rect.width);
        var cy = (e.clientY - rect.top)  * (canvas.height / rect.height);

        var closest = -1, dmin = Infinity;
        for (var i = 0; i < circles.length; i++) {
            var c = circles[i];
            if (c.hit || c.wrong) continue;
            var dx = cx - c.x, dy = cy - c.y;
            var d = dx * dx + dy * dy;
            if (d < dmin && d < (R * R * 4)) { dmin = d; closest = i; }
        }
        if (closest < 0) return;

        clicks++;
        var c = circles[closest];
        if (c.isTarget) { c.hit = true; target_hits++; }
        else            { c.wrong = true; }
        draw(false);

        if (clicks >= N_TARGETS) finish('click');
    }

    function onTimeout() { finish('timeout'); }

    function finish(state) {
        if (done) return;
        done = true;
        clearTimeout(responseTimer);
        canvas.removeEventListener('click', onClick);
        var rt = performance.now() - rt_t0;
        if (canvas.classList) canvas.classList.remove('responding');
        if (typeof ON_END === 'function') {
            ON_END({
                state: state,
                hits: target_hits,
                clicks: clicks,
                n_targets: N_TARGETS,
                speed: SPEED,
                rt: Math.round(rt)
            });
        }
    }

    init();
    flashAndMove();
}

// ---------- jsPsych trial wrapper ----------
function makeMotTrial(n_targets, speed, is_practice) {
    return {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div class="mot-stage">'
                + '  <div class="mot-status"><span id="mot-status-left"></span><span id="mot-status-right"></span></div>'
                + '  <canvas id="mot-canvas" class="mot-canvas" width="' + MOT_CANVAS_SIZE + '" height="' + MOT_CANVAS_SIZE + '"></canvas>'
                + '  <div id="mot-prompt" class="mot-prompt"></div>'
                + '</div>',
        choices: "NO_KEYS",
        trial_duration: null,
        data: {
            task: 'mot',
            n_targets: n_targets,
            speed: speed,
            phase: is_practice ? 'practice' : 'test'
        },
        on_load: function () {
            var canvas = document.getElementById('mot-canvas');
            var prompt = document.getElementById('mot-prompt');
            var status = document.getElementById('mot-status-left');
            if (status && !is_practice) status.textContent = 'Trial ' + (window.MOT_TRIAL_COUNT || 1) + ' of ' + (window.MOT_TOTAL_TRIALS || 18);
            new MOTEngine(canvas, {
                n_targets: n_targets,
                speed: speed,
                duration_ms: MOT_DURATION_MS,
                is_practice: is_practice,
                promptDiv: prompt,
                statusDiv: document.getElementById('mot-status-right'),
                on_end: function (result) {
                    setTimeout(function () { jsPsych.finishTrial(result); }, 500);
                }
            });
        },
        on_finish: function (data) {
            // Result props (hits, clicks, n_targets, speed, rt, state) are merged in
            // by jsPsych.finishTrial() because we pass them as the result object.
            data.accuracy = data.n_targets ? data.hits / data.n_targets : null;
            data.timeout = (data.state === 'timeout') ? 1 : 0;
        }
    };
}

// Welcome / instructions
var welcome = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:24pt;"><b>Splitting Your Attention</b></p>'
            + '<p style="font-size:14pt;">Click START to read the instructions.</p>',
    choices: ["START"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Variant-specific setup
var TEST_SCHEDULE = buildTestSchedule(MOT_VARIANT);
window.MOT_TOTAL_TRIALS = TEST_SCHEDULE.length;
window.MOT_TRIAL_COUNT  = 0;

var instructionTrialDescription =
      MOT_VARIANT === 'full' ? 'Three blocks of 6 trials each. Set sizes: 3, 4, then 5 dots. Motion gets faster within each block.'
    : MOT_VARIANT === 'ema'  ? '6 trials with 5 dots flashing. Motion starts slow and gets faster across trials.'
    :                          '12 trials with 5 dots flashing. Motion is mixed slow and fast — just track the flashed dots each trial.';

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="mot-instr">'
            + '<p>You will see <b>10 black dots</b> on the screen.</p>'
            + '<p>Some dots will <b>flash green</b> for a moment — these are your targets.</p>'
            + '<p>All dots then move around together. <b>Keep track of which dots flashed</b>.</p>'
            + '<p>When the dots stop, click on the dots that flashed.</p>'
            + '<p>Correct clicks turn <span style="color:#22c55e; font-weight:700;">green</span>; wrong clicks turn <span style="color:#ef4444; font-weight:700;">red</span>.</p>'
            + '<p>' + instructionTrialDescription + '</p>'
            + '<p>If you lose track, just guess. Your score is the total number of correct dots.</p>'
            + '</div>',
    choices: ["Start practice"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Build practice (2 trials, slow speed, 2 then 3 targets)
var practice_trials = [
    makeMotTrial(2, 0.5, true),
    makeMotTrial(3, 0.5, true)
];

var post_practice = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="mot-instr">'
            + '<p>Practice complete. The main test starts now.</p>'
            + '<p>' + window.MOT_TOTAL_TRIALS + ' trials. Click the dots that flashed when motion stops. Guess if you have to.</p>'
            + '</div>',
    choices: ["Start test"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Build main test trials from the schedule
var test_trials = TEST_SCHEDULE.map(function (entry) {
    var t = makeMotTrial(entry.n_targets, entry.speed, false);
    var orig_on_load = t.on_load;
    t.on_load = function () {
        window.MOT_TRIAL_COUNT = (window.MOT_TRIAL_COUNT || 0) + 1;
        orig_on_load();
    };
    return t;
});

// Block-break message — only used in 'full' variant
function blockBreak(next_n) {
    return {
        type: jsPsychHtmlButtonResponse,
        stimulus: '<div class="mot-instr">'
                + '<p>Excellent! Next block: <b>' + next_n + '</b> dots flash. Speed will start slow and increase.</p>'
                + '</div>',
        choices: ["Continue"],
        button_html: '<button class="mot-default-button">%choice%</button>'
    };
}

// Conclusion
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: function () {
        var d = jsPsych.data.get().filter({task: 'mot', phase: 'test'});
        var values = d.values();
        var total_hits = 0, total_targets = 0;
        for (var i = 0; i < values.length; i++) {
            total_hits += values[i].hits || 0;
            total_targets += values[i].n_targets || 0;
        }
        return '<p style="font-size:22pt;"><b>Test complete</b></p>'
             + '<p style="font-size:16pt;">Total correct dots: <b>' + total_hits + '</b> of ' + total_targets + '</p>'
             + '<p style="font-size:16pt;">Accuracy: <b>' + (total_targets ? Math.round(100 * total_hits / total_targets) : 0) + '%</b></p>'
             + '<p style="font-size:14pt; margin-top:20px;">Click below to finish.</p>';
    },
    choices: ["Finish"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Assemble timeline. Block breaks only relevant in 'full' variant (between set sizes).
var timeline = [];
timeline.push(get_participant_id, welcome, enter_fullscreen, instructions);
timeline = timeline.concat(practice_trials);
timeline.push(post_practice);
for (var i = 0; i < test_trials.length; i++) {
    timeline.push(test_trials[i]);
    if (MOT_VARIANT === 'full') {
        if (i === 5)  timeline.push(blockBreak(4));   // after first 6 (set size 3)
        if (i === 11) timeline.push(blockBreak(5));   // after next 6 (set size 4)
    }
}
timeline.push(conclusion, exit_fullscreen);

jsPsych.run(timeline);
