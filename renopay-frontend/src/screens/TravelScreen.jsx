import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { TravelAPI } from "../lib/api";
import { fmt } from "../lib/format";
import { Card, Btn, Badge } from "../components/ui";
import { DatePickerInput } from "../components/DatePickerInput";
import { PdfPreviewModal } from "../components/PdfPreviewModal";
import { FlightIcon, BusIcon, TrainIcon, HotelIcon } from "../components/TravelIcons";
import { PaymentMethodModal } from "../components/PaymentMethodModal";

// Helper for today's date formatted as YYYY-MM-DD
function getTodayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getNextDayString(daysAhead = 1) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

// Popular routes & realistic distances in KM (User Constants)
const CITY_DISTANCES = {
  "New Delhi_Mumbai": 1415,
  "New Delhi_Bengaluru": 2150,
  "New Delhi_Chennai": 2200,
  "New Delhi_Kolkata": 1500,
  "New Delhi_Hyderabad": 1580,
  "New Delhi_Pune": 1450,
  "New Delhi_Ahmedabad": 940,
  "New Delhi_Jaipur": 280,
  "New Delhi_Lucknow": 530,
  "New Delhi_Kanpur": 500,
  "New Delhi_Nagpur": 1060,
  "New Delhi_Indore": 810,
  "New Delhi_Bhopal": 780,
  "New Delhi_Patna": 1050,
  "New Delhi_Vadodara": 1000,
  "New Delhi_Surat": 1150,
  "New Delhi_Chandigarh": 250,
  "New Delhi_Kochi": 2650,
  "New Delhi_Visakhapatnam": 1800,
  "New Delhi_Varanasi": 820,
  "New Delhi_Agra": 210,
  "New Delhi_Amritsar": 450,
  "New Delhi_Bhubaneswar": 1650,
  "New Delhi_Guwahati": 1900,
  "New Delhi_Ranchi": 1200,
  "New Delhi_Coimbatore": 2450,
  "New Delhi_Madurai": 2600,
  "New Delhi_Goa": 1900,
  "New Delhi_Raipur": 1150,
  "Mumbai_Bengaluru": 980,
  "Mumbai_Chennai": 1330,
  "Mumbai_Kolkata": 1950,
  "Mumbai_Hyderabad": 710,
  "Mumbai_Pune": 150,
  "Mumbai_Ahmedabad": 530,
  "Mumbai_Jaipur": 1150,
  "Mumbai_Lucknow": 1370,
  "Mumbai_Kanpur": 1280,
  "Mumbai_Nagpur": 810,
  "Mumbai_Indore": 580,
  "Mumbai_Bhopal": 770,
  "Mumbai_Patna": 1750,
  "Mumbai_Vadodara": 410,
  "Mumbai_Surat": 290,
  "Mumbai_Chandigarh": 1650,
  "Mumbai_Kochi": 1350,
  "Mumbai_Visakhapatnam": 1340,
  "Mumbai_Varanasi": 1500,
  "Mumbai_Agra": 1200,
  "Mumbai_Amritsar": 1850,
  "Mumbai_Bhubaneswar": 1650,
  "Mumbai_Guwahati": 2500,
  "Mumbai_Ranchi": 1400,
  "Mumbai_Coimbatore": 1200,
  "Mumbai_Madurai": 1420,
  "Mumbai_Goa": 590,
  "Mumbai_Raipur": 1120,
  "Bengaluru_Chennai": 350,
  "Bengaluru_Kolkata": 1870,
  "Bengaluru_Hyderabad": 570,
  "Bengaluru_Pune": 840,
  "Bengaluru_Ahmedabad": 1500,
  "Bengaluru_Jaipur": 1950,
  "Bengaluru_Lucknow": 1850,
  "Bengaluru_Kanpur": 1780,
  "Bengaluru_Nagpur": 1050,
  "Bengaluru_Indore": 1400,
  "Bengaluru_Bhopal": 1450,
  "Bengaluru_Patna": 2050,
  "Bengaluru_Vadodara": 1380,
  "Bengaluru_Surat": 1250,
  "Bengaluru_Chandigarh": 2400,
  "Bengaluru_Kochi": 550,
  "Bengaluru_Visakhapatnam": 1000,
  "Bengaluru_Varanasi": 1800,
  "Bengaluru_Agra": 1900,
  "Bengaluru_Amritsar": 2600,
  "Bengaluru_Bhubaneswar": 1450,
  "Bengaluru_Guwahati": 2800,
  "Bengaluru_Ranchi": 1700,
  "Bengaluru_Coimbatore": 360,
  "Bengaluru_Madurai": 430,
  "Bengaluru_Goa": 560,
  "Bengaluru_Raipur": 1350,
  "Chennai_Kolkata": 1670,
  "Chennai_Hyderabad": 630,
  "Chennai_Pune": 1190,
  "Chennai_Ahmedabad": 1820,
  "Chennai_Jaipur": 2150,
  "Chennai_Lucknow": 2000,
  "Chennai_Kanpur": 1900,
  "Chennai_Nagpur": 1100,
  "Chennai_Indore": 1550,
  "Chennai_Bhopal": 1450,
  "Chennai_Patna": 2100,
  "Chennai_Vadodara": 1700,
  "Chennai_Surat": 1570,
  "Chennai_Chandigarh": 2450,
  "Chennai_Kochi": 690,
  "Chennai_Visakhapatnam": 800,
  "Chennai_Varanasi": 1850,
  "Chennai_Agra": 1950,
  "Chennai_Amritsar": 2650,
  "Chennai_Bhubaneswar": 1200,
  "Chennai_Guwahati": 2650,
  "Chennai_Ranchi": 1600,
  "Chennai_Coimbatore": 510,
  "Chennai_Madurai": 460,
  "Chennai_Goa": 920,
  "Chennai_Raipur": 1300,
  "Kolkata_Hyderabad": 1490,
  "Kolkata_Pune": 1840,
  "Kolkata_Ahmedabad": 2060,
  "Kolkata_Jaipur": 1500,
  "Kolkata_Lucknow": 1000,
  "Kolkata_Kanpur": 1000,
  "Kolkata_Nagpur": 1120,
  "Kolkata_Indore": 1550,
  "Kolkata_Bhopal": 1400,
  "Kolkata_Patna": 580,
  "Kolkata_Vadodara": 1950,
  "Kolkata_Surat": 1900,
  "Kolkata_Chandigarh": 1750,
  "Kolkata_Kochi": 2300,
  "Kolkata_Visakhapatnam": 880,
  "Kolkata_Varanasi": 680,
  "Kolkata_Agra": 1250,
  "Kolkata_Amritsar": 1950,
  "Kolkata_Bhubaneswar": 440,
  "Kolkata_Guwahati": 980,
  "Kolkata_Ranchi": 400,
  "Kolkata_Coimbatore": 2100,
  "Kolkata_Madurai": 2150,
  "Kolkata_Goa": 2100,
  "Kolkata_Raipur": 830,
  "Hyderabad_Pune": 560,
  "Hyderabad_Ahmedabad": 1200,
  "Hyderabad_Jaipur": 1450,
  "Hyderabad_Lucknow": 1350,
  "Hyderabad_Kanpur": 1250,
  "Hyderabad_Nagpur": 500,
  "Hyderabad_Indore": 850,
  "Hyderabad_Bhopal": 850,
  "Hyderabad_Patna": 1450,
  "Hyderabad_Vadodara": 1050,
  "Hyderabad_Surat": 950,
  "Hyderabad_Chandigarh": 1850,
  "Hyderabad_Kochi": 1100,
  "Hyderabad_Visakhapatnam": 620,
  "Hyderabad_Varanasi": 1200,
  "Hyderabad_Agra": 1350,
  "Hyderabad_Amritsar": 2050,
  "Hyderabad_Bhubaneswar": 1040,
  "Hyderabad_Guwahati": 2450,
  "Hyderabad_Ranchi": 1100,
  "Hyderabad_Coimbatore": 900,
  "Hyderabad_Madurai": 1050,
  "Hyderabad_Goa": 650,
  "Hyderabad_Raipur": 780,
  "Pune_Ahmedabad": 660,
  "Pune_Jaipur": 1180,
  "Pune_Lucknow": 1400,
  "Pune_Kanpur": 1300,
  "Pune_Nagpur": 710,
  "Pune_Indore": 600,
  "Pune_Bhopal": 790,
  "Pune_Patna": 1650,
  "Pune_Vadodara": 550,
  "Pune_Surat": 420,
  "Pune_Chandigarh": 1700,
  "Pune_Kochi": 1200,
  "Pune_Visakhapatnam": 1250,
  "Pune_Varanasi": 1450,
  "Pune_Agra": 1250,
  "Pune_Amritsar": 1900,
  "Pune_Bhubaneswar": 1550,
  "Pune_Guwahati": 2600,
  "Pune_Ranchi": 1350,
  "Pune_Coimbatore": 1050,
  "Pune_Madurai": 1250,
  "Pune_Goa": 450,
  "Pune_Raipur": 1050,
  "Ahmedabad_Jaipur": 680,
  "Ahmedabad_Lucknow": 1150,
  "Ahmedabad_Kanpur": 1050,
  "Ahmedabad_Nagpur": 850,
  "Ahmedabad_Indore": 390,
  "Ahmedabad_Bhopal": 590,
  "Ahmedabad_Patna": 1600,
  "Ahmedabad_Vadodara": 110,
  "Ahmedabad_Surat": 260,
  "Ahmedabad_Chandigarh": 1150,
  "Ahmedabad_Kochi": 1800,
  "Ahmedabad_Visakhapatnam": 1700,
  "Ahmedabad_Varanasi": 1350,
  "Ahmedabad_Agra": 850,
  "Ahmedabad_Amritsar": 1350,
  "Ahmedabad_Bhubaneswar": 1850,
  "Ahmedabad_Guwahati": 2500,
  "Ahmedabad_Ranchi": 1550,
  "Ahmedabad_Coimbatore": 1750,
  "Ahmedabad_Madurai": 1900,
  "Ahmedabad_Goa": 1100,
  "Ahmedabad_Raipur": 1200,
  "Jaipur_Lucknow": 570,
  "Jaipur_Kanpur": 510,
  "Jaipur_Nagpur": 920,
  "Jaipur_Indore": 600,
  "Jaipur_Bhopal": 610,
  "Jaipur_Patna": 1050,
  "Jaipur_Vadodara": 750,
  "Jaipur_Surat": 900,
  "Jaipur_Chandigarh": 510,
  "Jaipur_Kochi": 2450,
  "Jaipur_Visakhapatnam": 1650,
  "Jaipur_Varanasi": 850,
  "Jaipur_Agra": 240,
  "Jaipur_Amritsar": 700,
  "Jaipur_Bhubaneswar": 1600,
  "Jaipur_Guwahati": 1950,
  "Jaipur_Ranchi": 1250,
  "Jaipur_Coimbatore": 2300,
  "Jaipur_Madurai": 2450,
  "Jaipur_Goa": 1700,
  "Jaipur_Raipur": 1150,
  "Lucknow_Kanpur": 90,
  "Lucknow_Nagpur": 750,
  "Lucknow_Indore": 780,
  "Lucknow_Bhopal": 600,
  "Lucknow_Patna": 530,
  "Lucknow_Vadodara": 1150,
  "Lucknow_Surat": 1250,
  "Lucknow_Chandigarh": 660,
  "Lucknow_Kochi": 2350,
  "Lucknow_Visakhapatnam": 1350,
  "Lucknow_Varanasi": 320,
  "Lucknow_Agra": 330,
  "Lucknow_Amritsar": 850,
  "Lucknow_Bhubaneswar": 1150,
  "Lucknow_Guwahati": 1450,
  "Lucknow_Ranchi": 750,
  "Lucknow_Coimbatore": 2200,
  "Lucknow_Madurai": 2350,
  "Lucknow_Goa": 1950,
  "Lucknow_Raipur": 780,
  "Kanpur_Nagpur": 720,
  "Kanpur_Indore": 750,
  "Kanpur_Bhopal": 550,
  "Kanpur_Patna": 580,
  "Kanpur_Vadodara": 1050,
  "Kanpur_Surat": 1180,
  "Kanpur_Chandigarh": 680,
  "Kanpur_Kochi": 2250,
  "Kanpur_Visakhapatnam": 1250,
  "Kanpur_Varanasi": 330,
  "Kanpur_Agra": 280,
  "Kanpur_Amritsar": 870,
  "Kanpur_Bhubaneswar": 1100,
  "Kanpur_Guwahati": 1500,
  "Kanpur_Ranchi": 700,
  "Kanpur_Coimbatore": 2150,
  "Kanpur_Madurai": 2300,
  "Kanpur_Goa": 1900,
  "Kanpur_Raipur": 720,
  "Nagpur_Indore": 420,
  "Nagpur_Bhopal": 350,
  "Nagpur_Patna": 900,
  "Nagpur_Vadodara": 800,
  "Nagpur_Surat": 750,
  "Nagpur_Chandigarh": 1300,
  "Nagpur_Kochi": 1500,
  "Nagpur_Visakhapatnam": 700,
  "Nagpur_Varanasi": 750,
  "Nagpur_Agra": 850,
  "Nagpur_Amritsar": 1500,
  "Nagpur_Bhubaneswar": 850,
  "Nagpur_Guwahati": 1850,
  "Nagpur_Ranchi": 750,
  "Nagpur_Coimbatore": 1400,
  "Nagpur_Madurai": 1550,
  "Nagpur_Goa": 1100,
  "Nagpur_Raipur": 280,
  "Indore_Bhopal": 190,
  "Indore_Patna": 1050,
  "Indore_Vadodara": 350,
  "Indore_Surat": 450,
  "Indore_Chandigarh": 1050,
  "Indore_Kochi": 1750,
  "Indore_Visakhapatnam": 1300,
  "Indore_Varanasi": 900,
  "Indore_Agra": 600,
  "Indore_Amritsar": 1250,
  "Indore_Bhubaneswar": 1350,
  "Indore_Guwahati": 2100,
  "Indore_Ranchi": 1100,
  "Indore_Coimbatore": 1650,
  "Indore_Madurai": 1800,
  "Indore_Goa": 1000,
  "Indore_Raipur": 750,
  "Bhopal_Patna": 900,
  "Bhopal_Vadodara": 550,
  "Bhopal_Surat": 650,
  "Bhopal_Chandigarh": 1020,
  "Bhopal_Kochi": 1850,
  "Bhopal_Visakhapatnam": 1050,
  "Bhopal_Varanasi": 750,
  "Bhopal_Agra": 570,
  "Bhopal_Amritsar": 1220,
  "Bhopal_Bhubaneswar": 1150,
  "Bhopal_Guwahati": 1950,
  "Bhopal_Ranchi": 900,
  "Bhopal_Coimbatore": 1750,
  "Bhopal_Madurai": 1900,
  "Bhopal_Goa": 1150,
  "Bhopal_Raipur": 610,
  "Patna_Vadodara": 1650,
  "Patna_Surat": 1750,
  "Patna_Chandigarh": 1250,
  "Patna_Kochi": 2550,
  "Patna_Visakhapatnam": 1150,
  "Patna_Varanasi": 250,
  "Patna_Agra": 850,
  "Patna_Amritsar": 1450,
  "Patna_Bhubaneswar": 850,
  "Patna_Guwahati": 900,
  "Patna_Ranchi": 330,
  "Patna_Coimbatore": 2400,
  "Patna_Madurai": 2550,
  "Patna_Goa": 2200,
  "Patna_Raipur": 850,
  "Vadodara_Surat": 150,
  "Vadodara_Chandigarh": 1250,
  "Vadodara_Kochi": 1700,
  "Vadodara_Visakhapatnam": 1600,
  "Vadodara_Varanasi": 1250,
  "Vadodara_Agra": 950,
  "Vadodara_Amritsar": 1450,
  "Vadodara_Bhubaneswar": 1750,
  "Vadodara_Guwahati": 2600,
  "Vadodara_Ranchi": 1450,
  "Vadodara_Coimbatore": 1650,
  "Vadodara_Madurai": 1800,
  "Vadodara_Goa": 950,
  "Vadodara_Raipur": 1100,
  "Surat_Chandigarh": 1350,
  "Surat_Kochi": 1550,
  "Surat_Visakhapatnam": 1500,
  "Surat_Varanasi": 1350,
  "Surat_Agra": 1050,
  "Surat_Amritsar": 1550,
  "Surat_Bhubaneswar": 1650,
  "Surat_Guwahati": 2700,
  "Surat_Ranchi": 1550,
  "Surat_Coimbatore": 1500,
  "Surat_Madurai": 1650,
  "Surat_Goa": 800,
  "Surat_Raipur": 1050,
  "Chandigarh_Kochi": 2900,
  "Chandigarh_Visakhapatnam": 2050,
  "Chandigarh_Varanasi": 1050,
  "Chandigarh_Agra": 460,
  "Chandigarh_Amritsar": 225,
  "Chandigarh_Bhubaneswar": 1900,
  "Chandigarh_Guwahati": 2150,
  "Chandigarh_Ranchi": 1450,
  "Chandigarh_Coimbatore": 2700,
  "Chandigarh_Madurai": 2850,
  "Chandigarh_Goa": 2150,
  "Chandigarh_Raipur": 1400,
  "Kochi_Visakhapatnam": 1350,
  "Kochi_Varanasi": 2450,
  "Kochi_Agra": 2450,
  "Kochi_Amritsar": 3100,
  "Kochi_Bhubaneswar": 1750,
  "Kochi_Guwahati": 3250,
  "Kochi_Ranchi": 2250,
  "Kochi_Coimbatore": 190,
  "Kochi_Madurai": 270,
  "Kochi_Goa": 800,
  "Kochi_Raipur": 1900,
  "Visakhapatnam_Varanasi": 1050,
  "Visakhapatnam_Agra": 1550,
  "Visakhapatnam_Amritsar": 2250,
  "Visakhapatnam_Bhubaneswar": 450,
  "Visakhapatnam_Guwahati": 1850,
  "Visakhapatnam_Ranchi": 850,
  "Visakhapatnam_Coimbatore": 1150,
  "Visakhapatnam_Madurai": 1250,
  "Visakhapatnam_Goa": 1150,
  "Visakhapatnam_Raipur": 550,
  "Varanasi_Agra": 600,
  "Varanasi_Amritsar": 1250,
  "Varanasi_Bhubaneswar": 850,
  "Varanasi_Guwahati": 1150,
  "Varanasi_Ranchi": 450,
  "Varanasi_Coimbatore": 2150,
  "Varanasi_Madurai": 2300,
  "Varanasi_Goa": 1950,
  "Varanasi_Raipur": 700,
  "Agra_Amritsar": 660,
  "Agra_Bhubaneswar": 1450,
  "Agra_Guwahati": 1750,
  "Agra_Ranchi": 1000,
  "Agra_Coimbatore": 2250,
  "Agra_Madurai": 2400,
  "Agra_Goa": 1700,
  "Agra_Raipur": 950,
  "Amritsar_Bhubaneswar": 2100,
  "Amritsar_Guwahati": 2350,
  "Amritsar_Ranchi": 1650,
  "Amritsar_Coimbatore": 2900,
  "Amritsar_Madurai": 3050,
  "Amritsar_Goa": 2350,
  "Amritsar_Raipur": 1600,
  "Bhubaneswar_Guwahati": 1050,
  "Bhubaneswar_Ranchi": 450,
  "Bhubaneswar_Coimbatore": 1550,
  "Bhubaneswar_Madurai": 1650,
  "Bhubaneswar_Goa": 1550,
  "Bhubaneswar_Raipur": 550,
  "Guwahati_Ranchi": 950,
  "Guwahati_Coimbatore": 2950,
  "Guwahati_Madurai": 3100,
  "Guwahati_Goa": 3100,
  "Guwahati_Raipur": 1450,
  "Ranchi_Coimbatore": 2000,
  "Ranchi_Madurai": 2150,
  "Ranchi_Goa": 1850,
  "Ranchi_Raipur": 500,
  "Coimbatore_Madurai": 220,
  "Coimbatore_Goa": 750,
  "Coimbatore_Raipur": 1550,
  "Madurai_Goa": 950,
  "Madurai_Raipur": 1700,
  "Goa_Raipur": 1200,
  "Mumbai_Nashik": 165,
  "Pune_Nashik": 210,
  "Nagpur_Nashik": 700,
  "Mumbai_Aurangabad": 360,
  "Pune_Aurangabad": 235,
  "Nagpur_Aurangabad": 500,
  "Mumbai_Solapur": 400,
  "Pune_Solapur": 250,
  "Nagpur_Solapur": 600,
  "Ahmedabad_Rajkot": 215,
  "Surat_Rajkot": 450,
  "Vadodara_Rajkot": 280,
  "Ahmedabad_Bhavnagar": 170,
  "Surat_Bhavnagar": 360,
  "Vadodara_Bhavnagar": 200,
  "Ahmedabad_Jamnagar": 310,
  "Surat_Jamnagar": 550,
  "Vadodara_Jamnagar": 380,
  "Lucknow_Allahabad": 200,
  "Kanpur_Allahabad": 210,
  "Varanasi_Allahabad": 120,
  "Agra_Allahabad": 480,
  "Lucknow_Gorakhpur": 270,
  "Kanpur_Gorakhpur": 350,
  "Varanasi_Gorakhpur": 200,
  "Patna_Gaya": 100,
  "Patna_Muzaffarpur": 75,
  "Patna_Bhagalpur": 220,
  "Chandigarh_Ludhiana": 105,
  "Chandigarh_Jalandhar": 145,
  "Chandigarh_Patiala": 70,
  "Amritsar_Ludhiana": 140,
  "Amritsar_Jalandhar": 80,
  "Kochi_Trivandrum": 200,
  "Kochi_Kozhikode": 180,
  "Kochi_Thrissur": 85,
  "Kochi_Alleppey": 55,
  "Trivandrum_Kozhikode": 380,
  "Bengaluru_Mysore": 145,
  "Bengaluru_Mangaluru": 350,
  "Bengaluru_Hubli": 410,
  "Chennai_Salem": 340,
  "Chennai_Trichy": 330,
  "Chennai_Tirunelveli": 620,
  "Madurai_Salem": 230,
  "Madurai_Trichy": 135,
  "Madurai_Tirunelveli": 160,
  "Coimbatore_Salem": 165,
  "Coimbatore_Trichy": 215,
  "Kolkata_Durgapur": 170,
  "Kolkata_Asansol": 210,
  "Kolkata_Siliguri": 580,
  "Kolkata_Darjeeling": 620,
  "Bhubaneswar_Cuttack": 25,
  "Bhubaneswar_Puri": 60,
  "Bhubaneswar_Rourkela": 330,
  "Bhubaneswar_Sambalpur": 280,
  "New Delhi_Dehradun": 250,
  "New Delhi_Shimla": 340,
  "New Delhi_Haridwar": 220,
  "New Delhi_Rishikesh": 240,
  "New Delhi_Mathura": 180,
  "New Delhi_Gwalior": 350,
  "Jaipur_Udaipur": 390,
  "Jaipur_Jodhpur": 330,
  "Jaipur_Ajmer": 135,
  "Jaipur_Bikaner": 330,
  "Jaipur_Kota": 250,
  "Indore_Ujjain": 55,
  "Bhopal_Ujjain": 190,
  "Bhopal_Gwalior": 430,
  "Bhopal_Jabalpur": 310,
  "Indore_Jabalpur": 500,
  "Raipur_Bilaspur": 120,
  "Raipur_Bhilai": 30
};

