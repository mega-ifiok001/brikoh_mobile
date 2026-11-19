import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

// An animated evening market, drawn only with Views + Animated (all native-driven, no images):
// a Brikoh stall with a shopkeeper, customers who walk up, pay, collect a bag and leave,
// plus shoppers strolling past in the background and twinkling string lights.

export const SCENE_H = 340;
const GROUND_TOP = 262;
const FEET_Y = 308;
const PERSON_H = 100;
const LOOP_MS = 12000;

type Look = { skin: string; hair: string; shirt: string; pants: string; style: "short" | "puff" | "wrap" | "cap"; dress?: boolean; apron?: boolean };

const SKIN = ["#8d5a3b", "#6b4228", "#a8714c", "#51301d"];
const LOOKS = {
  keeper: { skin: SKIN[1], hair: "#17100b", shirt: C.brand, pants: "#3a2a1c", style: "cap", apron: true } as Look,
  buyerA: { skin: SKIN[0], hair: "#2a1a10", shirt: "#2f7bd1", pants: "#2b3445", style: "short" } as Look,
  buyerB: { skin: SKIN[2], hair: "#e0457b", shirt: "#7c3aed", pants: "#7c3aed", style: "wrap", dress: true } as Look,
  walker1: { skin: SKIN[3], hair: "#120b07", shirt: "#3b5d4a", pants: "#2a2f35", style: "puff" } as Look,
  walker2: { skin: SKIN[0], hair: "#2a1a10", shirt: "#8a5a2b", pants: "#33281f", style: "cap", } as Look,
};

type KF = [number, number];
/** Build a looping value from keyframes written in "local" time (0..1 of the loop) shifted by `o`. */
function kf(t: Animated.Value, o: number, frames: KF[]) {
  const r = (n: number) => Math.min(1, Math.round(n * 1000) / 1000);
  const pts = frames.map(([a, b]) => [r(a + o), b] as KF);
  if (pts[0][0] > 0) pts.unshift([0, pts[0][1]]);
  if (pts[pts.length - 1][0] < 1) pts.push([1, pts[pts.length - 1][1]]);
  return t.interpolate({ inputRange: pts.map((p) => p[0]), outputRange: pts.map((p) => p[1]), extrapolate: "clamp" });
}

/* --------------------------------- Person --------------------------------- */

