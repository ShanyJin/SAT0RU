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
        const OPEN_PTS = buildPose([], false);
        const FIST_PTS = buildPose(['index', 'middle', 'ring', 'pinky'], false);
        const RED_PTS = buildPose(['middle', 'ring', 'pinky'], false); // index up, others curled
        const GUN_PTS = buildPose(['ring', 'pinky'], false); // index+middle up, thumb flared
        const open1 = (x, y = 0.75) => [mkHand(x, y, OPEN_PTS)];
        const fist1 = (x, y = 0.75) => [mkHand(x, y, FIST_PTS)];
        // Bent-but-not-curled hand: every finger folds ~55° at the PIP and ~88° at the DIP,
        // yet the tips stay far from the wrist. This is the pose that used to sneak through
        // as an open palm and arm Blue; it must read as "not open" now.
        const bendFinger = (pts, mcpIdx, deg) => {
            const a = deg * Math.PI / 180;
            const rot = (vx, vy, angle) => [
                vx * Math.cos(angle) - vy * Math.sin(angle),
                vx * Math.sin(angle) + vy * Math.cos(angle)
            ];
            const pip = pts[mcpIdx + 1];
            const dip = pts[mcpIdx + 2];
            const tip = pts[mcpIdx + 3];
            let d = rot(dip[0] - pip[0], dip[1] - pip[1], a);
            const ndip = [pip[0] + d[0], pip[1] + d[1]];
            d = rot(tip[0] - dip[0], tip[1] - dip[1], a * 1.6);
            const ntip = [ndip[0] + d[0], ndip[1] + d[1]];
            pts[mcpIdx + 2] = ndip;
            pts[mcpIdx + 3] = ntip;
        };
        const bentPts = (deg = 55) => {
            const pts = OPEN.map((p) => p.slice());
            for (const name of ['index', 'middle', 'ring', 'pinky']) bendFinger(pts, FINGER_MCP[name], deg);
            return pts;
        };
        const bent1 = (x, y = 0.75) => [mkHand(x, y, bentPts(55))];
        const red1 = (x, y = 0.75) => [mkHand(x, y, RED_PTS)];
        const gun1 = (x, y = 0.75) => [mkHand(x, y, GUN_PTS)];
        const scaledOpen1 = (x, y, f) => {
            const hand = mkHand(x, y, OPEN_PTS); // one hand: 21 landmark points
            const w = hand[0];
            return [hand.map((p) => ({ x: w.x + (p.x - w.x) * f, y: w.y + (p.y - w.y) * f }))];
        };
        const scaledGun1 = (x, y, f) => {
            const hand = mkHand(x, y, GUN_PTS);
            const w = hand[0];
            return [hand.map((p) => ({ x: w.x + (p.x - w.x) * f, y: w.y + (p.y - w.y) * f }))];
        };
        // 茈's second firing pose: same raised index+middle, thumb tucked under, then a quick
        // outward lift of the two fingertips. `lift` is the outward displacement for the flick.
        const thumbUnderPts = (lift = 0) => {
            const pts = GUN_PTS.map((p) => p.slice());
            pts[4] = [pts[5][0] + 0.005, pts[5][1] + 0.015]; // thumb below the index MCP
            if (lift) {
                pts[8][1] -= lift;
                pts[12][1] -= lift;
            }
            return pts;
        };
        const thumbUnder1 = (x, lift = 0, y = 0.75) => [mkHand(x, y, thumbUnderPts(lift))];
        // Thumb snap: keep the two fingers still and swing only the thumb from under the
        // palm (f=0) out to the flared gun position (f=1). This is the gesture the user
        // actually makes to fire 茈; it does not move the index fingertip much.
        const thumbLerpPts = (f) => {
            const under = thumbUnderPts(0);
            const out = GUN_PTS;
            const pts = under.map((p) => p.slice());
            pts[4] = [
                under[4][0] + (out[4][0] - under[4][0]) * f,
                under[4][1] + (out[4][1] - under[4][1]) * f
            ];
            return pts;
        };
        const thumbLerp1 = (x, f, y = 0.75) => [mkHand(x, y, thumbLerpPts(f))];
        // 無量空処: the reference video's crossed two-finger sign. MediaPipe does not resolve
        // the crossing reliably, but the tucked thumb (thumbGapRatio < 0.75) is stable.
        const void1 = (x, y = 0.75) => [mkHand(x, y, thumbUnderPts(0))];
        // 虚式「茈」 clasp cast — real landmarks captured from the user's own photos by
        // the local MediaPipe build (three consecutive 2-hand frames of the same pose).
        // MediaPipe reports both hands as almost fully open on this pose, so the fixtures
        // are what the app really sees; hand-tuned synthetic fingers would hide that.
        const REAL_CLASP = [
            [[[0.5518,0.2725],[0.5513,0.2355],[0.5513,0.1989],[0.5538,0.1717],[0.5575,0.1493],[0.5510,0.1742],[0.5458,0.1287],[0.5436,0.1032],[0.5417,0.0813],[0.5548,0.1860],[0.5489,0.1385],[0.5454,0.1118],[0.5419,0.0886],[0.5586,0.2086],[0.5526,0.1845],[0.5519,0.1710],[0.5522,0.1550],[0.5624,0.2387],[0.5550,0.2346],[0.5508,0.2311],[0.5478,0.2262]],
             [[0.4981,0.2970],[0.5056,0.2546],[0.5200,0.2154],[0.5346,0.1913],[0.5448,0.1730],[0.5193,0.1923],[0.5341,0.1494],[0.5402,0.1163],[0.5418,0.0869],[0.5215,0.2072],[0.5458,0.1839],[0.5541,0.1745],[0.5578,0.1520],[0.5297,0.2231],[0.5474,0.2081],[0.5522,0.1991],[0.5551,0.1881],[0.5372,0.2391],[0.5474,0.2312],[0.5514,0.2242],[0.5532,0.2169]]],
            [[[0.5518,0.2725],[0.5513,0.2355],[0.5513,0.1989],[0.5538,0.1717],[0.5575,0.1493],[0.5510,0.1742],[0.5458,0.1287],[0.5436,0.1032],[0.5417,0.0813],[0.5548,0.1860],[0.5489,0.1385],[0.5454,0.1118],[0.5419,0.0886],[0.5586,0.2086],[0.5526,0.1845],[0.5519,0.1710],[0.5522,0.1550],[0.5624,0.2387],[0.5550,0.2346],[0.5508,0.2311],[0.5478,0.2262]],
             [[0.4994,0.2963],[0.5070,0.2551],[0.5212,0.2170],[0.5351,0.1931],[0.5454,0.1751],[0.5204,0.1932],[0.5344,0.1509],[0.5394,0.1180],[0.5404,0.0893],[0.5222,0.2076],[0.5460,0.1842],[0.5536,0.1746],[0.5568,0.1522],[0.5303,0.2235],[0.5472,0.2084],[0.5514,0.1994],[0.5540,0.1884],[0.5377,0.2395],[0.5473,0.2313],[0.5510,0.2243],[0.5528,0.2170]]],
            [[[0.5518,0.2725],[0.5513,0.2355],[0.5513,0.1989],[0.5538,0.1717],[0.5575,0.1493],[0.5510,0.1742],[0.5458,0.1287],[0.5436,0.1032],[0.5417,0.0813],[0.5548,0.1860],[0.5489,0.1385],[0.5454,0.1118],[0.5419,0.0886],[0.5586,0.2086],[0.5526,0.1845],[0.5519,0.1710],[0.5522,0.1550],[0.5624,0.2387],[0.5550,0.2346],[0.5508,0.2311],[0.5478,0.2262]],
             [[0.5002,0.2956],[0.5078,0.2553],[0.5218,0.2178],[0.5354,0.1942],[0.5458,0.1760],[0.5210,0.1938],[0.5346,0.1516],[0.5390,0.1190],[0.5398,0.0903],[0.5225,0.2079],[0.5459,0.1844],[0.5531,0.1747],[0.5561,0.1524],[0.5306,0.2237],[0.5471,0.2086],[0.5510,0.1996],[0.5535,0.1886],[0.5379,0.2397],[0.5472,0.2314],[0.5507,0.2244],[0.5525,0.2171]]]
        ];
        const realHand = (hand) => hand.map(([x, y]) => ({ x, y }));
        const shiftHand = (hand, dx) => hand.map((p) => ({ x: p.x + dx, y: p.y }));
        // One physical hand reported twice: same landmarks, shifted a little, same label.
        const claspWrapHand = () => realHand(REAL_CLASP[0][1]);
        const claspGhost = () => [claspWrapHand(), shiftHand(claspWrapHand(), 0.04)];
        const clasp2 = () => REAL_CLASP[0].map(realHand);
        // Two hands with the clasp family geometry but held well apart: no clasp either.
        const claspFar2 = () => [mkHand(0.30, 0.65, RED_PTS), mkHand(0.70, 0.65, FIST_PTS)];
        // Fast-forward a running clasp cast on the synthetic clock (used by the assertions).
        // The voice flag is pre-set so skipping ahead cannot re-fire the 0.5 s clip.
        const finishClasp = () => {
            if (!claspCast) return;
            claspCast.voicePlayed = true;
            claspCast.startMs = t - CLASP_CAST.explodeAtMs;
            updateClaspCast(t);
            if (claspCast) {
                claspCast.startMs = t - CLASP_CAST.endMs - 1;
                updateClaspCast(t);
            }
        };

        let t = 1000;
        // Visual-check hook: the module scope is closed, so expose the 赫 cast/burn state
        // for screenshot tooling (test artifact only, never the app).
        window.__redFxState = () => ({
            cast: !!redCast,
            castAge: redCast ? performance.now() - redCast.startMs : null,
            castStart: redCast ? redCast.startMs : null,
            burn: !!redBurn,
            burnAge: redBurn ? performance.now() - redBurn.startMs : null,
            now: performance.now(),
            tech: currentTech,
            neutralSettledAtMs,
            materialOpacity: particleMaterial.opacity,
            visible: {
                lance: redLance.points.visible,
                flash: redFlash.points.visible,
                cone: redCone.points.visible,
                ember: redEmber.points.visible
            },
            field: {
                x: particles.position.x,
                y: particles.position.y,
                scale: particles.scale.x,
                visible: particles.visible,
                rotZ: particles.rotation.z
            },
            ball: {
                visible: redBall.points.visible,
                opacity: redBall.material.opacity,
                x: redBall.points.position.x,
                y: redBall.points.position.y,
                scale: redBall.points.scale.x,
                count: RED_BALL.count
            }
        });
        // Visual-check hook: the module scope is closed, so expose the 茈 state for
        // screenshot tooling to assert where the ball is and whether it is visible.
        window.__chargeState = () => {
            const v = chargeOrb.position.clone().project(camera);
            return {
                blue: !!blueCharge,
                visual: { x: chargeVisual.x, y: chargeVisual.y, init: chargeVisual.init },
                orb: { x: chargeOrb.position.x, y: chargeOrb.position.y, visible: chargeOrb.visible },
                screen: { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight },
                dims: {
                    iw: window.innerWidth, ih: window.innerHeight, dpr: window.devicePixelRatio,
                    vw: videoElement.videoWidth, vh: videoElement.videoHeight,
                    cw: renderer.domElement.width, ch: renderer.domElement.height,
                    fov: camera.fov, aspect: camera.aspect, camZ: camera.position.z
                }
            };
        };
        window.__claspState = () => ({
            cast: !!claspCast,
            phase: claspCast ? claspCast.phase : null,
            run: claspRunFrames,
            releaseRequired: claspPoseReleaseRequired,
            cooldownLeftMs: Math.max(0, claspCooldownUntilMs - performance.now()),
            blueVisible: claspBlueOrb.points.visible,
            redVisible: claspRedOrb.points.visible,
            entwineVisible: typeof claspCore !== 'undefined' ? claspCore.points.visible : false,
            vortexVisible: typeof claspCore !== 'undefined'
                ? (claspCore.points.visible || claspRingA.points.visible || claspRingB.points.visible)
                : false,
            bluePointSize: claspBlueOrb.material.size,
            redPointSize: claspRedOrb.material.size,
            blueScreen: (() => {
                const v = claspBlueOrb.points.position.clone().project(camera);
                return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
            })(),
            redScreen: (() => {
                const v = claspRedOrb.points.position.clone().project(camera);
                return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
            })(),
            name: document.getElementById('technique-name')?.innerText,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            now: performance.now()
        });
        window.__purpleState = () => ({
            mode: purpleMode,
            charge: !!purpleCharge,
            shot: !!purpleShot,
            visual: { x: purpleVisual.x, y: purpleVisual.y, init: purpleVisual.init },
            orb: {
                x: purpleOrb.position.x,
                y: purpleOrb.position.y,
                z: purpleOrb.position.z,
                visible: purpleOrb.visible,
                size: purpleOrbMaterial.size
            },
            path: purplePath.length,
            screen: (() => {
                const v = purpleOrb.position.clone().project(camera);
                return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
            })(),
            chargeStartedMs: purpleCharge ? purpleCharge.startedMs : 0,
            now: performance.now(),
            viewport: { w: window.innerWidth, h: window.innerHeight }
        });
        // Visual-check hook for the 無量空処 hold-3s cinematic (screenshot tooling asserts beats).
        window.__voidCinemaState = () => ({
            active: !!voidCinematic,
            ringShown: voidCinematic ? voidCinematic.ringShown : false,
            awarded: voidHoldAwarded,
            bodyClass: document.body.classList.contains('void-cinema'),
            streaks: { visible: voidStreaks.visible, opacity: voidStreakMaterial.opacity },
            field: { visible: particles.visible, opacity: particleMaterial.opacity },
            overlay: voidCinemaEl ? Number(voidCinemaEl.style.opacity || 0) : null,
            now: performance.now()
        });
        const runFrame = (hands, ms, labels) => {
            // Mirror onResults: the 無量空処 cinematic freezes the gesture pipeline.
            if (voidCinematic) return;
            const results = {
                multiHandLandmarks: hands,
                multiHandedness: hands.map((_, i) => ({ label: labels ? labels[i] : 'H' + i }))
            };
            const scores = computeFrameScores(results, ms);
            const purpleArmedNow = currentTech === 'purple' && (ms - purpleEnteredAtMs) >= FLICK.purpleArmMs;
            if (purpleArmedNow && (scores.flick >= 1 || ms <= flickPulseUntilMs)) pendingPurpleExitFlick = true;
            scores.neutral = clamp01(1 - maxActiveScore(scores));
            GESTURES.forEach((tech) => { rawScores[tech] = scores[tech]; });
            smoothScores(scores);
            if (pendingBlueInstant) { smoothedScores.blue = 1; pendingBlueInstant = false; }
            let next = pickGestureFromScores(ms);
            // Mirror onResults' forced-technique wrapper (T/N preview and 茈's impact lock).
            if (forcedTech) {
                if (ms < forcedUntilMs) next = forcedTech;
                else forcedTech = null;
            }
            maybeTriggerPurpleExitExplosion(next, ms);
            updateState(next);
            maybeTriggerVoidCinematic(ms);
            updateTechniqueVoices(ms);
        };
        const step = (hands, n, labels) => {
            for (let i = 0; i < n; i++) { runFrame(hands, t, labels); t += 33; }
            return currentTech;
        };
        // Moves a single open hand horizontally `n` frames from `x0` at `dx` per frame.
        const drift = (x0, dx, n) => {
            let x = x0;
            for (let i = 0; i < n; i++) { x += dx; runFrame(open1(x), t); t += 33; }
            return x;
        };
        // 蒼 arms by holding an open palm for BLUE_SEQ.holdMs (2 s) — no open>fist>open cycle.
        const armBlue1 = (x = 0.5) => {
            step(open1(x), 100);
            return !!blueCharge;
        };
        // A test failure may leave a blast + 2s cooldown behind; clear it so the next
        // assertion starts from a fresh idle state instead of cascading.
        const recoverBlue = (x = 0.5) => {
            if (blueCharge) return x;
            step([], 280);
            armBlue1(x);
            return x;
        };

        // The regression runs on a synthetic clock, but animate() reads performance.now().
