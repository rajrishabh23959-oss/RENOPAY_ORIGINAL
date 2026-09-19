import { useState, useEffect, useRef } from "react";
import { AIAPI, AccountAPI } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import saathiLogo from "../assets/saathi-logo.png";

const LANGUAGES = [
  { code: "en", name: "English", native: "English", flag: "🌐", locale: "en-IN" },
  { code: "hi", name: "Hindi", native: "हिंदी", flag: "🇮🇳", locale: "hi-IN" },
  { code: "ta", name: "Tamil", native: "தமிழ்", flag: "🇮🇳", locale: "ta-IN" },
  { code: "te", name: "Telugu", native: "తెలుగు", flag: "🇮🇳", locale: "te-IN" },
  { code: "ml", name: "Malayalam", native: "മലയാളം", flag: "🇮🇳", locale: "ml-IN" },
];

const SCREEN_PROMPTS = {
  split: [
    "How do I split a bill with friends?",
    "Can I set custom amounts per person in Split Bill?",
  ],
  vaults: [
    "How do shared vaults work in RenoPay?",
    "How are vault withdrawals approved with multi-sig?",
  ],
  accounting: [
    "Explain double-entry ledger & chart of accounts",
    "How do I generate and download GST reports?",
    "How does automated payroll calculation work?",
  ],
  gold: [
    "How does 24K digital gold round-up work?",
    "How can I withdraw my gold balance to bank?",
  ],
  upilite: [
    "What are UPI Lite limits and benefits?",
    "How to make pinless 1-click payments under ₹500?",
  ],
  pay: [
    "How to send money to a UPI ID?",
    "What is the high-value privacy code?",
  ],
  giftcard: [
    "How do I create and send a RenoPay Gift Card?",
    "What is the difference between Normal Pay and Advance Pay for gift cards?",
    "How can someone scan the QR code to claim a gift card?",
    "How to download the Gift Card PDF voucher?",
  ],
  profile: [
    "How do I switch between Day Mode and Night Mode?",
    "Where is the Day Mode / Night Mode toggle located?",
    "How do I reset my UPI PIN?",
    "Where can I check my KYC and linked bank?",
  ],
  home: [
    "Who is the founder of RenoPay?",
    "How do I switch between Day Mode and Night Mode?",
    "How do I create a RenoPay Gift Card?",
    "Give me an overview of top RenoPay features",
    "How does SentinAI fraud detection protect me?",
    "How to save money with Digital Gold round-up?",
  ],
};

const FOUNDER_RESPONSES = {
  en: "👑 **Founder of RenoPay**\n\n**RISHABH RAJ** is the Founder and Creator of RenoPay.\n\nRishabh Raj is the visionary behind RenoPay, having conceptualized and built its modern UPI payments, double-entry accounting engine, Saathi AI assistant, and smart financial ecosystem.",
  hi: "👑 **RenoPay के संस्थापक (Founder)**\n\nRenoPay को **RISHABH RAJ** ने बनाया है और वे ही RenoPay के संस्थापक (Founder) और निर्माता हैं।\n\nऋषभ राज ने RenoPay के आधुनिक UPI पेमेंट्स, डबल-एंट्री अकाउंटिंग इंजन, Saathi AI असिस्टेंट और संपूर्ण फिनटेक प्लेटफॉर्म की परिकल्पना और निर्माण किया है।",
  ta: "👑 **RenoPay நிறுவனர் (Founder)**\n\nRenoPay-இன் நிறுவனர் (Founder) மற்றும் உருவாக்கியவர் **RISHABH RAJ** ஆவார்.\n\nரிஷப் ராஜ் RenoPay-இன் நவீன UPI பரிவர்த்தனைகள், இரட்டைப் பதிவு கணக்கியல் முறை, Saathi AI உதவியாளர் மற்றும் முழுமையான நிதி தளத்தை வடிவமைத்து உருவாக்கியவர் ஆவார்.",
  te: "👑 **RenoPay వ్యవస్థాపకుడు (Founder)**\n\nRenoPay వ్యవస్థాపకుడు (Founder) మరియు సృష్టికర్త **RISHABH RAJ**.\n\nరిషబ్ రాజ్ RenoPay యొక్క ఆధునిక UPI చెల్లింపులు, డబుల్-ఎంట్రీ అకౌంటింగ్ ఇంజిన్, Saathi AI అసిస్టెంట్ మరియు సమగ్ర ఫిన్‌టెక్ ప్లాట్‌ఫామ్‌ను రూపొందించారు.",
  ml: "👑 **RenoPay സ്ഥാപകൻ (Founder)**\n\nRenoPay-യുടെ സ്ഥാപകനും (Founder) സ്രഷ്ടാവും **RISHABH RAJ** ആണ്.\n\nറിഷഭ് രാജ് RenoPay-യുടെ ആധുനിക UPI പേയ്‌മെന്റുകൾ, ഡബിൾ-എൻട്രി അക്കൗണ്ടിംഗ് എഞ്ചിൻ, Saathi AI അസിസ്റ്റന്റ്, സമഗ്ര ഫിൻടെക് പ്ലാറ്റ്‌ഫോം എന്നിവ രൂപകൽപ്പന ചെയ്യുകയും നിർമ്മിക്കുകയും ചെയ്തു.",
};

const FOUNDER_TRIGGERS = [
  "founder", "creator", "founded", "owner", "created renopay",
  "who made renopay", "who built renopay", "who is behind renopay",
  "who started renopay", "who developed renopay",
  "kisne banaya", "kisne banaya hai", "kiska hai", "sansthapak", "संस्थापक", "किसने बनाया", "मालिक", "banane wala", "kisne build",
  "நிறுவனர்", "உருவாக்கியவர்", "யார் உருவாக்கினார்", "niruvanar", "uruvakkiyavar",
  "వ్యవస్థాపకుడు", "సృష్టికర్త", "vyavasthapakudu", "srushtikartha", "evaru nirmincharu",
  "സ്ഥാപകൻ", "സ്രഷ്ടാവ്", "sthapakan", "srashtavu", "aarannu undakkiyathu",
];

