// RenoPay Unified Financial Services Store
// Handles Loans, Mobile Recharges, Tuition Fee (UPI), Electricity Bills, and Mutual Funds / Daily RD

const STORAGE_KEYS = {
  LOANS: "renopay_active_loans_v1",
  TEACHERS: "renopay_tuition_teachers_v1",
  RECHARGES: "renopay_recharge_history_v1",
  INVESTMENTS: "renopay_investments_v1",
};

// Initial sample loans for rich demo experience
const DEFAULT_LOANS = [
  {
    id: "LOAN-PERS-8941",
    type: "Personal Loan",
    lender: "HDFC Bank & RenoPay Credit",
    principal: 75000,
    remainingAmount: 48500,
    monthlyEmi: 4320,
    tenureMonths: 18,
    emisPaid: 6,
    interestRate: 11.5,
    nextDueDate: "2026-10-05",
    disbursedAt: "2026-03-10",
    status: "ACTIVE",
  },
];

// Initial tuition teachers
const DEFAULT_TEACHERS = [
  {
    id: "TCH-001",
    name: "Dr. R. K. Verma",
    subject: "Physics & Mathematics (Class 12)",
    upiId: "rkverma.classes@okaxis",
    studentName: "Aarav Raj",
    monthlyFee: 3200,
    dueDay: 5,
    lastPaidDate: "2026-08-05",
  },
  {
    id: "TCH-002",
    name: "Meera Sen Coaching",
    subject: "Chemistry & Biology Academy",
    upiId: "meerasen.edu@icici",
    studentName: "Aarav Raj",
    monthlyFee: 2800,
    dueDay: 10,
    lastPaidDate: "2026-08-09",
  },
];

// Initial sample investments
const DEFAULT_INVESTMENTS = {
  totalInvested: 14500,
  currentValue: 17240,
  overallGain: 2740,
  gainPercent: 18.9,
  sips: [
    {
      id: "SIP-01",
      fundName: "Parag Parikh Flexi Cap Fund",
      category: "Equity - Flexi Cap",
      monthlyAmount: 2000,
      totalUnits: 28.45,
      currentNav: 82.4,
      investedAmount: 8000,
      currentValue: 9850,
      nextDebitDate: "2026-10-02",
      active: true,
    },
    {
      id: "SIP-02",
      fundName: "Nifty 50 Index Micro Fund",
      category: "Daily SIP ₹10",
      dailyAmount: 10,
      investedAmount: 1500,
      currentValue: 1820,
      nextDebitDate: "Daily Auto-Debit",
      active: true,
    },
  ],
  rds: [
    {
      id: "RD-01",
      bank: "RenoPay Virtual Bank (7.9% p.a.)",
      dailyAmount: 100,
      tenureMonths: 6,
      deposited: 5000,
      maturityAmount: 18720,
      maturityDate: "2027-01-15",
      active: true,
    },
  ],
};

function readStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (_) {}
}

