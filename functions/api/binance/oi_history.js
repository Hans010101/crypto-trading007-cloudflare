const CORS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestGet({ request }) {
    try {
        const url = new URL(request.url);
        const symbol = url.searchParams.get('symbol') || 'BTCUSDT';
        const period = url.searchParams.get('period') || '5m';
        const limit = url.searchParams.get('limit') || '30';
        const res = await fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=${period}&limit=${limit}`);
        const data = await res.json();
        return new Response(JSON.stringify(Array.isArray(data) ? data : []), { headers: CORS });
    } catch (e) {
        return new Response(JSON.stringify([]), { headers: CORS, status: 500 });
    }
}
export async function onRequestOptions() { return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET,OPTIONS' } }); }
