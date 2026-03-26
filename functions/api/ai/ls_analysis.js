const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
    const base = 'https://fapi.binance.com/futures/data';

    const results = await Promise.all([
      fetch(`${base}/openInterestHist?symbol=${symbol}&period=5m&limit=30`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${base}/topLongShortAccountRatio?symbol=${symbol}&period=5m&limit=30`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${base}/topLongShortPositionRatio?symbol=${symbol}&period=5m&limit=30`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${base}/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=30`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${base}/takerlongshortRatio?symbol=${symbol}&period=5m&limit=30`).then(r=>r.ok?r.json():[]).catch(()=>[]),
      fetch(`${base}/basis?symbol=${symbol}&period=5m&limit=30&contractType=PERPETUAL`).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]);
    const [oi, topAcc, topPos, globalLS, taker, basis] = results;

    const sf = (arr, key, idx) => { try { return parseFloat(arr[idx === undefined ? arr.length - 1 : idx][key]) || 0; } catch { return 0; } };

    const oiLast = sf(oi, 'sumOpenInterestValue');
    const oiFirst = sf(oi, 'sumOpenInterestValue', 0);
    const oiChg = oiFirst ? ((oiLast / oiFirst - 1) * 100) : 0;
    const topAccR = sf(topAcc, 'longShortRatio'), topAccL = sf(topAcc, 'longAccount') * 100;
    const topPosR = sf(topPos, 'longShortRatio'), topPosL = sf(topPos, 'longAccount') * 100;
    const globalR = sf(globalLS, 'longShortRatio'), globalL = sf(globalLS, 'longAccount') * 100;
    const takerR = sf(taker, 'buySellRatio');
    const basisRate = sf(basis, 'basisRate') * 100;

    const bull = [topAccR > 1, topPosR > 1, globalR > 1, takerR > 1, oiChg > 0, basisRate > 0].filter(Boolean).length;
    let bias, biasColor, biasIcon;
    if (bull >= 4) { bias = '偏多'; biasColor = 'var(--gain)'; biasIcon = '🟢'; }
    else if (bull <= 2) { bias = '偏空'; biasColor = 'var(--loss)'; biasIcon = '🔴'; }
    else { bias = '多空均衡'; biasColor = 'var(--text-muted)'; biasIcon = '🟡'; }

    const fV = v => { const a = Math.abs(v); if (a >= 1e9) return (v/1e9).toFixed(2)+'B'; if (a >= 1e6) return (v/1e6).toFixed(2)+'M'; return v.toLocaleString('en-US',{maximumFractionDigits:0}); };
    const clr = (v, t=0) => v > t ? 'var(--gain)' : (v < t ? 'var(--loss)' : 'var(--text-muted)');
    const rd = r => r > 1.5 ? '多头占绝对优势' : r > 1.1 ? '多头略占上风' : r > 0.9 ? '多空势均力敌' : r > 0.7 ? '空头略占上风' : '空头占绝对优势';

    const anomalies = [];
    if (Math.abs(oiChg) > 3) anomalies.push(`持仓量短时${oiChg>0?'暴增':'骤降'} ${Math.abs(oiChg).toFixed(1)}%`);
    if (topAccR > 1.5 || topAccR < 0.67) anomalies.push(`大户账户多空比 ${topAccR.toFixed(3)} 极端值`);
    if (Math.abs(takerR-1) > 0.15) anomalies.push(`主动买卖比 ${takerR.toFixed(3)} 偏离均衡`);
    if (Math.abs(basisRate) > 0.05) anomalies.push(`基差率 ${basisRate.toFixed(4)}% 显著偏离`);
    if (topAccR > 1 && topPosR < 1) anomalies.push('大户账户看多但持仓看空，存在对冲或诱多迹象');
    const anomalyHtml = anomalies.length ? anomalies.map(a=>`<div style="margin:3px 0;">⚡ ${a}</div>`).join('') : '<div style="color:var(--text-muted);">当前无明显异常信号</div>';

    let advice;
    if (bull >= 5) advice = '大户与散户均偏多，持仓增加，建议顺势做多，回调至支撑位可加仓。';
    else if (bull <= 1) advice = '多项指标偏空，建议谨慎持仓或轻仓做空。关注持仓量变化。';
    else advice = '多空信号交织，建议观望为主。若入场控制仓位在20%以内，严格止损。';

    const html = `
    <div style="margin-bottom:16px;"><div style="font-size:18px;font-weight:700;color:${biasColor};margin-bottom:8px;">${biasIcon} 综合研判：${bias} (${bull}/6 项看多)</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">📊 持仓量分析</strong><br><div style="color:var(--text-secondary);margin-top:4px;">持仓总价值 <span style="color:var(--text-primary);font-weight:600;">$${fV(oiLast)}</span>，2.5h 内<span style="color:${clr(oiChg)};font-weight:600;">${oiChg>0?'增仓':'减仓'} ${oiChg>=0?'+':''}${oiChg.toFixed(2)}%</span>。${oiChg>0?'资金持续流入，利于趋势延续。':'资金退出，短线波动可能加剧。'}</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">🐋 大户动向</strong><br><div style="color:var(--text-secondary);margin-top:4px;">账户多空比 <span style="color:${clr(topAccR,1)};font-weight:600;">${topAccR.toFixed(3)}</span>（多 ${topAccL.toFixed(1)}%），${rd(topAccR)}。<br>持仓多空比 <span style="color:${clr(topPosR,1)};font-weight:600;">${topPosR.toFixed(3)}</span>（多 ${topPosL.toFixed(1)}%），${rd(topPosR)}。</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">👥 散户情绪</strong><br><div style="color:var(--text-secondary);margin-top:4px;">全市场多空人数比 <span style="color:${clr(globalR,1)};font-weight:600;">${globalR.toFixed(3)}</span>（多 ${globalL.toFixed(1)}%），${rd(globalR)}。${globalR>1.2?'散户偏多，需警惕反向收割。':(globalR<0.8?'散户偏空，逆向指标显示可能见底。':'散户情绪中性。')}</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">💥 主动买卖</strong><br><div style="color:var(--text-secondary);margin-top:4px;">买卖比 <span style="color:${clr(takerR,1)};font-weight:600;">${takerR.toFixed(3)}</span>，${takerR>1?'主动买入力量较强':'主动卖出力量较强'}。</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">📐 基差信号</strong><br><div style="color:var(--text-secondary);margin-top:4px;">基差率 <span style="color:${clr(basisRate)};font-weight:600;">${basisRate.toFixed(4)}%</span>，${basisRate>0?'正溢价（看涨预期）':'负溢价（看跌预期）'}。</div></div>
    <div style="margin-bottom:14px;"><strong style="color:var(--text-primary);">⚠️ 异常信号</strong><br><div style="color:var(--text-secondary);margin-top:4px;">${anomalyHtml}</div></div>
    <div style="padding:10px;background:var(--bg-hover);border-radius:8px;border:1px solid var(--border-color);"><strong style="color:var(--text-primary);">📌 操作建议</strong><br><div style="color:var(--text-secondary);margin-top:4px;">${advice}</div></div>`;

    return new Response(JSON.stringify({ analysis: html }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ analysis: '数据获取失败，请稍后重试。' }), { headers: CORS, status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } });
}
