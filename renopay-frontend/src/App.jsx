import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Nav } from "./components/Nav";
import { AIAssistant } from "./components/AIAssistant";

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
import { DigitalGoldScreen } from "./screens/DigitalGoldScreen";
import { LedgerReportScreen } from "./screens/LedgerReportScreen";
import { AccountingScreen } from "./screens/AccountingScreen";
import { TravelScreen } from "./screens/TravelScreen";
import { LoansScreen } from "./screens/LoansScreen";
import { RechargeScreen } from "./screens/RechargeScreen";
import { MutualFundsScreen } from "./screens/MutualFundsScreen";
import { GiftCardScreen } from "./screens/GiftCardScreen";

function AppShell() {
  const { profile, loading } = useAuth();
  const [screen, setScreen] = useState("home");
  const [tab, setTab] = useState("home");
  const [payPrefill, setPayPrefill] = useState(null);
  const [travelPrefillTab, setTravelPrefillTab] = useState("train");
  const [rechargePrefillTab, setRechargePrefillTab] = useState("mobile");
  const [loansPrefillTab, setLoansPrefillTab] = useState("personal");
  const [scanInitialMode, setScanInitialMode] = useState("camera");
  const [giftCardPrefillCode, setGiftCardPrefillCode] = useState("");

  const go = (s, data) => {
    if (["home", "pay", "expenses", "history", "profile", "accounting"].includes(s)) setTab(s);
    setPayPrefill(s === "pay" ? data ?? null : null);
    if (s === "scan") {
      setScanInitialMode(typeof data === "string" ? data : data?.mode || "camera");
    }
    if (s === "giftcard") {
      setGiftCardPrefillCode(typeof data === "string" ? data : data?.claimCode || "");
    }
    if (s === "travel") {
      setTravelPrefillTab(typeof data === "string" ? data : data?.tab || "train");
    }
    if (s === "recharge") {
      setRechargePrefillTab(typeof data === "string" ? data : data?.tab || "mobile");
    }
    if (s === "loans") {
      setLoansPrefillTab(typeof data === "string" ? data : data?.tab || "personal");
    }
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
      {screen === "pay"           && (
        <PayScreen
          onBack={() => go("home")}
          onNavigate={go}
          prefillVpa={payPrefill?.vpa || (typeof payPrefill === "string" ? payPrefill : "")}
          prefillAmount={payPrefill?.amount}
          prefillNote={payPrefill?.note}
          prefillName={payPrefill?.name}
          prefillCategory={payPrefill?.category}
          prefillApp={payPrefill?.app}
        />
      )}
      {screen === "expenses"      && <ExpensesScreen onBack={() => go("home")} />}
      {screen === "history"       && <HistoryScreen onBack={() => go("home")} />}
      {screen === "giftcard"      && (
        <GiftCardScreen
          onBack={() => go("home")}
          initialClaimCode={giftCardPrefillCode}
          onScanQr={() => go("scan")}
        />
      )}
      {screen === "addmoney"      && <AddMoneyScreen onBack={() => go("home")} />}
      {screen === "qr"            && <QRScreen onBack={() => go("home")} />}
      {screen === "scan"          && (
        <ScanScreen
          onBack={() => go("home")}
          initialMode={scanInitialMode}
          onSuccess={(data) => {
            if (data?.type === "giftcard") {
              go("giftcard", { claimCode: data.code });
            } else {
              go("pay", typeof data === "string" ? { vpa: data } : data);
            }
          }}
        />
      )}

      {screen === "profile"       && <ProfileScreen onBack={() => go("home")} onLoggedOut={() => go("login")} />}
      {screen === "requests"      && <RequestScreen onBack={() => go("home")} />}
      {screen === "split"         && <SplitScreen onBack={() => go("home")} />}
      {screen === "subscriptions" && <SubscriptionsScreen onBack={() => go("home")} />}
      {screen === "upilite"       && <UPILiteScreen onBack={() => go("home")} />}
      {screen === "rewards"       && <RewardsScreen onBack={() => go("home")} />}
      {screen === "savings"       && <SavingsScreen onBack={() => go("home")} onNavigate={go} />}
      {screen === "vaults"        && <VaultScreen onBack={() => go("home")} />}
      {screen === "gold"          && <DigitalGoldScreen onBack={() => go("home")} />}
      {screen === "ledger"        && <LedgerReportScreen onBack={() => go("home")} />}
      {screen === "accounting"    && <AccountingScreen onBack={() => go("home")} />}
      {screen === "travel"        && (
        <TravelScreen
          onBack={() => go("home")}
          onNavigate={go}
          initialTab={travelPrefillTab}
        />
      )}
      {screen === "loans"         && (
        <LoansScreen
          onBack={() => go("home")}
          onNavigate={go}
          initialTab={loansPrefillTab}
        />
      )}
      {screen === "recharge"      && (
        <RechargeScreen
          onBack={() => go("home")}
          onNavigate={go}
          initialTab={rechargePrefillTab}
        />
      )}
      {screen === "invest"        && (
        <MutualFundsScreen
          onBack={() => go("home")}
          onNavigate={go}
        />
      )}
      <AIAssistant currentScreen={screen} onNavigate={go} />
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