function Person({ look, legL, legR, armL, armR, bob, blink }: { look: Look; legL?: any; legR?: any; armL?: any; armR?: any; bob?: any; blink?: any }) {
  const dress = !!look.dress;
  const eyeStyle = (left: number) => ({
    position: "absolute" as const,
    top: 11,
    left,
    width: 3.6,
    height: 3.6,
    borderRadius: 2,
    backgroundColor: "#2a1405",
    transform: blink ? [{ scaleY: blink }] : undefined,
  });
  return (
    <Animated.View style={{ width: 44, height: PERSON_H, transform: bob ? [{ translateY: bob }] : undefined }}>
      {/* legs */}
      {[10, 23].map((left, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            top: dress ? 60 : 62,
            left,
            width: 11,
            height: dress ? 34 : 34,
            borderRadius: 5,
            backgroundColor: dress ? look.skin : look.pants,
            transformOrigin: "50% 0%",
            transform: [{ rotate: (i === 0 ? legL : legR) ?? "0deg" }],
          }}
        >
          <View style={{ position: "absolute", bottom: -3, left: -2, width: 15, height: 8, borderRadius: 4, backgroundColor: "#1b120b" }} />
        </Animated.View>
      ))}

      {/* hair behind the head */}
      {look.style === "puff" ? <View style={{ position: "absolute", top: -7, left: 5, width: 34, height: 34, borderRadius: 17, backgroundColor: look.hair }} /> : null}

      {/* torso */}
      <View
        style={{
          position: "absolute",
          top: 24,
          left: 7,
          width: 30,
          height: dress ? 46 : 40,
          borderRadius: 11,
          borderBottomLeftRadius: dress ? 15 : 11,
          borderBottomRightRadius: dress ? 15 : 11,
          backgroundColor: look.shirt,
        }}
      />
      {look.apron ? <View style={{ position: "absolute", top: 40, left: 13, width: 18, height: 26, borderRadius: 6, backgroundColor: "#fbf9f5" }} /> : null}

      {/* arms (pivot at the shoulder) */}
      {[2, 34].map((left, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            top: 28,
            left,
            width: 8,
            height: 32,
            borderRadius: 4,
            backgroundColor: look.shirt,
            transformOrigin: "50% 0%",
            transform: [{ rotate: (i === 0 ? armL : armR) ?? "0deg" }],
          }}
        >
          <View style={{ position: "absolute", bottom: -4, left: -0.5, width: 9, height: 9, borderRadius: 5, backgroundColor: look.skin }} />
        </Animated.View>
      ))}

      {/* head */}
      <View style={{ position: "absolute", top: 0, left: 9, width: 26, height: 26, borderRadius: 13, backgroundColor: look.skin }}>
        <Animated.View style={eyeStyle(6.5)} />
        <Animated.View style={eyeStyle(16)} />
        <View style={{ position: "absolute", top: 17, left: 8.5, width: 9, height: 4.5, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, borderBottomWidth: 2, borderColor: "#5a2a1a" }} />
      </View>
      {look.style === "short" || look.style === "cap" ? (
        <View style={{ position: "absolute", top: -1, left: 9, width: 26, height: 12, borderTopLeftRadius: 13, borderTopRightRadius: 13, backgroundColor: look.style === "cap" ? "#fbf9f5" : look.hair }} />
      ) : null}
      {look.style === "cap" ? <View style={{ position: "absolute", top: 8, left: 26, width: 14, height: 4, borderRadius: 2, backgroundColor: "#fbf9f5" }} /> : null}
      {look.style === "wrap" ? (
        <>
          <View style={{ position: "absolute", top: -5, left: 7, width: 30, height: 16, borderRadius: 9, backgroundColor: look.hair }} />
          <View style={{ position: "absolute", top: -11, left: 24, width: 12, height: 12, borderRadius: 6, backgroundColor: look.hair }} />
        </>
      ) : null}
    </Animated.View>
  );
}

/* -------------------------------- Customers -------------------------------- */

