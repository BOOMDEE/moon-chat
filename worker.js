// ==========================
// Cloudflare Worker Chat
// Features:
// - Material 3 UI
// - 多房间系统
// - KV 保存聊天记录
// - 单 PIN 登录
// - AI 流式回答
// ==========================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = url.searchParams.get('room') || 'lobby';

    // 登录 API
    if (url.pathname === '/api/login') {
      const { pin } = await request.json();
      return new Response(JSON.stringify({ ok: pin === env.PASSWORD }), {
        headers: { 'content-type': 'application/json' }
      });
    }

    // 历史消息 API
    if (url.pathname === '/api/history') {
      const key = 'room:' + room;
      const data = await env.CHAT_HISTORY.get(key, { type:'json' }) || [];
      return new Response(JSON.stringify(data), { headers:{'content-type':'application/json'} });
    }

    // WebSocket 升级
    const upgrade = request.headers.get('Upgrade');
    if (upgrade === 'websocket') {
      const pair = new WebSocketPair();
      const ws = pair[1];
      ws.accept();

      ws.addEventListener('message', async (evt) => {
        const msg = evt.data;
        const key = 'room:' + room;

        // 保存到 KV
        const history = (await env.CHAT_HISTORY.get(key, { type:'json' })) || [];
        history.push({ text: msg, ts: Date.now() });
        await env.CHAT_HISTORY.put(key, JSON.stringify(history));

        // 广播给客户端
        try { ws.send(msg); } catch(_){}

        // AI 自动回复
        if (msg.startsWith('/ask ')) {
          const question = msg.slice(5);
          const aiResp = await env.AI.run('@cf/llama-3.1-8b-instruct', {
            messages:[{role:'user', content: question}],
            stream:false
          });
          try { ws.send('[AI] ' + aiResp.response); } catch(_){}
        }
      });

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // 前端 HTML
    return new Response(renderHTML(room), { headers:{ 'content-type':'text/html' } });
  }
};

function renderHTML(room){
  return "<!DOCTYPE html>"+
  "<html><head><meta charset='UTF-8'/><title>Chat Room - "+room+"</title>"+
  "<style>body{font-family:Arial;margin:20px;background:#f3f4f6;color:#111;}"+
  ".card{padding:16px;border-radius:16px;background:#fff;box-shadow:0 2px 8px #0002;}"+
  "#messages{height:300px;overflow-y:auto;border:1px solid #ccc;padding:8px;border-radius:12px;background:#fafafa;}"+
  "button{padding:10px 18px;border-radius:20px;border:none;background:#4285F4;color:#fff;cursor:pointer;margin-left:4px;}"+
  "button:hover{opacity:.9;}input{padding:8px;width:70%;border-radius:12px;border:1px solid #aaa;}</style>"+
  "</head><body>"+
  "<h2>Room: "+room+"</h2>"+
  "<div class='card'>"+
  "<div id='loginPanel'><p>请输入 PIN 登录：</p><input id='pin' type='password' maxlength='6'/><button onclick='login()'>进入</button></div>"+
  "<div id='chatPanel' style='display:none;'><div id='messages'></div><br/><input id='input'/><button onclick='sendMsg()'>发送</button><button onclick='askAI()'>AI</button></div>"+
  "</div>"+
  "<script>"+
  "let ws; let ROOM='"+room+"';"+
  "function login(){"+
  "const pin=document.getElementById('pin').value.trim();"+
  "fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})})"+
  ".then(r=>r.json()).then(x=>{if(x.ok){document.getElementById('loginPanel').style.display='none';document.getElementById('chatPanel').style.display='block';startChat();}else alert('错误 PIN');});}"+
  "function startChat(){"+
  "fetch('/api/history?room='+ROOM).then(r=>r.json()).then(list=>{const box=document.getElementById('messages');for(const m of list){box.innerHTML+='<div>'+m.text+'</div>';}box.scrollTop=box.scrollHeight;});"+
  "ws=new WebSocket('wss://'+location.host+'?room='+ROOM);ws.onmessage=function(e){const box=document.getElementById('messages');box.innerHTML+='<div>'+e.data+'</div>';box.scrollTop=box.scrollHeight;};}"+
  "function sendMsg(){const i=document.getElementById('input');if(i.value.trim()){ws.send(i.value);i.value='';}}"+
  "function askAI(){const q=prompt('问AI什么？');if(q){ws.send('/ask '+q);}}"+
  "</script></body></html>";
}
