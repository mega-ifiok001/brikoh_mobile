import { Pressable, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { T, tap, type IconName } from "../../src/components/ui";
import { TourOverlay, TourProvider, TourRing, useTour } from "../../src/components/tour/TourProvider";
import { C, shadow } from "../../src/theme";

const META: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  home: { label: "Home", icon: "grid-outline", iconOn: "grid" },
  orders: { label: "Orders", icon: "receipt-outline", iconOn: "receipt" },
  sell: { label: "Sell", icon: "cart-outline", iconOn: "cart" },
  products: { label: "Products", icon: "cube-outline", iconOn: "cube" },
  more: { label: "More", icon: "ellipsis-horizontal", iconOn: "ellipsis-horizontal" },
};

// SDK 58 hands custom tab bars `emitter` + `navigateToTab` (no `navigation`).
// Loose prop types on purpose: expo-router vendors react-navigation internally.
function TabBar({ state, emitter, navigateToTab }: { state: any; emitter: any; navigateToTab: (routeKey: string) => void }) {
  const insets = useSafeAreaInsets();
  const tour = useTour();
  return (
    <View
      onLayout={(e) => tour.setBarHeight(e.nativeEvent.layout.height)}
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: C.white,
        borderTopWidth: 1,
        borderTopColor: C.cream200,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
      }}
    >
      {state.routes.map((route: any, i: number) => {
        const meta = META[route.name];
        if (!meta) return null;
        const focused = state.index === i;
        const isSell = route.name === "sell";

        // While the tour is open it drives the tabs; ignore taps. Non-target tabs are dimmed.
        const highlight = tour.targetTab === route.name;
        const dim = !!tour.targetTab && !highlight;

        const onPress = () => {
          if (tour.active) return;
          tap();
          const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !e.defaultPrevented) navigateToTab(route.key);
        };

        if (isSell) {
          return (
            <Pressable key={route.key} onPress={onPress} style={{ flex: 1, alignItems: "center", opacity: dim ? 0.4 : 1 }} accessibilityLabel="Sell">
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 21,
                  marginTop: -26,
                  backgroundColor: C.brand,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 4,
                  borderColor: C.cream50,
                  ...shadow.brand,
                }}
              >
                <Ionicons name="cart" size={25} color="#fff" />
                {highlight && <TourRing circle />}
              </View>
              <T w="bold" size={11.5} color={focused ? C.brand : C.ink400} style={{ marginTop: 3 }}>
                Sell
              </T>
            </Pressable>
          );
        }

        return (
          <Pressable key={route.key} onPress={onPress} style={{ flex: 1, alignItems: "center", gap: 3, paddingTop: 2, opacity: dim ? 0.4 : 1 }} accessibilityLabel={meta.label}>
            {highlight && <TourRing />}
            <Ionicons name={focused ? meta.iconOn : meta.icon} size={23} color={focused ? C.brand : C.ink300} />
            <T w="bold" size={11.5} color={focused ? C.brand : C.ink400}>
              {meta.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <TourProvider>
      <View style={{ flex: 1 }}>
        <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.cream50 } }}>
          <Tabs.Screen name="home" />
          <Tabs.Screen name="orders" />
          <Tabs.Screen name="sell" />
          <Tabs.Screen name="products" />
          <Tabs.Screen name="more" />
        </Tabs>
        <TourOverlay />
      </View>
    </TourProvider>
  );
}