const THEME_RESPONSES = {
  en: "☀️ **RenoPay Day Mode & 🌙 Night Mode**\n\nRenoPay features a seamless dual-theme system designed for all lighting conditions:\n\n• **Where to find it**: Go to the **Profile / Account** screen (tap the Account tab at the bottom right). The theme selector is placed **directly above the UPI PIN card**.\n• **Night Mode (🌙)**: Deep OLED black theme designed for low-light comfort and battery savings (Switch ON).\n• **Day Mode (☀️)**: Clean, high-contrast daylight theme with bright cards and crisp slate text for outdoor readability (Switch OFF).\n• **Quick Controls**: Tap the toggle switch or the 1-tap pill buttons (`☀️ Day Mode` / `🌙 Night Mode`). Your theme preference is automatically remembered!",
  hi: "☀️ **RenoPay डे मोड (Day Mode) और 🌙 नाइट मोड (Night Mode)**\n\nRenoPay में आप आसानी से Day और Night मोड स्विच कर सकते हैं:\n\n• **कहाँ मिलेगा**: **Profile / Account** स्क्रीन खोलें (नीचे दाएँ कोने में Account टैब)। यह कार्ड **UPI PIN कार्ड के ठीक ऊपर** स्थित है।\n• **नाइट मोड (🌙)**: डिफ़ॉल्ट डीप OLED डार्क थीम, जो रात में आँखों के आराम और बैटरी बचाने के लिए उपयुक्त है (स्विच ऑन रहने पर)।\n• **डे मोड (☀️)**: ब्राइट, साफ़ और हाई-कॉन्ट्रास्ट डेलाइट थीम, जो धूप में साफ़ पढ़ने के लिए बेहतरीन है (स्विच ऑफ करने पर)।\n• **क्विक कंट्रोल**: आप स्लाइडिंग स्विच या 1-टैप बटन (`☀️ Day Mode` / `🌙 Night Mode`) से तुरंत बदल सकते हैं। आपकी पसंद अपने-आप सुरक्षित रहती है!",
  ta: "☀️ **RenoPay பகல் முறை (Day Mode) & 🌙 இரவு முறை (Night Mode)**\n\nRenoPay-ல் நீங்கள் மிக எளிதாக Day மற்றும் Night பயன்முறைகளை மாற்றிக்கொள்ளலாம்:\n\n• **எங்குள்ளது**: **Profile / Account** திரைக்குச் செல்லுங்கள். இந்த வசதி **UPI PIN கார்டுக்கு நேர் மேலே** உள்ளது.\n• **Night Mode (🌙)**: இயல்புநிலை OLED இருண்ட பயன்முறை, இரவு நேரப் பயன்பாட்டிற்கும் பேட்டரி சேமிப்பிற்கும் சிறந்தது.\n• **Day Mode (☀️)**: பிரகாசமான, தெளிவான மற்றும் அதிக மாறுபட்ட (high-contrast) பகல் பயன்முறை.\n• **கட்டுப்பாடு**: சுவிட்சை ஆன்/ஆஃப் செய்து அல்லது `☀️ Day Mode` / `🌙 Night Mode` பொத்தான்களைத் தட்டி உடனடியாக மாற்றலாம்!",
  te: "☀️ **RenoPay డే మోడ్ (Day Mode) & 🌙 నైట్ మోడ్ (Night Mode)**\n\nRenoPay లో మీరు సులభంగా Day మరియు Night మోడ్లను మార్చవచ్చు:\n\n• **ఎక్కడ ఉంటుంది**: **Profile / Account** స్క్రీన్‌కి వెళ్లండి. ఇది **UPI PIN కార్డుకు సరిగ్గా పైన** ఉంటుంది.\n• **Night Mode (🌙)**: డిఫాల్ట్ డీప్ OLED డార్క్ థీమ్, రాత్రి వేళల్లో సౌకర్యంగా ఉండటానికి మరియు బ్యాటరీ ఆదా చేయడానికి అనువైనది.\n• **Day Mode (☀️)**: ప్రకాశవంతమైన, స్పష్టమైన మరియు హై-కాంట్రాస్ట్ డేలైట్ థీమ్.\n• **కంట్రోల్స్**: స్లైడింగ్ స్విచ్ లేదా 1-ట్యాప్ బటన్లను (`☀️ Day Mode` / `🌙 Night Mode`) ఉపయోగించి సులభంగా మోడ్ మార్చవచ్చు!",
  ml: "☀️ **RenoPay ഡേ മോഡ് (Day Mode) & 🌙 നൈറ്റ് മോഡ് (Night Mode)**\n\nRenoPay-ൽ നിങ്ങൾക്ക് Day, Night മോഡുകൾ എളുപ്പത്തിൽ മാറ്റാം:\n\n• **എവിടെ കണ്ടെത്താം**: **Profile / Account** സ്ക്രീൻ തുറക്കുക. ഇത് **UPI PIN കാർഡിന് തൊട്ടുമുകളിലായി** നൽകിയിരിക്കുന്നു.\n• **Night Mode (🌙)**: ഡിഫോൾട്ട് ഡീപ് OLED ഡാർക്ക് തീം, രാത്രി സമയത്ത് കണ്ണിന് ആശ്വാസവും ബാറ്ററി ലാഭവും നൽകുന്നു.\n• **Day Mode (☀️)**: തെളിഞ്ഞതും ഉയർന്ന കോൺട്രാസ്റ്റുള്ളതുമായ ബ്രൈറ്റ് ഡേ തീം.\n• **നിയന്ത്രണം**: സ്ലൈഡിംഗ് സ്വിച്ച് അല്ലെങ്കിൽ `☀️ Day Mode` / `🌙 Night Mode` ബട്ടണുകൾ അമർത്തി മാറ്റാവുന്നതാണ്!",
};

const THEME_TRIGGERS = [
  "day mode", "night mode", "dark mode", "light mode", "theme", "switch theme",
  "change theme", "white mode", "black mode", "daylight",
  "day mode kaise", "night mode kaise", "theme kaise change", "theme badle", "day mode on", "night mode on",
  "light mode kaise", "screen white", "screen black", "theme change", "डे मोड", "नाइट मोड", "डार्क मोड",
  "பகல் முறை", "இரவு முறை", "day mode eppadi",
  "డే మోడ్", "నైట్ మోడ్", "day mode ela",
  "ഡേ മോഡ്", "നൈറ്റ് മോഡ്", "day mode engane",
];

