import { useAuth } from "../context/AuthContext";
import iconAccounting from "../assets/actions/accounting.png";

const ITEMS = [
  { id: "home", icon: "🏠", l: "Home" },
  { id: "pay", icon: "💸", l: "Pay" },
  { id: "accounting", icon: iconAccounting, l: "Accounting" },
  { id: "history", icon: "📋", l: "History" },
  { id: "profile", icon: "👤", l: "Profile" },
];

export function Nav({ active, onNavigate }) {
  const { profile } = useAuth();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#151210]/95 border-t border-line flex justify-around pt-2.5 pb-[18px] z-[100] backdrop-blur-2xl" role="navigation">
      {ITEMS.map((n) => (
        <button
          key={n.id} className="btn flex flex-col items-center gap-[3px] bg-transparent min-w-[54px] relative cursor-pointer"
          style={{ color: active === n.id ? "#FF6A1A" : "#5C564F" }}
          onClick={() => onNavigate(n.id)}
          aria-label={n.l}
        >
          {active === n.id && (
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-[26px] h-[3px] rounded bg-accent shadow-[0_0_8px_#FF6A1A]" />
          )}
          {n.id === "profile" && profile?.avatar_url ? (
            <div className="w-[26px] h-[26px] rounded-full overflow-hidden flex items-center justify-center mt-0.5">
              <img
                src={profile.avatar_url}
                alt="Profile"
                className={`w-full h-full object-cover rounded-full border-2 transition-all ${
                  active === "profile" ? "border-accent shadow-[0_0_8px_#FF6A1A]" : "border-white/30"
                }`}
              />
            </div>
          ) : n.id === "accounting" ? (
            <div className="w-[26px] h-[26px] flex items-center justify-center mt-0.5">
              <img
                src={iconAccounting}
                alt="Accounting"
                className={`w-full h-full object-contain rounded-full transition-all ${
                  active === "accounting"
                    ? "scale-110 drop-shadow-[0_0_8px_#FF6A1A] ring-2 ring-accent"
                    : "opacity-80 hover:opacity-100"
                }`}
              />
            </div>
          ) : (
            <span className={n.id === "pay" ? "text-[26px]" : "text-xl"} style={{ filter: active === n.id ? "drop-shadow(0 0 8px #FF6A1A)" : "none" }}>
              {n.icon}
            </span>
          )}
          <span className="text-[9px] tracking-wide" style={{ fontWeight: active === n.id ? 700 : 400 }}>{n.l}</span>
        </button>
      ))}
    </div>
  );
}
