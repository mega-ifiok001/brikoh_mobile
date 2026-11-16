import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { getAccess } from "../../lib/access";
import { Button, EmptyState, ErrorState, Skeleton, T } from "../ui";
import { Page } from "../kit";
import { C } from "../../theme";

/** Shared wrapper for every settings screen: Page + owner/admin gate + loading/error + scrollable form. */
export function SettingsScreen({
  title,
  loading,
  error,
  onRetry,
  right,
  footer,
  refreshing,
  onRefresh,
  children,
}: {
  title: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  right?: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const { me } = useAuth();
  const allowed = getAccess(me).can("settings");
  if (!allowed) {
    return (
      <Page title={title}>
        <EmptyState icon="lock-closed-outline" title="Owner access only" sub="Settings are limited to the store owner and admins." />
      </Page>
    );
  }
  return (
    <Page title={title} right={right}>
      {error ? (
        <ErrorState message={error} onRetry={onRetry || (() => {})} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} tintColor={C.brand} onRefresh={onRefresh} /> : undefined}
          >
            {loading ? (
              <>
                <Skeleton h={56} r={16} />
                <Skeleton h={56} r={16} />
                <Skeleton h={56} r={16} />
                <Skeleton h={56} r={16} />
              </>
            ) : (
              <>
                {children}
                {footer}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </Page>
  );
}

export function SaveBar({ label, busy, onPress, icon = "checkmark" }: { label: string; busy?: boolean; onPress: () => void; icon?: any }) {
  return <Button label={label} onPress={onPress} busy={busy} icon={icon} />;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <T w="regular" size={12} color={C.ink400} style={{ lineHeight: 17 }}>
      {children}
    </T>
  );
}

export function Gap({ h = 8 }: { h?: number }) {
  return <View style={{ height: h }} />;
}