function normalizeCity(name) {
  if (!name) return "";
  let s = name.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, "").trim();
  const stripWords = ["junction", "jn", "central", "cantt", "terminus", "terminal", "isbt", "airport", "city", "camp", "road", "railway station"];
  for (const term of stripWords) {
    s = s.replace(new RegExp(`\\b${term}\\b`, "gi"), "");
  }
  s = s.trim();

  if (s.includes("delhi")) return "New Delhi";
  if (s.includes("bangalore") || s.includes("bengaluru")) return "Bengaluru";
  if (s.includes("bombay") || s.includes("mumbai")) return "Mumbai";
  if (s.includes("calcutta") || s.includes("kolkata")) return "Kolkata";
  if (s.includes("madras") || s.includes("chennai")) return "Chennai";
  if (s.includes("bihar") || s.includes("patna")) return "Patna";
  if (s.includes("trivandrum") || s.includes("thiruvananthapuram")) return "Trivandrum";
  if (s.includes("baroda") || s.includes("vadodara")) return "Vadodara";
  if (s.includes("cochin") || s.includes("kochi")) return "Kochi";
  if (s.includes("vizag") || s.includes("visakhapatnam")) return "Visakhapatnam";
  if (s.includes("banaras") || s.includes("kashi") || s.includes("varanasi")) return "Varanasi";
  if (s.includes("prayagraj") || s.includes("allahabad")) return "Allahabad";

  return s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}

