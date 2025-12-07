export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = url.searchParams.get('room') || 'lobby';

    // 登录
    if (url.pathname === '/api/login') {
      const { pin } = await request.json();
      return new Response(
        JSON.stringify({ ok: pin === env.PASSWORD }),
        { headers: { 'content-type': 'application/json' }}
      );
    }

    // 历史记录
    if (url.pathname === '/api/history') {
      const data = await env.CHAT_HISTORY.get('room:' + room, { type:'json' }) || [];
      return new Response(JSON.stringify(data), { headers:{'content-type':'application/json'} });
    }

    // 清空
    if (url.pathname === '/api/clear') {
      await env.CHAT_HISTORY.put('room:' + room, JSON.stringify([]));
      return new Response(JSON.stringify({ ok:true }), { headers:{'content-type':'application/json'} });
    }

    // WebSocket
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const ws = pair[1];
      ws.accept();

      ws.addEventListener('message', async (evt)=>{
        const msg = evt.data;
        const key = 'room:' + room;
        const history = (await env.CHAT_HISTORY.get(key,{type:'json'})) || [];

        history.push({ text: msg, ts: Date.now() });
        await env.CHAT_HISTORY.put(key, JSON.stringify(history));

        try { ws.send(msg); } catch(_) {}
      });

      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // 前端页面
    return new Response(renderHTML(room), {
      headers:{'content-type':'text/html'}
    });
  }
};


function renderHTML(room){
return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8"/>
<title>Chat Room - ${room}</title>

<!-- Material 3 Components -->
<script type="module" src="https://esm.run/@material/web/all.js"></script>

<style>
body{
  font-family: Roboto, Arial, sans-serif;
  margin: 0;
  padding: 24px;
  background: #f3f4f6;
  display: flex;
  justify-content: center;
}
.container{
  width: 420px;
}
.card{
  padding: 24px;
  border-radius: 20px;
  background: white;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}
#messages{
  height: 300px;
  overflow-y: auto;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #ddd;
  border-radius: 12px;
  margin-bottom: 16px;
}
.message{
  background: #e7eefc;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 6px;
  width: fit-content;
  max-width: 80%;
}
</style>
</head>
<body>
<div class="container">
  <h2>Room: ${room}</h2>

  <div class="card">

    <!-- 登录面板 -->
    <div id="loginPanel">
      <p>请输入 PIN 登录：</p>
      <md-outlined-text-field id="pin" label="PIN" type="password"></md-outlined-text-field>
      <br><br>
      <md-filled-button onclick="login()">进入</md-filled-button>
    </div>

    <!-- 聊天面板 -->
    <div id="chatPanel" style="display:none;">
      <div id="messages"></div>

      <md-outlined-text-field id="input" label="消息"></md-outlined-text-field>
      <br><br>

      <md-filled-button onclick="sendMsg()">发送</md-filled-button>
      <md-filled-button onclick="clearHistory()">清空历史</md-filled-button>
    </div>

  </div>
</div>

<script>
let ws;
let ROOM = "${room}";

function login(){
  const pin = document.getElementById('pin').value.trim();
  fetch('/api/login', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({pin})
  })
  .then(r=>r.json())
  .then(x=>{
    if(x.ok){
      document.getElementById('loginPanel').style.display='none';
      document.getElementById('chatPanel').style.display='block';
      startChat();
    }else alert('错误 PIN');
  });
}

function startChat(){
  fetch('/api/history?room='+ROOM)
  .then(r=>r.json())
  .then(list=>{
    const box = document.getElementById('messages');
    for(const m of list){
      box.innerHTML += '<div class="message">'+m.text+'</div>';
    }
    box.scrollTop = box.scrollHeight;
  });

  ws = new WebSocket('wss://'+location.host+'?room='+ROOM);
  ws.onmessage = function(e){
    const box = document.getElementById('messages');
    box.innerHTML += '<div class="message">'+e.data+'</div>';
    box.scrollTop = box.scrollHeight;
  };
}

function sendMsg(){
  const i = document.getElementById('input');
  if(i.value.trim()){
    ws.send(i.value);
    i.value = '';
  }
}

function clearHistory(){
  fetch('/api/clear?room='+ROOM,{method:'POST'})
  .then(r=>r.json())
  .then(res=>{
    if(res.ok){
      document.getElementById('messages').innerHTML='';
      alert('历史已清空');
    }
  });
}
</script>

</body>
</html>`;
}