const GIFTCARD_RESPONSES = {
  en: "🎁 **RenoPay Luxury Gift Cards & Vouchers**\n\nRenoPay lets you create, send, and claim digital luxury gift vouchers seamlessly:\n\n• **How to Create**: Tap **Gift Card** on the Home screen. Enter the recipient's name, voucher amount, and a personalized message.\n• **Two Payment Methods**: Choose between ⚡ **Normal Pay** (fast 6-digit UPI PIN payment) or 🚀 **Advance Pay** (interactive currency note slider with tactile animations).\n• **Voucher Features**: Generates an emerald & gold luxury card with a unique Gift Card ID, issuer name (`From`), recipient name (`To`), and a real scannable dynamic QR code.\n• **Official PDF Download**: Instantly download a print-ready, high-definition PDF voucher card.\n• **How to Redeem / Claim**: The recipient can scan the gift card's QR code using the RenoPay scanner or enter the Gift Card ID to credit the full amount directly into their wallet balance!",
  hi: "🎁 **RenoPay लक्ज़री गिफ्ट कार्ड्स (Gift Cards & Vouchers)**\n\nRenoPay में आप दोस्तों और परिवार के लिए डिजिटल गिफ्ट कार्ड बना सकते हैं और भेज सकते हैं:\n\n• **गिफ्ट कार्ड कैसे बनाएँ**: होम स्क्रीन पर **Gift Card** विकल्प पर टैप करें। पाने वाले का नाम, राशि (Amount) और शुभकामना संदेश दर्ज करें।\n• **पेमेंट के दो तरीके**: आप ⚡ **Normal Pay** (डायरेक्ट UPI PIN) या 🚀 **Advance Pay** (इंटरैक्टिव करेंसी नोट स्लाइडर) चुन सकते हैं।\n• **वाउचर के फीचर्स**: इसमें यूनिक Gift Card ID, भेजने वाले का नाम (`From`), पाने वाले का नाम (`To`) और एक असली स्कैन करने योग्य डायनामिक QR कोड मिलता है।\n• **PDF डाउनलोड**: आप तुरंत खूबसूरत एमराल्ड और गोल्ड डिज़ाइन वाला हाई-क्वालिटी PDF वाउचर डाउनलोड या शेयर कर सकते हैं।\n• **रिडीम कैसे करें**: कोई भी RenoPay स्कैनर से QR कोड स्कैन करके या Gift Card ID डालकर राशि सीधे अपने वॉलेट में पा सकता है!",
  ta: "🎁 **RenoPay டிஜிட்டல் பரிசு அட்டைகள் (Gift Cards)**\n\nRenoPay-ல் நீங்கள் பிரத்யேக டிஜிட்டல் பரிசு அட்டைகளை (Gift Cards) உருவாக்கலாம், அனுப்பலாம் மற்றும் பெறலாம்:\n\n• **எப்படி உருவாக்குவது**: முகப்புத் திரையில் (Home) உள்ள **Gift Card** ஐகானைத் தட்டவும். பெறுநரின் பெயர், தொகை மற்றும் வாழ்த்துச் செய்தியை உள்ளிடவும்.\n• **கட்டண முறைகள்**: ⚡ **Normal Pay** (நேரடி UPI PIN) அல்லது 🚀 **Advance Pay** (நாணய நோட்டு ஸ்லைடர்) மூலம் பணம் செலுத்தலாம்.\n• **அம்சங்கள்**: தனித்துவமான Gift Card ID, அனுப்பியவர் பெயர், பெறுநர் பெயர் மற்றும் உடனடி ஸ்கேன் செய்யக்கூடிய QR குறியீடு இதில் அடங்கும்.\n• **PDF பதிவிறக்கம்**: அழகான பிரீமியம் PDF வவுச்சரை பதிவிறக்கம் செய்து பகிரலாம்.\n• **பயன்படுத்துவது (Redeem)**: QR குறியீட்டை ஸ்கேன் செய்து தொகையை உடனடியாக வாலட்டில் வரவு வைக்கலாம்!",
  te: "🎁 **RenoPay డిజిటల్ గిఫ్ట్ కార్డులు (Gift Cards & Vouchers)**\n\nRenoPay లో మీరు స్నేహితులు మరియు కుటుంబ సభ్యుల కోసం డిజిటల్ గిఫ్ట్ కార్డులను సృష్టించవచ్చు మరియు పంపవచ్చు:\n\n• **ఎలా సృష్టించాలి**: హోమ్ స్క్రీన్‌పై **Gift Card** బటన్‌ను నొక్కండి. గ్రహీత పేరు, మొత్తం మరియు సందేశాన్ని నమోదు చేయండి.\n• **చెల్లింపు ఎంపికలు**: ⚡ **Normal Pay** (UPI PIN తో) లేదా 🚀 **Advance Pay** (నోట్ స్లైడర్ తో) ద్వారా చెల్లించవచ్చు.\n• **ఫీచర్లు**: ప్రత్యేకమైన Gift Card ID, పంపినవారి పేరు, అందుకున్నవారి పేరు మరియు స్కాన్ చేయగల నిజమైన QR కోడ్ ఉంటాయి.\n• **PDF డౌన్‌లోడ్**: అందమైన గోల్డ్ డిజైన్ PDF వోచర్‌ను డౌన్‌లోడ్ చేసి పంపుకోవచ్చు.\n• **క్లెయిమ్ చేయడం**: QR కోడ్‌ను స్కాన్ చేసి నేరుగా వాలెట్‌లోకి డబ్బును జమ చేసుకోవచ్చు!",
  ml: "🎁 **RenoPay ഡിജിറ്റൽ ഗിഫ്റ്റ് കാർഡുകൾ (Gift Cards)**\n\nRenoPay-ൽ നിങ്ങൾക്ക് പ്രിയപ്പെട്ടവർക്കായി ഡിജിറ്റൽ ഗിഫ്റ്റ് കാർഡുകൾ അയക്കാം:\n\n• **എങ്ങനെ ഉണ്ടാക്കാം**: ഹോം സ്ക്രീനിലെ **Gift Card** ഐക്കൺ ടാപ്പ് ചെയ്യുക. ലഭിക്കേണ്ട ആളുടെ പേര്, തുക, സന്ദേശം എന്നിവ നൽകുക.\n• **പേയ്‌മെന്റ് ഓപ്ഷനുകൾ**: ⚡ **Normal Pay** (UPI PIN വഴി) അല്ലെങ്കിൽ 🚀 **Advance Pay** (കറൻസി നോട്ട് സ്ലൈഡർ വഴി) തിരഞ്ഞെടുക്കാം.\n• **സവിശേഷതകൾ**: തനതായ Gift Card ID, അയച്ചയാളുടെ പേര്, ലഭിക്കുന്ന ആളുടെ പേര്, സ്കാൻ ചെയ്യാവുന്ന QR കോഡ് എന്നിവ ഉണ്ടാകും.\n• **PDF ഡൗൺലോഡ്**: മനോഹരമായ ഹൈ-ക്വാളിറ്റി PDF വൗച്ചർ ഡൗൺലോഡ് ചെയ്ത് നൽകാം.\n• **റെഡീം ചെയ്യാൻ**: QR കോഡ് സ്കാൻ ചെയ്ത് വാലറ്റിലേക്ക് തുക ക്രെഡിറ്റ് ചെയ്യാം!",
};

