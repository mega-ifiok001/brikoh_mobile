import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { C } from "../theme";

// Launch loader: the Brikoh cart logo rolls in, then the name is typed out letter by letter.
// Built only from the existing logo asset + Animated, so it can ship as an OTA update.

const WORD = "Brikoh";
const TAGLINE = "Run your whole shop from your pocket.";
const SLOW = "Waking up the server — the first load can take a few seconds.";

const LOGO = require("../../assets/logo-white.png"); // cart + wordmark; we crop out just the cart
const LOGO_W = 2981;
const LOGO_H = 724;
const CART_X0 = 104; // cart's left/right edges inside logo-white.png (px of the original)
const CART_X1 = 705;
const CART_H = 84;
const SCALE = CART_H / LOGO_H;
const CART_W = (CART_X1 - CART_X0) * SCALE;

const START_TYPING_MS = 900;
const CHAR_MS = 170;

function CartLogo() {
  return (
    <View style={{ width: CART_W, height: CART_H, overflow: "hidden" }}>
      <Image
        source={LOGO}
        resizeMode="stretch"
        style={{ position: "absolute", top: 0, left: -CART_X0 * SCALE, width: LOGO_W * SCALE, height: CART_H }}
      />
    </View>
  );
}

export function BrandSplash() {
  const fade = useRef(new Animated.Value(0)).current;
  const cartIn = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const tagIn = useRef(new Animated.Value(0)).current;
  const [typed, setTyped] = useState(0);
  const [cursorOn, setCursorOn] = useState(true);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    Animated.spring(cartIn, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true }).start();
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ),
    ];
    loops.forEach((l) => l.start());

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= WORD.length; i++) {
      timers.push(setTimeout(() => setTyped(i), START_TYPING_MS + i * CHAR_MS));
    }
    const doneAt = START_TYPING_MS + WORD.length * CHAR_MS;
    // little hop of the cart each time it "finishes" typing, then the tagline fades in
    timers.push(
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.spring(bounce, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
        ]).start();
        Animated.timing(tagIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      }, doneAt + 80)
    );
    timers.push(setTimeout(() => setSlow(true), 7000));
    const blink = setInterval(() => setCursorOn((c) => !c), 480);
    return () => {
      loops.forEach((l) => l.stop());
      timers.forEach(clearTimeout);
      clearInterval(blink);
    };
  }, [fade, cartIn, bounce, glow, tagIn]);

  const shown = WORD.slice(0, typed);
  const rest = WORD.slice(typed);

  return (
    <Animated.View style={{ flex: 1, opacity: fade }}>
      <LinearGradient colors={["#0A100D", "#1a0f07", "#0A100D"]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* soft glow behind the logo: stacked translucent discs fake a radial blur */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            alignItems: "center",
            justifyContent: "center",
            opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }],
          }}
        >
          {[340, 260, 190, 130].map((d, i) => (
            <View key={d} style={{ position: "absolute", width: d, height: d, borderRadius: d / 2, backgroundColor: C.brand, opacity: 0.025 + i * 0.02 }} />
          ))}
        </Animated.View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Animated.View
            style={{
              opacity: cartIn,
              transform: [
                { translateX: cartIn.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) },
                { rotate: cartIn.interpolate({ inputRange: [0, 1], outputRange: ["-18deg", "0deg"] }) },
                { scale: cartIn.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                { translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
              ],
            }}
          >
            <CartLogo />
          </Animated.View>

          {/* typed name: untyped letters stay in the layout (invisible) so nothing shifts while typing */}
          <Text style={{ fontFamily: "BricolageGrotesque_800ExtraBold", fontSize: 50, letterSpacing: -1.2, color: "#fff", includeFontPadding: false }}>
            {shown}
            <Text style={{ color: C.brand, opacity: cursorOn ? 1 : 0 }}>|</Text>
            <Text style={{ opacity: 0 }}>{rest}</Text>
          </Text>
        </View>

        <Animated.Text
          style={{
            opacity: tagIn,
            marginTop: 22,
            paddingHorizontal: 40,
            textAlign: "center",
            fontFamily: "Manrope_600SemiBold",
            fontSize: 13,
            lineHeight: 19,
            color: "rgba(255,255,255,0.62)",
            transform: [{ translateY: tagIn.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          {slow ? SLOW : TAGLINE}
        </Animated.Text>
      </View>
    </Animated.View>
  );
}