import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

const MESSAGES = ["Opening your store…", "Counting today's sales…", "Checking your stock…", "Almost there…"];
const SLOW = "Waking up the server — the first load can take a few seconds.";
const { width: W, height: H } = Dimensions.get("window");
const BAR_W = 148;

// Small drifting sparks behind the logo.
function Sparks() {
  const sparks = useMemo(
    () =>
      Array.from({ length: 16 }).map((_, i) => ({
        left: ((i * 53) % 100) / 100 * W,
        top: H * 0.45 + ((i * 37) % 30) * 6,
        size: 3 + (i % 3) * 1.5,
        rise: 180 + ((i * 29) % 120),
        dur: 3600 + (i % 5) * 600,
        delay: (i * 310) % 2600,
        v: new Animated.Value(0),
      })),
    []
  );
  useEffect(() => {
    const loops = sparks.map((s) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.timing(s.v, { toValue: 1, duration: s.dur, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(s.v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [sparks]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparks.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: i % 3 === 0 ? "#ffd9b3" : C.brand,
            opacity: s.v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.75, 0.25, 0] }),
            transform: [
              { translateY: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, -s.rise] }) },
              { translateX: s.v.interpolate({ inputRange: [0, 1], outputRange: [0, (i % 2 ? 1 : -1) * 14] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function BrandSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const rings = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const logoIn = useRef(new Animated.Value(0)).current;
  const wordIn = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const msgFade = useRef(new Animated.Value(0)).current;
  const [idx, setIdx] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    Animated.spring(logoIn, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }).start();
    Animated.timing(wordIn, { toValue: 1, duration: 600, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const loops = [
      Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
      Animated.loop(Animated.timing(bar, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true })),
      ...rings.map((r, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 1000),
            Animated.timing(r, { toValue: 1, duration: 2000, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.delay((1 - i) * 1000),
          ])
        )
      ),
    ];
    loops.forEach((l) => l.start());
    const t1 = setInterval(() => setIdx((i) => (i + 1) % MESSAGES.length), 2200);
    const t2 = setTimeout(() => setSlow(true), 7000);
    return () => {
      loops.forEach((l) => l.stop());
      clearInterval(t1);
      clearTimeout(t2);
    };
  }, [fade, spin, breathe, glow, bar, rings, logoIn, wordIn]);

  useEffect(() => {
    msgFade.setValue(0);
    Animated.timing(msgFade, { toValue: 1, duration: 400, delay: 150, useNativeDriver: true }).start();
  }, [idx, slow, msgFade]);

  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>
      <LinearGradient colors={["#0A100D", "#1a0f07", "#0A100D"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Sparks />

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* soft glow behind the logo: stacked translucent discs fake a radial blur */}
        <Animated.View style={{ position: "absolute", transform: [{ scale: glowScale }] }} pointerEvents="none">
          {[420, 320, 230].map((s, i) => (
            <View
              key={s}
              style={{
                position: "absolute",
                width: s,
                height: s,
                borderRadius: s / 2,
                backgroundColor: C.brand,
                opacity: 0.05 + i * 0.035,
                left: -s / 2,
                top: -s / 2 - 36,
              }}
            />
          ))}
        </Animated.View>

        <View style={{ width: 170, height: 170, alignItems: "center", justifyContent: "center" }}>
          {rings.map((r, i) => (
            <Animated.View
              key={i}
              style={{
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: 30,
                borderWidth: 1.5,
                borderColor: C.brand,
                opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
              }}
            />
          ))}
          <Animated.View
            style={{
              position: "absolute",
              width: 136,
              height: 136,
              borderRadius: 68,
              borderWidth: 2.5,
              borderColor: "transparent",
              borderTopColor: C.brand,
              borderRightColor: "rgba(236,100,5,0.28)",
              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
            }}
          />
          <Animated.View
            style={{
              opacity: logoIn,
              transform: [
                { scale: Animated.multiply(logoIn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }), breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })) },
              ],
              shadowColor: C.brand,
              shadowOpacity: 0.55,
              shadowRadius: 26,
              shadowOffset: { width: 0, height: 8 },
              elevation: 14,
            }}
          >
            <Image source={require("../../assets/icon.png")} style={{ width: 92, height: 92, borderRadius: 26 }} />
          </Animated.View>
        </View>

        <Animated.View style={{ opacity: wordIn, transform: [{ translateY: wordIn.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }], marginTop: 6 }}>
          <Image source={require("../../assets/logo-white.png")} resizeMode="contain" style={{ width: 136, height: 34 }} />
        </Animated.View>

        {/* indeterminate progress bar */}
        <Animated.View style={{ opacity: wordIn, marginTop: 26, width: BAR_W, height: 3, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
          <Animated.View
            style={{
              width: BAR_W * 0.42,
              height: 3,
              borderRadius: 3,
              backgroundColor: C.brand,
              transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-BAR_W * 0.42, BAR_W] }) }],
            }}
          />
        </Animated.View>

        <Animated.Text
          style={{
            opacity: msgFade,
            marginTop: 16,
            paddingHorizontal: 40,
            textAlign: "center",
            fontFamily: "Manrope_600SemiBold",
            fontSize: 13,
            lineHeight: 19,
            color: "rgba(255,255,255,0.62)",
          }}
        >
          {slow ? SLOW : MESSAGES[idx]}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}