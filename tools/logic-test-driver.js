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
        const scaledFist1 = (x, y, f) => {
            const hand = mkHand(x, y, FIST_PTS);
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
        // 虚式「茈」 clasp cast: two hands, fingers interlocked, index up, thumbs tucked.
        // Placed close enough that the index tips nearly meet, as in the reference footage.
        const claspPts = thumbUnderPts(0);
        const clasp2 = () => [mkHand(0.455, 0.65, claspPts), mkHand(0.545, 0.65, claspPts)];
        const claspFar2 = () => [mkHand(0.30, 0.65, claspPts), mkHand(0.70, 0.65, claspPts)];
        // Fast-forward a running clasp cast on the synthetic clock (used by the assertions).
        const finishClasp = () => {
            if (!claspCast) return;
            claspCast.startMs = t - CLASP_CAST.buildMs - CLASP_CAST.convergeMs - 1;
            updateClaspCast(t);
            if (claspCast && claspCast.phase === 'burst') {
                claspCast.burstStartMs = t - CLASP_CAST.burstMs - 1;
                updateClaspCast(t);
            }
        };

        let t = 1000;
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
        // Visual-check hook for 黒閃 (charge orb / burst overlay beats).
        window.__bfState = () => ({
            charge: !!bfCharge,
            burstActive: bfBurstUntilMs > performance.now(),
            overlayActive: bfOverlayActiveUntilMs > performance.now(),
            chargeDots: !!(bfCharge && bfCharge.visInit),
            chargeRadiusPx: bfCharge ? bfCharge.size * window.innerHeight * 1.05 : 0,
            name: document.getElementById('technique-name')?.innerText,
            now: performance.now()
        });
        const runFrame = (hands, ms) => {
            // Mirror onResults: the 無量空処 cinematic freezes the gesture pipeline.
            if (voidCinematic) return;
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
            let next = pickGestureFromScores(ms);
            // Mirror onResults' forced-technique wrapper (T/N preview and 茈's impact lock).
            if (forcedTech) {
                if (ms < forcedUntilMs) next = forcedTech;
                else forcedTech = null;
            }
            maybeTriggerPurpleExitExplosion(next, ms);
            updateState(next);
            maybeTriggerVoidCinematic(ms);
            updateRedVoice(ms);
        };
        const step = (hands, n) => {
            for (let i = 0; i < n; i++) { runFrame(hands, t); t += 33; }
            return currentTech;
        };
        // Moves a single open hand horizontally `n` frames from `x0` at `dx` per frame.
        const drift = (x0, dx, n) => {
            let x = x0;
            for (let i = 0; i < n; i++) { x += dx; runFrame(open1(x), t); t += 33; }
            return x;
        };
        // 蒼 arms by holding an open palm for BLUE_SEQ.holdMs (3 s) — no open>fist>open cycle.
        const armBlue1 = (x = 0.5) => {
            step(open1(x), 100);
            return !!blueCharge;
        };
        // 黒閃: flash an open palm, then a quick fist within BLACK_FLASH.openWindowMs.
        const armBlackFlash1 = (x = 0.5) => {
            step(open1(x), 8);
            step(fist1(x), 6);
            return !!bfCharge;
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
            bfCharge = null;
            bfBurstUntilMs = 0;
            bfPoseReleaseRequired = false;
            resetBlackFlashHandStates();
            clearBlackFlashOverlay();
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

        try {
            step([], 5); mark('neutral', 'neutral');

            // Making the gun sign must not arm Blue. (The brief fist in this motion now arms
            // a 黒閃 charge by design — the following open hand lets it go.)
            step(open1(0.5), 8);
            step(gun1(0.5), 3);
            step(fist1(0.5), 2);
            step(open1(0.5), 6);
            markState('gun motion does not arm blue', 'idle', blueCharge ? 'charge' : 'idle');
            markState('gun motion leaves no black charge', 'idle', bfCharge ? 'charge' : 'idle');
            step([], 20);

            // --- 赫 form 2: gun (index+middle together, thumb flared) ---
            step(gun1(0.5), 25); mark('red gun form shows', 'red');
            step([], 24); mark('red gun releases on drop', 'neutral');
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

            // --- 赫 voice: either Red form held past 2 s plays one of the two local clips,
            // exactly once per continuous hold — dropping the sign re-arms it. ---
            const vc0 = redVoiceCount;
            step(red1(0.5), 50); // ~1.65 s of pointing; Red itself is entered after ~7 frames
            markState('red voice waits for the 2 s hold', 'silent',
                redVoiceCount === vc0 ? 'silent' : 'played');
            step(red1(0.5), 25); // crosses the 2 s hold
            markState('red voice fires after a 2 s hold', 'played',
                redVoiceCount === vc0 + 1 ? 'played' : 'silent');
            markState('red voice picks a local clip', 'local',
                /\/audio\/he-[12]\.mp3$/.test(redVoiceLastSrc || '') ? 'local' : (redVoiceLastSrc || 'none'));
            step(red1(0.5), 40); // a longer hold must not replay it
            markState('red voice plays once per hold', 'once',
                redVoiceCount === vc0 + 1 ? 'once' : 'again');
            step([], 60); // drop the sign: re-arm the clip for the next hold
            step(gun1(0.5), 70); // the gun form gets its own random clip after 2 s
            markState('red voice fires on the gun form too', 'played',
                redVoiceCount === vc0 + 2 ? 'played' : 'silent');
            step([], 200); // drain before the 黒閃 suite

            // --- 黒閃: open palm -> quick fist arms a black/red charge on the fist ---
            step([], 30);
            markState('black flash arms on open->quick fist', 'charge', armBlackFlash1() ? 'charge' : 'idle');
            markState('black flash charge shows no technique yet', 'neutral', currentTech);
            // A steady fist just holds the charge; wobble must not read as a punch.
            for (let i = 0; i < 10; i++) {
                runFrame(scaledFist1(0.5, 0.75, i % 2 ? 1.05 : 0.98), t);
                t += 33;
            }
            markState('fist wobble keeps black charge', 'charge', bfCharge ? 'charge' : 'idle');
            // A single motion-blurred "open" read must not kill the charge; a held open does.
            step(open1(0.5), 2);
            markState('brief open frame keeps black charge', 'charge', bfCharge ? 'charge' : 'idle');
            step(open1(0.5), 5);
            markState('opening hand cancels black charge', 'idle', bfCharge ? 'charge' : 'idle');
            step([], 20);

            // A sideways arm swing that also grows the palm must not fire: the fist travels
            // across the frame far too fast to be a punch toward the lens.
            armBlackFlash1();
            for (let i = 0; i < 6; i++) {
                runFrame(scaledFist1(0.5 + i * 0.055, 0.75, 1 + i * 0.06), t);
                t += 33;
            }
            markState('sideways swing does not fire black flash', 'no', bfBurstUntilMs > t ? 'yes' : 'no');
            markState('sideways swing keeps the charge', 'charge', bfCharge ? 'charge' : 'idle');
            // While the charge runs, no other technique may start at the same spot.
            step(red1(0.5), 10);
            markState('black charge locks out red', 'neutral', currentTech);
            markState('black charge survives a red pose', 'charge', bfCharge ? 'charge' : 'idle');
            step(open1(0.5), 7);
            markState('swing-test charge cancels on open', 'idle', bfCharge ? 'charge' : 'idle');
            step([], 20);

            // Punch: the fist accelerates toward the camera -> burst + overlay.
            armBlackFlash1();
            for (let f = 1.0; f <= 1.4; f += 0.07) {
                runFrame(scaledFist1(0.5, 0.75, f), t);
                t += 33;
            }
            markState('black flash punch fires burst', 'yes', bfBurstUntilMs > t ? 'yes' : 'no');
            mark('black flash burst shows its name', 'blackflash');
            markState('black flash overlay active', 'yes', bfOverlayActiveUntilMs > t ? 'yes' : 'no');
            step(gun1(0.5), 10);
            mark('black flash owns the burst', 'blackflash');
            // Within the 2 s cooldown an open->fist chain must not re-arm.
            step(open1(0.5), 12);
            step(fist1(0.5), 3);
            markState('black flash cooldown blocks rearm', 'idle', bfCharge ? 'charge' : 'idle');
            step([], 10);
            // After the cooldown the same chain arms again (the open hand also releases the
            // post-burst pose lock); the open stretch stays under 蒼's 3 s hold.
            step(open1(0.5), 60);
            step(fist1(0.5), 6);
            markState('black flash rearms after cooldown', 'charge', bfCharge ? 'charge' : 'idle');
            step(open1(0.5), 7); // cancel the charge again
            step([], 20);

            // --- 苍1: holding an open palm for 3 s arms a charge instead of blooming ---
            // Shorter holds must not arm it.
            step(open1(0.5), 40); // ~1.3 s
            markState('short open hold does not arm blue', 'idle', blueCharge ? 'charge' : 'idle');
            step(fist1(0.5), 2); // a fist breaks the hold (it arms 黒閃; the next open lets it go)
            step([], 10);
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

            // Brisk sideways swipe (~1.8 units/s) is not a forward thrust: must not fire.
            cx = drift(cx, 0.06, 4);
            markState('fast sideways swipe keeps charge', 'charge', blueCharge ? 'charge' : 'released');
            cx = recoverBlue(cx);

            // Pointing at the charging hand (Red) must not hijack the charge.
            step(red1(cx), 10);
            markState('point during charge keeps charge', 'charge', blueCharge ? 'charge' : 'released');

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
            step(void1(0.5), 20);
            mark('void holds while gesture held', 'void');
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
            step(gun1(0.5), 8);
            markState('purple gun arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            markState('purple mode blocks red gun', 'neutral', currentTech);
            step([], 20);
            markState('purple pose drop cancels', 'idle',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            step(PURPLE1, 8);
            markState('purple pinch arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            // The ready pose itself (two fingers + thumb tucked) also arms the orb, so the
            // user can go straight from the ready sign to the outward snap.
            step([], 20);
            step(thumbUnder1(0.5), 8);
            markState('purple thumb-under arms orb', 'charge',
                (typeof purpleCharge !== 'undefined' && purpleCharge) ? 'charge' : 'idle');
            setPurpleMode(false);
            step([], 10);

            // --- 茈 forward push: fire, impact at center, 2s cooldown ---
            setPurpleMode(true);
            step(scaledGun1(0.5, 0.75, 1.0), 8);
            for (let f = 1.0; f <= 1.5; f += 0.07) {
                runFrame(scaledGun1(0.5, 0.75, f), t);
                t += 33;
            }
            markState('purple forward push fires', 'shot',
                (typeof purpleShot !== 'undefined' && purpleShot) ? 'shot' : (purpleCharge ? 'charge' : 'idle'));
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

            // --- 虚式「茈」 clasp cast: two hands interlocked, no top button ---
            step([], 220); // drain cooldowns
            // One hand in the same two-finger pose is still the Void domain, never the clasp.
            step(void1(0.5), 20);
            markState('one hand clasp-like is void, not cast', 'no-cast', claspCast ? 'cast' : 'no-cast');
            step([], 100);
            // Two hands: the clasp itself must start the cinematic and suppress Void.
            step(clasp2(), 10);
            markState('clasp cast starts', 'cast', claspCast ? 'cast' : 'idle');
            markState('clasp pose does not become void', 'neutral', currentTech);
            // Fast-forward through build + convergence on the synthetic clock.
            claspCast.startMs = t - CLASP_CAST.buildMs - CLASP_CAST.convergeMs - 1;
            updateClaspCast(t);
            markState('clasp bursts into purple', 'burst', claspCast ? claspCast.phase : 'ended');
            markState('clasp blast is active', 'yes', purpleExplosionUntilMs > t ? 'yes' : 'no');
            claspCast.burstStartMs = t - CLASP_CAST.burstMs - 1;
            updateClaspCast(t);
            markState('clasp cast ends', 'ended', claspCast ? 'active' : 'ended');
            // A held clasp cannot immediately recast (pose must be released).
            step(clasp2(), 10);
            markState('clasp cooldown blocks recast', 'idle', claspCast ? 'cast' : 'idle');
            step([], 30); // release the pose so the clasp can re-arm
            step(clasp2(), 70); // hold through the 2s cooldown; it should fire once it expires
            markState('clasp recast after cooldown', 'cast', claspCast ? 'cast' : 'idle');
            finishClasp();
            step([], 70); // drain the recast's 2s cooldown
            // Two clasp-like hands held far apart are two separate Void signs, not a clasp.
            step(claspFar2(), 20);
            markState('far two-hand pose is not clasp', 'no-cast', claspCast ? 'cast' : 'no-cast');
            markState('far two-hand pose stays void', 'void', currentTech);
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

            step([], 10); mark('end', null);

            // Optional visual demos for screenshots: ?logictest=1&end=charge|blue|red|purplecharge|purpleburst|void|voidform|voidring
            const endMode = new URLSearchParams(location.search).get('end');
            const isPurpleDemo = endMode === 'purplecharge' || endMode === 'purpleburst';
            const isClaspDemo = endMode === 'claspbuild' || endMode === 'claspburst';
            const isVoidCinemaDemo = endMode === 'voidform' || endMode === 'voidring' || endMode === 'voidclear';
            const isBlackDemo = endMode === 'blackcharge' || endMode === 'blackburst';
            if (endMode === 'charge' || endMode === 'blue' || endMode === 'red' || endMode === 'void' || isPurpleDemo || isClaspDemo || isVoidCinemaDemo || isBlackDemo) {
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
                    // 虚式「茈」 two-hand clasp: trigger on synthetic hands, then retime the
                    // cinematic onto the render clock so animate() draws it for the screenshot.
                    step(clasp2(), 10);
                    if (claspCast) {
                        const now = performance.now();
                        if (endMode === 'claspbuild') {
                            // Freeze the build at ~75%: both grown orbs sit at the screen sides.
                            // The wrapper and interval are demo-only (this file is not the app).
                            // setInterval keeps the visual age fresh even at 1–3fps.
                            claspCast.startMs = now - CLASP_CAST.buildMs * 0.75;
                            const baseUpdate = updateClaspCast;
                            updateClaspCast = (ms) => {
                                if (claspCast && claspCast.phase === 'build') {
                                    // animate() calls this right before drawing, so the visual
                                    // age stays at 75% of the build at any frame rate.
                                    claspCast.startMs = ms - CLASP_CAST.buildMs * 0.75;
                                    return;
                                }
                                baseUpdate(ms);
                            };
                        } else {
                            claspCast.startMs = now - CLASP_CAST.buildMs - CLASP_CAST.convergeMs - 1;
                            updateClaspCast(now); // -> burst
                            const baseUpdate = updateClaspCast;
                            updateClaspCast = (ms) => {
                                if (claspCast && claspCast.phase === 'burst') {
                                    // Keep the blast mid-progress for the screenshot (life 0.42 = far-travelled streaks).
                                    purpleExplosionUntilMs = ms + TUNING.purpleExplosionDurationMs * 0.42;
                                    claspCooldownUntilMs = ms + CLASP_CAST.cooldownMs;
                                    forcedTech = 'purple';
                                    forcedUntilMs = ms + 400;
                                    return;
                                }
                                baseUpdate(ms);
                            };
                        }
                        document.title = endMode === 'claspbuild' ? 'CLASP BUILD DEMO' : 'CLASP BURST DEMO';
                    }
                } else if (endMode === 'void') {
                    // 無量空処: pin the domain field without needing the camera. The white
                    // inner ring + blue shell + slow rotation are the ported getVoid() effect.
                    forceTechnique('void', 999999999);
                    updateState('void', true);
                    document.title = 'VOID DEMO';
                } else if (isVoidCinemaDemo) {
                    // 無量空処 hold-3s cinematic: pin the domain field, start the ported
                    // opening animation on the real clock, then keep its phase frozen at the
                    // beat we want to screenshot (software GL runs at 1–3fps).
                    forceTechnique('void', 999999999);
                    updateState('void', true);
                    startVoidCinematic(performance.now());
                    if (voidCinematic) {
                        const freezeMs = endMode === 'voidform'
                            ? VOID_CINEMA.formDelayMs + VOID_CINEMA.formMs * 0.85
                            : endMode === 'voidclear'
                                ? VOID_CINEMA.blackFadeAtMs + VOID_CINEMA.blackFadeMs + 300
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
                        : endMode === 'voidclear' ? 'VOID CLEAR DEMO' : 'VOID RING DEMO';
                } else if (isBlackDemo) {
                    // 黒閃: arm the fist charge on synthetic hands, then ride the real clock so
                    // animate() paints the black/red orb (charge) or the burst + overlay.
                    step(open1(0.5), 8);
                    step(fist1(0.5), 6);
                    if (bfCharge) {
                        const now = performance.now();
                        bfCharge.startedMs = now - 2200; // fully grown ball
                        bfCharge.visX = 0;
                        bfCharge.visY = 0;
                        if (endMode === 'blackcharge') {
                            // Pin the charge at world centre and drift it a little.
                            const t0 = now;
                            (function wiggle() {
                                if (!bfCharge) return;
                                const sec = (performance.now() - t0) / 1000;
                                bfCharge.visX = Math.sin(sec * 1.7) * 1.0;
                                bfCharge.visY = Math.cos(sec * 1.3) * 0.7;
                                requestAnimationFrame(wiggle);
                            })();
                        } else {
                            startBlackFlashBurst(now);
                            // Hold the blast mid-progress for the screenshot. The overlay freeze
                            // is rewritten inside the draw call (same clock as animate); software
                            // GL frames can be a second apart, so an rAF loop would go stale.
                            const baseDraw = drawBlackFlashOverlay;
                            drawBlackFlashOverlay = (ms) => {
                                bfOverlayActiveUntilMs = ms + BLACK_FLASH.burstMs;
                                bfOverlayBurstMs = ms - BLACK_FLASH.burstMs * 0.45;
                                return baseDraw(ms);
                            };
                            // Keep the burst state (pill label + cooldown) fresh on a timer so
                            // the screenshot always lands inside an active blast.
                            setInterval(() => {
                                const ms = performance.now();
                                bfBurstUntilMs = ms + BLACK_FLASH.burstMs * 0.55;
                                techCooldownUntilMs = ms + BLACK_FLASH.cooldownMs;
                                forcedTech = 'blackflash';
                                forcedUntilMs = ms + 400;
                            }, 16);
                        }
                    }
                    document.title = endMode === 'blackcharge' ? 'BLACK FLASH CHARGE DEMO' : 'BLACK FLASH BURST DEMO';
                } else if (endMode === 'red') {
                    // Hold the gun form so the red core sits on the synthetic hand and the
                    // ambient dust gets pushed into a ring around it (repulsion demo).
                    step(gun1(0.5), 30);
                    document.title = 'RED DEMO';
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
                    step(open1(0.5), 8);
                    step(fist1(0.5), 6);
                    step(open1(0.5), 6);
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
        } catch (err) {
            log.push('EXCEPTION -> ' + (err && err.message ? err.message : String(err)));
            const where = String((err && err.stack) || '').split('\n').filter(Boolean)[1];
            if (where) log.push(where.trim());
        }

        const fails = log.filter((line) => line.includes('FAIL') || line.includes('EXCEPTION'));
        const banner = document.createElement('div');
        banner.id = 'logictest-banner';
        banner.style.cssText = 'position:fixed;top:8px;left:8px;z-index:99999;background:' + (fails.length ? '#a00' : '#080') + ';color:#fff;font:13px/1.5 monospace;padding:10px 14px;white-space:pre;border-radius:6px';
        banner.textContent = 'LOGICTEST ' + (fails.length ? 'FAIL' : 'PASS') + '\n' + log.join('\n');
        if (!new URLSearchParams(location.search).has('nobanner')) document.body.appendChild(banner);
        document.title = 'LOGICTEST ' + (fails.length ? 'FAIL ' + fails.slice(0, 4).join(' | ') : 'PASS');
    }