export const FinancialServices = {
  // --------------------------------------------------------------------------
  // LOANS MODULE
  // --------------------------------------------------------------------------
  getLoans() {
    return readStorage(STORAGE_KEYS.LOANS, DEFAULT_LOANS);
  },

  applyLoan({ type = "Personal Loan", lender, principal, tenureMonths, interestRate, monthlyEmi }) {
    const loans = this.getLoans();
    const newId = `LOAN-${type.slice(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const nextDueDate = d.toISOString().slice(0, 10);

    const newLoan = {
      id: newId,
      type,
      lender: lender || "RenoPay Instant Credit",
      principal: Number(principal),
      remainingAmount: Number(principal),
      monthlyEmi: Number(monthlyEmi),
      tenureMonths: Number(tenureMonths),
      emisPaid: 0,
      interestRate: Number(interestRate) || 11.5,
      nextDueDate,
      disbursedAt: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
    };

    const updated = [newLoan, ...loans];
    writeStorage(STORAGE_KEYS.LOANS, updated);
    return newLoan;
  },

  repayLoanEmi(loanId) {
    const loans = this.getLoans();
    let paidLoan = null;

    const updated = loans.map((l) => {
      if (l.id === loanId) {
        const emi = l.monthlyEmi;
        const newRemaining = Math.max(0, Math.round(l.remainingAmount - emi));
        const newPaid = (l.emisPaid || 0) + 1;

        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);

        paidLoan = {
          ...l,
          remainingAmount: newRemaining,
          emisPaid: newPaid,
          nextDueDate: nextDate.toISOString().slice(0, 10),
          status: newRemaining === 0 ? "CLOSED" : "ACTIVE",
        };
        return paidLoan;
      }
      return l;
    });

    writeStorage(STORAGE_KEYS.LOANS, updated);
    return paidLoan;
  },

  // --------------------------------------------------------------------------
  // RECHARGE & BILLS MODULE
  // --------------------------------------------------------------------------
  getRecharges() {
    return readStorage(STORAGE_KEYS.RECHARGES, []);
  },

  recordRecharge(rechargeData) {
    const history = this.getRecharges();
    const item = {
      id: `RCH-${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...rechargeData,
    };
    writeStorage(STORAGE_KEYS.RECHARGES, [item, ...history]);
    return item;
  },

  // Tuition Teachers
  getTeachers() {
    return readStorage(STORAGE_KEYS.TEACHERS, DEFAULT_TEACHERS);
  },

  addTeacher({ name, subject, upiId, studentName, monthlyFee, dueDay }) {
    const teachers = this.getTeachers();
    const newTeacher = {
      id: `TCH-${Date.now()}`,
      name,
      subject,
      upiId,
      studentName: studentName || "Student",
      monthlyFee: Number(monthlyFee) || 2000,
      dueDay: Number(dueDay) || 5,
      lastPaidDate: null,
    };
    const updated = [newTeacher, ...teachers];
    writeStorage(STORAGE_KEYS.TEACHERS, updated);
    return newTeacher;
  },

  payTeacherFee(teacherId) {
    const teachers = this.getTeachers();
    let paidTeacher = null;
    const today = new Date().toISOString().slice(0, 10);

    const updated = teachers.map((t) => {
      if (t.id === teacherId) {
        paidTeacher = {
          ...t,
          lastPaidDate: today,
        };
        return paidTeacher;
      }
      return t;
    });

    writeStorage(STORAGE_KEYS.TEACHERS, updated);
    return paidTeacher;
  },

  // --------------------------------------------------------------------------
  // MUTUAL FUNDS & DEPOSITS
  // --------------------------------------------------------------------------
  getInvestments() {
    return readStorage(STORAGE_KEYS.INVESTMENTS, DEFAULT_INVESTMENTS);
  },

  startSip({ fundName, category, monthlyAmount, sipDay = 5 }) {
    const store = this.getInvestments();
    const newSip = {
      id: `SIP-${Date.now()}`,
      fundName,
      category: category || "Equity Growth",
      monthlyAmount: Number(monthlyAmount),
      investedAmount: Number(monthlyAmount),
      currentValue: Number(monthlyAmount),
      nextDebitDate: `Day ${sipDay} of month`,
      active: true,
    };

    const updated = {
      ...store,
      totalInvested: store.totalInvested + Number(monthlyAmount),
      currentValue: store.currentValue + Number(monthlyAmount),
      sips: [newSip, ...store.sips],
    };
    writeStorage(STORAGE_KEYS.INVESTMENTS, updated);
    return newSip;
  },

  startDailySip10({ fundName = "Nifty 50 Index Micro Fund" }) {
    const store = this.getInvestments();
    const newDaily = {
      id: `DSIP-${Date.now()}`,
      fundName,
      category: "Daily SIP ₹10",
      dailyAmount: 10,
      investedAmount: 10,
      currentValue: 10,
      nextDebitDate: "Tomorrow 09:00 AM",
      active: true,
    };

    const updated = {
      ...store,
      totalInvested: store.totalInvested + 10,
      currentValue: store.currentValue + 10,
      sips: [newDaily, ...store.sips],
    };
    writeStorage(STORAGE_KEYS.INVESTMENTS, updated);
    return newDaily;
  },

  startDailyRd({ dailyAmount = 100, tenureMonths = 6, rate = 8.1 }) {
    const store = this.getInvestments();
    const days = Number(tenureMonths) * 30;
    const totalPrincipal = Number(dailyAmount) * days;
    const interest = Math.round(totalPrincipal * (rate / 100) * (tenureMonths / 12));
    const maturityAmount = totalPrincipal + interest;

    const d = new Date();
    d.setMonth(d.getMonth() + Number(tenureMonths));
    const maturityDate = d.toISOString().slice(0, 10);

    const newRd = {
      id: `RD-${Date.now()}`,
      bank: `RenoPay Virtual Bank (${rate}% p.a.)`,
      dailyAmount: Number(dailyAmount),
      tenureMonths: Number(tenureMonths),
      deposited: Number(dailyAmount),
      maturityAmount,
      maturityDate,
      active: true,
    };

    const updated = {
      ...store,
      totalInvested: store.totalInvested + Number(dailyAmount),
      currentValue: store.currentValue + Number(dailyAmount),
      rds: [newRd, ...store.rds],
    };
    writeStorage(STORAGE_KEYS.INVESTMENTS, updated);
    return newRd;
  },
};
