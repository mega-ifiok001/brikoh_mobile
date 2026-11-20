import type { ReactNode } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { T } from "../ui";
import { C } from "../../theme";

// Dark, branded frame shared by the verify / forgot / reset screens
// (same look as the login screen).
export default function AuthShell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.night }}>
      <LinearGradient
        colors={["rgba(236,100,5,0.28)", "rgba(236,100,5,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, padding: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
              <Image source={require("../../../assets/logo-white.png")} style={{ width: 112, height: 28 }} resizeMode="contain" />
              {onBack ? (
                <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
                  <Ionicons name="close" size={24} color={C.nightMuted} />
                </Pressable>
              ) : null}
            </View>

            <View style={{ marginTop: 44 }}>
              <T w="display" size={32} color={C.onNight} style={{ lineHeight: 36, letterSpacing: -0.6 }}>
                {title}
              </T>
              {subtitle ? (
                <T w="regular" size={14.5} color={C.nightMuted} style={{ marginTop: 12, lineHeight: 22 }}>
                  {subtitle}
                </T>
              ) : null}
            </View>

            <View style={{ flex: 1, minHeight: 28 }} />
            <View style={{ gap: 12, paddingBottom: 10 }}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}