// Leftover synthetic explosion/cooldown values would otherwise shake or hide the
// real-clock scene in the screenshot demos. Clear them before the visual setup.
        const resetRealClockFx = () => {
            purpleExplosionUntilMs = 0;
            neutralLockUntilMs = 0;
            lastPurpleExplosionMs = -Infinity;
            shakeIntensity = 0;
            forcedTech = null;
            forcedUntilMs = 0;
            gestureLockUntilMs = 0;
            flickLockUntilMs = 0;
            flickPulseUntilMs = 0;
            techCooldownUntilMs = 0;
            claspCast = null;
            claspRunFrames = 0;
            claspLastSeenMs = -Infinity;
            claspCooldownUntilMs = 0;
            claspPoseReleaseRequired = false;
            claspSuppressUntilMs = 0;
            claspSawRealPose = false;
            claspRealPoseFrames = 0;
            claspPairFrames = 0;
            redCast = null;
            redBurn = null;
            redFollow.x = 0;
            redFollow.y = 0;
            redFollow.init = false;
            redBall.points.visible = false;
            redLance.points.visible = false;
            redFlash.points.visible = false;
            redCone.points.visible = false;
            redEmber.points.visible = false;
            voidLongMode = false;
            voidCinematic = null;
            voidHoldAwarded = false;
            voidStreaks.visible = false;
            voidStreakMaterial.opacity = 0;
            particles.visible = true;
            particleMaterial.opacity = 1;
            dust.visible = true;
            document.body.classList.remove('void-cinema');
            if (voidCinemaEl) voidCinemaEl.style.opacity = '0';
            renderer.domElement.style.transform = 'translate(0,0)';
        };

        const log = [];
        const mark = (name, expect) => {
            log.push(name + ' -> ' + currentTech + (expect ? (currentTech === expect ? ' OK' : ' FAIL(want ' + expect + ')') : ''));
        };
        const markState = (name, expect, actual) => {
            log.push(name + ' -> ' + actual + (actual === expect ? ' OK' : ' FAIL(want ' + expect + ')'));
        };
        // Snapshot the startup preload state before any test plays a long clip (playing
        // one on demand legitimately switches its preload to auto).
        const initialAudioPreloadNone = Array.from(document.querySelectorAll('audio'))
            .filter((a) => a.preload === 'none').length;

        try {
            step([], 5); mark('neutral', 'neutral');

            // Making the gun sign must not arm Blue. The brief fist in this motion just
            // breaks the open-palm hold.
            step(open1(0.5), 8);
            step(gun1(0.5), 3);
            step(fist1(0.5), 2);
            step(open1(0.5), 6);
            markState('gun motion does not arm blue', 'idle', blueCharge ? 'charge' : 'idle');
            step([], 20);

            // --- 赫 form 2: gun (index+middle together, thumb flared) ---
            step(gun1(0.5), 25); mark('red gun form shows', 'red');
            // 赫's sustained field is a small dedicated orb, not the shared 20k swarm: a
            // compact ball (~5 units) with a sparse spark halo, and the big field stays
            // dark for the whole hold (that is also the perf win).
            markState('red orb is a small compact ball', 'small', (() => {
                if (typeof RED_BALL === 'undefined' || typeof redBallVisual !== 'function') return 'missing';
                const V = redBallVisual(-1);
                return (V.active && V.radius === RED_BALL.radius && V.radius < 8) ? 'small' : 'big';
            })());
            markState('red orb holds a small point budget', '1500', (() => {
                if (typeof RED_BALL === 'undefined') return 'missing';
                return String(RED_BALL.count);
            })());
            // The orb used to boil: every particle had its own breathing phase (0.08 @ 2.8)
            // plus a 0.14 ripple on the corona, which reads as constant shaking on camera.
            // The shell now breathes as one body with only a sliver of per-particle shimmer.
            markState('red orb breathes instead of shaking', 'calm', (() => {
                if (typeof RED_BALL === 'undefined') return 'missing';
                const calm = RED_BALL.breathe <= 0.05 && (RED_BALL.drift || 0) <= 0.02
                    && RED_BALL.spin <= 0.8;
                // Same-phase shell: the radius of two particles at the same seed radius must
                // scale identically over time (no per-particle phase offset).
                const seeds = redBall.seeds;
                const r0 = seeds.map((s) => s.r);
                const sample = (t) => {
                    fillRedBallPositions(t, 4.8);
                    return redBall.positions.slice(0, 60);
                };
                const a = sample(1.0);
                const b = sample(1.0 + 1 / 60);
                let moved = 0;
                for (let i = 0; i < a.length; i++) moved = Math.max(moved, Math.abs(a[i] - b[i]));
                // One frame of animation still moves points (the swirl), so only require that
                // the motion is bounded to a small fraction of the ball radius.
                const bounded = moved < 4.8 * 0.35;
                return calm && bounded && r0.length === seeds.length ? 'calm' : 'boiling';
            })());
            markState('red orb burn-out fades in place', 'fade', (() => {
                if (typeof redBallVisual !== 'function') return 'missing';
                const mid = redBallVisual(RED_CAST.burnMs * 0.5);
                const over = redBallVisual(RED_CAST.burnMs + 1);
                return (mid.radius < RED_BALL.radius && mid.alpha < RED_BALL.alpha
                    && !over.active) ? 'fade' : 'wrong';
            })());
            markState('red blanks the shared swarm', 'dark', (() => {
                const pos = particles.geometry.attributes.position.array;
                for (let i = 0; i < pos.length; i += 97) if (pos[i] !== 0) return 'visible';
                const sizes = particles.geometry.attributes.size.array;
                for (let i = 0; i < sizes.length; i += 13) if (sizes[i] !== 0) return 'visible';
                return 'dark';
            })());
            // 赫 activation is a shot, not a fade-in: entering arms a forward cast aimed
            // along the raised finger, and the pure layout must read as a narrow lance.
            markState('red cast starts with the field', 'cast',
                (typeof redCast !== 'undefined' && redCast) ? 'cast' : 'none');
            markState('red cast aims along the raised finger', 'up', (() => {
                if (typeof redCast === 'undefined' || !redCast) return 'none';
                const straight = Math.abs(redCast.dirX) < 0.2 && redCast.dirY > 0.9;
                return straight ? 'up' : `(${redCast.dirX.toFixed(2)},${redCast.dirY.toFixed(2)})`;
            })());
            markState('red cast starts as a muzzle flash', 'yes', (() => {
                if (typeof redCastLayout !== 'function') return 'missing';
                const L = redCastLayout(0);
                return (L.active && L.flash > 0.99 && L.reach < 1) ? 'yes' : 'no';
            })());
            markState('red cast travels forward with age', 'further', (() => {
                if (typeof redCastLayout !== 'function') return 'missing';
                const a = redCastLayout(200);
                const b = redCastLayout(400);
                return (a.active && b.active && a.reach > 8 && b.reach > a.reach + 8) ? 'further' : 'stuck';
            })());
            markState('red cast stays narrow (not an explosion)', 'narrow', (() => {
                if (typeof redCastLayout !== 'function') return 'missing';
                const L = redCastLayout(300);
                return (L.spread < L.reach * 0.25 && L.back < L.reach * 0.1) ? 'narrow' : 'radial';
            })());
            markState('red cast ends after the shot', 'over', (() => {
                if (typeof redCastLayout !== 'function') return 'missing';
                return redCastLayout(RED_CAST.lanceMs + 1).active ? 'active' : 'over';
            })());
            markState('red field snaps up and recoils', 'snap', (() => {
                if (typeof redCastLayout !== 'function') return 'missing';
                const a = redCastLayout(0);
                const b = redCastLayout(120);
                const d = redCastLayout(200);
                const c = redCastLayout(RED_CAST.fadeMs);
                return (a.pop < 0.9 && b.jolt < -1 && d.pop > 1.01
                    && Math.abs(c.jolt) < 0.05 && c.pop > 0.98) ? 'snap' : 'flat';
            })());
            markState('red lance geometry moves forward only', 'forward', (() => {
                if (typeof redCastLayout !== 'function' || typeof fillRedLancePositions !== 'function'
                    || typeof redLance === 'undefined') return 'missing';
                const L = redCastLayout(300, { x: 0, y: 0, dirX: 0, dirY: 1 });
                fillRedLancePositions(redLance, L);
                let minF = Infinity;
                let maxF = -Infinity;
                let maxSide = 0;
                for (let i = 0; i < redLance.seeds.length; i++) {
                    const px = redLance.positions[i * 3];
                    const py = redLance.positions[i * 3 + 1]; // aim is +y, origin 0
                    minF = Math.min(minF, py);
                    maxF = Math.max(maxF, py);
                    maxSide = Math.max(maxSide, Math.abs(px));
                }
                const ok = minF > -0.5 && maxF > L.reach * 0.8 && maxSide < L.reach * 0.2;
                return ok ? 'forward'
                    : `min=${minF.toFixed(1)} max=${maxF.toFixed(1)} side=${maxSide.toFixed(1)}`;
            })());
            step([], 24); mark('red gun releases on drop', 'neutral');
            // Release is its own animation: the field stops where it was and sheds falling
            // ash. No forward motion, so expiry can never read as a failed activation.
            markState('red release starts a burn-out', 'burn',
                (typeof redBurn !== 'undefined' && redBurn) ? 'burn' : 'none');
            markState('red burn-out falls instead of shooting', 'ash', (() => {
                if (typeof redBurnLayout !== 'function') return 'missing';
                const a = redBurnLayout(0);
                const b = redBurnLayout(300);
                return (a.active && a.alpha > 0.99 && b.fall > 1 && b.alpha < 0.7) ? 'ash' : 'shot';
            })());
            markState('red burn-out ends', 'over', (() => {
                if (typeof redBurnLayout !== 'function') return 'missing';
                return redBurnLayout(RED_CAST.burnMs + 1).active ? 'active' : 'over';
            })());
            // No 回中: where the shot landed is where the orb stays. Nothing in the state
            // machine may recentre the follow position after Red ends.
            redFollow.x = 37;
            redFollow.y = -21;
            redFollow.init = true;
            step([], 60);
            markState('red never eases back to the centre', 'still',
                (redFollow.x === 37 && redFollow.y === -21)
                    ? 'still' : `(${redFollow.x.toFixed(1)},${redFollow.y.toFixed(1)})`);
            redFollow.x = 0;
            redFollow.y = 0;
            redFollow.init = false;
            step([], 210); // drain the cooldown

            // --- 赫 form 1: index finger pointing up ---
            step(red1(0.5), 25); mark('red pointing shows', 'red');
            // Switching between the two Red forms keeps the field (same technique, no drop).
            step(gun1(0.5), 10); markState('red form handoff stays red', 'red', currentTech);
            // Brief tracking gaps mid-switch are bridged too.
            step([], 8);
            step(red1(0.5), 6);
            markState('red survives brief pose gap', 'red', currentTech);
            step([], 24); mark('red releases on drop', 'neutral');
            // The old 8s lock is gone: by now >2s has passed, so Red re-triggers.
            step(red1(0.5), 10); mark('red recovers after 2s', 'red');
            step([], 80); // drop + drain the 2s cooldown
            // Dedicated 2s window: trigger, drop, then re-present before and after the boundary.
            step(red1(0.5), 25);
            step([], 24);
            step(red1(0.5), 8); mark('red 2s cooldown blocks retrigger', 'neutral');
            step(red1(0.5), 30); mark('red 2s cooldown recovers', 'red');
            // The reported bug: the return swing after a Red fling must not arm Blue either.
            step(open1(0.5), 8);
            step(fist1(0.5), 6);
            step(open1(0.5), 6);
            markState('blue blocked by red cooldown', 'idle', blueCharge ? 'charge' : 'idle');
            step([], 180); // drain the rest of the cooldown
            // Red works again once the cooldown expires (two pointing hands also reach Red).
            step(RED2, 25); mark('red after cooldown', 'red');
            step([], 260); // drain again before the voice / Blue suites

            // --- 赫 hold robustness (the reported mid-hold drop-out) ---
            // The gun form (thumb flared) and 無量空処 (thumb tucked) differ only by
            // thumbGapRatio around 0.75, so a real hand hovering on that line used to
            // flicker the field off. The active field now keeps its pose family across the
            // boundary and bridges a longer tracking dropout.
            step(gun1(0.5), 20); mark('red started for the hold robustness tests', 'red');
            // f=0.78 puts the thumb at thumbGapRatio ≈ 0.66: above the hysteresis floor
            // (0.58) but below the gun rule's 0.75 — the exact band that used to flip the
            // field into 無量空処 and blink 赫 off.
            const nearRatio = handShape(mkHand(0.5, 0.75, thumbLerpPts(0.78))).thumbGapRatio;
            markState('thumbnail pose sits in the old dropout band', 'yes',
                (nearRatio < 0.75 && nearRatio > 0.58) ? 'yes' : nearRatio.toFixed(2));
            step(thumbLerp1(0.5, 0.78), 20);
            markState('red survives a thumb near the void line', 'red',
                currentTech === 'red' ? 'red' : currentTech);
            step([], 16); // 528 ms dropout: longer than the old 350 ms bridge
            step(gun1(0.5), 4);
            markState('red bridges a longer tracking dropout', 'red',
                currentTech === 'red' ? 'red' : currentTech);
            // Jitter guard: the orb must not chase per-frame landmark noise. `redFollowStep`
            // is the pure damped-follow used by animate(); pin its feel directly.
            markState('red orb ignores landmark jitter', 'still', (() => {
                if (typeof redFollowStep !== 'function') return 'missing';
                const f = { x: 10, y: -4, t: 1000 };
                const inDead = redFollowStep(f, { x: 10.6, y: -4.5 }, 1033);
                return Math.abs(inDead.x - 10) < 1e-9 && Math.abs(inDead.y + 4) < 1e-9 ? 'still' : 'drifted';
            })());
            // Follow the pure step at the real frame cadence (33 ms) — a single big dt is
            // capped at 100 ms, so stepping frame by frame is what actually happens.
            const followTrace = (() => {
                const trace = { one: NaN, later: NaN };
                if (typeof redFollowStep !== 'function') return trace;
                let f = { x: 0, y: 0, t: 1000 };
                const anchor = { x: 40, y: 0 };
                for (let i = 1; i <= 45; i++) {
                    const t = 1000 + i * 33;
                    const next = redFollowStep(f, anchor, t);
                    f = { x: next.x, y: next.y, t };
                    if (i === 1) trace.one = f.x;
                    if (i === 45) trace.later = f.x;
                }
                return trace;
            })();
            markState('red orb follows a real move smoothly '
                + followTrace.one.toFixed(2) + '/' + followTrace.later.toFixed(2), 'eased',
                (followTrace.one > 0.5 && followTrace.one < 12
                    && followTrace.later > 36 && followTrace.later <= 40) ? 'eased'
                    : `one=${followTrace.one.toFixed(2)} later=${followTrace.later.toFixed(2)}`);
            markState('red orb damping is slow enough to read as floating', 'calm',
                (RED_HOLD.followTauMs >= 150 && RED_HOLD.deadZone >= 0.5) ? 'calm' : 'twitchy');
            // The reported shake had two sources besides the particles: (1) a held
            // 0.4 camera shake for as long as any technique was on screen — the whole
            // canvas translated ±8 px every frame — and (2) per-particle breathing phases.
            // The camera kick is now an impulse that decays, never a sustained offset.
            markState('camera shake is an impulse, not a held offset', 'impulse',
                (typeof SHAKE_DECAY_TAU_MS === 'number' && SHAKE_DECAY_TAU_MS > 0
                    && /Math\.max\(shakeIntensity, 0\.4\)/.test(updateState.toString()))
                    ? 'impulse' : 'held');
            step([], 60); // let go, then confirm a clear tuck still flips to the domain
            step(thumbUnder1(0.5, 0, 0.75), 25);
            markState('void still takes over from a clear tuck', 'neutral|void',
                currentTech === 'neutral' || currentTech === 'void' ? 'neutral|void' : currentTech);
            step([], 40);
            step(gun1(0.5), 20);
            step([], 300); // drain this block's cooldown before the voice suite


            // --- 赫 voice: either Red form held 1 s plays one of the two local clips,
            // exactly once per continuous hold — dropping the sign re-arms it. ---
            const he0 = audioPlayCounts['he-1'] + audioPlayCounts['he-2'];
            const heCount = () => audioPlayCounts['he-1'] + audioPlayCounts['he-2'];
            step(red1(0.5), 22); // ~0.73 s of pointing; Red itself is entered after ~7 frames
            markState('red voice waits for the 1 s hold', 'silent',
                heCount() === he0 ? 'silent' : 'played');
            step(red1(0.5), 20); // crosses the 1 s hold
            markState('red voice fires after a 1 s hold', 'played',
                heCount() === he0 + 1 ? 'played' : 'silent');
            markState('red voice picks a local clip', 'local',
                /^(he-1|he-2)$/.test(lastAudioKey) ? 'local' : (lastAudioKey || 'none'));
            step(red1(0.5), 40); // a longer hold must not replay it
            markState('red voice plays once per hold', 'once',
                heCount() === he0 + 1 ? 'once' : 'again');
            step([], 60); // drop the sign: re-arm the clip for the next hold
            step(gun1(0.5), 70); // the gun form gets its own random clip after 1 s
            markState('red voice fires on the gun form too', 'played',
                heCount() === he0 + 2 ? 'played' : 'silent');
            step([], 200); // drain before the Blue suite

            // --- 苍1: holding an open palm for 2 s arms a charge instead of blooming ---
            // Blue voice: nothing during the hold; the clip plays 2 s AFTER the charge forms.
            const bc0 = audioPlayCounts.blue;
            step([], 20);
            step(open1(0.5), 45); // ~1.5 s: still short of the 2 s charge trigger
            markState('blue voice waits for the 2 s hold', 'silent',
                audioPlayCounts.blue === bc0 ? 'silent' : 'played');
            step(open1(0.5), 30); // crosses the 2 s trigger; the charge now exists
            step(open1(0.5), 44); // ~1.8 s after the charge formed: still inside the 2 s delay
            markState('blue voice waits 2 s after the charge', 'silent',
                (blueCharge && audioPlayCounts.blue === bc0) ? 'silent' : (blueCharge ? 'played' : 'idle'));
            step(open1(0.5), 10); // crosses 2 s after the charge
            markState('blue voice fires 2 s after the charge', 'played',
                audioPlayCounts.blue === bc0 + 1 ? 'played' : 'silent');
            markState('blue voice picks the local clip', 'blue',
                lastAudioKey === 'blue' ? 'blue' : (lastAudioKey || 'none'));
            step(open1(0.5), 40); // a longer charge must not replay it
            markState('blue voice plays once per charge', 'once',
                audioPlayCounts.blue === bc0 + 1 ? 'once' : 'again');
            cancelBlueCharge(); // drop the charge without firing, so the next test starts clean
            step(fist1(0.5), 3);
            // Shorter holds must not arm the charge.
            step(open1(0.5), 40); // ~1.3 s, still under the 2 s trigger
            markState('short open hold does not arm blue', 'idle', blueCharge ? 'charge' : 'idle');
            step(fist1(0.5), 2); // a fist breaks the open-palm hold
            step([], 10);
            // Openness is strict now: bent fingers (tips still far from the wrist) are not
            // an open palm, so a long bend-hold must never arm Blue.
            step(bent1(0.5), 100);
            markState('bent fingers do not arm blue', 'idle', blueCharge ? 'charge' : 'idle');
            markState('bent fingers stay neutral', 'neutral', currentTech);
            step([], 20);
            markState('blue1 charge armed (no bloom)', 'charge',
                armBlue1() ? (currentTech === 'neutral' ? 'charge' : 'bloomed') : 'idle');

            // Slow drag (~0.36 units/s): the orb must simply follow the hand.
            let cx = drift(0.5, -0.012, 20);
            markState('slow drag keeps charge', 'charge', blueCharge ? 'charge' : 'released');

            // Finger pose changes plus a 3-frame palm-size step (+24%): landmark wobble from
            // moving fingers must not be mistaken for a forward thrust.
            for (let i = 0; i < 8; i++) {
                runFrame(scaledOpen1(cx, 0.75, i % 2 ? 1.08 : 1.0), t);
                t += 33;
            }
            step(scaledOpen1(cx, 0.75, 1.0), 5); // settle so the old window baseline is 1.0
            for (let i = 0; i < 3; i++) {
                runFrame(scaledOpen1(cx, 0.75, 1.24), t);
                t += 33;
            }
            markState('finger/size jitter keeps charge', 'charge', blueCharge ? 'charge' : 'released');
            cx = recoverBlue(cx);

            // A fast sideways fling (~1.8 units/s) now releases the charge; only slow drags
            // merely carry the orb along.
            cx = drift(cx, 0.06, 4);
            markState('fast sideways fling releases blue', 'released', blueCharge ? 'charge' : 'released');
            mark('fling release blooms blue', 'blue');
            cx = recoverBlue(0.5);

            // Pointing at the charging hand (Red) must not hijack the charge.
            step(red1(cx), 10);
            markState('point during charge keeps charge', 'charge', blueCharge ? 'charge' : 'released');

            // Clenching the charging hand into a fist fires the blast right away (within a
            // couple of frames), instead of the old slow lost-tracking wait.
            step(fist1(cx), 3);
            markState('fist releases the blue charge', 'released', blueCharge ? 'charge' : 'released');
            mark('fist release blooms blue', 'blue');
            step([], 250); // drain the post-release cooldown
            armBlue1(cx);
            markState('blue re-armed for the push test', 'charge', blueCharge ? 'charge' : 'idle');

            // Only a sustained forward push (palm scale growing toward the camera) releases.
            for (let f = 1.0; f <= 1.5; f += 0.07) {
                runFrame(scaledOpen1(cx, 0.75, f), t);
                t += 33;
            }
            mark('forward push releases', 'blue');

            step(RED2, 40); mark('anim: other gestures ignored', 'blue');
            step(RED2, 60); mark('cooldown: red ignored', 'neutral');
            step([], 190); // drain the post-release cooldown

            // --- 苍2: two hands arm one charge; losing tracking releases ---
            step(OPEN2, 100);
            markState('blue2 charge armed', 'charge', blueCharge ? 'charge' : 'idle');
            step([], 34);
            mark('tracking loss releases', 'blue');
            step([], 250); // drain the post-release cooldown

            // --- 合掌: bringing the palms together releases ---
            step(OPEN2, 100);
            markState('palms charge armed', 'charge', blueCharge ? 'charge' : 'idle');
            step([mkHand(0.44, 0.75, OPEN_PTS), mkHand(0.56, 0.75, OPEN_PTS)], 6);
            mark('palms together releases', 'blue');
            step([], 250); // drain the post-release cooldown

            // --- no false triggers ---
            step(OPEN2, 20); mark('open only no trigger', 'neutral');
            step([], 60);
            step(FIST2, 8);
            step(OPEN2, 20); mark('fist>open alone no trigger', 'neutral');

            // --- 無量空処: two fingers raised, thumb tucked under (the video's crossed sign).
            // The flared-thumb gun is Red; the tucked thumb is the separator MediaPipe resolves
            // reliably (the index/middle crossing itself is not visible in its landmarks).
            step(gun1(0.5), 20);
            mark('red gun is not void', 'red');
            step([], 100);
            step(void1(0.5), 20);
            mark('void gesture triggers', 'void');
            const vv0 = audioPlayCounts.void;
            markState('void voice waits for the 1 s hold', 'silent',
                audioPlayCounts.void === vv0 ? 'silent' : 'played');
            step(void1(0.5), 20); // crosses the 1 s hold
            mark('void holds while gesture held', 'void');
            markState('void voice fires after a 1 s hold', 'played',
                audioPlayCounts.void === vv0 + 1 ? 'played' : 'silent');
            markState('void voice picks the local clip', 'void',
                lastAudioKey === 'void' ? 'void' : (lastAudioKey || 'none'));
            step(void1(0.5), 20);
            markState('void voice plays once per hold', 'once',
                audioPlayCounts.void === vv0 + 1 ? 'once' : 'again');
            step([], 30);
            mark('void releases when gesture drops', 'neutral');

            // --- 茈 mode: the top button is a mode switch, not a cast button ---
            const purpleBtn = document.getElementById('purple-mode-btn');
            markState('purple mode button exists', 'yes', purpleBtn ? 'yes' : 'no');
            if (purpleBtn) {
                purpleBtn.click();
                markState('purple mode button toggles on', 'on',
                    (purpleMode && purpleBtn.getAttribute('aria-pressed') === 'true') ? 'on' : 'off');
                purpleBtn.click();
                markState('purple mode button toggles off', 'off',
                    (!purpleMode && purpleBtn.getAttribute('aria-pressed') === 'false') ? 'off' : 'on');
            }

            // --- 茈 mode routing: the gun/pinch poses arm a purple charge; Red is paused ---
            setPurpleMode(true);
            // Arming is deliberately slow now: a pose flashed for a few frames is not a cast.
            step(gun1(0.5), 5);
            markState('purple gun flash does not arm', 'idle',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            step([], 10);
            step(gun1(0.5), 10);
            markState('purple gun arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            markState('purple mode blocks red gun', 'neutral', currentTech);
            step([], 20);
            markState('purple pose drop cancels', 'idle',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            step(PURPLE1, 10);
            markState('purple pinch arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            // The ready pose itself (two fingers + thumb tucked) also arms the orb, so the
            // user can go straight from the ready sign to the outward snap.
            step([], 20);
            step(thumbUnder1(0.5), 10);
            markState('purple thumb-under arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            setPurpleMode(false);
            step([], 10);

            // --- 茈 firing is gated by arm time, then by the strict forward push ---
            setPurpleMode(true);
            const pv0 = audioPlayCounts.purple;
            // The orb cannot fire while it is still being formed: an instant thumb snap
            // right after the ball appears is ignored (it is part of making the pose).
            step(gun1(0.5), 10);
            step(thumbUnder1(0.5), 2);
            runFrame(gun1(0.5), t); t += 33;
            markState('purple instant snap while arming is ignored', 'charge',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            // ...while the same snap fires once the orb has existed for armMs.
            step(thumbUnder1(0.5), 2);
            step(gun1(0.5), 4);
            markState('purple snap fires once armed', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            step(gun1(0.5), 15);
            mark('purple snap shot impacts', 'purple');
            step(gun1(0.5), 20);
            markState('purple snap cooldown blocks recharge', 'idle', purpleCharge ? 'charge' : 'idle');
            step(gun1(0.5), 50);
            markState('purple snap cooldown recovers', 'charge', purpleCharge ? 'charge' : 'idle');
            // A slow drift toward the camera is not a push: the projectile needs the
            // stricter growth and rate now.
            for (let f = 1.0; f <= 1.15; f += 0.03) {
                runFrame(scaledGun1(0.5, 0.75, f), t);
                t += 33;
            }
            markState('purple slow drift does not fire', 'charge',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            step([], 15); // drop this charge
            // The real forward push: fire, impact at center, 2s cooldown.
            step(scaledGun1(0.5, 0.75, 1.0), 10);
            for (let f = 1.0; f <= 1.5; f += 0.07) {
                runFrame(scaledGun1(0.5, 0.75, f), t);
                t += 33;
            }
            markState('purple forward push fires', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            markState('purple shot plays the short clip', 'played',
                (audioPlayCounts.purple === pv0 + 2 && lastAudioKey === 'purple') ? 'played' : 'silent');
            step(gun1(0.5), 15);
            mark('purple shot impacts', 'purple');
            step(gun1(0.5), 20);
            markState('purple 2s cooldown blocks recharge', 'idle', purpleCharge ? 'charge' : 'idle');
            step(gun1(0.5), 45);
            markState('purple cooldown recovers', 'charge', purpleCharge ? 'charge' : 'idle');

            // Thumb-under outward flick: the charge is already armed; tuck the thumb and snap
            // the two fingertips outward over two frames.
            step(thumbUnder1(0.5), 1);
            runFrame(thumbUnder1(0.5, 0.06), t); t += 33;
            runFrame(thumbUnder1(0.5, 0.12), t); t += 33;
            markState('purple thumb-under flick fires', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            step(gun1(0.5), 15);
            setPurpleMode(false);
            step([], 10);
            setPurpleMode(true);

            // --- 茈 thumb snap (the user's real firing motion) ---
            // Re-arm after the previous shot's 2s cooldown.
            step(gun1(0.5), 70);
            markState('purple rearmed for snap tests', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            // Slowly swinging the thumb out over ~660ms is not a snap: the charge must stay.
            step(thumbUnder1(0.5), 3);
            for (let i = 1; i <= 20; i++) { runFrame(thumbLerp1(0.5, i / 20), t); t += 33; }
            markState('purple slow thumb-out stays charging', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : (purpleShot ? 'shot' : 'idle'));
            // A quick under->out thumb snap fires, even though the fingertips barely move.
            step(thumbUnder1(0.5), 3);
            runFrame(gun1(0.5), t); t += 33;
            markState('purple thumb-out snap fires', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            step(gun1(0.5), 15);
            step([], 60);
            // Same snap with two frames of lost tracking in the middle: the charge must not
            // cancel, and the snap still fires when the hand reappears thumb-out.
            step(gun1(0.5), 70);
            step(thumbUnder1(0.5), 3);
            step([], 2);
            step(gun1(0.5), 2);
            markState('purple snap survives tracking gap', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
            step(gun1(0.5), 15);
            setPurpleMode(false);
            step([], 10);

            // --- 虚式「茈」 clasp cast: two hands, under the top 「茈」 switch ---
            step([], 220); // drain cooldowns
            // The switch now owns every 茈 form: with it OFF two clasped open hands are
            // just open palms and must never fire the cinematic.
            step(clasp2(), 40);
            markState('clasp needs the purple switch', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 40);
            cancelBlueCharge();
            resetBlueHandStates();

            setPurpleMode(true);
            // One hand in the two-finger Void pose is still the Void domain, never the clasp.
            step(void1(0.5), 20);
            markState('one hand void is not clasp', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 120); // drain the Void entry cooldown and any purple charge
            // Two flared open palms are 蒼-like hands, not the clasp.
            step(OPEN2, 40);
            markState('two open palms are not clasp', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 40);
            // MediaPipe can report the single Void hand twice, and while the sign is held the
            // other hand often sits in frame. 無量空処 is one-handed: neither case may turn
            // it into the two-hand clasp.
            step([mkHand(0.50, 0.65, thumbUnderPts(0)), mkHand(0.50, 0.65, thumbUnderPts(0))], 30);
            markState('duplicate void hand is not clasp', 'no-cast', claspCast ? 'cast' : 'no-cast');
            if (claspCast) finishClasp();
            step([], 120);
            step([mkHand(0.44, 0.65, OPEN_PTS), mkHand(0.50, 0.65, thumbUnderPts(0))], 30);
            markState('void next to a flared open palm is not clasp', 'no-cast',
                claspCast ? 'cast' : 'no-cast');
            step([], 120);
            // The real pose (user's own photos): the open hand — all four fingers up, thumb
            // tucked — clasped with the other hand, wrists together.
            step(clasp2(), 30);
            markState('clasp fires after the near misses', 'cast', claspCast ? 'cast' : 'idle');
            if (claspCast) finishClasp();
            step([], 400); // drain the cast's 2s cooldown and the release lock

            // MediaPipe sometimes reports the same physical hand twice on the clasp. The
            // duplicate carries the same label, or — with two labels — sits at a fixed,
            // near-zero wrist-relative offset from itself; neither may fire the cast.
            const realOpen0 = realHand(REAL_CLASP[0][0]);
            const realOpen1 = realHand(REAL_CLASP[0][1]);
            const soloOpen = () => [realHand(REAL_CLASP[0][0])];
            const claspApart2 = () => [realOpen0, shiftHand(realOpen1, 0.35)];
            step([realHand(REAL_CLASP[0][1]), realHand(REAL_CLASP[0][1])], 30);
            markState('duplicate clasp hand is not a cast', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 100);
            step(claspGhost(), 30, ['Right', 'Right']);
            markState('same-label duplicate hand is not a cast', 'no-cast',
                claspCast ? 'cast' : 'no-cast');
            step([], 100);
            step(claspGhost(), 30, ['Left', 'Right']);
            markState('offset duplicate clasp hand is not a cast', 'no-cast',
                claspCast ? 'cast' : 'no-cast');
            step([], 100);
            // The same open hands held apart are not clasped: wrists must meet.
            step(claspApart2(), 30);
            markState('open hands held apart are not a cast', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 120);
            // MediaPipe often tracks only ONE of the clasped hands. The lone open hand is
            // the pose too, but it needs the longer solo hold: a flash cannot fire it.
            step(soloOpen(), 4);
            markState('solo open hand flash does not cast', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step(soloOpen(), 10);
            markState('solo open hand casts after the solo hold', 'cast',
                claspCast ? 'cast' : (claspRunFrames > 0 ? 'warming' : 'idle'));
            if (claspCast) finishClasp();
            step([], 400);
            // A flared open palm (蒼's shape) is NOT the clasp pose even held long.
            step(open1(0.5), 40);
            markState('flared open palm never casts the clasp', 'no-cast',
                claspCast ? 'cast' : 'no-cast');
            step([], 120);

            markState('clasp purple choreography spans 16 s', '16000',
                String(CLASP_CAST.endMs - CLASP_CAST.convergeEndMs));
            markState('clasp audio ends before the animation', 'yes',
                CLASP_CAST.voiceDelayMs + CLASP_CAST.audioMs < CLASP_CAST.endMs ? 'yes' : 'no');
            gestureLockUntilMs = 0;
            const claspVoice0 = audioPlayCounts['purple-clasp'];
            step(clasp2(), 10); // ~0.3 s: cast started, voice not due yet
            markState('clasp cast starts', 'cast', claspCast ? 'cast' : 'idle');
            markState('clasp pose does not become void', 'neutral', currentTech);
            markState('clasp starts in the blue phase', 'blue', claspCast ? claspCast.phase : 'ended');
            markState('clasp voice waits for 0.5 s', 'silent',
                audioPlayCounts['purple-clasp'] === claspVoice0 ? 'silent' : 'played');
            markState('clasp blue orb sits on the right, red absent', 'right', (() => {
                const l = claspOrbLayout(700, 75);
                return (l.blue.visible && !l.red.visible && l.blue.x > 0) ? 'right' : 'wrong';
            })());
            markState('clasp blue grows to at least half the screen', 'big', (() => {
                const halfW = 75; // so the full view width is 150; half of it is 75
                const l = claspOrbLayout(CLASP_CAST.blueGrowMs, halfW);
                return (l.blue.radius * 2 >= halfW) ? 'big' : 'small';
            })());
            step(clasp2(), 15); // cross 0.5 s while still holding
            markState('clasp voice starts 0.5 s after the trigger', 'played',
                audioPlayCounts['purple-clasp'] === claspVoice0 + 1 ? 'played' : 'silent');
            step(clasp2(), 10);
            markState('clasp voice plays once per cast', 'once',
                audioPlayCounts['purple-clasp'] === claspVoice0 + 1 ? 'once' : 'replayed');
            markState('clasp red grows on the left after the blue', 'left', (() => {
                const l = claspOrbLayout(CLASP_CAST.blueGrowMs + 300, 75);
                return (l.blue.radius > 0 && l.red.visible && l.red.x < 0) ? 'left' : 'wrong';
            })());
            markState('clasp orbs are symmetric when red is full', 'symmetric', (() => {
                const l = claspOrbLayout(CLASP_CAST.redEndMs, 75);
                return (Math.abs(Math.abs(l.blue.x) - Math.abs(l.red.x)) < 0.001
                    && Math.abs(l.blue.radius - l.red.radius) < 0.001) ? 'symmetric' : 'asymmetric';
            })());
            // Jump the state machine to each phase on the synthetic clock.
            claspCast.startMs = t - CLASP_CAST.redStartMs - 100;
            updateClaspCast(t);
            markState('clasp red phase follows the blue', 'red', claspCast ? claspCast.phase : 'ended');
            claspCast.startMs = t - CLASP_CAST.redEndMs - 100;
            updateClaspCast(t);
            markState('clasp converge phase follows the red', 'converge', claspCast ? claspCast.phase : 'ended');
            claspCast.startMs = t - CLASP_CAST.collideStartMs - 10;
            updateClaspCast(t);
            markState('clasp purple vortex phase starts after 7 s', 'purple', claspCast ? claspCast.phase : 'ended');
            markState('clasp vortex core appears at the centre', 'visible', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const l = claspVortexLayout(CLASP_CAST.convergeEndMs + 1000, 75);
                return l.core.visible && l.core.radius > 0 ? 'visible' : 'hidden';
            })());
            markState('clasp vortex fills a readable share of the view', 'big', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const l = claspVortexLayout(CLASP_CAST.convergeEndMs + 2000, 75);
                return l.core.radius >= 75 * 0.18 ? 'big' : 'small';
            })());
            markState('clasp vortex gyro rings tilt apart', 'varied', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const l = claspVortexLayout(CLASP_CAST.convergeEndMs + 2000, 75);
                const rings = l.rings.filter((ring) => ring.visible);
                const tilts = new Set(rings.map((ring) => ring.tilt.toFixed(2)));
                return rings.length >= 3 && tilts.size >= 2 ? 'varied' : 'flat';
            })());
            markState('clasp vortex slams on the beat', 'slam',
                claspCollisionPulse(CLASP_CAST.collideStartMs) > 0.9 ? 'slam' : 'idle');
            markState('clasp vortex rebounds between collisions', 'open',
                claspCollisionPulse(CLASP_CAST.collideStartMs + CLASP_CAST.collideIntervalMs * 0.5) < 0.05 ? 'open' : 'closed');
            markState('clasp shockwave expands after a collision', 'expanding', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const a = claspVortexLayout(CLASP_CAST.collideStartMs + 100, 75);
                const b = claspVortexLayout(CLASP_CAST.collideStartMs + 500, 75);
                return (a.shock.visible && b.shock.visible && b.shock.radius > a.shock.radius + 1) ? 'expanding' : 'static';
            })());
            markState('clasp shockwave fades before the next beat', 'faded', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const l = claspVortexLayout(CLASP_CAST.collideStartMs + CLASP_CAST.collideIntervalMs - 50, 75);
                return l.shock.visible ? 'visible' : 'faded';
            })());
            markState('clasp vortex hides for the blast', 'hidden', (() => {
                if (typeof claspVortexLayout !== 'function') return 'missing';
                const l = claspVortexLayout(CLASP_CAST.explodeAtMs, 75);
                return l.core.visible ? 'visible' : 'hidden';
            })());
            claspCast.startMs = t - CLASP_CAST.explodeAtMs;
            updateClaspCast(t);
            markState('clasp bursts into purple at 20 s', 'burst', claspCast ? claspCast.phase : 'ended');
            markState('clasp blast is active', 'yes', purpleExplosionUntilMs > t ? 'yes' : 'no');
            claspCast.startMs = t - CLASP_CAST.endMs - 1;
            updateClaspCast(t);
            markState('clasp cast ends after the aftermath', 'ended', claspCast ? 'active' : 'ended');
            // A held clasp cannot immediately recast (pose must be released).
            step(clasp2(), 10);
            markState('clasp cooldown blocks recast', 'idle', claspCast ? 'cast' : 'idle');
            step([], 30); // release the pose so the clasp can re-arm
            step(clasp2(), 70); // hold through the 2s cooldown; it should fire once it expires
            markState('clasp recast after cooldown', 'cast', claspCast ? 'cast' : 'idle');
            finishClasp();
            step([], 70); // drain the recast's 2s cooldown
            // Open clasp hands held far apart stay neutral (Red is paused in 茈 mode).
            step(claspFar2(), 20);
            markState('far clasp-family pose is not clasp', 'no-cast', claspCast ? 'cast' : 'no-cast');
            markState('far clasp-family pose stays neutral', 'neutral', currentTech);
            step([], 100);

            // MediaPipe often drops one hand mid-clasp. The remaining hand IS the open half
            // of the pose; the run already accumulated must still cast.
            step(clasp2(), 2);
            markState('clasp warming before a hand drops', 'warming',
                claspCast ? 'cast' : (claspRunFrames > 0 ? 'warming' : 'idle'));
            step(soloOpen(), 30);
            markState('dropped-hand clasp does not fire red', 'ok',
                currentTech === 'red' ? 'red' : 'ok');
            markState('dropped-hand clasp still casts', 'cast', claspCast ? 'cast' : 'idle');
            finishClasp();
            step([], 220); // drain the cast cooldown
            // Back to normal mode for the red checks below.
            setPurpleMode(false);
            step([], 20);
            step(red1(0.5), 30);
            markState('lone index hand still fires red', 'red', currentTech);
            step([], 100);

            // --- 無量空処 hold-3s: the domain cinematic enters by itself ---
            // Holding the domain past 3 s must auto-play the ported opening animation
            // (no title/Enter UI), then hand the centre over to the particle ring.
            step([], 220); // drain the previous void trigger's cooldown
            step(void1(0.5), 20); // re-enter the domain
            step(void1(0.5), 60); // ~2.1–2.4 s since the entry frame: under the 3 s hold
            markState('void under 3s no cinematic', 'no', voidCinematic ? 'yes' : 'no');
            step(void1(0.5), 30); // cross the 3 s hold threshold
            markState('void held 3s starts cinematic', 'yes', voidCinematic ? 'yes' : 'no');
            markState('cinematic hides UI chrome', 'yes',
                document.body.classList.contains('void-cinema') ? 'yes' : 'no');
            // Fast-forward the timeline on the synthetic clock: the ring hand-off...
            voidCinematic.startMs = t - (VOID_CINEMA.ringAtMs + VOID_CINEMA.ringFadeMs * 0.5);
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('cinematic ring reveals void field', 'yes', particles.visible ? 'yes' : 'no');
            markState('cinematic field fades in', 'yes', particleMaterial.opacity > 0.4 ? 'yes' : 'no');
            markState('cinematic streaks dissolve', 'yes', voidStreakMaterial.opacity < 0.7 ? 'yes' : 'no');
            // The black stage now holds for 10 s after the ring appears: the ring sits on
            // black, fully lit, right up to the fade.
            voidCinematic.startMs = t - (VOID_CINEMA.blackFadeAtMs - 500);
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('ring holds on black before fade', 'yes',
                (particleMaterial.opacity > 0.95 && Number(voidCinemaEl.style.opacity) > 0.95) ? 'yes' : 'no');
            // After the stage fades away the background is transparent and the ring is still
            // there; only then does the ring itself fade out.
            voidCinematic.startMs = t - (VOID_CINEMA.blackFadeAtMs + VOID_CINEMA.blackFadeMs + 200);
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('black stage fades, ring stays', 'yes',
                (Number(voidCinemaEl.style.opacity) < 0.05 && particleMaterial.opacity > 0.95) ? 'yes' : 'no');
            voidCinematic.startMs = t - (VOID_CINEMA.ringOutAtMs + VOID_CINEMA.ringOutMs * 0.5);
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('ring fades at the tail', 'yes',
                (particleMaterial.opacity > 0.2 && particleMaterial.opacity < 0.8) ? 'yes' : 'no');
            // ...and the end must restore the app chrome and the field.
            voidCinematic.startMs = t - VOID_CINEMA.endMs - 1;
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('cinematic ends and restores UI', 'no',
                document.body.classList.contains('void-cinema') ? 'yes' : 'no');
            // One play per hold: still holding the sign must not loop the animation.
            step(void1(0.5), 120);
            markState('cinematic no loop while holding', 'no', voidCinematic ? 'yes' : 'no');
            step([], 30); // release the domain (re-arms the hold award)
            step(void1(0.5), 20);
            step(void1(0.5), 100); // hold past 3 s again
            markState('cinematic replays after re-entry', 'yes', voidCinematic ? 'yes' : 'no');
            voidCinematic.startMs = t - VOID_CINEMA.endMs - 1;
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            step([], 30);

            // --- 長時間無量空処: the left-rail switch selects the long timeline + 31 s voice ---
            const longBtn = document.querySelector('#settings-list [data-action="voidlong"]');
            markState('long void switch exists', 'yes', longBtn ? 'yes' : 'no');
            if (longBtn) longBtn.click();
            markState('long void switch toggles on', 'on',
                (voidLongMode && document.querySelector('#settings-list [data-action="voidlong"]')
                    ?.getAttribute('aria-checked') === 'true') ? 'on' : 'off');
            markState('long timeline outlives its voice', 'yes',
                VOID_CINEMA_LONG.endMs > VOID_CINEMA_LONG.audioMs + 1000 ? 'yes' : 'no');
            step([], 240); // drain cooldowns before the long hold
            const lv0 = audioPlayCounts['void-long'];
            const vs0 = audioPlayCounts.void;
            step(void1(0.5), 20); // enter the domain
            markState('long void under 1 s no cinematic', 'no', voidCinematic ? 'yes' : 'no');
            step(void1(0.5), 20); // cross the 1 s long hold: the voice starts right here
            markState('long void plays the long voice at the 1 s trigger', 'played',
                audioPlayCounts['void-long'] === lv0 + 1 ? 'played' : 'silent');
            markState('long void skips the short voice', 'skipped',
                audioPlayCounts.void === vs0 ? 'skipped' : 'played');
            step(void1(0.5), 200); // ~6.6 s more: still inside the 8 s pre-black wait
            markState('long void waits 8 s before cinematic', 'no', voidCinematic ? 'yes' : 'no');
            step(void1(0.5), 60); // ~2 s more: the 8 s wait has elapsed since the 1 s trigger
            markState('long void starts long cinematic after 8 s', 'yes',
                (voidCinematic && voidCinematic.long) ? 'yes' : 'no');
            markState('long voice does not replay at cinematic start', 'once',
                audioPlayCounts['void-long'] === lv0 + 1 ? 'once' : 'replayed');
            voidCinematic.startMs = t - VOID_CINEMA_LONG.endMs - 1;
            voidCinematic.lastMs = t;
            updateVoidCinematic(t);
            markState('long cinematic ends after the voice', 'ended', voidCinematic ? 'active' : 'ended');
            const longBtnOff = document.querySelector('#settings-list [data-action="voidlong"]');
            if (longBtnOff) longBtnOff.click();
            markState('long void switch toggles off', 'off', voidLongMode ? 'on' : 'off');
            step([], 40);

            // --- Audio block: one row per local clip; clicking plays it ---
            const audioRows = document.querySelectorAll('#audio-list .audio-row');
            markState('audio block lists every clip', '9', String(audioRows.length));
            markState('audio block includes the clasp track', 'yes',
                document.querySelector('#audio-list [data-audio="purple-clasp"]') ? 'yes' : 'no');
            const pc0 = audioPlayCounts['purple-clasp'];
            const claspRow = document.querySelector('#audio-list [data-audio="purple-clasp"]');
            if (claspRow) claspRow.click();
            markState('audio row click plays the clip', 'played',
                (audioPlayCounts['purple-clasp'] === pc0 + 1 && lastAudioKey === 'purple-clasp')
                    ? 'played' : 'silent');
            // The two new clips are click-only: no gesture may ever fire them.
            markState('audio block includes the failure clip', 'yes',
                document.querySelector('#audio-list [data-audio="fail"]') ? 'yes' : 'no');
            markState('audio block includes the creed clip', 'yes',
                document.querySelector('#audio-list [data-audio="creed"]') ? 'yes' : 'no');
            const failRow = document.querySelector('#audio-list [data-audio="fail"]');
            const failClicks0 = audioPlayCounts.fail || 0;
            if (failRow) failRow.click();
            markState('failure clip plays on click', 'played',
                ((audioPlayCounts.fail || 0) === failClicks0 + 1 && lastAudioKey === 'fail')
                    ? 'played' : 'silent');
            const creedRow = document.querySelector('#audio-list [data-audio="creed"]');
            const creedClicks0 = audioPlayCounts.creed || 0;
            if (creedRow) creedRow.click();
            markState('creed clip plays on click', 'played',
                ((audioPlayCounts.creed || 0) === creedClicks0 + 1 && lastAudioKey === 'creed')
                    ? 'played' : 'silent');
            const audioListText = document.getElementById('audio-list')?.textContent || '';
            markState('audio labels drop the old year', 'clean',
                (!audioListText.includes('2026') && audioListText.includes('虚式「茈」· 短'))
                    ? 'clean' : 'stale');
            markState('purple voice uses the renamed clip', 'purple-short',
                (document.getElementById('purple-voice')?.getAttribute('src') || '').includes('purple-short')
                    ? 'purple-short' : 'wrong');

            // --- Left rail: three small sub-menu tabs at the top ---
            markState('about shows the build tag', BUILD_TAG,
                document.getElementById('build-tag')?.textContent || 'missing');
            const viewportMeta = document.querySelector('meta[name="viewport"]');
            markState('viewport meta enables phone layout', 'device-width',
                (viewportMeta && (viewportMeta.getAttribute('content') || '').includes('width=device-width'))
                    ? 'device-width' : 'missing');
            const camVideoEl = document.querySelector('.input_video');
            markState('camera video is inline and muted', 'inline|true',
                camVideoEl
                    ? ((camVideoEl.hasAttribute('playsinline') ? 'inline' : 'no-inline')
                        + '|' + (camVideoEl.muted ? 'true' : 'false'))
                    : 'missing');
            const styleText = Array.from(document.querySelectorAll('style'))
                .map((el) => el.textContent).join('\n');
            markState('phone layout has a small-screen rule', 'yes',
                styleText.includes('@media (max-width: 600px)') ? 'yes' : 'no');
            const railTabs = document.querySelectorAll('#left-rail .rail-tab');
            markState('left rail has three sub-menu tabs', '3', String(railTabs.length));
            markState('rail tab order', 'main,guide,about',
                Array.from(railTabs).map((b) => b.dataset.tab).join(','));
            const mainPanel = document.querySelector('#rail-panel-main');
            const guidePanel = document.querySelector('#rail-panel-guide');
            const aboutPanel = document.querySelector('#rail-panel-about');
            markState('main tab is open by default', 'main',
                (mainPanel && !mainPanel.hidden && guidePanel && guidePanel.hidden
                    && aboutPanel && aboutPanel.hidden) ? 'main' : 'other');
            markState('main tab holds settings and audio', 'both',
                (mainPanel && mainPanel.contains(document.getElementById('settings-list'))
                    && mainPanel.contains(document.getElementById('audio-list'))) ? 'both' : 'missing');
            if (railTabs[1]) railTabs[1].click();
            markState('guide tab switches the panel', 'guide',
                (guidePanel && !guidePanel.hidden && mainPanel && mainPanel.hidden) ? 'guide' : 'other');
            const guideText = document.getElementById('gesture-guide')?.textContent || '';
            markState('guide drops the old year', 'clean',
                !guideText.includes('2026') ? 'clean' : 'stale');
            if (railTabs[2]) railTabs[2].click();
            markState('about tab switches the panel', 'about',
                (aboutPanel && !aboutPanel.hidden && guidePanel && guidePanel.hidden) ? 'about' : 'other');
            const aboutText = document.getElementById('about-body')?.textContent || '';
            markState('about credits the manga author', 'yes',
                (aboutText.includes('芥见下下') && aboutText.includes('Gege Akutami')) ? 'yes' : 'no');
            markState('about lists both bilibili videos with thanks', '2/2',
                ['BV17XMf6nE1v', 'BV1QC3G6DEKX']
                    .filter((id) => document.querySelector('#about-body a[href*="' + id + '"]')).length + '/2');
            markState('about gives an infringement contact email', 'yes',
                document.querySelector('#about-body a[href="mailto:shanyaojinjin@gmail.com"]') ? 'yes' : 'no');
            markState('about links the owner repo', 'ShanyJin/SAT0RU',
                document.querySelector('#about-body a[href="https://github.com/ShanyJin/SAT0RU"]')
                    ?.textContent.trim() || 'missing');
            markState('about says all assets come from the internet', 'yes',
                aboutText.includes('所有素材均来源于网络') ? 'yes' : 'no');
            markState('about credits the two build models', 'yes',
                aboutText.includes('本应用由 DeepSeek-V4.1 flash 跟 Gemini 4 Neon 共同完成') ? 'yes' : 'no');
            if (railTabs[0]) railTabs[0].click();
            markState('main tab returns', 'main', (mainPanel && !mainPanel.hidden) ? 'main' : 'hidden');
            markState('settings keep debug/voice/voidlong/egg', 'debug,voice,voidlong,egg',
                Array.from(document.querySelectorAll('#settings-list [data-action]'))
                    .map((row) => row.dataset.action).join(','));
            markState('synthesized SFX are gone for good', 'gone',
                (typeof playSfx === 'undefined' && typeof sfxEnabled === 'undefined') ? 'gone' : 'left');

            // --- 语音 switch: the technique voices' master gate ---
            // Default ON; gesture-triggered clips honour the switch, manual clicks in the
            // audio library always play.
            const voiceQuery = () => document.querySelector('#settings-list [data-action="voice"]');
            markState('technique voices are on by default', 'on',
                (typeof voiceEnabled !== 'undefined' && voiceEnabled) ? 'on' : 'off');
            const vc0 = audioPlayCounts.fail;
            playAudioClip('fail'); // the gesture-triggered path
            markState('gesture voice plays while the switch is on', 'played',
                audioPlayCounts.fail === vc0 + 1 ? 'played' : 'silent');
            stopAudioClip();
            if (voiceQuery()) voiceQuery().click();
            markState('voice switch turns off', 'off',
                (typeof voiceEnabled !== 'undefined' && !voiceEnabled
                    && voiceQuery() && voiceQuery().getAttribute('aria-checked') === 'false') ? 'off' : 'on');
            playAudioClip('fail');
            markState('gesture voice is silent when switched off', 'silent',
                audioPlayCounts.fail === vc0 + 1 ? 'silent' : 'played');
            toggleAudioClip('fail'); // a manual click in the left-rail audio library
            markState('manual audio-library click still plays when voices are off', 'played',
                audioPlayCounts.fail === vc0 + 2 ? 'played' : 'silent');
            stopAudioClip();
            if (voiceQuery()) voiceQuery().click(); // back on for the demos
            markState('voice switch turns back on', 'on',
                (typeof voiceEnabled !== 'undefined' && voiceEnabled) ? 'on' : 'off');

            // --- A long clip whose play() rejected gets one retry on the next gesture,
            // but that retry must pass the same voice gate and stage bookkeeping as a
            // normal play (no 31-second clip sneaking in after voices are switched off).
            pendingAudioRetry.clear(); // earlier technique tests may have queued other clips
            const longEl = audioTracksByKey['void-long'].el;
            const longPlay = longEl.play;
            let retryPlays = 0;
            longEl.play = () => { retryPlays += 1; return Promise.reject(new Error('blocked')); };
            playAudioClip('void-long');
            await Promise.resolve(); await Promise.resolve();
            markState('a rejected long clip queues a retry', 'queued',
                pendingAudioRetry.has('void-long') ? 'queued' : 'missing');
            stopAudioClip();
            if (voiceQuery()) voiceQuery().click(); // voices off
            longEl.play = () => { retryPlays += 1; return Promise.resolve(); };
            retryPlays = 0;
            window.dispatchEvent(new PointerEvent('pointerdown'));
            await Promise.resolve();
            markState('long clip retry respects the voice gate', '0', String(retryPlays));
            markState('long clip retry is dropped while voices are off', 'no',
                pendingAudioRetry.has('void-long') ? 'still queued' : 'no');
            if (voiceQuery()) voiceQuery().click(); // voices back on
            longEl.play = () => { retryPlays += 1; return Promise.reject(new Error('blocked')); };
            playAudioClip('void-long');
            await Promise.resolve(); await Promise.resolve();
            stopAudioClip(); // the stage is free, but the retry is still queued
            const longCount = audioPlayCounts['void-long'];
            longEl.play = () => { retryPlays += 1; return Promise.resolve(); };
            window.dispatchEvent(new PointerEvent('pointerdown'));
            await Promise.resolve();
            markState('long clip retry takes over the audio stage', 'void-long', activeAudioKey);
            markState('long clip retry counts as a normal play', String(longCount + 1),
                String(audioPlayCounts['void-long']));
            stopAudioClip();
            pendingAudioRetry.clear();
            longEl.play = longPlay;

            // --- First-run gate: welcome modal -> four-page tutorial -> camera opt-in ---
            const introModalEl = document.getElementById('intro-modal');
            markState('first visit shows the intro modal', 'visible',
                introModalEl && !introModalEl.hidden ? 'visible' : 'hidden');
            const introPages = Array.from(document.querySelectorAll('#intro-modal [data-intro-page]'));
            markState('intro has welcome plus four technique pages', '5', String(introPages.length));
            const welcomeText = document.querySelector('#intro-modal [data-intro-page="welcome"]')?.textContent || '';
            markState('intro credits the manga author, original project, fork author and site',
                'ok ok ok ok',
                [welcomeText.includes('芥见下下'), welcomeText.includes('reinesana/SAT0RU'),
                    welcomeText.includes('闪耀金金'), welcomeText.includes('shany.cc')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('intro promises local-only processing', 'yes',
                (welcomeText.includes('不会上传任何内容') && welcomeText.includes('MediaPipe Hands')) ? 'yes' : 'no');
            markState('intro carries the asset notice and contact', 'yes',
                (welcomeText.includes('所有用到的素材均来源于网络')
                    && welcomeText.includes('shanyaojinjin@gmail.com')) ? 'yes' : 'no');
            markState('intro asks for a bright clear play space', 'yes',
                (welcomeText.includes('光线充足') && welcomeText.includes('背景清晰')) ? 'yes' : 'no');
            markState('welcome lists supported browsers', 'yes',
                ['Chrome', 'Edge', 'Firefox', 'Safari'].every((b) => welcomeText.includes(b)) ? 'yes' : 'no');
            markState('welcome warns about performance', 'yes',
                (welcomeText.includes('硬件加速') && welcomeText.includes('1–3 fps')) ? 'yes' : 'no');
            const introTechPages = Array.from(document.querySelectorAll('#intro-modal [data-intro-tech]'));
            markState('tutorial technique order', 'blue,red,purple,void',
                introTechPages.map((p) => p.dataset.introTech).join(','));
            const introImgs = Array.from(document.querySelectorAll('#intro-modal .intro-figure img'));
            const introImgSources = introImgs.map((img) => img.getAttribute('data-src') || '');
            markState('tutorial images are local webp files', 'local,local,local,local',
                introImgSources.map((src) => (src.startsWith('/assets/tutorial/') && src.endsWith('.webp') ? 'local' : 'remote')).join(','));
            const introImgServed = await Promise.all(introImgSources.map(async (src) => {
                try { return (await fetch(src)).ok; } catch (e) { return false; }
            }));
            markState('tutorial image files are served', '4/4',
                introImgServed.filter(Boolean).length + '/4');
            markState('tutorial images wait for their page', '0/4',
                introImgs.filter((img) => img.getAttribute('src')).length + '/4');
            const introStepEl = document.getElementById('intro-step');
            markState('intro starts at step one', '01 / 05', introStepEl ? introStepEl.textContent.trim() : 'missing');
            const introAck = document.querySelector('#intro-modal [data-intro-action="ack"]');
            markState('intro acknowledgement button exists', 'yes', introAck ? 'yes' : 'no');
            if (introAck) introAck.click();
            markState('acknowledgement opens the blue tutorial', 'blue',
                document.querySelector('#intro-modal [data-intro-page="blue"]:not([hidden])') ? 'blue' : 'other');
            const introNext = document.querySelector('#intro-modal [data-intro-action="next"]');
            if (introNext) { introNext.click(); introNext.click(); introNext.click(); }
            markState('tutorial walks through to the void page', 'void',
                document.querySelector('#intro-modal [data-intro-page="void"]:not([hidden])') ? 'void' : 'other');
            markState('tutorial images load as their pages open', '4/4',
                introImgs.filter((img) => (img.getAttribute('src') || '').endsWith('.webp')).length + '/4');
            const purpleIntroText = document.querySelector('#intro-modal [data-intro-page="purple"]')?.textContent || '';
            markState('purple tutorial text drops the old year', 'clean',
                (!purpleIntroText.includes('2026') && purpleIntroText.includes('茈的短语音'))
                    ? 'clean' : 'stale');
            if (introNext) introNext.click();
            markState('finishing the tutorial closes the modal', 'closed',
                introModalEl && introModalEl.hidden ? 'closed' : 'open');
            markState('intro gate reaches the app', 'yes',
                (typeof introDone !== 'undefined' && introDone) ? 'yes' : 'no');

            // --- Camera opt-in: the switch is the only path to the camera/model ---
            markState('camera and model are idle before opt-in', 'off',
                (typeof cameraEnabled !== 'undefined' && !cameraEnabled
                    && typeof cameraStarted !== 'undefined' && !cameraStarted
                    && (typeof cameraUtils === 'undefined' || !cameraUtils)
                    && (typeof hands === 'undefined' || !hands)) ? 'off' : 'on');
            const startBtn = document.getElementById('start-btn');
            markState('top bar holds the start button', 'yes', startBtn ? 'yes' : 'no');
            markState('start button defaults off with a click-to-start label', 'false|启动',
                startBtn ? (startBtn.getAttribute('aria-pressed') + '|'
                    + ((startBtn.querySelector('#start-btn-label') || {}).textContent || '')) : 'missing');
            const camOrigStart = (typeof cameraPipeline !== 'undefined') ? cameraPipeline.start : null;
            const camOrigStop = (typeof cameraPipeline !== 'undefined') ? cameraPipeline.stop : null;
            let camStartCalls = 0;
            let camStopCalls = 0;
            if (startBtn && typeof cameraPipeline !== 'undefined' && cameraPipeline.start) {
                cameraPipeline.start = () => { camStartCalls += 1; cameraStarted = true; return Promise.resolve(); };
                cameraPipeline.stop = () => { camStopCalls += 1; cameraStarted = false; };
            }
            if (startBtn) startBtn.click();
            markState('start button calls the camera once', '1', String(camStartCalls));
            await new Promise((resolve) => setTimeout(resolve, 0));
            markState('start button waits for tracking', '等待追踪|waiting',
                ((document.getElementById('start-btn-label') || {}).textContent || 'missing') + '|'
                + (startBtn?.dataset.state || 'missing'));
            markState('start button shows running', 'true',
                startBtn?.getAttribute('aria-pressed') || 'missing');
            if (startBtn) startBtn.click();
            markState('switching off stops the camera', '1', String(camStopCalls));
            markState('start button returns to off', 'false',
                startBtn?.getAttribute('aria-pressed') || 'missing');
            markState('settings no longer hold the start row', 'none',
                document.querySelector('#settings-list [data-action="start"]') ? 'found' : 'none');
            if (typeof cameraPipeline !== 'undefined' && camOrigStart) {
                cameraPipeline.start = camOrigStart;
                cameraPipeline.stop = camOrigStop;
            }

            // --- 自定义无量空处: cut the transit into a full-screen Bilibili video ---
            try { localStorage.removeItem('sat0ru.voidEggCustom'); } catch (e) { /* ignore */ }
            if (typeof voidEggCustom !== 'undefined') voidEggCustom = null;
            voidEggVersion = 1;
            updateKeybindMenu();
            const eggRow = document.querySelector('#settings-list [data-action="egg"]');
            markState('settings include the custom void easter egg', 'yes', eggRow ? 'yes' : 'no');
            markState('custom void defaults off', 'off',
                (eggRow && eggRow.getAttribute('aria-checked') === 'false'
                    && typeof voidEggEnabled !== 'undefined' && !voidEggEnabled) ? 'off' : 'on');
            if (eggRow) eggRow.click();
            markState('custom void switch turns on', 'true',
                document.querySelector('#settings-list [data-action="egg"]')?.getAttribute('aria-checked') || 'missing');
            const eggPanelEl = document.getElementById('egg-panel');
            markState('egg panel opens with the switch', 'open',
                eggPanelEl && !eggPanelEl.hidden ? 'open' : 'closed');
            markState('egg info starts collapsed', 'true',
                document.getElementById('egg-info')?.hidden === true ? 'true' : 'false');
            const eggInfoText = document.getElementById('egg-info')?.textContent || '';
            markState('egg info explains the custom video', 'yes',
                (eggInfoText.includes('版本 3') && eggInfoText.includes('BV')) ? 'yes' : 'no');
            const eggInfoToggle = document.getElementById('egg-info-toggle');
            if (eggInfoToggle) {
                eggInfoToggle.click();
            }
            markState('egg info arrow expands the description', 'true|false',
                (eggInfoToggle?.getAttribute('aria-expanded') || 'missing') + '|'
                + (document.getElementById('egg-info')?.hidden ? 'true' : 'false'));
            const eggVersionBtns = Array.from(document.querySelectorAll('#egg-panel [data-egg-version]'));
            markState('egg offers three versions and starts at one', '3|1',
                eggVersionBtns.length + '|' + (typeof voidEggVersion !== 'undefined' ? String(voidEggVersion) : '?'));
            if (eggVersionBtns[1]) eggVersionBtns[1].click();
            markState('egg version two is selected', '2|true',
                (typeof voidEggVersion !== 'undefined' ? String(voidEggVersion) : '?') + '|'
                + (document.querySelector('#egg-panel [data-egg-version="2"]')?.getAttribute('aria-pressed') || 'missing'));
            const eggOverlay = document.getElementById('void-egg');
            markState('void egg overlay starts hidden', 'hidden',
                eggOverlay && eggOverlay.hidden ? 'hidden' : 'visible');
            step([], 240); // drain the previous void cooldown
            step(void1(0.5), 20);
            step(void1(0.5), 130); // hold past 3 s: the cinematic starts
            markState('void cinematic arms for the egg', 'yes', voidCinematic ? 'yes' : 'no');
            if (voidCinematic) {
                voidCinematic.startMs = t - (VOID_CINEMA.ringAtMs - 100);
                voidCinematic.lastMs = t;
                updateVoidCinematic(t);
            }
            markState('egg waits for the transit to finish', 'hidden|active',
                (eggOverlay && eggOverlay.hidden ? 'hidden' : 'visible') + '|'
                + (voidCinematic ? 'active' : 'ended'));
            if (voidCinematic) {
                voidCinematic.startMs = t - VOID_CINEMA.ringAtMs;
                voidCinematic.lastMs = t;
                updateVoidCinematic(t);
            }
            markState('egg cuts in when the transit ends', 'visible|ended',
                (eggOverlay && !eggOverlay.hidden ? 'visible' : 'hidden') + '|'
                + (voidCinematic ? 'active' : 'ended'));
            const eggFrame = document.getElementById('void-egg-frame');
            const eggSrc = eggFrame ? (eggFrame.getAttribute('src') || '') : '';
            markState('egg plays the selected bilibili video', 'yes',
                (eggSrc.includes('BV1QC3G6DEKX') && eggSrc.includes('cid=40301496754')
                    && eggSrc.includes('autoplay=1')) ? 'yes' : (eggSrc || 'none'));
            const eggClose = document.getElementById('void-egg-close');
            if (eggClose) eggClose.click();
            markState('egg can be closed and clears the iframe', 'hidden|cleared',
                (eggOverlay && eggOverlay.hidden ? 'hidden' : 'visible') + '|'
                + (!eggFrame || !eggFrame.getAttribute('src') || eggFrame.getAttribute('src') === 'about:blank'
                    ? 'cleared' : 'loaded'));
            // Version 3: the viewer pastes a Bilibili share link; the app builds its own player URL.
            const shortParse = parseBilibiliShareUrl('https://b23.tv/abc123');
            markState('custom egg rejects b23.tv short links', 'short',
                shortParse.ok ? 'accepted' : shortParse.reason);
            const parsedShare = parseBilibiliShareUrl(
                'https://www.bilibili.com/video/BV1xx411c7mD/?p=2&share_source=copy_web');
            markState('custom egg parser extracts the BV id and page', 'BV1xx411c7mD|2',
                parsedShare.ok ? parsedShare.video.bvid + '|' + parsedShare.video.page : 'failed');
            const plainParse = parseBilibiliShareUrl('https://example.com/hello');
            markState('custom egg rejects text without a video id', 'novideo',
                plainParse.ok ? 'accepted' : plainParse.reason);
            if (eggVersionBtns[2]) eggVersionBtns[2].click();
            markState('egg version three waits for a link', '3|false',
                (typeof voidEggVersion !== 'undefined' ? String(voidEggVersion) : '?') + '|'
                + (hasVoidEggVideo(3) ? 'true' : 'false'));
            markState('custom egg input appears for version three', 'shown',
                document.getElementById('egg-custom') && !document.getElementById('egg-custom').hidden
                    ? 'shown' : 'hidden');
            const customInput = document.getElementById('egg-custom-url');
            const customSave = document.getElementById('egg-custom-save');
            if (customInput) {
                customInput.value = 'https://www.bilibili.com/video/BV1xx411c7mD/?p=3';
                customInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (customSave) customSave.click();
            markState('custom egg saves the pasted link', '3|true',
                (typeof voidEggVersion !== 'undefined' ? String(voidEggVersion) : '?') + '|'
                + (hasVoidEggVideo(3) ? 'true' : 'false'));
            const customUrl = buildVoidEggUrl(3);
            markState('custom egg plays through the bilibili player', 'yes',
                (customUrl.startsWith('https://player.bilibili.com/player.html')
                    && customUrl.includes('bvid=BV1xx411c7mD') && customUrl.includes('page=3')
                    && customUrl.includes('autoplay=1')) ? 'yes' : customUrl);
            let savedCustom = null;
            try { savedCustom = JSON.parse(localStorage.getItem('sat0ru.voidEggCustom') || 'null'); } catch (e) { savedCustom = null; }
            markState('custom egg link persists locally', 'BV1xx411c7mD|3',
                (savedCustom && savedCustom.bvid ? savedCustom.bvid : 'none') + '|'
                + (savedCustom && savedCustom.page ? String(savedCustom.page) : '?'));
            const customNote = document.getElementById('egg-custom-note')?.textContent || '';
            markState('custom egg confirms the saved link', 'yes',
                customNote.includes('BV1xx411c7mD') ? 'yes' : (customNote || 'missing'));
            const eggRowOff = document.querySelector('#settings-list [data-action="egg"]');
            if (eggRowOff) eggRowOff.click();
            markState('egg switch turns off again', 'off',
                (typeof voidEggEnabled !== 'undefined' && !voidEggEnabled) ? 'off' : 'on');
            step([], 40); // release the held void sign before the demos

            // --- Technique call-out subtitles: traditional lines that ride the voice clips ---
            // Only a clip that actually starts gets a line (voice switch off => no audio =>
            // no line), the line lasts exactly as long as its clip, and 無量空処's line is
            // gone before the black stage takes the ring away.
            const subEl = document.getElementById('technique-subtitle');
            markState('call-out subtitle element exists', 'yes|zh-Hant|hidden',
                subEl
                    ? 'yes|' + subEl.getAttribute('lang') + '|'
                        + (subEl.getAttribute('aria-hidden') === 'true' ? 'hidden' : 'exposed')
                    : 'missing');
            const callOutText = (key) => {
                const track = audioTracksByKey[key];
                if (!track) return 'no-track';
                playAudioClip(key, true);
                showTechniqueSubtitle(key, track.el);
                const el = document.getElementById('technique-subtitle');
                return el ? el.textContent.trim() : 'missing';
            };
            markState('call-out lines are traditional fansub titles',
                '術式順轉『蒼』|術式反轉『赫』|虛式『茈』|領域展開『無量空處』',
                [callOutText('blue'), callOutText('he-1'), callOutText('purple'), callOutText('void')].join('|'));
            // A line only shows for the clip that is currently playing (voice gate + failed
            // play both leave the stage clean); asking for another clip's line is ignored.
            playAudioClip('purple', true);
            finishTechniqueSubtitle();
            showTechniqueSubtitle('blue', audioTracksByKey.blue.el);
            const ignoredLine = !!techniqueSubtitle ? 'leaked' : 'ignored';
            showTechniqueSubtitle('purple', audioTracksByKey.purple.el);
            markState('call-out only appears for the playing clip', 'ignored|shown',
                ignoredLine + '|' + (techniqueSubtitle && techniqueSubtitle.audioKey === 'purple' ? 'shown' : 'missing'));
            const blueTiming = subtitleTiming(SUBTITLE_FALLBACK_MS.blue);
            const shortTiming = subtitleTiming(1500);
            markState('call-out timing tracks the clip length', '3543|480|1020|480',
                [blueTiming.fadeAtMs, blueTiming.fadeOutMs, shortTiming.fadeAtMs, shortTiming.fadeOutMs].join('|'));
            markState('call-out ends with its clip', 'exact|exact',
                (blueTiming.fadeAtMs + blueTiming.fadeOutMs === blueTiming.durationMs ? 'exact' : 'off')
                    + '|' + (shortTiming.fadeAtMs + shortTiming.fadeOutMs === shortTiming.durationMs ? 'exact' : 'off'));
            // 無量空処 pre-cut: a far-away cinematic trigger leaves the line alone, a near one
            // starts the fade, and the black stage itself never inherits a line.
            playAudioClip('void', true);
            showTechniqueSubtitle('void', audioTracksByKey.void.el);
            cueDomainSubtitleBlackCut(t + 4000, t);
            const farCut = techniqueSubtitle && !techniqueSubtitle.ending ? 'waiting' : 'ended';
            cueDomainSubtitleBlackCut(t + 120, t);
            markState('domain call-out fades on the black cut', 'waiting|ending',
                farCut + '|' + (techniqueSubtitle && techniqueSubtitle.ending ? 'ending' : 'idle'));
            startVoidCinematic(t, false);
            markState('black stage never keeps a call-out', 'cleared',
                techniqueSubtitle ? 'lingering' : 'cleared');
            finishVoidCinematic();
            voidHoldAwarded = false;
            finishTechniqueSubtitle();
            stopAudioClip();

            step([], 10); mark('end', null);

            // Optional visual demos for screenshots: ?logictest=1&end=charge|blue|red|redcast|redburn|purplecharge|purpleburst|void|voidform|voidring
            const endMode = new URLSearchParams(location.search).get('end');
            const isRedFxDemo = endMode === 'redcast' || endMode === 'redburn';
            const isPurpleDemo = endMode === 'purplecharge' || endMode === 'purpleburst';
            const isClaspDemo = endMode === 'claspblue' || endMode === 'claspred'
                || endMode === 'claspconverge' || endMode === 'claspvortex'
                || endMode === 'claspclash' || endMode === 'claspburst';
            const isVoidCinemaDemo = endMode === 'voidform' || endMode === 'voidring' || endMode === 'voidclear' || endMode === 'voidlong';
            const isEggDemo = endMode === 'voidegg';
            const isSubtitleDemo = endMode === 'sub';
            if (endMode === 'charge' || endMode === 'blue' || endMode === 'red' || isRedFxDemo || endMode === 'void' || isPurpleDemo || isClaspDemo || isVoidCinemaDemo || isEggDemo || isSubtitleDemo) {
                step([], 200);
                resetRealClockFx();
                // Screenshot helper for the test artifact only (never the app): hide the rails.
                if (new URLSearchParams(location.search).has('noui')) {
                    // Screenshot helper for the test artifact only (never the app): hide the
                    // rail and menu button. (The app's old clean-mode class is gone.)
                    const rail = document.getElementById('left-rail');
                    if (rail) rail.style.display = 'none';
                    const menuBtn = document.getElementById('menu-btn');
                    if (menuBtn) menuBtn.style.display = 'none';
                }
                if (isClaspDemo) {
                    // 虚式「茈」 two-hand clasp: trigger on synthetic hands, then freeze the
                    // long cinematic at one age so animate() draws the requested beat. The
                    // wrapper is demo-only (this file is not the app).
                    step(clasp2(), 10);
                    if (claspCast) {
                        const now = performance.now();
                        const demoAge = {
                            claspblue: CLASP_CAST.blueGrowMs * 0.75,
                            claspred: CLASP_CAST.redEndMs - 300,
                            claspconverge: CLASP_CAST.redEndMs + CLASP_CAST.convergeMs * 0.6,
                            claspvortex: CLASP_CAST.convergeEndMs + CLASP_CAST.vortexMs * 0.5,
                            claspclash: CLASP_CAST.collideStartMs + 30,
                            claspburst: CLASP_CAST.explodeAtMs + CLASP_CAST.burstMs * 0.42
                        }[endMode];
                        claspCast.voicePlayed = true; // do not fire audio when the frozen age resets
                        claspCast.startMs = now - demoAge;
                        updateClaspCast(now); // set the phase for this beat
                        updateClaspCast = (ms) => {
                            if (!claspCast) return;
                            claspCast.startMs = ms - demoAge; // hold the visual age at any fps
                            if (claspCast.phase === 'burst') {
                                // Keep the blast mid-progress for the screenshot.
                                const life = 1 - (demoAge - CLASP_CAST.explodeAtMs) / CLASP_CAST.burstMs;
                                purpleExplosionUntilMs = ms + TUNING.purpleExplosionDurationMs * life;
                                claspCooldownUntilMs = ms + CLASP_CAST.cooldownMs;
                                forcedTech = 'purple';
                                forcedUntilMs = ms + 400;
                            }
                        };
                        document.title = 'CLASP DEMO · ' + endMode.toUpperCase();
                    }
                } else if (isSubtitleDemo) {
                    // Call-out screenshot: &end=sub&call=blue|red|purple|void pins a line
                    // (no audio) so a slow software-GL capture still lands on it.
                    const callKey = ['blue', 'he-1', 'purple', 'void'].includes(
                        new URLSearchParams(location.search).get('call'))
                        ? new URLSearchParams(location.search).get('call') : 'blue';
                    const callLive = new URLSearchParams(location.search).has('live');
                    activeAudioKey = callKey; // let showTechniqueSubtitle accept the key
                    const callDurationMs = SUBTITLE_FALLBACK_MS[callKey] || 2000;
                    showTechniqueSubtitle(callKey, { duration: callDurationMs / 1000 });
                    // &live=1 keeps the real timers so a screen recording can see the
                    // entrance and the tail fade; otherwise the line is pinned for stills.
                    if (techniqueSubtitle && !callLive) clearTechniqueSubtitleTimers(techniqueSubtitle);
                    document.title = 'SUBTITLE DEMO · ' + callKey.toUpperCase();
                    if (callLive) {
                        // Sample the real transition in this browser (test artifact only):
                        // when the line becomes readable, holds, and is gone again.
                        // Compositor-driven opacity can be throttled in software rendering
                        // (the same 1-3 fps limit as WebGL), so measure the schedule instead:
                        // when the tail fade is armed, and when the line is fully gone.
                        const subElLive = document.getElementById('technique-subtitle');
                        const timing = subtitleTiming(callDurationMs);
                        const t0 = performance.now();
                        let fadedAt = -1;
                        let goneAt = -1;
                        let shownAt = -1;
                        while (performance.now() - t0 < callDurationMs + 900) {
                            const at = performance.now() - t0;
                            if (shownAt < 0 && subElLive.classList.contains('visible')) shownAt = at;
                            if (fadedAt < 0 && subElLive.classList.contains('out')) fadedAt = at;
                            if (goneAt < 0 && !techniqueSubtitle) { goneAt = at; break; }
                            await new Promise((resolve) => setTimeout(resolve, 40));
                        }
                        // One second of slack: background/software-rendered tabs batch timers.
                        const fadeOff = fadedAt < 0 ? 9999 : Math.abs(fadedAt - timing.fadeAtMs);
                        const goneOff = goneAt < 0 ? 9999 : Math.abs(goneAt - timing.durationMs);
                        const profile = 'shown' + Math.round(shownAt) + '|fade' + Math.round(fadedAt)
                            + '(±' + Math.round(fadeOff) + ')|gone' + Math.round(goneAt) + '(±' + Math.round(goneOff) + ')';
                        window.__subLiveProfile = profile; // CDP/console readout for the live check
                        // Name carries the numbers so the tab title (which only keeps the
                        // first failing line) shows the measured profile.
                        markState('call-out live schedule ' + profile, 'on-time|on-time|on-time',
                            (shownAt >= 0 ? 'on-time' : 'missing') + '|'
                                + (fadeOff <= 1000 ? 'on-time' : 'off') + '|'
                                + (goneOff <= 1000 ? 'on-time' : 'off'));
                    }
                } else if (endMode === 'void') {
                    // 無量空処: pin the domain field without needing the camera. The white
                    // inner ring + blue shell + slow rotation are the ported getVoid() effect.
                    forceTechnique('void', 999999999);
                    updateState('void', true);
                    document.title = 'VOID DEMO';
                } else if (isEggDemo) {
                    // Screenshot helper: arm the egg, jump to the transit cut, let it open the
                    // Bilibili overlay on the real clock. The player itself may need network.
                    forceTechnique('void', 999999999);
                    updateState('void', true);
                    voidEggEnabled = true;
                    voidEggVersion = 1;
                    updateKeybindMenu();
                    startVoidCinematic(performance.now(), false);
                    if (voidCinematic) {
                        const now = performance.now();
                        voidCinematic.startMs = now - VOID_CINEMA.ringAtMs;
                        voidCinematic.lastMs = now;
                        updateVoidCinematic(now);
                    }
                    document.title = 'VOID EGG DEMO';
                } else if (isVoidCinemaDemo) {
                    // 無量空処 hold-3s cinematic: pin the domain field, start the ported
                    // opening animation on the real clock, then keep its phase frozen at the
                    // beat we want to screenshot (software GL runs at 1–3fps).
                    forceTechnique('void', 999999999);
                    updateState('void', true);
                    startVoidCinematic(performance.now(), endMode === 'voidlong');
                    if (voidCinematic) {
                        const freezeMs = endMode === 'voidform'
                            ? VOID_CINEMA.formDelayMs + VOID_CINEMA.formMs * 0.85
                            : endMode === 'voidclear'
                                ? VOID_CINEMA.blackFadeAtMs + VOID_CINEMA.blackFadeMs + 300
                                : endMode === 'voidlong'
                                    ? VOID_CINEMA_LONG.ringAtMs + VOID_CINEMA_LONG.ringFadeMs * 0.5
                                    : VOID_CINEMA.ringAtMs + VOID_CINEMA.ringFadeMs * 0.5;
                        const baseUpdate = updateVoidCinematic;
                        updateVoidCinematic = (ms) => {
                            if (!voidCinematic) return;
                            // Rewriting the origin each frame freezes the phase while the
                            // formation/dissolve lerps keep running on real dt.
                            voidCinematic.startMs = ms - freezeMs;
                            baseUpdate(ms);
                        };
                    }
                    document.title = endMode === 'voidform' ? 'VOID FORM DEMO'
                        : endMode === 'voidclear' ? 'VOID CLEAR DEMO'
                        : endMode === 'voidlong' ? 'VOID LONG DEMO' : 'VOID RING DEMO';
                } else if (endMode === 'red') {
                    // Hold the gun form so the red orb sits on the synthetic hand and the
                    // ambient dust gets pushed into a ring around it (repulsion demo).
                    step(gun1(0.5), 30);
                    // The synthetic clock is far ahead of performance.now(), so the entry
                    // cast would stay frozen at age 0 (muzzle flash + compressed orb).
                    // Drop it: this demo shows the settled small orb.
                    redCast = null;
                    document.title = 'RED DEMO';
                } else if (endMode === 'redcast') {
                    // Freeze the activation at `age` ms (default 170: flash + lance + cone
                    // mid-flight). The phase is re-pinned right before every animate() frame,
                    // so a screenshot lands on the same moment even at 1-3 fps software WebGL.
                    const castAge = Math.max(0, Math.min(RED_CAST.lanceMs - 1,
                        Number(new URLSearchParams(location.search).get('age')) || 170));
                    step(gun1(0.5), 30);
                    // The 20k field normally eases 0.1/frame toward its target; a headless
                    // capture may only get one frame, so snap it to the red target now.
                    for (let i = 0; i < COUNT * 3; i++) {
                        particles.geometry.attributes.position.array[i] = targetPositions[i];
                        particles.geometry.attributes.color.array[i] = targetColors[i];
                    }
                    for (let i = 0; i < COUNT; i++) {
                        particles.geometry.attributes.size.array[i] = targetSizes[i];
                    }
                    particles.geometry.attributes.position.needsUpdate = true;
                    particles.geometry.attributes.color.needsUpdate = true;
                    particles.geometry.attributes.size.needsUpdate = true;
                    const rafCast = window.requestAnimationFrame.bind(window);
                    window.requestAnimationFrame = (cb) => rafCast((ts) => {
                        // Re-arm if a stray frame let the cast expire: the demo must always
                        // render the requested phase, not an empty field.
                        if (!redCast) startRedCast(performance.now() - castAge);
                        else redCast.startMs = performance.now() - castAge;
                        cb(ts);
                    });
                    document.title = 'RED CAST DEMO';
                } else if (endMode === 'redburn') {
                    // Freeze the release burn-out at `age` ms (default 200): the field stays
                    // where the hand was while ash falls. Kept in Red on purpose so the field
                    // itself does not finish its neutral fade before the screenshot lands.
                    const burnAge = Math.max(0, Math.min(RED_CAST.burnMs - 1,
                        Number(new URLSearchParams(location.search).get('age')) || 200));
                    step(gun1(0.5), 30);
                    // Snap the field to its red target (see the cast demo) so one forced
                    // frame is enough to show it behind the falling ash.
                    for (let i = 0; i < COUNT * 3; i++) {
                        particles.geometry.attributes.position.array[i] = targetPositions[i];
                        particles.geometry.attributes.color.array[i] = targetColors[i];
                    }
                    for (let i = 0; i < COUNT; i++) {
                        particles.geometry.attributes.size.array[i] = targetSizes[i];
                    }
                    particles.geometry.attributes.position.needsUpdate = true;
                    particles.geometry.attributes.color.needsUpdate = true;
                    particles.geometry.attributes.size.needsUpdate = true;
                    // The synthetic-clock entry cast would otherwise sit frozen at age 0
                    // (its startMs is far in the future in real time); show the release only.
                    redCast = null;
                    startRedBurn(performance.now() - burnAge);
                    const rafBurn = window.requestAnimationFrame.bind(window);
                    window.requestAnimationFrame = (cb) => rafBurn((ts) => {
                        if (!redBurn) startRedBurn(performance.now() - burnAge);
                        else redBurn.startMs = performance.now() - burnAge;
                        cb(ts);
                    });
                    document.title = 'RED BURN DEMO';
                } else if (isPurpleDemo) {
                    // 茈 mode: gun pose arms the violet ball. Visual timers use performance.now()
                    // because the synthetic test clock and the animate loop's clock differ.
                    setPurpleMode(true);
                    step(gun1(0.5), 8);
                    if (purpleCharge) {
                        const chargeRef = purpleCharge;
                        chargeRef.startedMs = performance.now() - 2200; // fully grown ball
                        // Put the demo ball at world center: the synthetic hand's mapping depends
                        // on the browser's viewport metrics, which vary under Xvfb.
                        purpleVisual.x = 0;
                        purpleVisual.y = 0;
                        const baseX = 0;
                        const baseY = 0;
                        const t0 = performance.now();
                        (function wiggle() {
                            if (!purpleCharge || purpleCharge !== chargeRef) return;
                            const sec = (performance.now() - t0) / 1000;
                            purpleVisual.x = baseX + Math.sin(sec * 1.6) * 1.1;
                            purpleVisual.y = baseY + Math.cos(sec * 1.2) * 0.8;
                            requestAnimationFrame(wiggle);
                        })();
                        if (endMode === 'purpleburst') {
                            firePurpleCharge(performance.now());
                            impactPurpleShot(performance.now());
                            // Software WebGL under Xvfb can render at 1-3fps, so a real-time
                            // 1.6s blast may fall between frames. Hold it at mid-progress for
                            // the screenshot; also keep the button's cooldown ring populated.
                            (function burstLoop() {
                                if (!purpleMode) return;
                                const now = performance.now();
                                purpleExplosionUntilMs = now + TUNING.purpleExplosionDurationMs * 0.94;
                                purpleCooldownUntilMs = now + PURPLE_CAST.cooldownMs;
                                requestAnimationFrame(burstLoop);
                            })();
                        }
                    }
                    document.title = endMode === 'purplecharge' ? 'PURPLE CHARGE DEMO' : 'PURPLE BURST DEMO';
                } else {
                    // 蒼 arms on a strict 2 s open-palm hold now (no open>fist>open cycle).
                    step(open1(0.5), 100);
                    if (blueCharge) {
                        // Center the orb and pretend the construction has converged.
                        blueCharge.x = 0.5;
                        blueCharge.y = 0.52;
                        blueCharge.startedMs = performance.now() - 2200;
                        if (endMode === 'blue') {
                            // Forward push: palm scale grows toward the camera.
                            for (let f = 1.0; f <= 1.5; f += 0.05) {
                                runFrame(scaledOpen1(0.5, 0.75, f), t);
                                t += 33;
                            }
                        }
                        if (endMode === 'charge') {
                            // Slow orbit so the screenshot shows the swarm trailing behind the orb.
                            const t0 = performance.now();
                            (function wiggle() {
                                if (!blueCharge) return;
                                const sec = (performance.now() - t0) / 1000;
                                blueCharge.x = 0.5 + Math.sin(sec * 2.2) * 0.08;
                                blueCharge.y = 0.52 + Math.cos(sec * 1.7) * 0.05;
                                requestAnimationFrame(wiggle);
                            })();
                        }
                    }
                    document.title = endMode === 'charge' ? 'CHARGE DEMO' : 'BLUE DEMO';
                }
            }

        if (!endMode) {
            const langBtn = (code) => document.querySelector('#intro-lang [data-lang="' + code + '"]');
            const welcomeTextLater = document.querySelector('#intro-modal [data-intro-page="welcome"]')?.textContent || '';
            markState('language defaults to Chinese', 'zh-CN', document.documentElement.lang || 'missing');
            markState('site title uses the new Chinese name', '五条悟术式模拟', document.title || 'missing');
            markState('welcome uses the new Chinese name and tagline', 'ok ok',
                [welcomeTextLater.includes('五条悟术式模拟'), welcomeTextLater.includes('咒术回战手势触发模拟')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('settings hold a language row outside the switches', 'yes',
                (document.getElementById('lang-row')
                    && !document.getElementById('lang-row').closest('[data-action]')) ? 'yes' : 'no');
            if (langBtn('en')) langBtn('en').click();
            markState('English switch updates html lang', 'en', document.documentElement.lang || 'missing');
            markState('English switch updates the title', 'Gojo Satoru Cursed Technique Simulator', document.title || 'missing');
            markState('English switch localizes the rail tabs', 'Mode & Audio,Guide,About',
                Array.from(document.querySelectorAll('#left-rail .rail-tab')).map((b) => b.textContent.trim()).join(','));
            markState('English start label is localized', 'yes',
                ['Start', 'Starting…', 'Waiting for tracking', 'Tracking', 'Tracking error', 'Start failed']
                    .includes((document.getElementById('start-btn-label') || {}).textContent || '') ? 'yes' : 'no');
            markState('English keeps technique names in Traditional Chinese', 'ok ok',
                [document.getElementById('audio-list')?.textContent.includes('術式反転「赫」'),
                    document.getElementById('audio-list')?.textContent.includes('術式順転「蒼」')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('language choice is persisted', 'en', localStorage.getItem('sat0ru.language') || 'missing');
            markState('English localizes the welcome tutorial body', 'yes',
                (document.querySelector('#intro-modal [data-intro-page="blue"]')?.textContent || '')
                    .includes('Four fingers fully extended') ? 'yes' : 'no');
            const welcomeTextEn = document.querySelector('#intro-modal [data-intro-page="welcome"]')?.textContent || '';
            markState('English welcome keeps the support and performance cards', 'ok ok',
                [welcomeTextEn.includes('Recommended setup'), welcomeTextEn.includes('Performance tips')]
                    .map((ok) => (ok ? 'ok' : 'missing')).join(' '));
            markState('English localizes the settings labels', 'yes',
                (document.getElementById('settings-list')?.textContent || '')
                    .includes('Technique Voices') ? 'yes' : 'no');
            markState('English localizes the gesture guide', 'yes',
                (document.getElementById('gesture-guide')?.textContent || '')
                    .includes('Construct') ? 'yes' : 'no');
            markState('English localizes the about page labels', 'yes',
                (document.getElementById('about-body')?.textContent || '')
                    .includes('Fork author') ? 'yes' : 'no');
            markState('English localizes the custom void panel', 'yes',
                (document.getElementById('egg-panel')?.textContent || '')
                    .includes('Custom Infinite Void') ? 'yes' : 'no');
            markState('English audio labels keep the Traditional Chinese technique name', 'yes',
                (document.getElementById('audio-list')?.textContent || '')
                    .includes('術式反転「赫」 · I') ? 'yes' : 'no');
            if (typeof updateState === 'function') updateState('red', true);
            markState('English keeps the top-bar technique name in Traditional Chinese', '術式反転「赫」',
                document.getElementById('technique-name')?.textContent.trim() || 'missing');
            if (langBtn('zh')) langBtn('zh').click(); // 在技法进行中切回中文
            markState('a technique in progress survives a language switch', 'red',
                (typeof currentTech !== 'undefined') ? currentTech : 'missing');
            if (typeof updateState === 'function') updateState('neutral', true);
            if (langBtn('zh')) langBtn('zh').click();
            markState('switching back restores Chinese', 'zh-CN', document.documentElement.lang || 'missing');
            markState('switching back restores the Chinese title', '五条悟术式模拟', document.title || 'missing');
            markState('audio elements do not preload at startup', '9/9',
                initialAudioPreloadNone + '/9');
            markState('MediaPipe scripts stay out of the first load', '0',
                String(document.querySelectorAll('script[src*="/vendor/mediapipe/"]').length));
            markState('MediaPipe lazy loader exists', 'function', typeof loadMediaPipeScripts);
            await loadMediaPipeScripts();
            markState('MediaPipe header scripts load on demand', '3',
                String(document.querySelectorAll('script[data-mediapipe]').length));
            markState('MediaPipe lazy loading is idempotent', '3',
                (await loadMediaPipeScripts(),
                    String(document.querySelectorAll('script[data-mediapipe]').length)));
        }
        } catch (err) {
            log.push('EXCEPTION -> ' + (err && err.message ? err.message : String(err)));
            const where = String((err && err.stack) || '').split('\n').filter(Boolean)[1];
            if (where) log.push(where.trim());
        }

        const fails = log.filter((line) => line.includes('FAIL') || line.includes('EXCEPTION'));
        const banner = document.createElement('div');
        banner.id = 'logictest-banner';
        banner.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:' + (fails.length ? '#a00' : '#080') + ';color:#fff;font:13px/1.5 monospace;padding:10px 14px;white-space:pre;border-radius:6px';
        banner.textContent = 'LOGICTEST ' + (fails.length ? 'FAIL' : 'PASS')
            + ' · ' + log.length + ' assertions\n' + log.join('\n');
        if (!new URLSearchParams(location.search).has('nobanner')) document.body.appendChild(banner);
        document.title = 'LOGICTEST ' + (fails.length
            ? 'FAIL ' + fails.length + ': ' + fails.map((line) => line.replace(/ -> .*$/, '')).join(' | ')
            : 'PASS');
    }