function Customer({ t, walk, look, fromLeft, cx, W }: { t: Animated.Value; walk: Animated.Value; look: Look; fromLeft: boolean; cx: number; W: number }) {
  const dir = fromLeft ? 1 : -1; // +1: stall is to the customer's right
  const o = fromLeft ? 0 : 0.46;
  const standX = cx - dir * 72;
  const startX = fromLeft ? -60 : W + 60;

  const n = useMemo(() => {
    const sin = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 0, -1, 0] });
    const stepBob = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -3, 0, -3, 0] });
    const moving = kf(t, o, [[0, 1], [0.17, 1], [0.19, 0], [0.35, 0], [0.37, 1], [0.53, 1], [0.54, 0]]);
    const swing = Animated.multiply(sin, moving);
    const x = kf(t, o, [[0, startX - 22], [0.18, standX - 22], [0.36, standX - 22], [0.54, startX - 22]]);
    const hop = kf(t, o, [[0, 0], [0.33, 0], [0.345, -12], [0.36, 0]]);
    const raise = kf(t, o, [[0, 0], [0.19, 0], [0.22, -125 * dir], [0.28, -125 * dir], [0.31, 0]]);
    const legL = swing.interpolate({ inputRange: [-1, 1], outputRange: ["-30deg", "30deg"] });
    const legR = swing.interpolate({ inputRange: [-1, 1], outputRange: ["30deg", "-30deg"] });
    const sA = swing.interpolate({ inputRange: [-1, 1], outputRange: [-24, 24] });
    const sB = swing.interpolate({ inputRange: [-1, 1], outputRange: [24, -24] });
    const toStr = (v: any) => v.interpolate({ inputRange: [-200, 200], outputRange: ["-200deg", "200deg"] });
    // the arm nearest the stall raises to hand over the coin; the other swings and holds the bag
    const nearL = dir < 0; // customer's screen-left arm is the near one when the stall is to the left
    const armNear = toStr(Animated.add(nearL ? sA : sB, raise));
    const armFar = toStr((nearL ? sB : sA).interpolate({ inputRange: [-24, 24], outputRange: [-5, 5] }));
    const coinP = kf(t, o, [[0, 0], [0.22, 0], [0.27, 1]]);
    const coinOpacity = kf(t, o, [[0, 0], [0.218, 0], [0.22, 1], [0.268, 1], [0.27, 0]]);
    const bag = kf(t, o, [[0, 0], [0.3, 0], [0.32, 1.3], [0.34, 1], [0.54, 1]]);
    const pop = {
      s: kf(t, o, [[0, 0], [0.27, 0], [0.285, 1.15], [0.3, 1], [0.33, 1], [0.345, 0]]),
      y: kf(t, o, [[0, 0], [0.285, 0], [0.345, -18]]),
      a: kf(t, o, [[0, 0], [0.27, 0], [0.28, 1], [0.32, 1], [0.345, 0]]),
    };
    return { x, hop, legL, legR, armNear, armFar, bob: Animated.add(Animated.multiply(stepBob, moving), hop), coinP, coinOpacity, bag, pop, nearL };
  }, [t, walk, o, dir, startX, standX]);

  const top = FEET_Y - PERSON_H;
  const coinX = n.coinP.interpolate({ inputRange: [0, 1], outputRange: [0, dir * 36] });
  const coinY = n.coinP.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -28, 12] });
  // near arm is on the stall side: right arm (index 1) when dir>0
  const armL = n.nearL ? n.armNear : n.armFar;
  const armR = n.nearL ? n.armFar : n.armNear;
  const coinLeft = 22 + dir * 43 - 7;
  const bagLeft = dir > 0 ? -7 : 36;

  return (
    <>
      {/* ground shadow */}
      <Animated.View style={{ position: "absolute", left: 0, top: FEET_Y - 4, width: 40, height: 8, borderRadius: 4, backgroundColor: "#000", opacity: 0.35, transform: [{ translateX: Animated.add(n.x, 2) }] }} />
      <Animated.View style={{ position: "absolute", left: 0, top, width: 44, height: PERSON_H, transform: [{ translateX: n.x }] }}>
        <Person look={look} legL={n.legL} legR={n.legR} armL={armL} armR={armR} bob={n.bob} />
        {/* the paid coin */}
        <Animated.View
          style={{
            position: "absolute",
            left: coinLeft,
            top: 6,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: "#ffc83d",
            borderWidth: 1.5,
            borderColor: "#e0a21a",
            opacity: n.coinOpacity,
            transform: [{ translateX: coinX }, { translateY: coinY }],
          }}
        />
        {/* the bag they get back */}
        <Animated.View style={{ position: "absolute", left: bagLeft, top: 56, transform: [{ scale: n.bag }], transformOrigin: "50% 0%" }}>
          <View style={{ width: 12, height: 7, marginLeft: 3, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 1.5, borderBottomWidth: 0, borderColor: "#fbf9f5" }} />
          <View style={{ width: 18, height: 20, borderRadius: 4, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 9, color: "#fff", includeFontPadding: false }}>₦</Text>
          </View>
        </Animated.View>
      </Animated.View>
      {/* "+₦" popping above the counter when the shopkeeper is paid */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: cx - 17 + (fromLeft ? -16 : 16),
          top: 142,
          paddingHorizontal: 8,
          height: 20,
          borderRadius: 10,
          backgroundColor: "#ffc83d",
          alignItems: "center",
          justifyContent: "center",
          opacity: n.pop.a,
          transform: [{ translateY: n.pop.y }, { scale: n.pop.s }],
        }}
      >
        <Text style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 11, color: "#5a3a00", includeFontPadding: false }}>+₦</Text>
      </Animated.View>
    </>
  );
}

