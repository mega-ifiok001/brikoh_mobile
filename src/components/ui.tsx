import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, F, R, shadow } from "../theme";
import { fm, initialsOf, titleCase } from "../lib/format";

export type IconName = keyof typeof Ionicons.glyphMap;

export function tap() {
  Haptics.selectionAsync().catch(() => {});
}

/* ---------------------------------- Text ---------------------------------- */

type Weight = "regular" | "semi" | "bold" | "extra" | "display";
export function T({
  w = "semi",
  size = 14,
  color = C.ink900,
  style,
  ...p
}: TextProps & { w?: Weight; size?: number; color?: string }) {
  const family = w === "display" ? F.display : w === "regular" ? F.regular : w === "semi" ? F.semi : w === "bold" ? F.bold : F.extra;
  return <RNText {...p} style={[{ fontFamily: family, fontSize: size, color }, style]} />;
}

/* ---------------------------------- Card ---------------------------------- */

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const base: ViewStyle = {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.cream200,
    borderRadius: R.lg,
    ...shadow.card,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={() => {
          tap();
          onPress();
        }}
        style={({ pressed }) => [base, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/* ---------------------------------- Pill ---------------------------------- */

export type Tone = "green" | "gold" | "danger" | "neutral" | "brand" | "dark";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: C.leaf100, fg: C.leaf500 },
  gold: { bg: C.gold100, fg: C.gold600 },
  danger: { bg: C.danger100, fg: C.danger500 },
  neutral: { bg: C.cream100, fg: C.ink500 },
  brand: { bg: C.brand50, fg: C.brand },
  dark: { bg: C.ink900, fg: C.white },
};

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={{ backgroundColor: t.bg, borderRadius: R.pill, paddingHorizontal: 9, paddingVertical: 3, alignSelf: "flex-start" }}>
      <T w="extra" size={10.5} color={t.fg}>
        {children}
      </T>
    </View>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  PENDING: "gold",
  AWAITING_PAYMENT: "gold",
  PAID: "green",
  SHIPPED: "dark",
  CANCELLED: "neutral",
  REFUNDED: "gold",
  FAILED: "danger",
  DRAFT: "neutral",
  PUBLISHED: "green",
  ISSUED: "gold",
  VOID: "neutral",
  REQUESTED: "gold",
  PROCESSING: "gold",
  SUCCESS: "green",
  CONFIRMED: "green",
  COMPLETED: "green",
};

export function StatusPill({ status }: { status?: string | null }) {
  if (!status) return null;
  return <Pill tone={STATUS_TONE[status] || "neutral"}>{titleCase(status)}</Pill>;
}

/* ---------------------------------- Money --------------------------------- */

export function Money({
  v,
  currency = "NGN",
  compact,
  size = 14,
  color = C.ink900,
  w = "extra",
}: {
  v: any;
  currency?: string;
  compact?: boolean;
  size?: number;
  color?: string;
  w?: Weight;
}) {
  return (
    <T w={w} size={size} color={color} style={{ fontVariant: ["tabular-nums"] }}>
      {fm(v, currency, { compact })}
    </T>
  );
}

/* --------------------------------- Button --------------------------------- */

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  busy,
  disabled,
  style,
  small,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "dark" | "outline" | "ghost" | "danger";
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const bg =
    variant === "primary" ? C.brand : variant === "dark" ? C.ink900 : variant === "danger" ? C.danger100 : variant === "outline" ? C.white : "transparent";
  const fg = variant === "outline" ? C.ink900 : variant === "ghost" ? C.brand : variant === "danger" ? C.danger500 : C.white;
  const off = disabled || busy;
  return (
    <Pressable
      disabled={off}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          height: small ? 40 : 52,
          borderRadius: small ? 13 : 16,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 18,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: C.cream300,
          opacity: off ? 0.5 : pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        variant === "primary" && !off ? shadow.brand : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
          <T w="extra" size={small ? 13 : 15} color={fg}>
            {label}
          </T>
        </>
      )}
    </Pressable>
  );
}

/* ---------------------------------- Input --------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <T w="bold" size={12} color={C.ink500}>
          {label}
        </T>
      ) : null}
      {children}
      {hint ? (
        <T w="regular" size={11} color={C.ink400}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Input({
  dark,
  style,
  right,
  ...p
}: TextInputProps & { dark?: boolean; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <View
      style={[
        {
          height: 52,
          borderRadius: 15,
          backgroundColor: dark ? "#161d19" : C.white,
          borderWidth: 1.5,
          borderColor: focus ? C.brand : dark ? "#26302a" : C.cream300,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
        },
        style,
      ]}
    >
      <TextInput
        {...p}
        onFocus={(e) => {
          setFocus(true);
          p.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          p.onBlur?.(e);
        }}
        placeholderTextColor={dark ? "#6f7a73" : C.ink300}
        style={{ flex: 1, fontFamily: F.semi, fontSize: 15, color: dark ? C.cream50 : C.ink900, height: "100%" }}
      />
      {right}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <View
      style={{
        height: 44,
        borderRadius: 14,
        backgroundColor: C.white,
        borderWidth: 1,
        borderColor: C.cream200,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name="search" size={17} color={C.ink400} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink400}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, fontFamily: F.semi, fontSize: 14, color: C.ink900, height: "100%" }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10}>
          <Ionicons name="close-circle" size={17} color={C.ink300} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------------------------------- Chips --------------------------------- */

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: R.pill,
        backgroundColor: on ? C.ink900 : C.white,
        borderWidth: 1,
        borderColor: on ? C.ink900 : C.cream200,
      }}
    >
      <T w="bold" size={12.5} color={on ? C.white : C.ink500}>
        {label}
      </T>
    </Pressable>
  );
}