const GIFTCARD_TRIGGERS = [
  "gift card", "giftcard", "voucher", "create gift card", "send gift card", "claim gift card",
  "redeem gift card", "gift card pdf", "gift voucher",
  "गिफ्ट कार्ड", "gift card kaise", "gift card banana", "gift card bhejna", "voucher kaise", "gift card claim",
  "वाउचर", "गिफ्ट कार्ड कैसे बनाएं", "gift card kya hai",
  "பரிசு அட்டை", "gift card eppadi",
  "గిఫ్ట్ కార్డు", "gift card ela",
  "ഗിഫ്റ്റ് കാർഡ്", "gift card engane",
];

const detectQueryLanguage = (text, fallbackLang = "en") => {
  for (const ch of (text || "")) {
    const cp = ch.charCodeAt(0);
    if (cp >= 0x0900 && cp <= 0x097f) return "hi";
    if (cp >= 0x0b80 && cp <= 0x0bff) return "ta";
    if (cp >= 0x0c00 && cp <= 0x0c7f) return "te";
    if (cp >= 0x0d00 && cp <= 0x0d7f) return "ml";
  }
  const lower = (text || "").toLowerCase();
  if (/kisne|banaya|kiska|sansthapak|kiske|aapko|kaise|banae|badle/.test(lower)) return "hi";
  if (/niruvanar|uruvakkiyavar|yaar|eppadi/.test(lower)) return "ta";
  if (/vyavasthapakudu|srushtikartha|evaru|ela/.test(lower)) return "te";
  if (/sthapakan|srashtavu|aarannu|engane/.test(lower)) return "ml";
  return fallbackLang in FOUNDER_RESPONSES ? fallbackLang : "en";
};

const getClientDirectFeatureResponse = (text, lang = "en") => {
  const lower = (text || "").toLowerCase();
  const detectedLang = detectQueryLanguage(text, lang);
  if (FOUNDER_TRIGGERS.some((t) => lower.includes(t))) {
    return FOUNDER_RESPONSES[detectedLang] || FOUNDER_RESPONSES.en;
  }
  if (THEME_TRIGGERS.some((t) => lower.includes(t))) {
    return THEME_RESPONSES[detectedLang] || THEME_RESPONSES.en;
  }
  if (GIFTCARD_TRIGGERS.some((t) => lower.includes(t))) {
    return GIFTCARD_RESPONSES[detectedLang] || GIFTCARD_RESPONSES.en;
  }
  return null;
};

