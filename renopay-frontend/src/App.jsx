import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Nav } from "./components/Nav";

import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PayScreen } from "./screens/PayScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { AddMoneyScreen } from "./screens/AddMoneyScreen";
import { RequestScreen } from "./screens/RequestScreen";
import { SplitScreen } from "./screens/SplitScreen";
import { SubscriptionsScreen } from "./screens/SubscriptionsScreen";
import { RewardsScreen } from "./screens/RewardsScreen";
import { SavingsScreen } from "./screens/SavingsScreen";
import { VaultScreen } from "./screens/VaultScreen";
import { UPILiteScreen } from "./screens/UPILiteScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { ScanScreen } from "./screens/ScanScreen";
import { QRScreen } from "./screens/QRScreen";
import { VoiceUPIScreen } from "./screens/VoiceUPIScreen";
import { DigitalGoldScreen } from "./screens/DigitalGoldScreen";
import { LedgerReportScreen } from "./screens/LedgerReportScreen";
import { AccountingScreen } from "./screens/AccountingScreen";

function AppShell() {
  const { profile, loading } = useAuth();
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [payPrefill, setPayPrefill] = useState(null);

  const go = (s, data) => {
    if (["home", "pay", "expenses", "history", "profile", "accounting"].includes(s)) setTab(s);
    setPayPrefill(s === "pay" ? data ?? null : null);
    setScreen(s);
  };

  if (loading) {
    return <div className="min-h-screen bg-bg flex items-center justify-center text-muted text-sm">Loading...</div>;
  }

  if (!profile) {
    return <LoginScreen onDone={() => { setScreen("home"); setTab("home"); }} />;
  }

  return (
    <div className="max-w-[430px] mx-auto relative">
      {screen === "home"          && <HomeScreen onNavigate={go} />}
      {screen === "pay"           && <PayScreen onBack={() => go("home")} onNavigate={go} prefillVpa={payPrefill?.vpa} prefillAmount={payPrefill?.amount} prefillNote={payPrefill?.note} />}
      {screen === "expenses"      && <ExpensesScreen onBack={() => go("home")} />}
      {screen === "history"       && <HistoryScreen onBack={() => go("home")} />}
      {screen === "addmoney"      && <AddMoneyScreen onBack={() => go("home")} />}
      {screen === "qr"            && <QRScreen onBack={() => go("home")} />}
      {screen === "scan"          && <ScanScreen onBack={() => go("home")} onSuccess={(v) => go("pay", v)} />}
      {screen === "profile"       && <ProfileScreen onBack={() => go("home")} onLoggedOut={() => go("login")} />}
      {screen === "requests"      && <RequestScreen onBack={() => go("home")} />}
      {screen === "split"         && <SplitScreen onBack={() => go("home")} />}
      {screen === "subscriptions" && <SubscriptionsScreen onBack={() => go("home")} />}
      {screen === "upilite"       && <UPILiteScreen onBack={() => go("home")} />}
      {screen === "rewards"       && <RewardsScreen onBack={() => go("home")} />}
      {screen === "savings"       && <SavingsScreen onBack={() => go("home")} onNavigate={go} />}
      {screen === "vaults"        && <VaultScreen onBack={() => go("home")} />}
      {screen === "voice"         && <VoiceUPIScreen onBack={() => go("home")} onNavigatePay={(data) => go("pay", data)} />}
      {screen === "gold"          && <DigitalGoldScreen onBack={() => go("home")} />}
      {screen === "ledger"        && <LedgerReportScreen onBack={() => go("home")} />}
      {screen === "accounting"    && <AccountingScreen onBack={() => go("home")} />}
      <Nav active={tab} onNavigate={go} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