/** Shoppers strolling past in the background, smaller and dimmer, never stopping. */
function Walker({ walk, look, dir, dur, delay, W, scale = 0.6, lane = 0 }: { walk: Animated.Value; look: Look; dir: 1 | -1; dur: number; delay: number; W: number; scale?: number; lane?: number }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(p, { toValue: 1, duration: dur, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [p, dur, delay]);
  const sin = useMemo(() => walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 1, 0, -1, 0] }), [walk]);
  const bob = useMemo(() => walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -3, 0, -3, 0] }), [walk]);
  const legL = sin.interpolate({ inputRange: [-1, 1], outputRange: ["-28deg", "28deg"] });
  const legR = sin.interpolate({ inputRange: [-1, 1], outputRange: ["28deg", "-28deg"] });
  const armL = sin.interpolate({ inputRange: [-1, 1], outputRange: ["22deg", "-22deg"] });
  const armR = sin.interpolate({ inputRange: [-1, 1], outputRange: ["-22deg", "22deg"] });
  const x = p.interpolate({ inputRange: [0, 1], outputRange: dir > 0 ? [-60, W + 20] : [W + 20, -60] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: GROUND_TOP + 22 + lane - PERSON_H, width: 44, height: PERSON_H, opacity: 0.78, transformOrigin: "50% 100%", transform: [{ translateX: x }, { scale }] }}
    >
      <Person look={look} legL={legL} legR={legR} armL={armL} armR={armR} bob={bob} />
    </Animated.View>
  );
}

/* ---------------------------------- Stall ---------------------------------- */

const SW = 216;