/* --------------------------------- Avatar --------------------------------- */

export function Avatar({ name, size = 40, dark }: { name?: string | null; size?: number; dark?: boolean }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        backgroundColor: dark ? C.brand : C.cream100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T w="extra" size={size * 0.33} color={dark ? C.white : C.ink500}>
        {initialsOf(name)}
      </T>
    </View>
  );
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ h = 16, w, r = 10, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0.45, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ height: h, width: w ?? "100%", borderRadius: r, backgroundColor: C.cream200, opacity: a }, style]} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={{ gap: 10, paddingHorizontal: 16 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} h={74} r={18} />
      ))}
    </View>
  );
}

/* ------------------------------- Empty / error ------------------------------ */

export function EmptyState({
  icon = "sparkles-outline",
  title,
  sub,
  action,
}: {
  icon?: IconName;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 8 }}>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
        <Ionicons name={icon} size={28} color={C.brand} />
      </View>
      <T w="display" size={18} style={{ textAlign: "center" }}>
        {title}
      </T>
      {sub ? (
        <T w="regular" size={13} color={C.ink400} style={{ textAlign: "center", lineHeight: 19 }}>
          {sub}
        </T>
      ) : null}
      {action ? <View style={{ marginTop: 10 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      sub={message}
      action={<Button label="Try again" onPress={onRetry} small />}
    />
  );
}

/* ------------------------------- Screen header ------------------------------ */

export function LargeTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <View style={{ flex: 1 }}>
        <T w="display" size={28} style={{ letterSpacing: -0.6 }}>
          {title}
        </T>
        {sub ? (
          <T w="semi" size={12.5} color={C.ink400} style={{ marginTop: 1 }}>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({ name, onPress, dark, badge }: { name: IconName; onPress: () => void; dark?: boolean; badge?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 13,
        backgroundColor: dark ? C.brand : C.white,
        borderWidth: dark ? 0 : 1,
        borderColor: C.cream200,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={name} size={20} color={dark ? C.white : C.ink700} />
      {badge ? (
        <View style={{ position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 9, backgroundColor: C.brand, borderWidth: 2, borderColor: C.white }} />
      ) : null}
    </Pressable>
  );
}

/* ------------------------------- Bottom sheet ------------------------------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,16,13,0.5)" }} />
        <View
          style={{
            backgroundColor: C.white,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 14),
            maxHeight: "88%",
          }}
        >
          <View style={{ width: 40, height: 4, borderRadius: 4, backgroundColor: C.cream200, alignSelf: "center", marginBottom: 12 }} />
          {title ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 }}>
              <T w="display" size={20}>
                {title}
              </T>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color={C.ink400} />
              </Pressable>
            </View>
          ) : null}
          {children}
          {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/* ----------------------------------- Toast ---------------------------------- */

type ToastMsg = { id: number; kind: "success" | "error" | "info"; text: string };
let toastId = 0;
const toastListeners = new Set<(m: ToastMsg) => void>();
const emit = (kind: ToastMsg["kind"], text: string) => {
  const m = { id: ++toastId, kind, text };
  toastListeners.forEach((l) => l(m));
};
export const toast = {
  success: (t: string) => emit("success", t),
  error: (t: string) => emit("error", t),
  info: (t: string) => emit("info", t),
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const y = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (m: ToastMsg) => {
      setMsg(m);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      clearTimeout(timer);
      timer = setTimeout(() => {
        Animated.timing(y, { toValue: -120, duration: 220, useNativeDriver: true }).start(() => setMsg(null));
      }, 3200);
    };
    toastListeners.add(on);
    return () => {
      toastListeners.delete(on);
      clearTimeout(timer);
    };
  }, [y]);

  if (!msg) return null;
  const bg = msg.kind === "error" ? C.danger500 : msg.kind === "success" ? C.leaf500 : C.ink900;
  const icon: IconName = msg.kind === "error" ? "alert-circle" : msg.kind === "success" ? "checkmark-circle" : "information-circle";
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 16,
        right: 16,
        transform: [{ translateY: y }],
        backgroundColor: bg,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        ...shadow.float,
        zIndex: 999,
      }}
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <T w="bold" size={13} color="#fff" style={{ flex: 1 }}>
        {msg.text}
      </T>
    </Animated.View>
  );
}
