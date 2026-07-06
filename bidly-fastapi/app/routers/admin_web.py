"""Panel de administración INTERNO de Bidly, servido como WEB desde el backend.

No es parte de la app móvil: el usuario carga sus bienes desde la app y acá, desde
el navegador, la empresa les da el alta (inspecciona, tasa y los aprueba), admite
postores y corre las subastas. Se sirve en GET /admin.
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

PAGE = r"""<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bidly — Panel interno</title>
<style>
  :root{
    --bg:#0b1022; --bg2:#0e142a; --card:#151b33; --cardEl:#1b2340; --border:#2a3556;
    --blue:#4b9fe6; --blueDark:#2f7fc4; --green:#37d66f; --gold:#e6b23a; --red:#e2504f;
    --muted:#8b94ad; --txt:#eef2ff; --shadow:0 2px 10px rgba(0,0,0,.28);
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.45}
  header{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:6}
  header h1{font-size:20px;margin:0;color:var(--blue);letter-spacing:.5px;font-weight:900}
  .tag{font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:999px;color:#fff;letter-spacing:.4px}
  nav{display:flex;gap:8px;padding:12px 24px;border-bottom:1px solid var(--border);flex-wrap:wrap}
  nav button{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:999px;cursor:pointer;font-weight:700;font-size:13px;transition:.15s}
  nav button:hover{color:var(--txt);border-color:var(--blue)}
  nav button.active{background:var(--blue);color:#fff;border-color:var(--blue)}
  main{padding:22px 24px 60px;max-width:960px;margin:0 auto}
  .card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:var(--shadow)}
  .card.tool{background:var(--bg2);border-color:var(--blueDark)}
  .row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
  .muted{color:var(--muted);font-size:12.5px}
  .title{font-weight:800;font-size:15.5px;letter-spacing:.2px}
  input,select{background:var(--cardEl);border:1px solid var(--border);color:var(--txt);border-radius:9px;padding:10px 12px;font-size:13.5px;width:100%;margin:5px 0;transition:.15s;outline:none}
  input::placeholder{color:var(--muted)}
  input:focus,select:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(75,159,230,.18)}
  button.act{border:none;border-radius:9px;padding:10px 14px;font-weight:800;cursor:pointer;color:#fff;font-size:13px;transition:.15s;margin-top:2px}
  button.act:hover{filter:brightness(1.08)}
  button.act:disabled{opacity:.4;cursor:not-allowed;filter:none}
  .b-blue{background:var(--blue)} .b-green{background:var(--green);color:#04220f} .b-red{background:var(--red)} .b-ghost{background:transparent;border:1px solid var(--border);color:var(--txt)}
  .b-ghost:hover{border-color:var(--blue)}
  .st{font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:999px;color:#fff;white-space:nowrap;letter-spacing:.3px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .colitem{display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid var(--border);border-radius:9px;margin:6px 0;background:var(--card)}
  .colitem input[type=checkbox]{width:auto;margin:0;flex:0 0 auto;cursor:pointer}
  .colitem-name{flex:1;font-size:13px}
  .colitem-base{max-width:120px;margin:0}
  .toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:12px;font-weight:700;z-index:20;display:none;box-shadow:0 6px 24px rgba(0,0,0,.4)}
  .hint{color:var(--muted);font-size:12.5px;line-height:1.55;margin:0 0 14px}
  .refresh{color:var(--blue);cursor:pointer;font-weight:700;font-size:13px;background:none;border:none;float:right}
  .refresh:hover{text-decoration:underline}
  a{color:var(--blue)}
  .sec{font-size:12px;font-weight:800;letter-spacing:1.2px;color:var(--muted);margin:20px 2px 10px;text-transform:uppercase;display:flex;align-items:center;gap:8px}
  .sec .cnt{background:var(--cardEl);border:1px solid var(--border);border-radius:999px;padding:1px 9px;font-size:11px;color:var(--txt)}
  .chipst{font-size:10px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
  .pulse{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-right:6px;animation:pu 1.2s infinite}
  @keyframes pu{0%{opacity:1}50%{opacity:.25}100%{opacity:1}}
  .itemrow{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 10px;border:1px solid var(--border);border-radius:9px;margin-top:6px;background:var(--bg2)}
</style></head>
<body>
<header>
  <h1>BIDLY</h1><span class="tag" style="background:var(--blue)">PANEL INTERNO · WEB</span>
</header>
<nav>
  <button id="t-adm" class="active" onclick="show('adm')">Admisiones</button>
  <button id="t-pos" onclick="show('pos')">Postores</button>
  <button id="t-sub" onclick="show('sub')">Subastas</button>
  <button id="t-chq" onclick="show('chq')">Cheques</button>
  <button id="t-reem" onclick="show('reem')">Reembolsos</button>
  <button id="t-mul" onclick="show('mul')">Multas</button>
</nav>
<main>
  <section id="s-adm">
    <p class="hint">Solicitudes de los usuarios. Pedí la inspección, rechazá con motivo, o aceptá proponiendo
      valor base + comisión y asignando a una subasta (el dueño confirma desde la app).
      <button class="refresh" onclick="loadAdm()">↻ Actualizar</button></p>
    <div class="card tool">
      <div class="title" style="margin-bottom:6px">🧩 Armar catálogo</div>
      <p class="muted" style="margin:0 0 10px">Marcá bienes del <b>mismo dueño</b> (puede ser <b>1 solo</b>), poné la base de cada uno, un nombre y la subasta.
        Cada pieza conserva su base y el total es la suma. Sirve también para meter un producto <b>«sin asignar»</b> a una subasta.</p>
      <div class="grid2">
        <input id="col-nombre" placeholder="Nombre del catálogo (ej: Colección Pérez)">
        <select id="col-sub" onchange="colSubChange()"></select>
      </div>
      <div id="col-nueva" style="display:none;border:1px dashed var(--blueDark);border-radius:9px;padding:10px;margin-top:4px">
        <div class="muted" style="margin-bottom:4px"><b>Nueva subasta para este catálogo</b> — fecha opcional (vacía = "a confirmar"):</div>
        <div class="grid2">
          <input id="cn-fecha" type="date"><input id="cn-hora" type="time" value="15:00">
          <select id="cn-cat"><option>comun</option><option>especial</option><option>plata</option><option>oro</option><option>platino</option></select>
          <select id="cn-mon"><option value="pesos">Pesos</option><option value="dolares">Dólares</option></select>
        </div>
        <input id="cn-ubi" placeholder="Ubicación">
        <div class="muted">El rematador (martillero de la casa) se asigna solo.</div>
      </div>
      <div id="col-items" style="max-height:240px;overflow:auto;margin:8px 0 4px">
        <div class="muted">Cargando bienes…</div>
      </div>
      <div class="row" style="align-items:center;gap:14px">
        <div style="flex:1">
          <div><b id="col-total">Total: $0</b> · <span id="col-sel" class="muted">Nada seleccionado.</span></div>
          <div style="margin-top:6px">
            <label class="muted" style="display:flex;gap:7px;align-items:center;cursor:pointer">
              <input type="radio" name="col-modo" value="individual" checked style="width:auto;margin:0">
              Venta pieza por pieza (cada ítem se remata por separado)</label>
            <label class="muted" style="display:flex;gap:7px;align-items:center;cursor:pointer">
              <input type="radio" name="col-modo" value="bloque" style="width:auto;margin:0">
              Todo junto en una <b>&nbsp;única venta&nbsp;</b> (el mejor postor se lleva el catálogo completo)</label>
          </div>
        </div>
        <button class="act b-blue" onclick="crearColeccion()">Crear catálogo</button>
      </div>
    </div>
    <div id="adm"></div>
  </section>
  <section id="s-pos" style="display:none">
    <p class="hint">Todos los postores registrados. Admití a los <b>pendientes</b> con su categoría; a los ya
      <b>admitidos</b> les podés ajustar la categoría cuando quieras (común → especial → plata → oro → platino).
      <button class="refresh" onclick="loadPos()">↻ Actualizar</button></p>
    <div id="pos"></div>
  </section>
  <section id="s-sub" style="display:none">
    <p class="hint">Las subastas <b>se crean desde Admisiones</b> — al aceptar un bien o al armar un catálogo.
      Acá seguís su ciclo: <b>PRÓXIMAMENTE</b> (programada, esperando el día) → la <b>abrís</b> (EN VIVO: el
      remate corre solo, ítem por ítem o todo junto) → al venderse todo queda <b>FINALIZADA</b>.
      <button class="refresh" onclick="loadSub()">↻ Actualizar</button></p>
    <div id="sub"></div>
  </section>
  <section id="s-chq" style="display:none">
    <p class="hint">Cheques certificados cargados por los postores. Quedan <b>ESPERANDO VALIDACIÓN</b>:
      verificá el cheque físico y validalo para que el postor pueda usarlo al pujar. (Las cuentas
      y tarjetas se validan solas.)
      <button class="refresh" onclick="loadChq()">↻ Actualizar</button></p>
    <div id="chq"></div>
  </section>
  <section id="s-reem" style="display:none">
    <p class="hint">Solicitudes de reembolso de los compradores. Aceptá (se acredita el dinero) o rechazá con motivo.
      <button class="refresh" onclick="loadReem()">↻ Actualizar</button></p>
    <div id="reem"></div>
  </section>
  <section id="s-mul" style="display:none">
    <p class="hint">Multas por impago (10% de lo ofertado). El postor queda <b>bloqueado</b> hasta pagarla; pasadas 72hs se deriva
      a la <b>justicia</b>. Para la demo, "Vencer 72hs" adelanta el plazo y muestra la cuenta en justicia al instante.
      <button class="refresh" onclick="loadMult()">↻ Actualizar</button></p>
    <div id="mul"></div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const API='/api';
const ADM_ST={solicitada:['A REVISAR','#e6b23a'],en_inspeccion:['EN INSPECCIÓN','#3a8fd6'],propuesta:['PROPUESTA ENVIADA','#e6b23a'],pendiente_subasta:['ESPERANDO SUBASTA','#3a8fd6'],aprobada:['EN SUBASTA','#37d66f'],rechazada:['RECHAZADA','#e23950'],rechazada_duenio:['DEVUELTA','#8a93ab']};
let SUBS=[];
function toast(m,ok=true){const t=document.getElementById('toast');t.textContent=m;t.style.background=ok?'#123a22':'#3a1220';t.style.color=ok?'#37d66f':'#ff8393';t.style.display='block';setTimeout(()=>t.style.display='none',2600)}
async function api(path,method='GET',body){const o={method,headers:{'Content-Type':'application/json'}};if(body!==undefined)o.body=JSON.stringify(body);const r=await fetch(API+path,o);const tx=await r.text();let d=null;try{d=tx?JSON.parse(tx):null}catch(e){}if(!r.ok)throw new Error((d&&(d.message||d.error))||('HTTP '+r.status));return d}
function show(k){for(const x of ['adm','pos','sub','chq','reem','mul']){document.getElementById('s-'+x).style.display=x===k?'':'none';document.getElementById('t-'+x).classList.toggle('active',x===k)}if(k==='adm')loadAdm();if(k==='pos')loadPos();if(k==='sub')loadSub();if(k==='chq')loadChq();if(k==='reem')loadReem();if(k==='mul')loadMult()}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// ── ADMISIONES ──
async function loadAdm(){
  const el=document.getElementById('adm');el.innerHTML='Cargando…';
  try{const [adm,subs]=await Promise.all([api('/admisiones'),api('/subastas')]);SUBS=subs||[];
    // Subastas que pueden RECIBIR ítems: abiertas o programadas (cerradas sin terminar).
    // Antes se excluían TODAS las 'cerrada', y como las programadas nacen 'cerrada' no
    // se podía asignar un bien a una subasta futura.
    const disp=SUBS.filter(s=>!(s.estado==='cerrada' && (s.totalItems||0)>0 && (s.itemsPendientes||0)===0));
    const cs=document.getElementById('col-sub');
    if(cs){cs.innerHTML=disp.map(s=>'<option value="'+s.identificador+'">'+subLabel(s)+'</option>').join('')
      +'<option value="nueva">➕ Crear una subasta nueva para este catálogo…</option>';colSubChange();}
    const ci=document.getElementById('col-items');if(ci)ci.innerHTML=colCandidatos(adm);
    if(!adm.length){el.innerHTML='<p class="muted">No hay solicitudes.</p>';recomputeCol();return}
    el.innerHTML=adm.map(a=>admCard(a,disp)).join('');recomputeCol()}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}
}
function subLabel(s){return '#'+s.identificador+' · '+(s.estado==='abierta'?'ABIERTA':'programada')+' · '+esc(s.fecha||'sin fecha')+' · '+esc(s.categoria||'')+' · '+esc(s.moneda||'pesos')
  +' · '+(s.totalItems||0)+' ítems'+(s.totalItems>0?' (los nuevos se AGREGAN)':'');}
// Lista de bienes candidatos a agrupar en una colección — TODO en la misma tarjeta,
// así se marcan varios de una. Cada fila: check + nombre + base editable.
function colCandidatos(adm){
  const elig=(adm||[]).filter(a=>!['rechazada','rechazada_duenio','aprobada'].includes(a.estado));
  if(!elig.length)return '<div class="muted">No hay bienes para agrupar todavía.</div>';
  return elig.map(a=>{
    const nombre=esc((a.producto&&a.producto.titulo)||('Producto #'+(a.producto&&a.producto.identificador)));
    const base=a.valorBase!=null?a.valorBase:'';
    const aviso=(a.estado==='solicitada'||a.estado==='en_inspeccion')?' · <span style="color:var(--gold)">⚠ sin inspección</span>':'';
    return '<label class="colitem"><input type="checkbox" id="colchk'+a.identificador+'" data-duenio="'+a.duenio+'" onchange="recomputeCol()">'
      +'<span class="colitem-name">'+nombre+' <span class="muted">#'+a.identificador+' · dueño '+a.duenio+aviso+'</span></span>'
      +'<input class="colitem-base" id="colvb'+a.identificador+'" type="number" placeholder="Base $" value="'+esc(base)+'" oninput="recomputeCol()"></label>';
  }).join('');
}
function admCard(a,disp){
  const [lbl,col]=ADM_ST[a.estado]||ADM_ST.solicitada;
  const opts=disp.map(s=>'<option value="'+s.identificador+'">'+subLabel(s)+'</option>').join('');
  let acc='';
  if(a.estado==='solicitada'){
    acc='<input id="dir'+a.identificador+'" value="Depósito BIDLY · Av. Corrientes 1234, CABA">'
       +'<button class="act b-blue" onclick="insp('+a.identificador+')">Pedir inspección</button>'
       +rechazoBox(a);
  } else if(a.estado==='en_inspeccion'){
    const id=a.identificador, sinSubs=disp.length===0;
    acc='<div class="grid2"><input id="vb'+id+'" placeholder="Valor base $" type="number">'
       +'<input id="co'+id+'" placeholder="Comisión $ (opc.)" type="number"></div>'
       +'<select id="su'+id+'" onchange="propSubChange('+id+')">'+opts
       +'<option value="nueva">➕ Crear una subasta nueva para este producto…</option>'
       +'<option value="sin">⏸ Sin asignar (tasar y dejar el producto esperando)</option></select>'
       // Subasta NUEVA (visible al elegir "nueva", o si no hay ninguna existente).
       +'<div id="pn'+id+'" style="display:'+(sinSubs?'':'none')+';border:1px dashed var(--blueDark);border-radius:9px;padding:10px;margin-top:4px">'
       +'<div class="muted" style="margin-bottom:4px"><b>Nueva subasta para este producto</b> — fecha opcional:</div>'
       +'<div class="grid2"><input id="pnf'+id+'" type="date"><input id="pnh'+id+'" type="time" value="15:00"></div>'
       +'<div class="grid2"><select id="pncat'+id+'"><option>comun</option><option>especial</option><option>plata</option><option>oro</option><option>platino</option></select>'
       +'<select id="pnmon'+id+'"><option value="pesos">Pesos</option><option value="dolares">Dólares</option></select></div>'
       +'<input id="pnubi'+id+'" placeholder="Ubicación"></div>'
       // Fecha para una subasta EXISTENTE (oculta si no hay existentes o se eligió nueva/sin).
       +'<div id="pe'+id+'" style="display:'+(sinSubs?'none':'')+'"><div class="muted" style="margin:2px 0">Fijar/actualizar la fecha de la subasta elegida (opcional):</div>'
       +'<div class="grid2"><input id="pf'+id+'" type="date"><input id="ph'+id+'" type="time" value="15:00"></div></div>'
       +'<button class="act b-green" onclick="proponer('+id+')">Aceptar y proponer</button>'
       +rechazoBox(a);
  } else if(a.estado==='propuesta'){ acc='<p class="muted">Propuesto: base $'+esc(a.valorBase)+' · comisión $'+esc(a.comision)+(a.subastaId?' · subasta #'+esc(a.subastaId):' · <b>sin asignar</b>')+' · fecha: '+esc((a.subasta&&a.subasta.fecha)||'a confirmar')+' — esperando al dueño.</p>'; }
  else if(a.estado==='pendiente_subasta'){ acc='<p class="muted" style="color:var(--blue)">✔ El dueño aceptó la tasación (base $'+esc(a.valorBase)+'). Metelo en una subasta desde el armador de arriba (aparece en la lista para marcar).</p>'; }
  else if(a.estado==='rechazada'){ acc='<p class="muted" style="color:var(--red)">Motivo: '+esc(a.observacion)+'</p>'; }
  return '<div class="card"><div class="row"><div><div class="title">'+esc(a.producto&&a.producto.titulo||('Producto #'+(a.producto&&a.producto.identificador)))+'</div>'
    +'<div class="muted">#'+a.identificador+' · dueño '+a.duenio+' · '+(a.producto&&a.producto.fotos||0)+' fotos · propiedad:'+esc(a.declaraPropiedad)+' · origen:'+esc(a.declaraOrigen)+'</div>'
    +(a.esColeccion==='si'?'<div class="muted" style="color:var(--blue)">Catálogo: '+esc(a.nombreColeccion)+'</div>':'')+'</div>'
    +'<span class="st" style="background:'+col+'">'+lbl+'</span></div>'+acc+origenBox(a)+'</div>';
}
function rechazoBox(a){return '<input id="obs'+a.identificador+'" placeholder="Motivo del rechazo"><button class="act b-red" onclick="rechazar('+a.identificador+')">Rechazar y devolver</button>'}
function origenBox(a){
  if(a.alertaOrigen==='si')return '<div class="muted" style="color:var(--red);margin-top:6px">⚠ Origen observado — autoridades avisadas'+(a.alertaOrigenMotivo?': '+esc(a.alertaOrigenMotivo):'')+'</div>';
  if(!['solicitada','en_inspeccion'].includes(a.estado))return '';
  return '<input id="org'+a.identificador+'" placeholder="Motivo de la duda de origen (opcional)"><button class="act b-ghost" onclick="alertarOrigen('+a.identificador+')">⚠ Alertar origen a autoridades</button>';
}
async function insp(id){const dir=document.getElementById('dir'+id).value;try{await api('/admisiones/'+id+'/inspeccion','PATCH',{direccionEnvio:dir});toast('Inspección solicitada');loadAdm()}catch(e){toast(e.message,false)}}
function propSubChange(id){const v=(document.getElementById('su'+id)||{}).value;
  const pn=document.getElementById('pn'+id), pe=document.getElementById('pe'+id);
  if(pn)pn.style.display=(v==='nueva')?'':'none';
  if(pe)pe.style.display=(v==='nueva'||v==='sin')?'none':'';}
async function proponer(id){const vb=+document.getElementById('vb'+id).value,co=document.getElementById('co'+id).value;
  const sel=(document.getElementById('su'+id)||{}).value;
  if(!vb||vb<=0)return toast('Ingresá un valor base',false);
  const body={valorBase:vb,comision:co?+co:null};
  try{
    if(sel==='sin'){
      body.subastaId=null;
    }else if(sel==='nueva'){
      const f=document.getElementById('pnf'+id).value,h=document.getElementById('pnh'+id).value;
      const nueva=await api('/subastas','POST',{fecha:f||null,hora:(f&&h)?h+':00':null,estado:'cerrada',
        categoria:document.getElementById('pncat'+id).value,moneda:document.getElementById('pnmon'+id).value,ubicacion:document.getElementById('pnubi'+id).value});
      body.subastaId=nueva.identificador;
    }else{
      body.subastaId=+sel;
      const pf=document.getElementById('pf'+id).value,ph=document.getElementById('ph'+id).value;
      if(pf){body.fecha=pf;body.hora=ph||'15:00';}
    }
    await api('/admisiones/'+id+'/proponer','PATCH',body);
    toast(sel==='sin'?'✔ Tasado y sin asignar — metelo en un catálogo cuando quieras':'Propuesta enviada al dueño');loadAdm()
  }catch(e){toast(e.message,false)}}
async function rechazar(id){const o=document.getElementById('obs'+id).value;if(!o.trim())return toast('Ingresá el motivo',false);
  try{await api('/admisiones/'+id+'/rechazar','PATCH',{observacion:o.trim()});toast('Admisión rechazada');loadAdm()}catch(e){toast(e.message,false)}}
async function alertarOrigen(id){const m=(document.getElementById('org'+id).value||'').trim();
  try{await api('/admisiones/'+id+'/alertar-origen','PATCH',{motivo:m||'Sin especificar'});toast('Aviso de origen registrado');loadAdm()}catch(e){toast(e.message,false)}}

// ── CATÁLOGO (armador; "colección" en la consigna del profe) ──
function _colChecks(){return document.querySelectorAll('input[id^=colchk]');}
function recomputeCol(){
  let total=0,n=0;const duenios=new Set();
  _colChecks().forEach(chk=>{if(chk.checked){const id=chk.id.slice(6);const vb=+((document.getElementById('colvb'+id)||{}).value||0);total+=vb||0;n++;duenios.add(chk.getAttribute('data-duenio'));}});
  const t=document.getElementById('col-total');if(t)t.textContent='Total: $'+total.toLocaleString('es-AR');
  const sel=document.getElementById('col-sel');if(sel)sel.innerHTML=n?(n+' bien(es)'+(duenios.size>1?' · <span style="color:var(--red)">⚠ distintos dueños</span>':'')):'Nada seleccionado.';
}
function colSubChange(){const v=(document.getElementById('col-sub')||{}).value;
  const f=document.getElementById('col-nueva');if(f)f.style.display=(v==='nueva')?'':'none';}
async function crearColeccion(){
  const nombre=(document.getElementById('col-nombre').value||'').trim();
  const sel=document.getElementById('col-sub').value;
  const modo=(document.querySelector('input[name=col-modo]:checked')||{}).value||'individual';
  const items=[];const duenios=new Set();
  _colChecks().forEach(chk=>{if(chk.checked){const id=+chk.id.slice(6);const vb=+((document.getElementById('colvb'+id)||{}).value||0);items.push({admisionId:id,valorBase:vb});duenios.add(chk.getAttribute('data-duenio'));}});
  if(!nombre)return toast('Poné un nombre para el catálogo',false);
  if(!sel)return toast('Elegí una subasta para el catálogo',false);
  if(items.length<1)return toast('Marcá al menos 1 bien',false);
  if(duenios.size>1)return toast('El catálogo debe ser de un solo dueño',false);
  if(items.some(it=>!it.valorBase||it.valorBase<=0))return toast('Cada pieza necesita una base > 0',false);
  try{
    let su;
    if(sel==='nueva'){
      // Gestión completa en un solo flujo: crea la subasta acá mismo y le cuelga el
      // catálogo (el rematador lo asigna el backend solo).
      const f=document.getElementById('cn-fecha').value,h=document.getElementById('cn-hora').value;
      const nueva=await api('/subastas','POST',{fecha:f||null,hora:(f&&h)?h+':00':null,estado:'cerrada',
        categoria:document.getElementById('cn-cat').value,
        moneda:document.getElementById('cn-mon').value,ubicacion:document.getElementById('cn-ubi').value});
      su=nueva.identificador;
    }else{su=+sel;}
    await api('/admisiones/coleccion','POST',{subastaId:su,nombreColeccion:nombre,items:items,ventaModo:modo});
    toast('✔ Listo: subasta #'+su+' con el catálogo ('+items.length+' piezas'+(modo==='bloque'?' · única venta':'')+'). Cuando el dueño acepte, abrila desde Subastas.');loadAdm()}catch(e){toast(e.message,false)}
}

// ── POSTORES ──
async function loadPos(){const el=document.getElementById('pos');el.innerHTML='Cargando…';
  try{const ps=await api('/clientes/todos/lista');if(!ps.length){el.innerHTML='<p class="muted">No hay postores registrados.</p>';return}
    // Pendientes primero (son los que requieren acción), después los admitidos.
    ps.sort((a,b)=>(a.admitido==='si')-(b.admitido==='si'));
    el.innerHTML=ps.map(p=>{
      const adm=p.admitido==='si';
      const opts=['comun','especial','plata','oro','platino'].map(c=>'<option'+(c===(p.categoria||'comun')?' selected':'')+'>'+c+'</option>').join('');
      return '<div class="card"><div class="row"><div><div class="title">'+esc(p.nombre||'Postor')+'</div>'
        +'<div class="muted">#'+p.identificador+' · '+esc(p.email||'—')+' · categoría actual: <b>'+esc(p.categoria||'comun')+'</b></div></div>'
        +'<span class="st" style="background:'+(adm?'var(--green)':'var(--gold)')+';color:#111">'+(adm?'ADMITIDO':'PENDIENTE')+'</span></div>'
        +'<select id="cat'+p.identificador+'">'+opts+'</select>'
        +(adm
          ?'<button class="act b-blue" onclick="cambiarCat('+p.identificador+')">Actualizar categoría</button>'
          :'<button class="act b-green" onclick="admitir('+p.identificador+')">Admitir con categoría</button>')
        +'</div>';
    }).join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function admitir(id){const cat=document.getElementById('cat'+id).value;try{await api('/clientes/'+id+'/categoria','PATCH',{categoria:cat});await api('/clientes/'+id+'/admitido','PATCH',{admitido:'si'});toast('Postor admitido');loadPos()}catch(e){toast(e.message,false)}}
async function cambiarCat(id){const cat=document.getElementById('cat'+id).value;try{await api('/clientes/'+id+'/categoria','PATCH',{categoria:cat});toast('Categoría actualizada a '+cat);loadPos()}catch(e){toast(e.message,false)}}

// ── SUBASTAS ── (se crean desde Admisiones; acá solo se gestiona su ciclo)
async function loadSub(){const el=document.getElementById('sub');el.innerHTML='Cargando…';
  try{const subs=await api('/subastas');SUBS=subs||[];if(!subs.length){el.innerHTML='<p class="muted">No hay subastas. Creá la primera acá arriba.</p>';return}
    // Agrupadas por proceso, en el orden en que las mira el subastador.
    const g={ 'EN VIVO':[], 'PRÓXIMAMENTE':[], 'FINALIZADA':[] };
    subs.forEach(s=>g[subEstadoReal(s)[0]].push(s));
    g['PRÓXIMAMENTE'].sort((a,b)=>String(a.fecha||'9999').localeCompare(String(b.fecha||'9999')));
    g['FINALIZADA'].sort((a,b)=>b.identificador-a.identificador);
    let html='';
    for(const [titulo,lista] of [['🔴 En vivo',g['EN VIVO']],['📅 Próximamente',g['PRÓXIMAMENTE']],['✔ Finalizadas',g['FINALIZADA']]]){
      if(!lista.length)continue;
      const cards=await Promise.all(lista.map(subCard));
      html+='<div class="sec">'+titulo+'<span class="cnt">'+lista.length+'</span></div>'+cards.join('');
    }
    el.innerHTML=html||'<p class="muted">No hay subastas.</p>'}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
// Estado REAL del proceso (no el crudo abierta/cerrada): una 'cerrada' puede ser
// una PRÓXIMA (programada, sin rematar) o una FINALIZADA (todo adjudicado).
function subEstadoReal(s){
  const total=s.totalItems||0, pend=(s.itemsPendientes==null?total:s.itemsPendientes);
  if(s.estado==='abierta') return pend>0?['EN VIVO','var(--green)']:['FINALIZADA','var(--muted)'];
  if(total>0&&pend===0) return ['FINALIZADA','var(--muted)'];
  return ['PRÓXIMAMENTE','var(--blue)'];
}
async function subCard(s){
  const ab=s.estado==='abierta';
  const bloque=s.ventaModo==='bloque';
  const [estLbl,estCol]=subEstadoReal(s);
  const esProx=estLbl==='PRÓXIMAMENTE';
  let its=[];try{its=await api('/subastas/'+s.identificador+'/catalogos')}catch(e){}
  // En única venta no se adjudica pieza por pieza (romperia el bloque): se lleva todo el mejor postor.
  const items=(its||[]).map(it=>'<div class="row" style="margin-top:6px"><div class="muted">'+esc(it.producto&&it.producto.descripcionCatalogo||('Ítem #'+it.identificador))+' · base '+esc(it.precioBase)+(it.subastado==='si'?' · <b style="color:var(--green)">ADJUDICADO</b>':'')+'</div>'
    +((it.subastado==='si'||bloque)?'':'<button class="act b-ghost" onclick="adjudicar('+it.identificador+')">Adjudicar</button>')+'</div>').join('')||'<div class="muted" style="margin-top:6px">Sin ítems.</div>';
  const total=s.totalItems||0, pend=(s.itemsPendientes==null?total:s.itemsPendientes), vendidas=total-pend;
  // Línea de proceso: qué está pasando y qué sigue.
  let proceso='';
  if(esProx){
    let cuando='sin fecha todavía (se puede fijar al proponer un bien)';
    if(s.fecha){const d=Math.ceil((new Date(s.fecha+'T00:00:00')-new Date())/86400000);
      cuando=esc(s.fecha)+(d>1?' — faltan '+d+' días':d===1?' — es mañana':d===0?' — ¡es hoy!':' — ⚠ la fecha ya pasó');}
    proceso='<div class="muted" style="margin-top:6px">📅 Programada: '+cuando+'.'
      +(total===0?' <b style="color:var(--gold)">Sin bienes aún</b> — cargalos desde la pestaña Admisiones.':' Cuando llegue el día, tocá <b>Abrir subasta</b>.')+'</div>';
  }else if(estLbl==='EN VIVO'){
    const reloj=(s.segundosRestantes!=null)?(' · ⏱ al ítem en curso le quedan ~'+s.segundosRestantes+'s'):'';
    proceso='<div class="muted" style="margin-top:6px"><span class="pulse"></span>Rematando '
      +(bloque?'el catálogo completo en única venta':'ítem por ítem')+': vendidas '+vendidas+'/'+total+reloj+'. El remate avanza solo.</div>';
  }else{
    proceso='<div class="muted" style="margin-top:6px">✔ Terminada: '+vendidas+'/'+total+' piezas adjudicadas.</div>';
  }
  // Acciones según el estado (solo las que tienen sentido).
  let acciones='';
  if(esProx) acciones='<div style="margin-top:8px"><button class="act b-green" onclick="setEstado('+s.identificador+',\'abierta\')">▶ Abrir subasta (arranca el remate)</button></div>';
  else if(estLbl==='EN VIVO') acciones='<div style="margin-top:8px"><button class="act b-red" onclick="setEstado('+s.identificador+',\'cerrada\')">■ Cerrar ahora (adjudica lo pendiente)</button></div>';
  else if(ab) acciones='<div style="margin-top:8px"><button class="act b-ghost" onclick="setEstado('+s.identificador+',\'cerrada\')">Cerrar</button></div>';
  else acciones='<div style="margin-top:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    +'<button class="act b-ghost" onclick="reabrirSub('+s.identificador+')">↻ Reabrir subasta</button>'
    +'<span class="muted">Vuelven a venta las piezas compradas por la empresa (las ganadas por postores no se tocan).</span></div>';
  return '<div class="card"><div class="row"><div><div class="title">'+esc(s.titulo||('Subasta #'+s.identificador))+'</div>'
    +'<div class="muted">#'+s.identificador+' · '+esc(s.categoria||'—')+' · '+esc(s.moneda||'pesos')+' · '+total+' ítems'
    +(s.catalogoNombre?' · 🧩 <b style="color:var(--blue)">'+esc(s.catalogoNombre)+'</b>':'')+'</div></div>'
    +'<div style="display:flex;gap:6px;align-items:center">'
    +(bloque?'<span class="st" style="background:var(--gold);color:#231a02">ÚNICA VENTA</span>':'')
    +'<span class="st" style="background:'+estCol+'">'+estLbl+'</span></div></div>'
    +proceso+acciones+items+'</div>';
}
async function setEstado(id,e){try{await api('/subastas/'+id+'/estado','PATCH',{estado:e});toast('Subasta '+(e==='abierta'?'abierta':'cerrada'));loadSub()}catch(x){toast(x.message,false)}}
async function reabrirSub(id){
  if(!confirm('Reabrir la subasta #'+id+':\n\nLas piezas que compró la empresa (sin comprador real) vuelven a estar en venta y el remate arranca de nuevo. Las piezas ganadas por postores NO se tocan.\n\n¿Continuar?'))return;
  await setEstado(id,'abierta');
}
async function adjudicar(itemId){try{await api('/items/'+itemId+'/adjudicar','PATCH',{});toast('Ítem adjudicado');loadSub()}catch(e){toast(e.message,false)}}

// ── REEMBOLSOS ──
async function loadReem(){const el=document.getElementById('reem');el.innerHTML='Cargando…';
  try{const rs=await api('/registro-subasta/reembolsos/solicitados');
    if(!rs.length){el.innerHTML='<p class="muted">No hay solicitudes de reembolso pendientes.</p>';return}
    el.innerHTML=rs.map(r=>'<div class="card"><div class="row"><div><div class="title">'+esc((r.subasta&&r.subasta.titulo)||('Compra #'+r.identificador))+'</div>'
      +'<div class="muted">registro #'+r.identificador+' · comprador '+esc((r.cliente&&r.cliente.nombre)||r.clienteId)+' · $'+esc(r.importe)+'</div>'
      +'<div class="muted">Motivo: '+esc(r.motivoReembolso||'—')+'</div></div><span class="st" style="background:var(--gold)">SOLICITADO</span></div>'
      +'<input id="rmot'+r.identificador+'" placeholder="Motivo del rechazo (opcional)">'
      +'<div style="margin-top:6px"><button class="act b-green" onclick="resolverReem('+r.identificador+',true)">Aceptar y acreditar</button> '
      +'<button class="act b-red" onclick="resolverReem('+r.identificador+',false)">Rechazar</button></div></div>').join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function resolverReem(id,aceptar){const mot=document.getElementById('rmot'+id).value;
  try{await api('/registro-subasta/'+id+'/reembolso-resolver','PATCH',{aceptar:aceptar,motivo:mot||null});toast(aceptar?'Reembolso aceptado':'Reembolso rechazado');loadReem()}catch(e){toast(e.message,false)}}

// ── CHEQUES (validación de medios de pago) ──
async function loadChq(){const el=document.getElementById('chq');el.innerHTML='Cargando…';
  try{const ms=await api('/clientes/medios-pago/pendientes');
    const cheques=(ms||[]).filter(m=>m.tipo==='cheque');
    if(!cheques.length){el.innerHTML='<p class="muted">No hay cheques esperando validación.</p>';return}
    el.innerHTML=cheques.map(m=>'<div class="card"><div class="row"><div><div class="title">Cheque '+esc(m.numeroCheque||'')+'</div>'
      +'<div class="muted">medio #'+m.identificador+' · cliente '+esc(m.cliente)+' · '+esc(m.titular||'')+' · monto $'+Number(m.montoCheque||m.saldo||0).toLocaleString('es-AR')+'</div></div>'
      +'<span class="st" style="background:var(--gold)">ESPERANDO VALIDACIÓN</span></div>'
      +'<div style="margin-top:8px"><button class="act b-green" onclick="validarChq('+m.identificador+')">Validar cheque</button></div></div>').join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function validarChq(id){try{await api('/clientes/medios-pago/'+id+'/verificar','PATCH',{verificado:'si'});toast('Cheque validado — el postor ya puede usarlo');loadChq()}catch(e){toast(e.message,false)}}

// ── MULTAS ──
const MUL_ST={pagada:['PAGADA','#8a93ab'],justicia:['EN JUSTICIA','#e23950'],bloqueado:['BLOQUEADO','#e6b23a']};
async function loadMult(){const el=document.getElementById('mul');el.innerHTML='Cargando…';
  try{const ms=await api('/multas');
    if(!ms.length){el.innerHTML='<p class="muted">No hay multas.</p>';return}
    el.innerHTML=ms.map(m=>{
      const st=m.pagada==='si'?MUL_ST.pagada:(m.vencida?MUL_ST.justicia:MUL_ST.bloqueado);
      let acc='';
      if(m.pagada!=='si'){acc='<div style="margin-top:8px">'
        +(m.vencida?'':'<button class="act b-red" onclick="vencerMulta('+m.identificador+')">Vencer 72hs (demo)</button> ')
        +'<button class="act b-green" onclick="pagarMulta('+m.identificador+')">Marcar pagada</button></div>';}
      return '<div class="card"><div class="row"><div><div class="title">'+esc(m.clienteNombre||('Cliente '+m.cliente))+'</div>'
        +'<div class="muted">multa #'+m.identificador+' · $'+esc(m.importe)+' · límite '+esc(m.fechaLimite||'—')+'</div></div>'
        +'<span class="st" style="background:'+st[1]+'">'+st[0]+'</span></div>'+acc+'</div>';
    }).join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function vencerMulta(id){try{await api('/multas/'+id+'/vencer','POST',{});toast('Multa vencida (demo) — cuenta en justicia');loadMult()}catch(e){toast(e.message,false)}}
async function pagarMulta(id){try{await api('/multas/'+id,'PATCH',{pagada:'si'});toast('Multa marcada como pagada');loadMult()}catch(e){toast(e.message,false)}}

loadAdm();
</script>
</body></html>"""


@router.get("/admin", response_class=HTMLResponse)
def admin_panel():
    return PAGE
