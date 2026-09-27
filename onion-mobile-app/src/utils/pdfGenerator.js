import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export const generateAndShareQualityPDF = async ({ report, disputeData, disputeNotes, lang = 'en', threshold = 65 }) => {
  if (!report || !report.batch_metrics) {
    throw new Error("No report metrics available to generate certificate.");
  }

  const batchId = `ONION-LOT-${Date.now()}`;
  const timestamp = new Date().toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const originalString = `${batchId}|A:${report.batch_metrics.grade_a_pct}|C:${report.batch_metrics.grade_c_pct}|URS:${report.batch_metrics.urs_pct}`;
  const originalHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, originalString);

  let disputeHash = null;
  if (disputeData) {
    const disputeString = `${batchId}|A:${disputeData.grade_a_pct}|C:${disputeData.grade_c_pct}|URS:${disputeData.urs_pct}|Notes:${disputeNotes || ''}`;
    disputeHash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, disputeString);
  }

  const finalRate = disputeData ? disputeData.grade_a_pct : report.batch_metrics.grade_a_pct;

  const defectRows = (report.defect_breakdown && report.defect_breakdown.length > 0)
    ? report.defect_breakdown.map(d => `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E8E3DC; color: #1F2421;">${d.fault}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #E8E3DC; text-align: right; color: #DC2626; font-weight: 600;">${d.severity_pct}% Area</td>
        </tr>
      `).join('')
    : `<tr><td colspan="2" style="padding: 12px; color: #5C646D; text-align: center;">No significant surface defect detected</td></tr>`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Mandi Quality Certificate - ${batchId}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #FFFFFF;
            color: #1F2421;
            margin: 0;
            padding: 36px 40px;
          }
          .header {
            border-bottom: 3px solid #8D2644;
            padding-bottom: 18px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .title {
            color: #8D2644;
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .subtitle {
            color: #5C646D;
            margin-top: 4px;
            font-size: 13px;
          }
          .badge {
            background-color: #FDF2F4;
            color: #8D2644;
            padding: 6px 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 12px;
            border: 1px solid #F3C5D0;
          }
          .info-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background-color: #FBF9F6;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #E8E3DC;
          }
          .info-table td {
            padding: 10px 16px;
            font-size: 14px;
          }
          .section-card {
            background-color: #FFFFFF;
            border: 1px solid #E8E3DC;
            border-radius: 10px;
            padding: 18px 20px;
            margin-bottom: 20px;
          }
          .section-title {
            margin: 0 0 14px 0;
            font-size: 16px;
            font-weight: bold;
            color: #1F2421;
            border-bottom: 1px solid #E8E3DC;
            padding-bottom: 8px;
          }
          .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 15px;
          }
          .metric-val {
            font-weight: bold;
            font-size: 16px;
          }
          .val-a { color: #2E7D32; }
          .val-c { color: #D97706; }
          .val-urs { color: #DC2626; }
          .hash-box {
            margin-top: 12px;
            font-size: 10px;
            font-family: monospace;
            background: #F4EFEA;
            padding: 8px 12px;
            border-radius: 6px;
            word-break: break-all;
            color: #5C646D;
          }
          .dispute-box {
            background-color: #FFFBEB;
            border: 1px solid #FDE68A;
            border-radius: 10px;
            padding: 18px 20px;
            margin-bottom: 20px;
          }
          .settlement-card {
            background-color: #EBF7EE;
            border: 2px solid #2E7D32;
            border-radius: 10px;
            padding: 18px 20px;
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            color: #2E7D32;
            margin-top: 24px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 11px;
            color: #8B95A0;
            border-top: 1px solid #E8E3DC;
            padding-top: 14px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">आधिकारिक गुणवत्ता प्रमाण पत्र / Quality Certificate</div>
            <div class="subtitle">Agricultural Mandi Computer Vision Automated Grading Division</div>
          </div>
          <div class="badge">VERIFIED LOT</div>
        </div>

        <table class="info-table">
          <tr>
            <td style="font-weight: bold; width: 40%;">Lot / Batch ID:</td>
            <td style="font-family: monospace; font-weight: bold;">${batchId}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Timestamp:</td>
            <td>${timestamp}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Total Unique Onions Analyzed:</td>
            <td style="font-weight: bold;">${report.batch_metrics.total_unique_onions} units</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Statistical Margin (95% CI):</td>
            <td>${report.batch_metrics.confidence_interval_95}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Grade A Calibrated Threshold:</td>
            <td>Diameter ≥ ${threshold} mm</td>
          </tr>
        </table>

        <div class="section-card">
          <div class="section-title">Grading Breakdown (प्राथमिक वर्गीकरण)</div>
          <div class="metric-row">
            <span><strong>Premium (Grade A / निर्यात गुणवत्ता):</strong></span>
            <span class="metric-val val-a">${report.batch_metrics.grade_a_pct}%</span>
          </div>
          <div class="metric-row">
            <span><strong>Undersized (Grade C / छोटा प्याज):</strong></span>
            <span class="metric-val val-c">${report.batch_metrics.grade_c_pct}%</span>
          </div>
          <div class="metric-row">
            <span><strong>Rejected (URS / सड़ा-गला):</strong></span>
            <span class="metric-val val-urs">${report.batch_metrics.urs_pct}%</span>
          </div>
          <div class="hash-box">
            <strong>Original SHA-256 Hash:</strong> ${originalHash}
          </div>
        </div>

        ${disputeData ? `
          <div class="dispute-box">
            <div class="section-title" style="color: #D97706; border-color: #FDE68A;">
              ⚠️ DISPUTED & REASSESSED (विवाद निवारण एवं पुनर्मूल्यांकन)
            </div>
            <p style="font-size: 13px; margin: 4px 0 12px 0;"><strong>Contestation Reason:</strong> ${disputeNotes || 'Secondary lot verification requested by farmer/trader.'}</p>
            <div class="metric-row">
              <span><strong>New Premium (Grade A):</strong></span>
              <span class="metric-val val-a">${disputeData.grade_a_pct}%</span>
            </div>
            <div class="metric-row">
              <span><strong>New Undersized (Grade C):</strong></span>
              <span class="metric-val val-c">${disputeData.grade_c_pct}%</span>
            </div>
            <div class="metric-row">
              <span><strong>New Rejected (URS):</strong></span>
              <span class="metric-val val-urs">${disputeData.urs_pct}%</span>
            </div>
            <div class="hash-box" style="background: #FEF3C7;">
              <strong>Reassessment SHA-256 Hash:</strong> ${disputeHash}
            </div>
          </div>
        ` : ''}

        <div class="section-card">
          <div class="section-title">Surface Defect Diagnostics (दोष विवरण)</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            ${defectRows}
          </table>
        </div>

        <div class="settlement-card">
          FINAL SETTLEMENT RATE: ${finalRate}% (Grade A / प्रीमियम)
        </div>

        <div class="footer">
          Generated automatically by Onion Grader AI Mobile System • Cryptographically secured with SHA-256 • SIH PS-31 Automated Procurement
        </div>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html: htmlContent });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  }

  return { uri, batchId, originalHash };
};
