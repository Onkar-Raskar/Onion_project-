import { AnalyzeResponse } from '../services/api';

export const aggregateReports = (reports: AnalyzeResponse[]) => {
  let total = 0, aCount = 0, cCount = 0, ursCount = 0;
  let allDefects: { fault: string; severity_pct: number }[] = [];
  let allDetections: any[] = [];

  reports.forEach(r => {
    const t = r.batch_metrics.total_unique_onions;
    total += t;
    aCount += Math.round((parseFloat(r.batch_metrics.grade_a_pct) / 100) * t);
    cCount += Math.round((parseFloat(r.batch_metrics.grade_c_pct) / 100) * t);
    ursCount += Math.round((parseFloat(r.batch_metrics.urs_pct) / 100) * t);
    
    if (r.defect_breakdown) {
      allDefects = allDefects.concat(r.defect_breakdown);
    }
    
    if (r.detections) {
      allDetections = allDetections.concat(r.detections);
    }
  });

  const defectMap: Record<string, { count: number; severitySum: number }> = {};
  allDefects.forEach(d => {
    if (!defectMap[d.fault]) defectMap[d.fault] = { count: 0, severitySum: 0 };
    defectMap[d.fault].count += 1;
    defectMap[d.fault].severitySum += d.severity_pct;
  });

  const finalDefects = Object.keys(defectMap).map(key => ({
    fault: key,
    severity_pct: parseFloat((defectMap[key].severitySum / defectMap[key].count).toFixed(1))
  }));

  let p_a = total > 0 ? (aCount / total) : 0;
  let margin = total > 0 ? (1.96 * Math.sqrt((p_a * (1 - p_a)) / total) * 100).toFixed(2) : '0.00';

  // Derived metrics for UI
  const grade_a_pct = total > 0 ? ((aCount / total) * 100) : 0;
  const grade_c_pct = total > 0 ? ((cCount / total) * 100) : 0;
  const urs_pct = total > 0 ? ((ursCount / total) * 100) : 0;
  
  const uniformity = Math.max(grade_a_pct, grade_c_pct).toFixed(1);
  const integrity_score = (100 - urs_pct).toFixed(1);

  return {
    batch_metrics: {
      total_unique_onions: total,
      grade_a_pct: grade_a_pct.toFixed(1),
      grade_c_pct: grade_c_pct.toFixed(1),
      urs_pct: urs_pct.toFixed(1),
      confidence_interval_95: `+/- ${margin}%`,
      uniformity: `${uniformity}%`,
      integrity_score: `${integrity_score}/100`
    },
    defect_breakdown: finalDefects,
    detections: allDetections,
  };
};
