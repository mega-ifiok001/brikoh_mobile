import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Button, T } from "../../src/components/ui";
import MarketScene, { SCENE_H } from "../../src/components/MarketScene";
import { C } from "../../src/theme";

// First screen for anyone who isn't signed in: an animated market scene + Sign up / Sign in.
export default function Welcome() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [sceneBox, setSceneBox] = useState(0);
  const sceneIn = useRef(new Animated.Value(0)).current;
  const copyIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(sceneIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    Animated.timing(copyIn, { toValue: 1, duration: 650, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [sceneIn, copyIn]);

  // shrink the scene a little on short phones so the buttons always fit
  const scale = sceneBox > 0 ? Math.min(1, sceneBox / SCENE_H) : 1;

  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <LinearGradient colors={["rgba(236,100,5,0.22)", "rgba(236,100,5,0)"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 320 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <Image source={require("../../assets/logo-white.png")} style={{ width: 104, height: 26, marginTop: 14, marginLeft: 24 }} resizeMode="contain" />

        <View style={{ flex: 1, justifyContent: "center" }} onLayout={(e) => setSceneBox(e.nativeEvent.layout.height)}>
          <Animated.View style={{ opacity: sceneIn, height: SCENE_H * scale, alignItems: "center", overflow: "hidden" }}>
            <View style={{ width, height: SCENE_H, transformOrigin: "50% 0%", transform: [{ scale }] }}>
              <MarketScene width={width} />
            </View>
          </Animated.View>
        </View>

        <Animated.View style={{ paddingHorizontal: 24, paddingBottom: 14, gap: 12, opacity: copyIn, transform: [{ translateY: copyIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
          <T w="display" size={30} color={C.onNight} style={{ lineHeight: 34, letterSpacing: -0.6 }}>
            Your shop, open all day.
          </T>
          <T w="regular" size={14} color={C.nightMuted} style={{ lineHeight: 21, marginBottom: 6 }}>
            Sell, track stock and get paid, right from your phone.
          </T>
          <Button label="Create account" onPress={() => router.push("/(auth)/register")} />
          <Pressable
            onPress={() => router.push("/(auth)/login")}
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: "rgba(255,255,255,0.24)",
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <T w="extra" size={15} color={C.onNight}>
              Sign in
            </T>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
