// logic test: ?logictest=1 — synthetic landmarks through the real scoring pipeline
    if (new URLSearchParams(location.search).has('logictest')) {
        const OPEN = [
            [0, 0], [-0.05, -0.02], [-0.09, -0.05], [-0.12, -0.08], [-0.15, -0.11],
            [-0.04, -0.12], [-0.04, -0.18], [-0.04, -0.24], [-0.04, -0.30],
            [0.01, -0.13], [0.01, -0.20], [0.01, -0.26], [0.01, -0.32],
            [0.06, -0.12], [0.06, -0.18], [0.06, -0.23], [0.06, -0.28],
            [0.10, -0.10], [0.10, -0.15], [0.10, -0.19], [0.10, -0.23]
        ];
        const CURL = {
            index: [[-0.04, -0.12], [-0.03, -0.17], [-0.02, -0.14], [-0.02, -0.11]],
            middle: [[0.01, -0.13], [0.02, -0.18], [0.03, -0.15], [0.03, -0.12]],
            ring: [[0.06, -0.12], [0.07, -0.17], [0.08, -0.14], [0.08, -0.11]],
            pinky: [[0.10, -0.10], [0.11, -0.14], [0.12, -0.12], [0.12, -0.09]]
        };
        const FINGER_MCP = { index: 5, middle: 9, ring: 13, pinky: 17 };

        const buildPose = (curled, pinch) => {
            const pts = OPEN.map((p) => p.slice());
            for (const name of curled) {
                const start = FINGER_MCP[name];
                CURL[name].forEach((p, i) => { pts[start + i] = p.slice(); });
            }
            if (pinch) pts[4] = [pts[8][0], pts[8][1] + 0.005];
            return pts;
        };
        const mkHand = (wx, wy, pts) => pts.map((p) => ({ x: wx + p[0], y: wy + p[1] }));
        const twoHands = (pts) => [mkHand(0.35, 0.75, pts), mkHand(0.65, 0.75, pts)];

        const RED2 = twoHands(buildPose(['middle', 'ring', 'pinky'], false));
        const VOID2 = twoHands(buildPose(['ring', 'pinky'], false));
        const OPEN2 = twoHands(buildPose([], false));
        const FIST2 = twoHands(buildPose(['index', 'middle', 'ring', 'pinky'], false));
        const PURPLE1 = [mkHand(0.5, 0.75, buildPose([], true))];
        const GUN1 = [mkHand(0.5, 0.75, buildPose(['ring', 'pinky'], false))];
        const OPEN1 = [mkHand(0.5, 0.75, buildPose([], false))];
        const FIST1 = [mkHand(0.5, 0.75, buildPose(['index', 'middle', 'ring', 'pinky'], false))];

        let t = 1000;
        const runFrame = (hands, ms) => {
            const results = {
                multiHandLandmarks: hands,
                multiHandedness: hands.map((_, i) => ({ label: 'H' + i }))
            };
            const scores = computeFrameScores(results, ms);
            const purpleArmedNow = currentTech === 'purple' && (ms - purpleEnteredAtMs) >= FLICK.purpleArmMs;
            if (purpleArmedNow && (scores.flick >= 1 || ms <= flickPulseUntilMs)) pendingPurpleExitFlick = true;
            scores.neutral = clamp01(1 - maxActiveScore(scores));
            GESTURES.forEach((tech) => { rawScores[tech] = scores[tech]; });
            smoothScores(scores);
            if (pendingBlueInstant) { smoothedScores.blue = 1; pendingBlueInstant = false; }
            const next = pickGestureFromScores(ms);
            maybeTriggerPurpleExitExplosion(next, ms);
            updateState(next);
        };
        const step = (hands, n) => {
            for (let i = 0; i < n; i++) { runFrame(hands, t); t += 33; }
            return currentTech;
        };

        const log = [];
        const mark = (name, expect) => {
            log.push(name + ' -> ' + currentTech + (expect ? (currentTech === expect ? ' OK' : ' FAIL(want ' + expect + ')') : ''));
        };

        step([], 5); mark('neutral', 'neutral');
        step(RED2, 20); mark('red disabled', 'neutral');
        step([], 5);
        step(OPEN1, 8);
        step(FIST1, 6);
        step(OPEN1, 8); mark('blue1 single hand', 'blue');
        step(RED2, 40); mark('anim: other gestures ignored', 'blue');
        step(RED2, 60); mark('cooldown: still no red', 'neutral');
        step([], 60);
        step(OPEN2, 8);
        step(FIST2, 6);
        step(OPEN2, 8); mark('blue2 both hands', 'blue');
        step([], 120);
        step(OPEN2, 20); mark('open only no trigger', 'neutral');
        step(FIST2, 8);
        step(OPEN2, 20); mark('fist>open no trigger', 'neutral');
        step([], 10); mark('end', null);

        const fails = log.filter((line) => line.includes('FAIL'));
        const banner = document.createElement('div');
        banner.id = 'logictest-banner';
        banner.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:' + (fails.length ? '#a00' : '#080') + ';color:#fff;font:13px/1.5 monospace;padding:10px 14px;white-space:pre;border-radius:6px';
        banner.textContent = 'LOGICTEST ' + (fails.length ? 'FAIL' : 'PASS') + '\n' + log.join('\n');
        document.body.appendChild(banner);
        document.title = 'LOGICTEST ' + (fails.length ? 'FAIL' : 'PASS');
    }