import { useState } from "react";
import { Linking, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { Button, T } from "../src/components/ui";
import { C } from "../src/theme";

// Shown when you're signed in but no store was found on the account — either
// onboarding on the web isn't finished, or the profile request failed.
export default function Setup() {
  const { refresh, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.cream50 }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center", alignItems: "center", gap: 10 }}>
        <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: C.brand50, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
          <Ionicons name="storefront-outline" size={32} color={C.brand} />
        </View>
        <T w="display" size={24} style={{ textAlign: "center" }}>
          Let's finish setting up
        </T>
        <T w="regular" size={14} color={C.ink500} style={{ textAlign: "center", lineHeight: 21, maxWidth: 320 }}>
          We couldn't find a store on your account yet. Finish onboarding on the Brikoh website, then come back and refresh. If you already did, check your connection and try again.
        </T>
        <View style={{ width: "100%", gap: 10, marginTop: 18 }}>
          <Button
            label="Refresh"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              await refresh();
              setBusy(false);
            }}
          />
          <Button label="Open brikoh.com" variant="outline" onPress={() => Linking.openURL("https://brikoh.com/#/onboarding")} />
          <Button label="Sign out" variant="ghost" onPress={logout} />
        </View>
      </View>
    </SafeAreaView>
  );
}
