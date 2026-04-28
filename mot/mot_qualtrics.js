/////////////////////////////////////////
// MULTIPLE OBJECT TRACKING — Qualtrics-loadable build
/////////////////////////////////////////
// Adapted from Test My Brain (Many Brains Project, McLean Hospital), LGPLv3.
// 18-trial test (3 blocks × 6 trials at set sizes 3/4/5, speeds 1..6) plus
// 2 practice trials. Pure-canvas re-implementation (no Snap.svg).

var MOT_NUM_CIRCLES   = 10;
var MOT_RADIUS        = 15;
var MOT_REPULSION     = 4;
var MOT_NOISE_DEG     = 15;
var MOT_DURATION_MS   = 5000;
var MOT_FLASH_CYCLES  = 5;
var MOT_FLASH_MS      = 100;
var MOT_PRE_HIDE_MS   = 1500;
var MOT_RESPONSE_TIMEOUT_MS = 15000;
var MOT_CANVAS_SIZE   = 500;
var MOT_SPEEDS        = [1, 2, 3, 4, 5, 6];
var MOT_SET_SIZES     = [3, 4, 5];
var MOT_TRIALS_PER_SS = MOT_SPEEDS.length;

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

        var test = data.filter({task: 'mot', phase: 'test'}).values();
        var trialCols = ['n_targets', 'speed', 'hits', 'clicks', 'rt', 'state'];
        var rows = test.map(function (r) {
            return [r.n_targets, r.speed, r.hits, r.clicks, r.rt, r.state];
        });

        if (qHas) {
            try {
                Qualtrics.SurveyEngine.setEmbeddedData('mot_data', JSON.stringify({
                    pid: subject, task: 'mot', cols: trialCols, rows: rows
                }));
            } catch (e) {
                console.warn('[mot] setEmbeddedData failed for mot_data:', e);
            }
        }

        // Outcomes
        var total_hits    = 0;
        var total_targets = 0;
        var rts           = [];
        var per_ss        = {3: {hits: 0, total: 0}, 4: {hits: 0, total: 0}, 5: {hits: 0, total: 0}};
        for (var i = 0; i < test.length; i++) {
            var r = test[i];
            total_hits    += r.hits || 0;
            total_targets += r.n_targets || 0;
            if (r.state !== 'timeout' && typeof r.rt === 'number') rts.push(r.rt);
            if (per_ss[r.n_targets]) {
                per_ss[r.n_targets].hits  += r.hits || 0;
                per_ss[r.n_targets].total += r.n_targets || 0;
            }
        }

        if (qHas) {
            Qualtrics.SurveyEngine.setEmbeddedData('mot_score',     total_hits);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_max_score', total_targets);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_accuracy',  total_targets ? round3(total_hits / total_targets) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_acc_3',     per_ss[3].total ? round3(per_ss[3].hits / per_ss[3].total) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_acc_4',     per_ss[4].total ? round3(per_ss[4].hits / per_ss[4].total) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_acc_5',     per_ss[5].total ? round3(per_ss[5].hits / per_ss[5].total) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_medianrt',  median(rts) !== null ? Math.round(median(rts)) : null);
            Qualtrics.SurveyEngine.setEmbeddedData('mot_n_trials',  test.length);
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

    // ---- update one motion frame ----
    function step() {
        for (var i = 0; i < circles.length; i++) {
            var c = circles[i];
            var newDir = c.dir + (Math.random() * 2 - 1) * NOISE;
            var vx = Math.cos(newDir) * SPEED;
            var vy = Math.sin(newDir) * SPEED;
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
                vx = Math.cos(newDir) * SPEED;
                vy = Math.sin(newDir) * SPEED;
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

    function animationLoop() {
        var elapsed = performance.now() - motion_t0;
        if (elapsed >= DURATION) {
            startResponse();
            return;
        }
        step();
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
            if (status && !is_practice) status.textContent = 'Trial ' + (window.MOT_TRIAL_COUNT || 1) + ' of 18';
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

var instructions = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="mot-instr">'
            + '<p>You will see <b>10 black dots</b> on the screen.</p>'
            + '<p>Some dots will <b>flash green</b> for a moment — these are your targets.</p>'
            + '<p>All dots then move around together. <b>Keep track of which dots flashed</b>.</p>'
            + '<p>When the dots stop, click on the dots that flashed.</p>'
            + '<p>Correct clicks turn <span style="color:#22c55e; font-weight:700;">green</span>; wrong clicks turn <span style="color:#ef4444; font-weight:700;">red</span>.</p>'
            + '<p>Three blocks of 6 trials each. Set sizes: 3, 4, then 5 dots. Motion gets faster within each block.</p>'
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
            + '<p>3 blocks of 6 trials each. Speed increases within each block.</p>'
            + '<p>Click the dots that flashed when motion stops. Guess if you have to.</p>'
            + '</div>',
    choices: ["Start test"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Build main test (set sizes 3, 4, 5; speeds 1..6)
var test_trials = [];
window.MOT_TRIAL_COUNT = 0;
MOT_SET_SIZES.forEach(function (n) {
    MOT_SPEEDS.forEach(function (s) {
        var t = makeMotTrial(n, s, false);
        // wrap to bump trial counter on load
        var orig_on_load = t.on_load;
        t.on_load = function () {
            window.MOT_TRIAL_COUNT = (window.MOT_TRIAL_COUNT || 0) + 1;
            orig_on_load();
        };
        test_trials.push(t);
    });
});

// Block-break message between set sizes
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

// Conclusion — button click triggers initJsPsych on_finish
var conclusion = {
    type: jsPsychHtmlButtonResponse,
    stimulus: '<p style="font-size:22pt;"><b>Test complete</b></p>'
            + '<p style="font-size:14pt; margin-top:20px;">Click below to submit and continue.</p>',
    choices: ["Finish and submit"],
    button_html: '<button class="mot-default-button">%choice%</button>'
};

// Assemble timeline (skip get_participant_id and fullscreen)
var timeline = [];
timeline.push(welcome, instructions);
timeline = timeline.concat(practice_trials);
timeline.push(post_practice);
for (var i = 0; i < test_trials.length; i++) {
    timeline.push(test_trials[i]);
    if (i === MOT_TRIALS_PER_SS - 1)        timeline.push(blockBreak(4));
    if (i === 2 * MOT_TRIALS_PER_SS - 1)    timeline.push(blockBreak(5));
}
timeline.push(conclusion);

jsPsych.run(timeline);

} // end initExp
