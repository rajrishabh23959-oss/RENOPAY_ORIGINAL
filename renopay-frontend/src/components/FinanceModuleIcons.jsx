import React from "react";
import iconTravel from "../assets/actions/travel.webp";
import iconRecharge from "../assets/actions/recharge.webp";
import iconInvest from "../assets/actions/invests.webp";

import iconLoans from "../assets/actions/loans.webp";

export function TravelActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconTravel}
      alt="Travel"
      className={`${className} object-contain`}
    />
  );
}

export function LoanActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconLoans}
      alt="Loans"
      className={`${className} object-contain`}
    />
  );
}

export function RechargeActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconRecharge}
      alt="Recharge"
      className={`${className} object-contain`}
    />
  );
}

export function InvestActionIcon({ className = "w-[38px] h-[38px]" }) {
  return (
    <img
      src={iconInvest}
      alt="Invest"
      className={`${className} object-contain`}
    />
  );
}
