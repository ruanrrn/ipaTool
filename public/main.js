const state={accounts:[]};
const $=s=>document.querySelector(s);
const log=(m)=>{ const el=$('#log'); el.textContent += `${m}\n`; el.scrollTop = el.scrollHeight; };
const setStage=(t)=>$('#progressStage').textContent=t;
const setPct=(n)=>{ $('#progressPct').textContent=`${n}%`; $('#progressInner').style.width=`${n}%`; };

$('#toggleDark').addEventListener('click',()=>{ const d=document.documentElement.classList.toggle('dark'); log(`[主题] 切换为 ${d?'暗色':'浅色'}`); });

$('#loginForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); const f=e.target;
  const email=f.email.value.trim(); const password=f.password.value; const code=f.code.value.trim()||undefined;
  log(`[登录] 正在登录 ${email}...`);
  const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,code})}).then(r=>r.json()).catch(err=>({ok:false,error:err.message}));
  if(!r.ok) return log(`[登录] 失败：${r.error||'未知错误'}`);
  state.accounts.push({ token:r.token, email:r.email, dsid:r.dsid }); renderAccounts(); log(`[登录] 成功：${email}`);
});

function renderAccounts(){ const list=$('#accountList'); const sel=$('#tokenSelect'); list.innerHTML=''; sel.innerHTML='<option value="">请选择登录账号</option>'; for(const a of state.accounts){ const li=document.createElement('li'); li.textContent=`${a.email} (dsid=${a.dsid})`; list.appendChild(li); const opt=document.createElement('option'); opt.value=a.token; opt.textContent=a.email; sel.appendChild(opt);} }

$('#btnFetch').addEventListener('click', async ()=>{
  const appid=$('#appid').value.trim(); if(!appid) return log('[查询] 请填写 APPID');
  log(`[查询] 正在查询 APPID=${appid} 的历史版本...`);
  const r=await fetch(`/api/versions?appid=${encodeURIComponent(appid)}`).then(r=>r.json()).catch(err=>({ok:false,error:err.message}));
  if(!r.ok) return log(`[查询] 失败：${r.error||'未知错误'}`);
  const sel=$('#versionSelect'); sel.innerHTML='';
  for(const it of r.data){ const opt=document.createElement('option'); opt.value=String(it.external_identifier); opt.textContent=`${it.bundle_version} | ${it.created_at}`; sel.appendChild(opt); }
  log(`[查询] 获取到 ${r.data.length} 条版本记录`);
  sel.onchange=()=>{ $('#appVerId').value = sel.value || ''; };
});

$('#btnDirectLink').addEventListener('click', async ()=>{
  const token=$('#tokenSelect').value; const appid=$('#appid').value.trim(); const appVerId=$('#appVerId').value.trim();
  if(!token) return log('[直链] 请选择登录账号'); if(!appid) return log('[直链] 请填写 APPID');
  log('[直链] 获取直链中…');
  const r=await fetch(`/api/download-url?token=${encodeURIComponent(token)}&appid=${encodeURIComponent(appid)}${appVerId?`&appVerId=${encodeURIComponent(appVerId)}`:''}`).then(r=>r.json()).catch(err=>({ok:false,error:err.message}));
  if(!r.ok) return log(`[直链] 失败：${r.error||'未知错误'}`);
  log(`[直链] 成功：文件名=${r.fileName}，即将从 Apple CDN 直连下载`);
  log(`[直链] URL（部分）=${String(r.url).slice(0,80)}...`);
  const a=document.createElement('a'); a.href=r.url; a.download=r.fileName||''; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
});

$('#btnServerProgress').addEventListener('click', async ()=>{
  const token=$('#tokenSelect').value; const appid=$('#appid').value.trim(); const appVerId=$('#appVerId').value.trim();
  if(!token) return log('[进度] 请选择登录账号'); if(!appid) return log('[进度] 请填写 APPID');
  const r=await fetch('/api/start-download-direct',{ method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ token, appid, appVerId: appVerId||undefined }) }).then(r=>r.json()).catch(err=>({ok:false,error:err.message}));
  if(!r.ok) return log(`[进度] 创建任务失败：${r.error||'未知错误'}`);
  const { jobId } = r; log(`[进度] 任务已创建：${jobId}`); setStage('准备中…'); setPct(0);

  const es = new EventSource(`/api/progress-sse?jobId=${encodeURIComponent(jobId)}`);
  es.addEventListener('progress', (ev)=>{
    try{
      const data=JSON.parse(ev.data);
      if(data?.progress?.percent!=null) setPct(data.progress.percent);
      if(data?.progress?.stage){ const map={ 'auth':'获取下载信息','download-start':'开始下载','download-progress':'下载中','merge':'合并分块','sign':'写入签名','done':'完成' }; setStage(map[data.progress.stage]||data.progress.stage); }
      if(data?.error){ log(`[错误] ${data.error}`); }
      if(data.status==='ready'){
        setStage('准备下载文件…');
        const a=document.createElement('a'); a.href=`/api/download-file?jobId=${encodeURIComponent(jobId)}`; a.rel='noopener'; document.body.appendChild(a); a.click(); a.remove();
        setPct(100); setStage('已开始下载');
      }
    }catch(e){ console.error(e); }
  });
  es.addEventListener('log', (ev)=>{ try{ const { line } = JSON.parse(ev.data); if(line) log(line); }catch(_){} });
  es.addEventListener('end', (ev)=>{ try{ const data=JSON.parse(ev.data||'{}'); if(data.status==='ready'){ log('[end] 任务已就绪'); } else if(data.status==='failed'){ log('[end] 任务失败'); } else { log(`[end] 任务结束：${data.status||'unknown'}`); } }catch(_){ } es.close(); });
});
