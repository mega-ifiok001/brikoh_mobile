// Guided tour for new users. Lives inside the tabs layout so it can walk through the tab bar.
//  - Auto-offers once (after sign-in + setup). Start / skip / close are all remembered.
//  - Replay any time via useTour().start() (More → App tour).
//  - Never forced: the user can skip or close on every step, and Android back closes it.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, BackHandler, Easing, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { getTourStatus, saveTourStatus, TAB_ORDER, TOUR_STEPS, type TourStatus, type TourTab } from "../../lib/tour";
import { Button, T, toast } from "../ui";
import { C, R, shadow } from "../../theme";

const AUTO_START_DELAY_MS = 900;
const SCRIM = "rgba(10,16,13,0.62)";
const STRIP = 24; // dimmed strip above the tab bar (covers the top of the raised Sell button)
const SELL_GAP = 64; // width left undimmed around the Sell button

interface TourCtx {
  active: boolean;
  step: number;
  targetTab: TourTab | null;
  barHeight: number;
  setBarHeight: (h: number) => void;
  start: () => void;
  next: () => void;
  back: () => void;
  end: (status: TourStatus) => void;
}

const TourContext = createContext<TourCtx>({
  active: false,
  step: 0,
  targetTab: null,
  barHeight: 64,
  setBarHeight: () => {},
  start: () => {},
  next: () => {},
  back: () => {},
  end: () => {},
});

export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  const router = useRouter();
  const ownerId = String(me?.store?.id ?? me?.account?.id ?? "device");

  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [barHeight, setBar] = useState(64);
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;

  const setBarHeight = useCallback((h: number) => setBar((p) => (Math.abs(p - h) > 0.5 ? h : p)), []);

  // First visit: offer the tour once, unless a choice has already been saved.
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    getTourStatus(ownerId).then((status) => {
      if (!alive || status) return;
      timer = setTimeout(() => {
        if (!alive) return;
        setStep(0);
        setActive(true);
      }, AUTO_START_DELAY_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [ownerId]);

  // Move to the tab each step is talking about.
  const tab = active ? TOUR_STEPS[step]?.tab : undefined;
  useEffect(() => {
    if (tab) router.navigate(`/${tab}` as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const end = useCallback((status: TourStatus) => {
    setActive(false);
    setStep(0);
    saveTourStatus(ownerRef.current, status);
    if (status === "completed") toast.success("You're all set. Replay the tour any time from More.");
  }, []);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) end("completed");
    else setStep(step + 1);
  }, [step, end]);

  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Android hardware back closes the tour instead of leaving the screen.
  useEffect(() => {
    if (!active || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      end("dismissed");
      return true;
    });
    return () => sub.remove();
  }, [active, end]);

  const value = useMemo<TourCtx>(
    () => ({ active, step, targetTab: active ? TOUR_STEPS[step]?.tab ?? null : null, barHeight, setBarHeight, start, next, back, end }),
    [active, step, barHeight, setBarHeight, start, next, back, end]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/* ------------------------------ Tab highlight ------------------------------ */

// Pulsing ring the tab bar draws around the tab the tour is pointing at.
export function TourRing({ circle }: { circle?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const inset = circle ? -9 : -4;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: inset,
        bottom: circle ? inset : -6,
        left: circle ? inset : 6,
        right: circle ? inset : 6,
        borderWidth: 2.5,
        borderColor: C.brand,
        borderRadius: circle ? 27 : 16,
        transform: [{ scale }],
      }}
    />
  );
}

/* --------------------------------- Overlay --------------------------------- */

// A Pressable with no handler: it just swallows touches so the screen underneath can't be used mid-tour.
const Block = ({ style }: { style: object }) => <Pressable accessible={false} style={style} />;

export function TourOverlay() {
  const { active, step, barHeight, next, back, end } = useTour();
  const [width, setWidth] = useState(0);
  if (!active) return null;

  const s = TOUR_STEPS[step];
  const last = TOUR_STEPS.length - 1;
  const isWelcome = step === 0;
  const isLast = step === last;
  const tabIndex = s.tab ? TAB_ORDER.indexOf(s.tab) : -1;
  const bottomOffset = barHeight + STRIP;

  // Arrow: points down at the centre of the highlighted tab (card has 16px side margins).
  const arrowLeft = tabIndex >= 0 && width ? Math.min(Math.max((width / TAB_ORDER.length) * (tabIndex + 0.5) - 16 - 8, 18), width - 32 - 34) : 0;

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents="box-none" onLayout={onLayout}>
      {/* Dim everything above the tab bar */}
      <Block style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: bottomOffset, backgroundColor: SCRIM }} />
      {/* Strip just above the bar. The Sell step leaves a gap so the raised button stays bright. */}
      <View style={{ position: "absolute", left: 0, right: 0, bottom: barHeight, height: STRIP, flexDirection: "row" }}>
        <Block style={{ flex: 1, backgroundColor: SCRIM }} />
        <Block style={{ width: SELL_GAP, backgroundColor: s.tab === "sell" ? "transparent" : SCRIM }} />
        <Block style={{ flex: 1, backgroundColor: SCRIM }} />
      </View>

      <View
        pointerEvents="box-none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: bottomOffset, padding: 16, justifyContent: s.tab ? "flex-end" : "center" }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: C.white,
            borderRadius: R.xl,
            borderWidth: 1,
            borderColor: C.cream200,
            padding: 18,
            ...shadow.float,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={s.icon} size={19} color={C.brand} />
            </View>
            <T w="extra" size={11} color={C.ink300} style={{ flex: 1, letterSpacing: 1.2, textTransform: "uppercase" }}>
              {isWelcome ? "Quick tour" : `Step ${step} of ${last}`}
            </T>
            <Pressable
              onPress={() => end("dismissed")}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close tour"
              style={({ pressed }) => ({
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: C.cream100,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="close" size={18} color={C.ink500} />
            </Pressable>
          </View>

          {/* Copy */}
          <T w="display" size={21} style={{ marginTop: 14 }}>
            {s.title}
          </T>
          <T w="regular" size={14} color={C.ink500} style={{ marginTop: 6, lineHeight: 21 }}>
            {s.body}
          </T>

          {/* Progress dots */}
          {!isWelcome && (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 14 }}>
              {TOUR_STEPS.slice(1).map((st, i) => (
                <View
                  key={st.id}
                  style={{ height: 6, width: i + 1 === step ? 18 : 6, borderRadius: 3, backgroundColor: i + 1 === step ? C.brand : C.cream300 }}
                />
              ))}
            </View>
          )}

          {/* Actions */}
          {isWelcome ? (
            <View style={{ marginTop: 18, gap: 4 }}>
              <Button label="Start tour" icon="arrow-forward" onPress={next} />
              <Button label="Maybe later" variant="ghost" onPress={() => end("skipped")} />
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 }}>
              <Button label="Skip tour" variant="ghost" small onPress={() => end("skipped")} style={{ paddingHorizontal: 6 }} />
              <View style={{ flex: 1 }} />
              {step > 1 && <Button label="Back" variant="outline" small onPress={back} />}
              <Button label={isLast ? "Done" : "Next"} small onPress={next} />
            </View>
          )}

          {/* Arrow toward the tab */}
          {tabIndex >= 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: -8,
                left: arrowLeft,
                width: 16,
                height: 16,
                backgroundColor: C.white,
                borderRightWidth: 1,
                borderBottomWidth: 1,
                borderColor: C.cream200,
                transform: [{ rotate: "45deg" }],
              }}
            />
          )}
        </View>
      </View>
    </View>
  );
}