/**
 * Safely aggregates multiple AI JSON responses from 3-layer sampling sequence into 1 master report
 */
export const aggregateReports = (reports) => {
  if (!reports || reports.length === 0) return null;

  let total = 0;
  let aCount = 0;
  let cCount = 0;
  let ursCount = 0;
  let allDefects = [];

  reports.forEach(r => {
    if (!r || !r.batch_metrics) return;
    const t = Number(r.batch_metrics.total_unique_onions) || 0;
    total += t;
    aCount += Math.round(((Number(r.batch_metrics.grade_a_pct) || 0) / 100) * t);
    cCount += Math.round(((Number(r.batch_metrics.grade_c_pct) || 0) / 100) * t);
    ursCount += Math.round(((Number(r.batch_metrics.urs_pct) || 0) / 100) * t);
    
    if (Array.isArray(r.defect_breakdown)) {
      allDefects = allDefects.concat(r.defect_breakdown);
    }
  });

  const defectMap = {};
  allDefects.forEach(d => {
    if (!d || !d.fault) return;
    if (!defectMap[d.fault]) {
      defectMap[d.fault] = { count: 0, severitySum: 0 };
    }
    defectMap[d.fault].count += 1;
    defectMap[d.fault].severitySum += parseFloat(d.severity_pct || 0);
  });

  const finalDefects = Object.keys(defectMap).map(key => ({
    fault: key,
    severity_pct: Number((defectMap[key].severitySum / defectMap[key].count).toFixed(1))
  }));

  const p_a = total > 0 ? (aCount / total) : 0;
  const margin = total > 0 ? (1.96 * Math.sqrt((p_a * (1 - p_a)) / total) * 100).toFixed(2) : "0.00";

  return {
    batch_metrics: {
      total_unique_onions: total,
      grade_a_pct: total > 0 ? ((aCount / total) * 100).toFixed(1) : "0.0",
      grade_c_pct: total > 0 ? ((cCount / total) * 100).toFixed(1) : "0.0",
      urs_pct: total > 0 ? ((ursCount / total) * 100).toFixed(1) : "0.0",
      confidence_interval_95: `±${margin}%`
    },
    defect_breakdown: finalDefects
  };
};

/**
 * Generates mock analysis report for demo mode or local offline testing
 */
export const generateMockReport = (ppm = 2.4, minPremiumMm = 65) => {
  const totalOnions = Math.floor(Math.random() * 15) + 20; // 20-35 onions
  // Grade A depends somewhat on minPremiumMm threshold
  const baselinePremiumRatio = Math.max(0.1, Math.min(0.85, 0.65 - (minPremiumMm - 65) * 0.015));
  const gradeACount = Math.round(totalOnions * baselinePremiumRatio);
  const ursCount = Math.round(totalOnions * 0.08); // 8% defect
  const gradeCCount = totalOnions - gradeACount - ursCount;

  const aPct = ((gradeACount / totalOnions) * 100).toFixed(1);
  const cPct = ((gradeCCount / totalOnions) * 100).toFixed(1);
  const ursPct = ((ursCount / totalOnions) * 100).toFixed(1);
  const p_a = gradeACount / totalOnions;
  const margin = (1.96 * Math.sqrt((p_a * (1 - p_a)) / totalOnions) * 100).toFixed(2);

  return {
    batch_metrics: {
      total_unique_onions: totalOnions,
      grade_a_pct: aPct,
      grade_c_pct: cPct,
      urs_pct: ursPct,
      confidence_interval_95: `±${margin}%`
    },
    defect_breakdown: [
      { fault: "Sprouting", severity_pct: (Math.random() * 5 + 2).toFixed(1) },
      { fault: "Cracked / Mechanical Damage", severity_pct: (Math.random() * 6 + 4).toFixed(1) }
    ]
  };
};