export function AIAssistant({ currentScreen = "home", onNavigate }) {
  const { profile, refreshProfile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // Active language
  const [currentLang, setCurrentLang] = useState("en");

  // Voice state: STT (Speech-to-Text) and TTS (Text-to-Speech)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [speechStatus, setSpeechStatus] = useState("idle"); // "idle" | "playing" | "paused" | "ended"
  const isSpeaking = speechStatus === "playing";
  const isSpeechPaused = speechStatus === "paused";
  const isSpeechEnded = speechStatus === "ended";

  const activeSpeechRef = useRef({
    msgId: null,
    text: "",
    cleanText: "",
    charIndex: 0,
  });
  const currentUtteranceRef = useRef(null);
  const resumeTimerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const modalRef = useRef(null);

  // Movable / Draggable Button State
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem("saathi_btn_pos");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null; // null means default centered bottom
  });

  const dragRef = useRef({
    isDragging: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
  });

  const handleDragStart = (clientX, clientY, targetRect) => {
    dragRef.current = {
      isDragging: true,
      hasMoved: false,
      startX: clientX,
      startY: clientY,
      elemStartX: targetRect.left,
      elemStartY: targetRect.top,
    };
  };

  const handleDragMove = (clientX, clientY) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      dragRef.current.hasMoved = true;
    }

    const btnWidth = 64;
    const btnHeight = 64;
    const newX = Math.max(10, Math.min(window.innerWidth - btnWidth - 10, dragRef.current.elemStartX + deltaX));
    const newY = Math.max(10, Math.min(window.innerHeight - btnHeight - 80, dragRef.current.elemStartY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    if (!dragRef.current.isDragging) return;
    const wasMoved = dragRef.current.hasMoved;
    dragRef.current.isDragging = false;

    if (!wasMoved) {
      setIsOpen(true);
    } else {
      if (position) {
        try {
          localStorage.setItem("saathi_btn_pos", JSON.stringify(position));
        } catch {
          // ignore
        }
      }
    }
  };

  useEffect(() => {
    const onMouseMove = (e) => handleDragMove(e.clientX, e.clientY);
    const onMouseUp = () => handleDragEnd();
    const onTouchMove = (e) => {
      if (dragRef.current.isDragging && e.touches[0]) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [position]);

  // Sync language with user profile
  useEffect(() => {
    if (profile?.language_code) {
      setCurrentLang(profile.language_code);
    }
  }, [profile?.language_code]);

  // Initial welcome greeting when chat opens first time
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const userFirstName = profile?.full_name?.split(" ")[0] || "there";
      let greeting = `Hello ${userFirstName}! I'm **Saathi**, your personal assistant for RenoPay, UPI, Accounting & Stock Markets. How can I help you today?`;
      if (currentLang === "hi") {
        greeting = `नमस्ते ${userFirstName}! मैं **Saathi** हूँ, आपका RenoPay साथी। RenoPay, UPI, Accounting, Stock Market या Banking के बारे में आप मुझसे पूछ सकते हैं!`;
      } else if (currentLang === "ta") {
        greeting = `வணக்கம் ${userFirstName}! நான் **Saathi**, உங்கள் RenoPay, UPI, கணக்கியல் மற்றும் பங்குச் சந்தை உதவியாளர். உங்களுக்கு நான் எவ்வாறு உதவ முடியும்?`;
      } else if (currentLang === "te") {
        greeting = `నమస్కారం ${userFirstName}! నేను **Saathi**, మీ RenoPay, UPI, అకౌంటింగ్ మరియు స్టాక్ మార్కెట్ సహాయకుడిని. మీకు నేను ఎలా సహాయపడగలను?`;
      } else if (currentLang === "ml") {
        greeting = `നമസ്കാരം ${userFirstName}! ഞാൻ **Saathi**, നിങ്ങളുടെ RenoPay, UPI, അക്കൗണ്ടിംഗ്, സ്റ്റോക്ക് മാർക്കറ്റ് സഹായി. ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കണം?`;
      }

      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: greeting,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, currentLang, profile?.full_name]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const handleClose = () => {
    // Note: Do not cancel speech synthesis here so Saathi keeps speaking
    // the instructions while the user navigates RenoPay screens!
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsListening(false);
    setIsOpen(false);
  };

  // Handle Text Submission
  const handleSend = async (overrideText = null) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || busy) return;

    setInput("");
    const userMsg = {
      id: "u-" + Date.now(),
      role: "user",
      content: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    const clientFeatureReply = getClientDirectFeatureResponse(textToSend, currentLang);
    if (clientFeatureReply) {
      const botMsg = {
        id: "b-" + Date.now(),
        role: "assistant",
        content: clientFeatureReply,
        provider: "RenoPay Core",
        model: "feature-verified",
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
      setBusy(false);
      // Asynchronously notify backend session to preserve history
      AIAPI.query(textToSend, currentScreen, currentLang, sessionId)
        .then((res) => {
          if (res?.session_id) setSessionId(res.session_id);
        })
        .catch(() => {});
      return;
    }

    setBusy(true);

    try {
      const res = await AIAPI.query(
        textToSend,
        currentScreen,
        currentLang,
        sessionId
      );

      if (res.session_id) setSessionId(res.session_id);

      const botMsg = {
        id: "b-" + Date.now(),
        role: "assistant",
        content: res.response_text,
        provider: res.provider,
        model: res.model,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const fallbackFeature = getClientDirectFeatureResponse(textToSend, currentLang);
      if (fallbackFeature) {
        const featureMsg = {
          id: "b-" + Date.now(),
          role: "assistant",
          content: fallbackFeature,
          provider: "Saathi Knowledge Base",
          model: "renopay-core",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, featureMsg]);
      } else {
        const errMsg = {
          id: "err-" + Date.now(),
          role: "assistant",
          content: `⚠️ ${e?.response?.data?.detail || "Could not connect to Saathi. Please check backend Groq API settings or network."}`,
          isError: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setBusy(false);
    }
  };

  // Speech-to-Text (STT)
  // Speech-to-Text (STT)
  const toggleSpeechRecognition = () => {
    // 1. If running in Android APK with native AndroidSTT
    if (window.AndroidSTT?.startListening) {
      window.__onNativeSpeechResult = (spokenText) => {
        setIsListening(false);
        if (spokenText) {
          setInput(spokenText);
          handleSend(spokenText);
        }
      };
      setIsListening(true);
      window.AndroidSTT.startListening(currentLang);
      return;
    }

    // 2. Browser Web Speech API
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input: Tap the microphone on your phone keyboard (Gboard), or use Chrome/Edge on web!");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
      recognition.lang = langObj.locale;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(transcript);
          handleSend(transcript);
        }
      };
      recognition.onerror = (err) => {
        console.warn("Speech recognition error:", err);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition startup error:", e);
      setIsListening(false);
    }
  };

  // Handle Android Native TTS speech callbacks
  useEffect(() => {
    window.__onSaathiSpeechStart = () => {
      setSpeechStatus("playing");
    };
    window.__onSaathiSpeechEnd = () => {
      setSpeechStatus("ended");
      setSpeakingMessageId(null);
      currentUtteranceRef.current = null;
      window.__saathiUtterance = null;
    };
    return () => {
      delete window.__onSaathiSpeechStart;
      delete window.__onSaathiSpeechEnd;
    };
  }, []);

  // Text-to-Speech (TTS) with Universal Cross-Android Support (Android 12, 13, 14, 15, 16+)
  const startSpeechUtterance = (textToSpeak, msgId, fullOriginalText, offset = 0) => {
    setSpeakingMessageId(msgId);
    setSpeechStatus("playing");

    // 1. Capacitor Native Plugin (Official bridge for Android 12, 13, 14, 15, 16)
    if (window.Capacitor?.Plugins?.RenoTTS) {
      try {
        window.Capacitor.Plugins.RenoTTS.speak({ text: textToSpeak, lang: currentLang });
        return;
      } catch (err) {
        console.warn("Capacitor RenoTTS speak error:", err);
      }
    }

    // 2. Android JavascriptInterface Bridge (Native Android TextToSpeech)
    if (window.AndroidTTS && typeof window.AndroidTTS.speak === "function") {
      try {
        window.AndroidTTS.speak(textToSpeak, currentLang);
        return;
      } catch (err) {
        console.warn("AndroidTTS speak error, trying Web Speech fallback:", err);
      }
    }

    // 3. Browser speechSynthesis (Web Speech API)
    if (window.speechSynthesis && typeof window.speechSynthesis.speak === "function") {
      try {
        if (resumeTimerRef.current) {
          clearTimeout(resumeTimerRef.current);
          resumeTimerRef.current = null;
        }

        window.speechSynthesis.cancel();
        window.speechSynthesis.resume?.();

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const langObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];
        utterance.lang = langObj.locale;
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices?.() || [];
        if (voices.length > 0) {
          const match =
            voices.find((v) => v.lang === langObj.locale || v.lang.startsWith(langObj.code)) ||
            voices.find((v) => v.lang.startsWith("en")) ||
            voices[0];
          if (match) utterance.voice = match;
        }

        currentUtteranceRef.current = utterance;
        window.__saathiUtterance = utterance;

        utterance.onstart = () => {
          setSpeakingMessageId(msgId);
          setSpeechStatus("playing");
        };

        utterance.onboundary = (e) => {
          if (typeof e.charIndex === "number") {
            activeSpeechRef.current.charIndex = offset + e.charIndex;
          }
        };

        utterance.onend = () => {
          setSpeechStatus("ended");
          currentUtteranceRef.current = null;
          window.__saathiUtterance = null;
        };

        utterance.onerror = (e) => {
          if (e.error === "canceled" || e.error === "interrupted") return;
          setSpeechStatus("ended");
          currentUtteranceRef.current = null;
          window.__saathiUtterance = null;
        };

        window.speechSynthesis.speak(utterance);
        return;
      } catch (err) {
        console.warn("speechSynthesis error, falling back to Audio stream:", err);
      }
    }

    // 4. Guaranteed Audio Stream TTS Fallback (Works on ALL mobile WebViews & Android 12-16)
    try {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      const langMap = { en: "en-IN", hi: "hi-IN", ta: "ta-IN", te: "te-IN", ml: "ml-IN" };
      const code = langMap[currentLang] || "en-IN";
      const cleanSnippet = textToSpeak.slice(0, 180).trim();
      const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${code}&q=${encodeURIComponent(cleanSnippet)}`;
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      audio.onplay = () => {
        setSpeakingMessageId(msgId);
        setSpeechStatus("playing");
      };
      audio.onended = () => {
        setSpeechStatus("ended");
      };
      audio.onerror = () => {
        setSpeechStatus("ended");
      };
      audio.play().catch((err) => {
        console.warn("Audio TTS play error:", err);
        setSpeechStatus("ended");
      });
    } catch (e) {
      console.warn("Final audio TTS fallback error:", e);
      setSpeechStatus("ended");
    }
  };

  const toggleSpeechSynthesis = (msgId, text) => {
    if (speakingMessageId === msgId && speechStatus !== "idle") {
      stopSpeech();
      return;
    }

    const cleanText = text.replace(/[*#_`]/g, "");
    activeSpeechRef.current = {
      msgId,
      text,
      cleanText,
      charIndex: 0,
    };

    startSpeechUtterance(cleanText, msgId, text, 0);
  };

  const replaySpeech = (e) => {
    e?.stopPropagation();
    if (!activeSpeechRef.current.cleanText || !activeSpeechRef.current.msgId) return;

    activeSpeechRef.current.charIndex = 0;
    startSpeechUtterance(
      activeSpeechRef.current.cleanText,
      activeSpeechRef.current.msgId,
      activeSpeechRef.current.text,
      0
    );
  };

  const toggleSpeechPause = (e) => {
    e?.stopPropagation();
    if (window.AndroidTTS && typeof window.AndroidTTS.stop === "function") {
      if (speechStatus === "playing") {
        window.AndroidTTS.stop();
        setSpeechStatus("paused");
      } else {
        replaySpeech();
      }
      return;
    }

    if (!window.speechSynthesis) return;

    if (speechStatus === "paused") {
      // RESUME / PLAY
      setSpeechStatus("playing");
      window.speechSynthesis.resume();

      // Chromium safeguard: if browser resume hangs or cancels utterance silently, re-speak from charIndex:
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (window.speechSynthesis.paused || !window.speechSynthesis.speaking) {
          const idx = activeSpeechRef.current.charIndex || 0;
          const remainingText = activeSpeechRef.current.cleanText.slice(idx);
          startSpeechUtterance(
            remainingText || activeSpeechRef.current.cleanText,
            activeSpeechRef.current.msgId,
            activeSpeechRef.current.text,
            idx
          );
        }
      }, 150);
    } else if (speechStatus === "playing") {
      // PAUSE
      if (resumeTimerRef.current) {
        clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      window.speechSynthesis.pause();
      setSpeechStatus("paused");
    }
  };

  const stopSpeech = (e) => {
    e?.stopPropagation();
    if (window.Capacitor?.Plugins?.RenoTTS) {
      try {
        window.Capacitor.Plugins.RenoTTS.stop();
      } catch (err) {}
    }
    if (window.AndroidTTS && typeof window.AndroidTTS.stop === "function") {
      try {
        window.AndroidTTS.stop();
      } catch (err) {
        console.warn("AndroidTTS stop error:", err);
      }
    }
    if (audioPlayerRef.current) {
      try {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      } catch (err) {}
    }
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {}
    }
    currentUtteranceRef.current = null;
    window.__saathiUtterance = null;
    setSpeakingMessageId(null);
    setSpeechStatus("idle");
    activeSpeechRef.current = {
      msgId: null,
      text: "",
      cleanText: "",
      charIndex: 0,
    };
  };

  const currentPrompts = SCREEN_PROMPTS[currentScreen] || SCREEN_PROMPTS["home"];
  const currentLangObj = LANGUAGES.find((l) => l.code === currentLang) || LANGUAGES[0];

  return (
    <>
      {/* ── 1. Floating Saathi Button (Movable / Draggable Circle Launcher) ── */}
      {!isOpen && (
        <div
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px`, transform: "none" }
              : { left: "50%", bottom: "74px", transform: "translateX(-50%)" }
          }
          className="fixed z-[90] flex flex-col items-center pointer-events-auto select-none"
        >
          <button
            type="button"
            onMouseDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              handleDragStart(e.clientX, e.clientY, rect);
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                const rect = e.currentTarget.getBoundingClientRect();
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY, rect);
              }
            }}
            className={`group relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#151210] shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_25px_rgba(255,106,26,0.55)] border-2 transition-all duration-150 cursor-grab active:cursor-grabbing touch-none select-none ${speechStatus !== "idle"
                ? "border-teal ring-4 ring-teal/30 scale-105 shadow-[0_0_30px_rgba(20,184,166,0.5)]"
                : "border-accent hover:border-[#FF5500] hover:scale-105 active:scale-95"
              }`}
            title="Drag to move • Tap to open Saathi"
          >
            {/* Ambient radial pulse glow */}
            <span
              className={`absolute inset-0 rounded-full blur-md -z-10 transition-all animate-pulse ${speechStatus !== "idle" ? "bg-teal/50" : "bg-accent/40 group-hover:blur-lg group-hover:bg-accent/60"
                }`}
            />

            {/* Circular Saathi Logo */}
            <img
              src={saathiLogo}
              alt="Saathi"
              className="w-full h-full rounded-full object-cover p-0.5"
            />

            {/* Speaking audio animation badge or online indicator */}
            {speechStatus === "playing" ? (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-teal text-black text-[10px] font-black shadow-md flex items-center gap-0.5 animate-bounce">
                <span>🔊</span>
              </span>
            ) : speechStatus === "paused" ? (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-black shadow-md flex items-center gap-0.5">
                <span>⏸️</span>
              </span>
            ) : speechStatus === "ended" ? (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-black shadow-md flex items-center gap-0.5 animate-pulse">
                <span>🔁</span>
              </span>
            ) : (
              <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-teal border-2 border-[#151210] shadow-sm flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            )}
          </button>

          {/* Docked Audio Controller under circle (Handwritten diagram layout) */}
          {speakingMessageId && speechStatus !== "idle" && (
            <div className="mt-2.5 flex items-center gap-2 bg-surf/95 backdrop-blur-xl border border-teal/50 px-3 py-1.5 rounded-full shadow-[0_12px_30px_rgba(0,0,0,0.5)] animate-fade-in z-[95]">
              {speechStatus === "ended" ? (
                /* Replay Button (shown when voice finishes) */
                <button
                  type="button"
                  onClick={replaySpeech}
                  className="btn px-2.5 py-1 rounded-full text-xs font-bold bg-accent/30 hover:bg-accent/50 text-white flex items-center gap-1 transition-all active:scale-95 cursor-pointer border border-accent/40"
                  title="Replay Saathi voice"
                >
                  <span>🔁 Replay</span>
                </button>
              ) : (
                /* Pause / Play Button */
                <button
                  type="button"
                  onClick={toggleSpeechPause}
                  className="btn px-2.5 py-1 rounded-full text-xs font-bold bg-card hover:bg-surf text-textLight flex items-center gap-1 transition-all active:scale-95 cursor-pointer border border-line"
                  title={speechStatus === "paused" ? "Resume Saathi Voice" : "Pause Saathi Voice"}
                >
                  <span>{speechStatus === "paused" ? "▶️ Play" : "⏸️ Pause"}</span>
                </button>
              )}

              <span className="w-px h-3.5 bg-line" />

              {/* Stop Button (Cancels audio & resets icon to normal) */}
              <button
                type="button"
                onClick={stopSpeech}
                className="btn px-2.5 py-1 rounded-full text-xs font-bold bg-danger/25 hover:bg-danger/40 text-danger border border-danger/40 flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                title="Stop Voice & Reset"
              >
                <span>⏹️ Stop</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Centered Modal Overlay ("BEECH ME KRO") ───────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-5 bg-black/75 backdrop-blur-md transition-all duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          {/* Centered Modal Card */}
          <div
            ref={modalRef}
            className="relative w-full max-w-[460px] h-[88dvh] max-h-[640px] flex flex-col bg-card border border-accent/40 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(255,106,26,0.2)] overflow-hidden ring-1 ring-black/5 dark:ring-white/10 animate-fade-in"
          >
            {/* Top subtle decorative ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-28 bg-gradient-to-b from-accent/25 to-transparent blur-3xl pointer-events-none -z-0" />

            {/* Mobile Top Grab / Close Bar (Guaranteed Cut button on phone) */}
            <div className="sm:hidden flex items-center justify-between px-3.5 py-2 bg-surf border-b border-line flex-shrink-0 z-20">
              <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                <span>✨</span> Saathi AI Assistant
              </span>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1 rounded-full bg-card hover:bg-surf border border-line active:bg-danger text-textLight text-xs font-black flex items-center gap-1 shadow-sm cursor-pointer"
                aria-label="Close Saathi Chat"
              >
                ✕ Close
              </button>
            </div>

            {/* Header Bar */}
            <div className="relative z-10 px-3.5 sm:px-4 py-3 bg-surf/95 backdrop-blur-md border-b border-line flex items-center justify-between gap-2 flex-shrink-0">
              {/* Saathi Brand & Status */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                  <img
                    src={saathiLogo}
                    alt="Saathi Logo"
                    className="w-10 h-10 rounded-full object-cover border-2 border-accent/50 shadow-md ring-1 ring-black/5 dark:ring-white/10"
                  />
                  {/* Online Dot */}
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-teal border-2 border-card shadow-sm animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm sm:text-base font-black text-textLight tracking-wide truncate">
                      Saathi
                    </h3>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal/15 text-teal font-bold border border-teal/30 flex-shrink-0">
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] text-muted truncate font-medium">
                    Your 24/7 Companion
                  </p>
                </div>
              </div>

              {/* Controls: Language Selector & High-Visibility Close Button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Language Select Dropdown */}
                <select
                  value={currentLang}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setCurrentLang(newLang);
                    if (profile) {
                      AccountAPI.updatePreferences({ language_code: newLang })
                        .then(refreshProfile)
                        .catch(() => { });
                    }
                  }}
                  className="bg-card border border-accent/40 text-[11px] text-accent font-bold rounded-xl px-2 py-1.5 outline-none cursor-pointer max-w-[120px] sm:max-w-none truncate hover:border-accent transition-colors"
                  title="Change AI Language"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-card text-textLight">
                      {l.flag} {l.native}
                    </option>
                  ))}
                </select>

                {/* Primary Prominent Close Button */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-9 h-9 rounded-full bg-card hover:bg-surf active:bg-danger/60 border border-line text-textLight flex items-center justify-center text-base font-black transition-all cursor-pointer flex-shrink-0 shadow-sm"
                  title="Close (Esc)"
                  aria-label="Close Saathi Chat"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Smart Screen Context Bar */}
            <div className="relative z-10 px-4 py-2 bg-accent/[.08] border-b border-accent/20 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1.5 text-muted">
                <span className="text-accent">📍</span>
                <span>Active Context:</span>
                <span className="text-accent font-bold uppercase tracking-wider">
                  {currentScreen}
                </span>
              </div>
              <span className="text-muted text-[10px] font-medium">
                Speaks {currentLangObj.native}
              </span>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin relative z-10">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-end gap-2 max-w-[88%]">
                      {/* Saathi Icon Avatar */}
                      {!isUser && (
                        <img
                          src={saathiLogo}
                          alt="Saathi"
                          className="w-7 h-7 rounded-full object-cover border border-accent/40 shadow-sm flex-shrink-0 mb-1"
                        />
                      )}

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${isUser
                            ? "bg-gradient-to-r from-accent to-[#D43D0A] text-white rounded-br-none shadow-md font-medium"
                            : m.isError
                              ? "bg-danger/15 text-danger border border-danger/30 rounded-bl-none"
                              : "bg-surf text-textLight border border-line rounded-bl-none shadow-sm"
                          }`}
                      >
                        <div className="whitespace-pre-wrap">{m.content}</div>

                        {/* Footer with Timestamp & Listen / Pause / Stop buttons */}
                        {!isUser && !m.isError && (
                          <div className="mt-2.5 pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-muted">
                            <span className="text-[10px]">{m.time}</span>
                            {speakingMessageId === m.id && speechStatus !== "idle" ? (
                              <div className="flex items-center gap-1.5">
                                {speechStatus === "ended" ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      replaySpeech();
                                    }}
                                    className="text-accent hover:brightness-110 font-bold transition-colors flex items-center gap-1 cursor-pointer bg-accent/15 hover:bg-accent/25 px-2 py-0.5 rounded-md border border-accent/30 text-[10px]"
                                    title="Replay voice from start"
                                  >
                                    <span>🔁 Replay</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSpeechPause();
                                    }}
                                    className="text-textLight hover:text-accent font-bold transition-colors flex items-center gap-1 cursor-pointer bg-card px-2 py-0.5 rounded-md border border-line text-[10px]"
                                    title={speechStatus === "paused" ? "Resume voice" : "Pause voice"}
                                  >
                                    <span>{speechStatus === "paused" ? "▶️ Play" : "⏸️ Pause"}</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    stopSpeech();
                                  }}
                                  className="text-danger hover:text-danger/80 font-bold transition-colors flex items-center gap-1 cursor-pointer bg-danger/15 px-2 py-0.5 rounded-md border border-danger/30 text-[10px]"
                                  title="Stop voice"
                                >
                                  {speechStatus === "playing" && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-ping" />}
                                  <span>⏹️ Stop</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleSpeechSynthesis(m.id, m.content)}
                                className="text-muted hover:text-accent font-semibold transition-colors flex items-center gap-1 cursor-pointer bg-card px-2 py-0.5 rounded-md border border-line"
                                title="Listen audio"
                              >
                                <span>🔊 Listen</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {isUser && (
                      <span className="text-[10px] text-muted mt-1 pr-1 font-mono">
                        {m.time}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Saathi Thinking Animation */}
              {busy && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-surf border border-line w-fit animate-pulse shadow-sm">
                  <img
                    src={saathiLogo}
                    alt="Saathi"
                    className="w-6 h-6 rounded-full object-cover border border-accent/40 animate-spin"
                    style={{ animationDuration: "3s" }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce" />
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-accent animate-bounce [animation-delay:0.4s]" />
                    <span className="text-xs text-muted font-medium ml-1">
                      Saathi is thinking...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Context-Aware Suggestion Chips */}
            {messages.length <= 4 && (
              <div className="relative z-10 px-4 py-2.5 bg-surf/95 border-t border-line flex gap-2 overflow-x-auto scrollbar-none">
                {currentPrompts.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(prompt)}
                    className="whitespace-nowrap px-3 py-1.5 rounded-full bg-card border border-line text-xs text-text hover:text-textLight hover:border-accent/50 hover:bg-accent/10 transition-all cursor-pointer font-medium"
                  >
                    💡 {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Live Listening Wave Banner */}
            {isListening && (
              <div className="relative z-10 px-4 py-2.5 bg-[#FF3D60]/15 border-t border-[#FF3D60]/30 flex items-center justify-between text-xs text-[#FF3D60] animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF3D60] animate-ping" />
                  <span>
                    Listening in <strong>{currentLangObj.native}</strong>... speak now
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => recognitionRef.current?.stop()}
                  className="font-bold underline cursor-pointer hover:opacity-80"
                >
                  Done
                </button>
              </div>
            )}

            {/* Input Footer Bar */}
            <div className="relative z-10 p-3.5 bg-surf border-t border-line flex items-center gap-2.5">
              {/* Mic Voice Button */}
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg transition-all cursor-pointer flex-shrink-0 ${isListening
                    ? "bg-[#FF3D60] text-white animate-pulse shadow-lg ring-2 ring-[#FF3D60]/50"
                    : "bg-card border border-line text-muted hover:text-accent hover:border-accent/40"
                  }`}
                title={isListening ? "Listening..." : "Tap to Speak (Voice)"}
              >
                🎙️
              </button>

              {/* Text Input Field */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={
                  currentLang === "hi"
                    ? "RenoPay, UPI, Accounting ya Stock Market ke baare me poochein..."
                    : `Ask about RenoPay, UPI, Accounting or Stocks in ${currentLangObj.native}...`
                }
                className="flex-1 bg-bg border border-line rounded-2xl py-2.5 px-4 text-xs sm:text-sm text-textLight placeholder:text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                disabled={busy}
                autoFocus
              />

              {/* Send Button */}
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={busy || !input.trim()}
                className="w-11 h-11 rounded-2xl bg-gradient-to-r from-accent to-[#D43D0A] text-white flex items-center justify-center text-base font-bold shadow-md hover:opacity-95 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer flex-shrink-0"
                title="Send message"
              >
                ➤
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