function lookupDistance(from, to) {
  if (!from || !to) return 500;
  const c1 = normalizeCity(from);
  const c2 = normalizeCity(to);
  if (c1.toLowerCase() === c2.toLowerCase()) return 0;

  // 1. Direct key match (bidirectional)
  const k1 = `${c1}_${c2}`;
  const k2 = `${c2}_${c1}`;
  if (CITY_DISTANCES[k1]) return CITY_DISTANCES[k1];
  if (CITY_DISTANCES[k2]) return CITY_DISTANCES[k2];

  // 2. Loose substring check
  const fLower = from.toLowerCase();
  const tLower = to.toLowerCase();
  for (const k in CITY_DISTANCES) {
    const [cityA, cityB] = k.split("_");
    const ca = cityA.toLowerCase();
    const cb = cityB.toLowerCase();
    if (
      (fLower.includes(ca) && tLower.includes(cb)) ||
      (fLower.includes(cb) && tLower.includes(ca))
    ) {
      return CITY_DISTANCES[k];
    }
  }

  return 500;
}

export function TravelScreen({ onBack, onNavigate, initialTab = "train" }) {
  const { profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // "train" | "flight" | "bus" | "hotel" | "bookings"

  // Train search state
  const [trainFrom, setTrainFrom] = useState("Bihar (Patna)");
  const [trainTo, setTrainTo] = useState("Chennai Central (MAS)");
  const [trainDate, setTrainDate] = useState(getNextDayString(2));
  const [trainDistance, setTrainDistance] = useState(2075);

  // Flight search state
  const [flightFrom, setFlightFrom] = useState("Delhi (DEL)");
  const [flightTo, setFlightTo] = useState("Mumbai (BOM)");
  const [flightDate, setFlightDate] = useState(getNextDayString(3));
  const [flightClass, setFlightClass] = useState("Economy");

  // Bus search state
  const [busFrom, setBusFrom] = useState("Delhi (ISBT)");
  const [busTo, setBusTo] = useState("Jaipur (Sindhi Camp)");
  const [busDate, setBusDate] = useState(getNextDayString(1));
  const [busDistance, setBusDistance] = useState(280);

  // Hotel search state
  const [hotelCity, setHotelCity] = useState("Goa");
  const [checkInDate, setCheckInDate] = useState(getNextDayString(2));
  const [checkOutDate, setCheckOutDate] = useState(getNextDayString(4));
  const [guestsCount, setGuestsCount] = useState(2);
  const [roomsCount, setRoomsCount] = useState(1);

  // Checkout modal state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [passengerName, setPassengerName] = useState(profile?.full_name || "");
  const [passengerAge, setPassengerAge] = useState(28);
  const [passengerGender, setPassengerGender] = useState("Male");
  const [berthPreference, setBerthPreference] = useState("No Preference");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState("");

  // Confirmed ticket modal state
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // PDF Preview modal state
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [previewTitle, setPreviewTitle] = useState("Travel E-Ticket");
  const [previewFilename, setPreviewFilename] = useState("ticket.pdf");
  const [loadingPdf, setLoadingPdf] = useState(false);

  // My Bookings state
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Load bookings from backend
  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await TravelAPI.getBookings(30);
      setMyBookings(res);
    } catch (e) {
      console.error("Failed to load bookings:", e);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    if (activeTab === "bookings") {
      loadBookings();
    }
  }, [activeTab]);

  // Automatic distance calculation from static lookup table
  useEffect(() => {
    const dist = lookupDistance(trainFrom, trainTo);
    if (dist > 0) setTrainDistance(dist);
  }, [trainFrom, trainTo]);

  useEffect(() => {
    const dist = lookupDistance(busFrom, busTo);
    if (dist > 0) setBusDistance(dist);
  }, [busFrom, busTo]);

  // Quick route apply helper
  const applyQuickRoute = (from, to) => {
    setTrainFrom(from);
    setTrainTo(to);
    const d = lookupDistance(from, to);
    if (d > 0) setTrainDistance(d);
  };

  // Handle PDF View
  const handleViewTicket = async (booking) => {
    setLoadingPdf(true);
    setPreviewTitle(`E-Ticket - ${booking.pnr_or_ticket_no}`);
    setPreviewFilename(`Ticket_${booking.pnr_or_ticket_no}.pdf`);
    setPreviewBlob(null);
    setPreviewModalOpen(true);
    try {
      const blob = await TravelAPI.getTicketPdf(booking.id);
      setPreviewBlob(blob);
    } catch (e) {
      alert("Failed to render ticket PDF: " + (e?.response?.data?.detail || e.message));
      setPreviewModalOpen(false);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Handle PDF Download
  const handleDownloadTicket = async (booking) => {
    try {
      const blob = await TravelAPI.getTicketPdf(booking.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ticket_${booking.pnr_or_ticket_no}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Failed to download ticket PDF: " + (e?.response?.data?.detail || e.message));
    }
  };

  // Calculate nights for hotel
  const hotelNights = useMemo(() => {
    try {
      const d1 = new Date(checkInDate);
      const d2 = new Date(checkOutDate);
      const diff = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
      return diff;
    } catch (_) {
      return 1;
    }
  }, [checkInDate, checkOutDate]);

  // Train rate formula as requested:
  // Sleeper (SL): 0.7 Rs / km
  // 3rd AC (3A): 1.2 Rs / km
  // 2nd AC (2A): 2.0 Rs / km
  // 1st AC (1A): 3.0 Rs / km
  const trainOptions = useMemo(() => {
    const dist = trainDistance > 0 ? trainDistance : 500;
    const hours = Math.max(2, Math.round(dist / 65));
    const mins = Math.round(((dist % 65) / 65) * 60);
    const calcDuration = `${hours}h ${mins > 0 ? (mins < 10 ? "0" + mins : mins) + "m" : "15m"}`;

    // Specific route: Bihar / Patna to Chennai
    const isBiharChennai =
      (trainFrom.toLowerCase().includes("bihar") || trainFrom.toLowerCase().includes("patna")) &&
      trainTo.toLowerCase().includes("chennai");

    if (isBiharChennai) {
      return [
        {
          trainNo: "12296",
          name: "Sanghamitra Superfast Exp",
          depart: "08:15 PM",
          arrive: "06:45 AM (Day 3)",
          duration: "34h 30m",
          classes: [
            { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "AVL 114" },
            { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 48" },
            { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 14" },
            { code: "1A", label: "1st AC", ratePerKm: 3.0, price: Math.round(dist * 3.0), seats: "AVL 04" },
          ],
        },
        {
          trainNo: "12577",
          name: "Bagmati Superfast Express",
          depart: "07:20 AM",
          arrive: "07:15 PM (Day 2)",
          duration: "35h 55m",
          classes: [
            { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "RAC 08" },
            { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 24" },
            { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 06" },
          ],
        },
        {
          trainNo: "22644",
          name: "Patna - Ernakulam Superfast",
          depart: "02:00 PM",
          arrive: "11:55 PM (Day 2)",
          duration: "33h 55m",
          classes: [
            { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "AVL 52" },
            { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 18" },
            { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 08" },
          ],
        },
        {
          trainNo: "22353",
          name: "Patna - SMVT Humsafar Exp",
          depart: "08:25 PM",
          arrive: "06:50 AM (Day 3)",
          duration: "34h 25m",
          classes: [
            { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 64" },
            { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 20" },
          ],
        },
      ];
    }

    return [
      {
        trainNo: "22436",
        name: "Vande Bharat Express",
        depart: "06:00 AM",
        arrive: "02:00 PM",
        duration: calcDuration,
        classes: [
          { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "AVL 80" },
          { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 48" },
          { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 16" },
        ],
      },
      {
        trainNo: "12952",
        name: "Tejas Rajdhani Express",
        depart: "04:55 PM",
        arrive: "08:35 AM",
        duration: calcDuration,
        classes: [
          { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 32" },
          { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 14" },
          { code: "1A", label: "1st AC", ratePerKm: 3.0, price: Math.round(dist * 3.0), seats: "AVL 04" },
        ],
      },
      {
        trainNo: "12004",
        name: "Shatabdi Express",
        depart: "06:10 AM",
        arrive: "11:45 AM",
        duration: calcDuration,
        classes: [
          { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "AVL 120" },
          { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 45" },
          { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 18" },
        ],
      },
      {
        trainNo: "12398",
        name: "Mahabodhi Superfast Exp",
        depart: "12:50 PM",
        arrive: "09:10 PM",
        duration: calcDuration,
        classes: [
          { code: "SL", label: "Sleeper", ratePerKm: 0.7, price: Math.round(dist * 0.7), seats: "RAC 12" },
          { code: "3A", label: "3rd AC", ratePerKm: 1.2, price: Math.round(dist * 1.2), seats: "AVL 28" },
          { code: "2A", label: "2nd AC", ratePerKm: 2.0, price: Math.round(dist * 2.0), seats: "AVL 09" },
          { code: "1A", label: "1st AC", ratePerKm: 3.0, price: Math.round(dist * 3.0), seats: "AVL 02" },
        ],
      },
    ];
  }, [trainDistance, trainFrom, trainTo]);

  // Demo Flights
  const flightOptions = useMemo(() => {
    const multiplier = flightClass === "Business" ? 2.5 : flightClass === "Premium Economy" ? 1.5 : 1.0;
    return [
      {
        carrier: "IndiGo",
        code: "6E-204",
        depart: "07:15 AM",
        arrive: "09:30 AM",
        duration: "2h 15m",
        type: "Non-stop",
        basePrice: Math.round(4199 * multiplier),
      },
      {
        carrier: "Air India",
        code: "AI-805",
        depart: "10:30 AM",
        arrive: "12:45 PM",
        duration: "2h 15m",
        type: "Non-stop",
        basePrice: Math.round(4650 * multiplier),
      },
      {
        carrier: "Vistara",
        code: "UK-995",
        depart: "03:40 PM",
        arrive: "05:45 PM",
        duration: "2h 05m",
        type: "Non-stop",
        basePrice: Math.round(5250 * multiplier),
      },
      {
        carrier: "Akasa Air",
        code: "QP-1322",
        depart: "08:00 PM",
        arrive: "10:20 PM",
        duration: "2h 20m",
        type: "Non-stop",
        basePrice: Math.round(3899 * multiplier),
      },
    ];
  }, [flightClass]);

  // Demo Buses (with per KM rate)
  const busOptions = useMemo(() => {
    const dist = busDistance > 0 ? busDistance : 280;
    return [
      {
        operator: "Zingbus Electric",
        type: "AC Seater (2+2)",
        depart: "07:00 AM",
        arrive: "12:30 PM",
        duration: "5h 30m",
        rating: "4.7★",
        price: Math.round(dist * 1.2),
        amenities: ["WiFi", "Live Tracking", "Water"],
      },
      {
        operator: "IntrCity SmartBus",
        type: "AC Sleeper (2+1)",
        depart: "10:30 PM",
        arrive: "05:00 AM",
        duration: "6h 30m",
        rating: "4.8★",
        price: Math.round(dist * 1.6),
        amenities: ["Blanket", "Charging", "Snacks"],
      },
      {
        operator: "NueGo Eco Express",
        type: "Electric AC Luxury",
        depart: "02:15 PM",
        arrive: "07:30 PM",
        duration: "5h 15m",
        rating: "4.6★",
        price: Math.round(dist * 1.4),
        amenities: ["Clean Air", "CCTV", "WiFi"],
      },
      {
        operator: "SRS Travels",
        type: "Volvo Multi-Axle",
        depart: "11:15 PM",
        arrive: "05:45 AM",
        duration: "6h 30m",
        rating: "4.5★",
        price: Math.round(dist * 2.0),
        amenities: ["Recliner", "Water", "USB"],
      },
    ];
  }, [busDistance]);

  // Demo Hotels
  const hotelOptions = useMemo(() => {
    return [
      {
        name: "The Grand Heritage & Spa",
        city: hotelCity,
        location: "Beachfront / Central",
        rating: "4.9★",
        reviews: "1,240 reviews",
        roomTypes: [
          { type: "Deluxe Ocean View", pricePerNight: 2899, total: 2899 * hotelNights * roomsCount },
          { type: "Executive Pool Suite", pricePerNight: 4499, total: 4499 * hotelNights * roomsCount },
        ],
        tags: ["Free Breakfast", "Swimming Pool", "Couple Friendly"],
      },
      {
        name: "Radisson Blu Resort",
        city: hotelCity,
        location: "Prime City Hub",
        rating: "4.7★",
        reviews: "890 reviews",
        roomTypes: [
          { type: "Standard Cozy Room", pricePerNight: 1899, total: 1899 * hotelNights * roomsCount },
          { type: "Deluxe King Room", pricePerNight: 2499, total: 2499 * hotelNights * roomsCount },
        ],
        tags: ["Free Wi-Fi", "Free Cancellation", "Gym"],
      },
      {
        name: "Urban Oasis Boutique Hotel",
        city: hotelCity,
        location: "Near City Market",
        rating: "4.6★",
        reviews: "640 reviews",
        roomTypes: [
          { type: "Superior City View", pricePerNight: 1499, total: 1499 * hotelNights * roomsCount },
          { type: "Family Luxury Suite", pricePerNight: 3199, total: 3199 * hotelNights * roomsCount },
        ],
        tags: ["24/7 Room Service", "Restaurant"],
      },
    ];
  }, [hotelCity, hotelNights, roomsCount]);

  // Initiate Booking
  const openBookingModal = (bookingData) => {
    setSelectedBooking(bookingData);
    setShowPaymentModal(false);
    setPin("");
    setBookingError("");
  };

  // Submit Booking
  const handleConfirmBooking = async (enteredPin, mode = "normal") => {
    if (!selectedBooking) return;
    setBookingError("");

    if (!passengerName.trim()) {
      setBookingError("Please enter passenger/guest name");
      return;
    }

    if (profile?.has_upi_pin && !enteredPin) {
      setBookingError("Please enter your 6-digit UPI PIN");
      return;
    }

    if ((profile?.account?.balance ?? 0) < selectedBooking.amount) {
      setBookingError("Insufficient wallet balance. Please add money to RenoPay wallet.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        booking_type: selectedBooking.type,
        operator_name: selectedBooking.operator,
        service_number: selectedBooking.serviceNumber || null,
        from_location: selectedBooking.from,
        to_location: selectedBooking.to,
        departure_date: selectedBooking.departDate,
        departure_time: selectedBooking.departTime || null,
        arrival_date: selectedBooking.arriveDate || null,
        arrival_time: selectedBooking.arriveTime || null,
        distance_km: selectedBooking.distance || 0,
        travel_class: selectedBooking.travelClass,
        passenger_name: passengerName.trim(),
        passenger_age: Number(passengerAge) || 28,
        passenger_gender: passengerGender,
        seat_or_room_no: selectedBooking.seatOrRoom || (selectedBooking.type === "train" ? `B2 - ${Math.floor(Math.random() * 60) + 1} (${berthPreference})` : selectedBooking.type === "hotel" ? `Room ${Math.floor(Math.random() * 300) + 101}` : `${Math.floor(Math.random() * 25) + 1}A`),
        amount: selectedBooking.amount,
        pin: enteredPin || null,
      };

      const result = await TravelAPI.book(payload);
      await refreshProfile?.();
      await loadBookings();
      setShowPaymentModal(false);
      setSelectedBooking(null);
      setConfirmedBooking(result);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || err.message || "Booking failed";
      setBookingError(typeof msg === "object" ? msg.message || JSON.stringify(msg) : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg pb-[100px] text-textLight">
      {/* Top Header */}
      <div className="px-[22px] pt-[46px] pb-[16px] flex items-center justify-between border-b border-line bg-surf/60 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-card border border-line flex items-center justify-center text-textLight hover:border-accent/40 active:scale-95 transition-all"
            title="Go back"
          >
            ←
          </button>
          <div>
            <h2 className="text-[19px] font-extrabold text-textLight leading-tight">Travel & Transit</h2>
            <p className="text-[11px] text-muted">Direct Route Search & Instant Wallet Booking</p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
            activeTab === "bookings" ? "bg-accent text-white border-accent shadow-accentGlow" : "bg-card border-line text-muted hover:text-textLight"
          }`}
        >
          <span>🎟️</span>
          <span>My Tickets</span>
          {myBookings.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-white text-accent flex items-center justify-center text-[9px] font-extrabold ml-0.5">
              {myBookings.length}
            </span>
          )}
        </button>
      </div>

      {/* Prominent My Bookings Section at Top */}
      <div className="px-[20px] pt-3 pb-1">
        <button
          onClick={() => setActiveTab("bookings")}
          className={`w-full rounded-2xl p-3 flex items-center justify-between border transition-all cursor-pointer shadow-sm ${
            activeTab === "bookings"
              ? "bg-accent/15 border-accent text-accent"
              : "bg-card hover:bg-card/80 border-accent/30 text-textLight"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-1.5 rounded-xl bg-accent/15 text-accent">🎟️</span>
            <div className="text-left">
              <h4 className="text-xs font-extrabold flex items-center gap-1.5 text-textLight">
                My Bookings & Stored Tickets
                {myBookings.length > 0 ? (
                  <span className="bg-accent text-white px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {myBookings.length} Booked
                  </span>
                ) : (
                  <span className="text-muted text-[10px] font-normal">(0 stored)</span>
                )}
              </h4>
              <p className="text-[10px] text-muted">Tap to view, verify PNR, or re-download PDF boarding passes</p>
            </div>
          </div>
          <span className="text-accent text-xs font-bold flex items-center gap-0.5">
            {activeTab === "bookings" ? "Viewing" : "Open"} ➔
          </span>
        </button>
      </div>

      <div className="px-[20px] pt-2">
        {/* Service Tab Switcher (Flight, Bus, Train, Hotel) */}
        <div className="grid grid-cols-4 gap-2 mb-3.5 bg-card p-1.5 rounded-2xl border border-line">
          {[
            { key: "train", label: "Train", icon: TrainIcon },
            { key: "flight", label: "Flight", icon: FlightIcon },
            { key: "bus", label: "Bus", icon: BusIcon },
            { key: "hotel", label: "Hotel", icon: HotelIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setConfirmedBooking(null);
                }}
                className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                  isSel ? "bg-accent text-white shadow-accentGlow scale-[1.02]" : "hover:bg-surf text-muted hover:text-textLight"
                }`}
              >
                <Icon className="w-7 h-7 mb-1" />
                <span className={`text-[11px] font-bold ${isSel ? "text-white" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ===================== TAB 1: TRAIN ===================== */}
        {activeTab === "train" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                  <span>🚆</span> IRCTC Train Booking
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center gap-1">
                  <span>⚡</span>
                  <span>Instant Rates</span>
                </span>
              </div>

              {/* Free text search inputs */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                    From City / Station (Type any location)
                  </label>
                  <input
                    type="text"
                    value={trainFrom}
                    onChange={(e) => setTrainFrom(e.target.value)}
                    placeholder="e.g. Bihar, Patna, Delhi, Lucknow..."
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-center -my-1 relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      const temp = trainFrom;
                      setTrainFrom(trainTo);
                      setTrainTo(temp);
                    }}
                    className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs shadow-md hover:scale-110 active:scale-90 transition-transform"
                    title="Swap stations"
                  >
                    ⇅
                  </button>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">
                    To City / Station (Type any location)
                  </label>
                  <input
                    type="text"
                    value={trainTo}
                    onChange={(e) => setTrainTo(e.target.value)}
                    placeholder="e.g. Chennai, Mumbai, Bangalore..."
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Quick Suggestion Chips */}
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] no-scrollbar">
                <span className="text-muted text-[9px] uppercase font-bold shrink-0">Popular:</span>
                {[
                  ["Bihar (Patna)", "Chennai Central"],
                  ["Delhi", "Mumbai Central"],
                  ["Patna", "New Delhi"],
                  ["Bengaluru", "Goa"],
                ].map(([f, t], idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyQuickRoute(f, t)}
                    className="bg-surf hover:bg-accent/20 border border-line hover:border-accent text-textLight/80 px-2 py-0.5 rounded-lg whitespace-nowrap transition-colors shrink-0"
                  >
                    {f} ➔ {t}
                  </button>
                ))}
              </div>

              {/* Date & Distance Strip */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line/60">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Journey Date 📅</label>
                  <DatePickerInput
                    value={trainDate}
                    onChange={(e) => setTrainDate(e.target.value)}
                    title="Select Journey Date"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase font-bold text-muted block">Real Track Distance</label>
                    <span className="text-[9px] text-accent font-bold">Standard Railway Route</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={trainDistance}
                      onChange={(e) => setTrainDistance(Math.max(10, Number(e.target.value) || 0))}
                      className="w-full bg-surf border border-line rounded-xl px-3 py-1.5 text-xs text-textLight font-mono font-bold outline-none focus:border-accent"
                    />
                    <span className="absolute right-2.5 top-2 text-[10px] text-muted font-bold">KM</span>
                  </div>
                </div>
              </div>

              {/* Rate Card Legend */}
              <div className="mt-2.5 p-2 rounded-xl bg-surf border border-line flex items-center justify-between text-[10px] font-semibold text-textLight flex-wrap gap-1">
                <span>SL: <strong className="text-accent">₹0.7/km</strong></span>
                <span>3A: <strong className="text-accent">₹1.2/km</strong></span>
                <span>2A: <strong className="text-accent">₹2/km</strong></span>
                <span>1A: <strong className="text-accent">₹3/km</strong></span>
              </div>
            </Card>

            {/* Train Results */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1 flex items-center justify-between">
                <span>Available Trains ({trainOptions.length}) &bull; {trainDistance} KM</span>
                <span className="text-[10px] text-accent font-semibold">{trainFrom} ➔ {trainTo}</span>
              </h3>

              {trainOptions.map((train) => (
                <Card key={train.trainNo} className="p-3.5 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[14px] text-textLight">{train.name}</span>
                        <Badge color="#FF6A1A" size={9}>#{train.trainNo}</Badge>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">Runs on schedule &bull; Punctual</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-accent">{train.duration}</span>
                  </div>

                  {/* Timings */}
                  <div className="flex items-center justify-between py-2 border-y border-line/40 text-xs my-2">
                    <div>
                      <p className="font-bold text-sm text-textLight">{train.depart}</p>
                      <p className="text-[10px] text-muted truncate max-w-[120px]">{trainFrom}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted block">&#10230;</span>
                      <span className="text-[9px] text-accent font-bold">{trainDistance} KM</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-textLight">{train.arrive}</p>
                      <p className="text-[10px] text-muted truncate max-w-[120px]">{trainTo}</p>
                    </div>
                  </div>

                  {/* Class options with exact requested formula */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2">
                    {train.classes.map((cls) => (
                      <button
                        key={cls.code}
                        onClick={() =>
                          openBookingModal({
                            type: "train",
                            operator: `${train.trainNo} ${train.name}`,
                            serviceNumber: train.trainNo,
                            from: trainFrom,
                            to: trainTo,
                            departDate: trainDate,
                            departTime: train.depart,
                            arriveTime: train.arrive,
                            distance: trainDistance,
                            travelClass: `${cls.label} (${cls.code})`,
                            amount: cls.price,
                            rateDesc: `${trainDistance} km × ₹${cls.ratePerKm}/km`,
                          })
                        }
                        className="bg-surf hover:bg-accent/15 border border-line hover:border-accent rounded-xl p-2 text-left transition-all active:scale-95 group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-textLight group-hover:text-accent">{cls.code}</span>
                          <span className="text-[9px] text-emerald-400 font-bold">{cls.seats}</span>
                        </div>
                        <p className="text-[13px] font-mono font-extrabold text-textLight mt-1">{fmt(cls.price)}</p>
                        <p className="text-[9px] text-muted">₹{cls.ratePerKm}/km</p>
                      </button>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 2: FLIGHT ===================== */}
        {activeTab === "flight" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">✈️ Domestic Flights</span>
                <span className="text-[10px] text-muted">Direct Airline Partner Rates</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">From Airport</label>
                  <input
                    type="text"
                    value={flightFrom}
                    onChange={(e) => setFlightFrom(e.target.value)}
                    placeholder="e.g. Delhi (DEL), Patna (PAT)..."
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">To Airport</label>
                  <input
                    type="text"
                    value={flightTo}
                    onChange={(e) => setFlightTo(e.target.value)}
                    placeholder="e.g. Chennai (MAA), Mumbai (BOM)..."
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Date 📅</label>
                  <DatePickerInput
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    title="Departure Date"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Cabin Class</label>
                  <select
                    value={flightClass}
                    onChange={(e) => setFlightClass(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-1.5 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  >
                    <option value="Economy">Economy</option>
                    <option value="Premium Economy">Premium Economy</option>
                    <option value="Business">Business Class</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Flight Results */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                Available Flights ({flightOptions.length}) &bull; {flightClass}
              </h3>

              {flightOptions.map((f) => (
                <Card key={f.code} className="p-3.5 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-extrabold text-[14px] text-textLight">{f.carrier}</p>
                      <p className="text-[10px] text-muted font-mono">{f.code} &bull; {f.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-mono font-extrabold text-accent">{fmt(f.basePrice)}</p>
                      <p className="text-[9px] text-muted">per adult (taxes incl.)</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-y border-line/40 text-xs my-2">
                    <div>
                      <p className="font-bold text-sm text-textLight">{f.depart}</p>
                      <p className="text-[10px] text-muted">{flightFrom}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted block">{f.duration}</span>
                      <span className="text-[9px] text-emerald-400 font-semibold">{f.type}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-textLight">{f.arrive}</p>
                      <p className="text-[10px] text-muted">{flightTo}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1">
                    <span className="text-[10px] text-muted">🧳 15 Kg Check-in &bull; 7 Kg Cabin</span>
                    <Btn
                      variant="teal"
                      className="py-1.5 px-4 text-xs font-bold"
                      onClick={() =>
                        openBookingModal({
                          type: "flight",
                          operator: f.carrier,
                          serviceNumber: f.code,
                          from: flightFrom,
                          to: flightTo,
                          departDate: flightDate,
                          departTime: f.depart,
                          arriveTime: f.arrive,
                          travelClass: flightClass,
                          amount: f.basePrice,
                          distance: 1150,
                          rateDesc: "Airfare tariff",
                        })
                      }
                    >
                      Book Flight
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: BUS ===================== */}
        {activeTab === "bus" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">🚌 Intercity Bus Tickets</span>
                <span className="text-[10px] text-muted">Fixed Distance Tariff</span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">From City</label>
                  <input
                    type="text"
                    value={busFrom}
                    onChange={(e) => setBusFrom(e.target.value)}
                    placeholder="e.g. Delhi, Jaipur, Patna..."
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">To City</label>
                  <input
                    type="text"
                    value={busTo}
                    onChange={(e) => setBusTo(e.target.value)}
                    placeholder="e.g. Jaipur, Lucknow, Agra..."
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Date 📅</label>
                  <DatePickerInput
                    value={busDate}
                    onChange={(e) => setBusDate(e.target.value)}
                    title="Journey Date"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Distance (KM)</label>
                  <input
                    type="number"
                    value={busDistance}
                    onChange={(e) => setBusDistance(Math.max(10, Number(e.target.value) || 0))}
                    className="w-full bg-surf border border-line rounded-xl px-3 py-1.5 text-xs text-textLight font-mono font-bold outline-none focus:border-accent"
                  />
                </div>
              </div>
            </Card>

            {/* Bus Results */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                Available Buses ({busOptions.length}) &bull; {busDistance} KM
              </h3>

              {busOptions.map((b, i) => (
                <Card key={i} className="p-3.5 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-[14px] text-textLight">{b.operator}</p>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{b.rating}</span>
                      </div>
                      <p className="text-[11px] text-muted">{b.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[16px] font-mono font-extrabold text-accent">{fmt(b.price)}</p>
                      <p className="text-[9px] text-muted">seat fare</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-y border-line/40 text-xs my-2">
                    <div>
                      <p className="font-bold text-sm text-textLight">{b.depart}</p>
                      <p className="text-[10px] text-muted">{busFrom}</p>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] text-muted block">{b.duration}</span>
                      <span className="text-[9px] text-accent font-semibold">{busDistance} KM</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-textLight">{b.arrive}</p>
                      <p className="text-[10px] text-muted">{busTo}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {b.amenities.map((a, ai) => (
                        <span key={ai} className="text-[9px] bg-surf px-2 py-0.5 rounded text-muted">
                          {a}
                        </span>
                      ))}
                    </div>
                    <Btn
                      variant="teal"
                      className="py-1.5 px-4 text-xs font-bold"
                      onClick={() =>
                        openBookingModal({
                          type: "bus",
                          operator: b.operator,
                          from: busFrom,
                          to: busTo,
                          departDate: busDate,
                          departTime: b.depart,
                          arriveTime: b.arrive,
                          distance: busDistance,
                          travelClass: b.type,
                          amount: b.price,
                          rateDesc: `${busDistance} km route`,
                        })
                      }
                    >
                      Book Seat
                    </Btn>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: HOTEL ===================== */}
        {activeTab === "hotel" && (
          <div className="space-y-4 animate-fadeUp">
            <Card className="p-4 border-line">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">🏨 Hotel Reservations</span>
                <span className="text-[10px] text-muted">Instant Voucher & Check-in</span>
              </div>

              <div className="mb-3">
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">Destination City</label>
                <input
                  type="text"
                  value={hotelCity}
                  onChange={(e) => setHotelCity(e.target.value)}
                  placeholder="e.g. Goa, Jaipur, Mumbai, Manali..."
                  className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Check-in 📅</label>
                  <DatePickerInput
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                    title="Check-in Date"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Check-out 📅</label>
                  <DatePickerInput
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                    title="Check-out Date"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line/60">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Guests</label>
                  <select
                    value={guestsCount}
                    onChange={(e) => setGuestsCount(Number(e.target.value))}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-1.5 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  >
                    <option value={1}>1 Guest</option>
                    <option value={2}>2 Guests</option>
                    <option value={3}>3 Guests</option>
                    <option value={4}>4 Guests</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Rooms</label>
                  <select
                    value={roomsCount}
                    onChange={(e) => setRoomsCount(Number(e.target.value))}
                    className="w-full bg-surf border border-line rounded-xl px-2.5 py-1.5 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  >
                    <option value={1}>1 Room</option>
                    <option value={2}>2 Rooms</option>
                    <option value={3}>3 Rooms</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Hotel Results */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider px-1">
                Properties in {hotelCity} &bull; {hotelNights} {hotelNights === 1 ? "Night" : "Nights"}
              </h3>

              {hotelOptions.map((h, i) => (
                <Card key={i} className="p-3.5 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-[14px] text-textLight">{h.name}</p>
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">{h.rating}</span>
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{h.location}, {h.city} &bull; {h.reviews}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 my-2 flex-wrap">
                    {h.tags.map((t, ti) => (
                      <span key={ti} className="text-[9px] bg-surf text-textLight/70 px-2 py-0.5 rounded border border-line">
                        ✓ {t}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-line/40">
                    {h.roomTypes.map((rt, rti) => (
                      <div key={rti} className="flex items-center justify-between bg-surf/80 p-2.5 rounded-xl border border-line/60">
                        <div>
                          <p className="text-xs font-bold text-textLight">{rt.type}</p>
                          <p className="text-[10px] text-muted">
                            {fmt(rt.pricePerNight)} / night &bull; {hotelNights} {hotelNights === 1 ? "night" : "nights"}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="text-xs font-mono font-extrabold text-accent">{fmt(rt.total)}</p>
                            <p className="text-[9px] text-muted">all taxes incl.</p>
                          </div>
                          <Btn
                            variant="teal"
                            className="py-1 px-3 text-[11px] font-bold"
                            onClick={() =>
                              openBookingModal({
                                type: "hotel",
                                operator: h.name,
                                from: h.city,
                                to: h.location,
                                departDate: checkInDate,
                                arriveDate: checkOutDate,
                                departTime: "12:00 PM Check-in",
                                arriveTime: "11:00 AM Check-out",
                                travelClass: rt.type,
                                amount: rt.total,
                                rateDesc: `${hotelNights} nights × ${fmt(rt.pricePerNight)}`,
                              })
                            }
                          >
                            Reserve
                          </Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: MY BOOKINGS ===================== */}
        {activeTab === "bookings" && (
          <div className="space-y-3 animate-fadeUp">
            <div className="flex items-center justify-between px-1 mb-1">
              <h3 className="text-xs font-bold text-muted uppercase tracking-wider">
                My Stored Bookings ({myBookings.length})
              </h3>
              <button onClick={loadBookings} className="text-xs text-accent font-semibold hover:underline">
                Refresh ↻
              </button>
            </div>

            {loadingBookings ? (
              <div className="py-12 text-center text-muted text-xs">Loading stored travel bookings...</div>
            ) : myBookings.length === 0 ? (
              <Card className="p-8 text-center border-line">
                <p className="text-3xl mb-2">🎟️</p>
                <h4 className="text-sm font-bold text-textLight mb-1">No Stored Bookings Yet</h4>
                <p className="text-xs text-muted mb-4">
                  Whenever you book a train, flight, bus or hotel, all tickets will be safely stored right here with live PDF viewing!
                </p>
                <Btn variant="teal" onClick={() => setActiveTab("train")}>
                  Book a Train Ticket Now
                </Btn>
              </Card>
            ) : (
              myBookings.map((b) => (
                <Card key={b.id} className="p-4 border-line hover:border-accent/40 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {b.booking_type === "train" ? "🚆" : b.booking_type === "flight" ? "✈️" : b.booking_type === "bus" ? "🚌" : "🏨"}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-textLight">{b.operator_name}</p>
                        <p className="text-[10px] font-mono text-accent font-bold">PNR: {b.pnr_or_ticket_no}</p>
                      </div>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded uppercase">
                      {b.status}
                    </span>
                  </div>

                  <div className="bg-surf/60 rounded-xl p-2.5 my-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted uppercase font-bold">Origin</p>
                        <p className="font-bold text-textLight">{b.from_location}</p>
                      </div>
                      <span className="text-muted">&#10230;</span>
                      <div className="text-right">
                        <p className="text-[10px] text-muted uppercase font-bold">Destination</p>
                        <p className="font-bold text-textLight">{b.to_location}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-line/40 text-[11px] text-muted">
                      <span>Date: <strong className="text-textLight">{b.departure_date}</strong></span>
                      <span>Class: <strong className="text-accent">{b.travel_class}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[10px] text-muted">Total Paid</p>
                      <p className="text-sm font-mono font-extrabold text-textLight">{fmt(b.amount)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleViewTicket(b)}
                        className="btn bg-card border border-line hover:border-accent text-textLight px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        👁 View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadTicket(b)}
                        className="btn bg-accent text-white shadow-accentGlow hover:brightness-110 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        ⬇ Download
                      </button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* ===================== CHECKOUT & PASSENGER MODAL ===================== */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-card border border-line rounded-3xl shadow-2xl p-5 overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Review & Pay</span>
                <h3 className="text-lg font-extrabold text-textLight">Confirm Booking</h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="w-8 h-8 rounded-full bg-surf flex items-center justify-center text-muted hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Trip Details Card */}
            <div className="bg-surf/90 rounded-2xl p-3.5 border border-line mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-textLight">{selectedBooking.operator}</span>
                <span className="text-xs font-mono font-extrabold text-accent">{fmt(selectedBooking.amount)}</span>
              </div>
              <p className="text-[11px] text-muted">
                {selectedBooking.from} ➔ {selectedBooking.to}
              </p>
              <div className="flex items-center justify-between text-[10px] text-muted mt-2 pt-2 border-t border-line/60">
                <span>Date: <strong className="text-textLight">{selectedBooking.departDate}</strong></span>
                <span>Class: <strong className="text-accent">{selectedBooking.travelClass}</strong></span>
              </div>
            </div>

            {/* Passenger Form */}
            <div className="space-y-3 mb-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-muted block mb-1">Passenger / Guest Full Name</label>
                <input
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Age</label>
                  <input
                    type="number"
                    value={passengerAge}
                    onChange={(e) => setPassengerAge(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Gender</label>
                  <select
                    value={passengerGender}
                    onChange={(e) => setPassengerGender(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {selectedBooking.type === "train" && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-muted block mb-1">Berth Preference</label>
                  <select
                    value={berthPreference}
                    onChange={(e) => setBerthPreference(e.target.value)}
                    className="w-full bg-surf border border-line rounded-xl px-3 py-2 text-xs text-textLight font-semibold outline-none focus:border-accent"
                  >
                    <option value="Lower Berth">Lower Berth</option>
                    <option value="Middle Berth">Middle Berth</option>
                    <option value="Upper Berth">Upper Berth</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                    <option value="No Preference">No Preference</option>
                  </select>
                </div>
              )}
            </div>

            {bookingError && <p className="text-danger text-xs font-semibold mb-3">{bookingError}</p>}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Btn variant="dark" onClick={() => setSelectedBooking(null)} className="flex-1 py-2.5 text-xs font-semibold">
                Cancel
              </Btn>
              <Btn
                variant="teal"
                onClick={() => {
                  if (!passengerName.trim()) {
                    setBookingError("Please enter passenger/guest full name");
                    return;
                  }
                  setBookingError("");
                  setShowPaymentModal(true);
                }}
                className="flex-1 py-2.5 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                Proceed to Pay ({fmt(selectedBooking.amount)}) →
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PAYMENT METHOD MODAL (NORMAL VS ADVANCE PAY) ===================== */}
      <PaymentMethodModal
        isOpen={showPaymentModal && !!selectedBooking}
        onClose={() => setShowPaymentModal(false)}
        title={`${selectedBooking?.operator || "Ticket"} Booking`}
        subtitle={`${selectedBooking?.from} ➔ ${selectedBooking?.to} • ${selectedBooking?.travelClass}`}
        amount={selectedBooking?.amount || 0}
        recipient={selectedBooking?.operator}
        accountBalance={profile?.account?.balance ?? 0}
        onAddMoney={() => {
          setShowPaymentModal(false);
          setSelectedBooking(null);
          onNavigate?.("addmoney");
        }}
        onConfirm={async (enteredPin, mode) => {
          await handleConfirmBooking(enteredPin, mode);
        }}
        loading={submitting}
        error={bookingError}
      />

      {/* ===================== CONFIRMED TICKET SUCCESS MODAL ===================== */}
      {confirmedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-card border border-line rounded-3xl shadow-2xl p-5 text-center overflow-hidden animate-heartbeat">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-3xl mx-auto mb-3">
              ✓
            </div>
            <h2 className="text-xl font-extrabold text-emerald-400">Booking Confirmed!</h2>
            <p className="text-xs text-muted mt-1">
              Your ticket has been saved to <strong>My Bookings</strong> at the top!
            </p>

            <div className="bg-surf/90 rounded-2xl p-4 border border-line my-4 text-left">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-line">
                <span className="text-[10px] uppercase font-bold text-muted">Booking Reference</span>
                <span className="text-xs font-mono font-extrabold text-accent">{confirmedBooking.pnr_or_ticket_no}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted">Operator</span>
                <span className="text-xs font-bold text-textLight">{confirmedBooking.operator_name}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted">Route</span>
                <span className="text-xs font-semibold text-textLight">{confirmedBooking.from_location} ➔ {confirmedBooking.to_location}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted">Date & Class</span>
                <span className="text-xs font-semibold text-textLight">{confirmedBooking.departure_date} &bull; {confirmedBooking.travel_class}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-line mt-2">
                <span className="text-xs font-bold text-muted">Amount Paid</span>
                <span className="text-sm font-mono font-extrabold text-emerald-400">{fmt(confirmedBooking.amount)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleViewTicket(confirmedBooking)}
                  className="btn flex-1 bg-surf border border-line hover:border-accent text-textLight py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  👁 View Ticket (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTicket(confirmedBooking)}
                  className="btn flex-1 bg-accent text-white shadow-accentGlow hover:brightness-110 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  ⬇ Download (PDF)
                </button>
              </div>

              <div className="flex gap-2 mt-1">
                <Btn
                  variant="dark"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setActiveTab("train");
                  }}
                  className="flex-1 py-2 text-xs font-semibold"
                >
                  🔄 Book Another Ticket
                </Btn>
                <Btn
                  variant="teal"
                  onClick={() => {
                    setConfirmedBooking(null);
                    setActiveTab("bookings");
                  }}
                  className="flex-1 py-2 text-xs font-bold"
                >
                  🎟️ Go to My Bookings
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== PDF PREVIEW MODAL ===================== */}
      <PdfPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        pdfBlob={previewBlob}
        title={previewTitle}
        filename={previewFilename}
        loading={loadingPdf}
      />
    </div>
  );
}