function Goods({ left, shelfTop }: { left: number; shelfTop: number }) {
  const cans = ["#2f7bd1", "#e0457b", "#ffc83d", "#4cc38a"];
  return (
    <View style={{ position: "absolute", left, top: shelfTop - 22, flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
      {cans.slice(0, 3).map((c, i) => (
        <View key={i} style={{ width: 13, height: 16 + (i % 2) * 6, borderRadius: 3, backgroundColor: c, opacity: 0.92 }}>
          <View style={{ position: "absolute", top: 5, left: 2, right: 2, height: 4, borderRadius: 1, backgroundColor: "rgba(255,255,255,0.55)" }} />
        </View>
      ))}
    </View>
  );
}

function Pile({ left, colors, size = 17 }: { left: number; colors: string[]; size?: number }) {
  // a heap of produce sitting on the counter top (bottom edge at the counter's top)
  const pos: [number, number][] = [[0, 0], [size - 3, 0], [(size - 3) * 2, 0], [(size - 3) / 2, -(size - 5)], [(size - 3) * 1.5, -(size - 5)], [size - 3, -(size - 5) * 2]];
  return (
    <View style={{ position: "absolute", left, top: 232 - size }}>
      {pos.map(([x, y], i) => (
        <View key={i} style={{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: size / 2, backgroundColor: colors[i % colors.length] }}>
          <View style={{ position: "absolute", top: 3, left: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.45)" }} />
        </View>
      ))}
    </View>
  );
}

/* ---------------------------------- Scene ---------------------------------- */

export default function MarketScene({ width }: { width: number }) {
  const W = width;
  const cx = W / 2;
  const left = cx - SW / 2;

  const t = useRef(new Animated.Value(0)).current;
  const walk = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const idle = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;
  const lamp = useRef(new Animated.Value(0)).current;
  const tw = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.timing(t, { toValue: 1, duration: LOOP_MS, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(walk, { toValue: 1, duration: 650, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sway, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(idle, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(idle, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.delay(2100),
          Animated.timing(blink, { toValue: 0.1, duration: 90, useNativeDriver: true }),
          Animated.timing(blink, { toValue: 1, duration: 110, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(lamp, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(lamp, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      ...tw.map((v, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 380),
            Animated.timing(v, { toValue: 1, duration: 900 + i * 200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 900 + i * 200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        )
      ),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [t, walk, sway, idle, blink, lamp, tw]);

  // shopkeeper: idle sway + hands the bag to whoever is paying
  const keeper = useMemo(() => {
    const hand = [[0, 0], [0.275, 0], [0.3, 70], [0.335, 70], [0.36, 0]] as KF[];
    const handNeg = hand.map(([a, b]) => [a, -b] as KF);
    const toStr = (v: any) => v.interpolate({ inputRange: [-200, 200], outputRange: ["-200deg", "200deg"] });
    const sway1 = idle.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] });
    const sway2 = idle.interpolate({ inputRange: [0, 1], outputRange: [5, -5] });
    return {
      armL: toStr(Animated.add(sway1, kf(t, 0, hand))), // serving the customer on the left
      armR: toStr(Animated.add(sway2, kf(t, 0.46, handNeg))), // serving the customer on the right
      bob: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }),
    };
  }, [t, idle]);

  const awningSway = sway.interpolate({ inputRange: [0, 1], outputRange: ["-0.8deg", "0.8deg"] });
  const signSway = sway.interpolate({ inputRange: [0, 1], outputRange: ["3deg", "-3deg"] });
  const lampSway = lamp.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });

  const bulbs = useMemo(() => Array.from({ length: 14 }).map((_, i) => ({ x: ((i + 0.5) * W) / 14, y: 14 + 5 * Math.sin((i / 13) * Math.PI), c: ["#ffc83d", "#ff8a3d", "#fbf9f5"][i % 3], g: i % 3 })), [W]);

  return (
    <View style={{ width: W, height: SCENE_H, overflow: "hidden" }}>
      {/* warm glow behind the stall */}
      {[360, 280, 200].map((s, i) => (
        <View key={s} style={{ position: "absolute", left: cx - s / 2, top: 190 - s / 2, width: s, height: s, borderRadius: s / 2, backgroundColor: C.brand, opacity: 0.035 + i * 0.03 }} />
      ))}

      {/* string lights */}
      <View style={{ position: "absolute", left: 0, right: 0, top: 13, height: 1.5, backgroundColor: "#3a2a1c" }} />
      {bulbs.map((b, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: b.x - 4, top: b.y, opacity: tw[b.g].interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }}>
          <View style={{ position: "absolute", left: -6, top: -6, width: 16, height: 16, borderRadius: 8, backgroundColor: b.c, opacity: 0.18 }} />
          <View style={{ width: 8, height: 10, borderRadius: 4, backgroundColor: b.c }} />
        </Animated.View>
      ))}

      {/* distant stalls (silhouettes) */}
      {[-46, W - 74].map((lx, k) => (
        <View key={k} style={{ position: "absolute", left: lx, top: 140, width: 120, height: GROUND_TOP - 140 + 4 }}>
          <View style={{ position: "absolute", left: 6, right: 6, top: 26, bottom: 0, backgroundColor: "#140e09" }} />
          <View style={{ position: "absolute", left: 22, top: 50, width: 30, height: 22, borderRadius: 3, backgroundColor: "#ffb347", opacity: 0.16 }} />
          <View style={{ flexDirection: "row" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View key={i} style={{ width: 20, height: 26, backgroundColor: i % 2 ? "#2a1a0f" : "#4a2a12", borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }} />
            ))}
          </View>
        </View>
      ))}

      {/* ground */}
      <LinearGradient colors={["#1f1710", "#120d09"]} style={{ position: "absolute", left: 0, right: 0, top: GROUND_TOP, bottom: 0 }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: GROUND_TOP, height: 1.5, backgroundColor: "#33241a" }} />
      <View style={{ position: "absolute", left: cx - 150, top: GROUND_TOP + 6, width: 300, height: 26, borderRadius: 13, backgroundColor: C.brand, opacity: 0.07 }} />

      {/* strolling shoppers (pass behind the stall) */}
      <Walker walk={walk} look={LOOKS.walker1} dir={1} dur={15000} delay={600} W={W} lane={0} />
      <Walker walk={walk} look={LOOKS.walker2} dir={-1} dur={19000} delay={5200} W={W} scale={0.55} lane={-4} />

      {/* ---- main stall ---- */}
      <View style={{ position: "absolute", left, top: 104, width: SW, height: 166, backgroundColor: "#24160d" }} />
      {/* shelves + goods */}
      {[158, 204].map((y) => (
        <View key={y}>
          <View style={{ position: "absolute", left: left + 8, top: y, width: SW - 16, height: 5, borderRadius: 2, backgroundColor: "#7a5230" }} />
          <Goods left={left + 16} shelfTop={y} />
          <Goods left={left + SW - 70} shelfTop={y} />
        </View>
      ))}

      {/* shopkeeper */}
      <View style={{ position: "absolute", left: cx - 22, top: 168 }}>
        <Person look={LOOKS.keeper} armL={keeper.armL} armR={keeper.armR} bob={keeper.bob} blink={blink} />
      </View>

      {/* counter */}
      <View style={{ position: "absolute", left: left - 8, top: 232, width: SW + 16, height: 38, borderRadius: 4, backgroundColor: "#7a4a22", overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, backgroundColor: "#a8743f" }} />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View key={i} style={{ position: "absolute", top: 8, bottom: 0, left: (i * (SW + 16)) / 8, width: 1.5, backgroundColor: "rgba(0,0,0,0.25)" }} />
        ))}
      </View>
      <Pile left={left + 6} colors={["#ff7a1a", "#ff9a3c"]} />
      <Pile left={left + SW - 62} colors={["#e0392d", "#c2302a", "#ff5a3c"]} size={16} />
      {/* basket */}
      <View style={{ position: "absolute", left: cx - 18, top: 222, width: 36, height: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: "#c9a063" }} />

      {/* posts */}
      {[left - 2, left + SW - 6].map((px) => (
        <View key={px} style={{ position: "absolute", left: px, top: 70, width: 8, height: 200, backgroundColor: "#8a5a34" }} />
      ))}

      {/* awning */}
      <Animated.View style={{ position: "absolute", left, top: 64, width: SW, transformOrigin: "50% 0%", transform: [{ rotate: awningSway }] }}>
        <View style={{ height: 8, backgroundColor: "#3a2312", borderTopLeftRadius: 6, borderTopRightRadius: 6, marginHorizontal: -6 }} />
        <View style={{ flexDirection: "row" }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={{ width: SW / 8, height: 32, backgroundColor: i % 2 ? "#fbf9f5" : C.brand }}>
              <View style={{ position: "absolute", left: 0, right: 0, bottom: -(SW / 8) / 2 + 1, height: SW / 8, borderRadius: SW / 16, backgroundColor: i % 2 ? "#fbf9f5" : C.brand }} />
            </View>
          ))}
        </View>
      </Animated.View>

      {/* hanging sign */}
      <Animated.View style={{ position: "absolute", left: cx - 56, top: 108, width: 112, transformOrigin: "50% 0%", transform: [{ rotate: signSway }] }}>
        <View style={{ position: "absolute", left: 20, top: 0, width: 1.5, height: 8, backgroundColor: "#c9a063" }} />
        <View style={{ position: "absolute", right: 20, top: 0, width: 1.5, height: 8, backgroundColor: "#c9a063" }} />
        <View style={{ marginTop: 8, height: 24, borderRadius: 7, backgroundColor: "#0A100D", borderWidth: 1.5, borderColor: C.brand, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: "Manrope_800ExtraBold", fontSize: 10, letterSpacing: 1.6, color: C.brand, includeFontPadding: false }}>BRIKOH MARKET</Text>
        </View>
      </Animated.View>

      {/* lamps under the awning */}
      {[left + 18, left + SW - 18].map((lx, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: lx - 1, top: 100, width: 2, transformOrigin: "50% 0%", transform: [{ rotate: lampSway }] }}>
          <View style={{ width: 1.5, height: 14, marginLeft: 0.25, backgroundColor: "#c9a063" }} />
          <View style={{ position: "absolute", left: -13, top: 3, width: 28, height: 28, borderRadius: 14, backgroundColor: "#ffc83d", opacity: 0.16 }} />
          <View style={{ marginLeft: -4.5, width: 11, height: 13, borderRadius: 6, backgroundColor: "#ffd36b" }} />
        </Animated.View>
      ))}

      {/* customers (in front of the counter) */}
      <Customer t={t} walk={walk} look={LOOKS.buyerA} fromLeft cx={cx} W={W} />
      <Customer t={t} walk={walk} look={LOOKS.buyerB} fromLeft={false} cx={cx} W={W} />

      {/* soft vignette so the edges melt into the page */}
      <LinearGradient pointerEvents="none" colors={["rgba(10,16,13,0)", "rgba(10,16,13,0.9)"]} style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26 }} />
    </View>
  );
}