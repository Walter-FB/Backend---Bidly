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
  :root{--bg:#0b1022;--card:#141a30;--cardEl:#1b2340;--border:#26304f;--blue:#3a8fd6;--green:#37d66f;--gold:#e6b23a;--red:#e23950;--muted:#8a93ab;--txt:#eef2ff}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--txt);font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:14px}
  header{display:flex;align-items:center;gap:14px;padding:16px 22px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:5}
  header h1{font-size:19px;margin:0;color:var(--blue)}
  .tag{font-size:11px;font-weight:800;padding:3px 9px;border-radius:6px;color:#fff}
  nav{display:flex;gap:6px;padding:12px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap}
  nav button{background:var(--card);border:1px solid var(--border);color:var(--muted);padding:9px 16px;border-radius:9px;cursor:pointer;font-weight:700}
  nav button.active{background:var(--blue);color:#fff;border-color:var(--blue)}
  main{padding:20px 22px;max-width:920px;margin:0 auto}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px}
  .row{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
  .muted{color:var(--muted);font-size:12.5px}
  .title{font-weight:800;font-size:15px}
  input,select{background:var(--cardEl);border:1px solid var(--border);color:var(--txt);border-radius:8px;padding:9px 10px;font-size:13px;width:100%;margin:4px 0}
  button.act{border:none;border-radius:8px;padding:9px 12px;font-weight:800;cursor:pointer;color:#fff;font-size:13px}
  .b-blue{background:var(--blue)} .b-green{background:var(--green);color:#04220f} .b-red{background:var(--red)} .b-ghost{background:transparent;border:1px solid var(--border);color:var(--txt)}
  .st{font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;color:#fff}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:10px;font-weight:700;z-index:20;display:none}
  .hint{color:var(--muted);font-size:12.5px;line-height:1.5;margin:0 0 12px}
  .refresh{color:var(--blue);cursor:pointer;font-weight:700;font-size:13px;background:none;border:none;float:right}
  a{color:var(--blue)}
</style></head>
<body>
<header>
  <h1>BIDLY</h1><span class="tag" style="background:var(--blue)">PANEL INTERNO · WEB</span>
</header>
<nav>
  <button id="t-adm" class="active" onclick="show('adm')">Admisiones</button>
  <button id="t-pos" onclick="show('pos')">Postores</button>
  <button id="t-sub" onclick="show('sub')">Subastas</button>
  <button id="t-reem" onclick="show('reem')">Reembolsos</button>
</nav>
<main>
  <section id="s-adm">
    <p class="hint">Solicitudes de los usuarios. Pedí la inspección, rechazá con motivo, o aceptá proponiendo
      valor base + comisión y asignando a una subasta (el dueño confirma desde la app).
      <button class="refresh" onclick="loadAdm()">↻ Actualizar</button></p>
    <div id="adm"></div>
  </section>
  <section id="s-pos" style="display:none">
    <p class="hint">Postores registrados pendientes. Asigná categoría y admitilos.
      <button class="refresh" onclick="loadPos()">↻ Actualizar</button></p>
    <div id="pos"></div>
  </section>
  <section id="s-sub" style="display:none">
    <p class="hint">Crear / abrir / cerrar / adjudicar subastas.
      <button class="refresh" onclick="loadSub()">↻ Actualizar</button></p>
    <div class="card">
      <div class="title" style="margin-bottom:8px">+ Crear subasta</div>
      <div class="grid2">
        <input id="ns-fecha" type="date"><input id="ns-hora" type="time" value="15:00">
        <select id="ns-cat"><option>comun</option><option>especial</option><option>plata</option><option>oro</option><option>platino</option></select>
        <select id="ns-mon"><option value="pesos">Pesos</option><option value="dolares">Dólares</option></select>
      </div>
      <input id="ns-ubi" placeholder="Ubicación"><input id="ns-subastador" placeholder="ID subastador (empleado/persona)" value="16">
      <button class="act b-blue" onclick="crearSub()">Crear subasta</button>
    </div>
    <div id="sub"></div>
  </section>
  <section id="s-reem" style="display:none">
    <p class="hint">Solicitudes de reembolso de los compradores. Aceptá (se acredita el dinero) o rechazá con motivo.
      <button class="refresh" onclick="loadReem()">↻ Actualizar</button></p>
    <div id="reem"></div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const API='/api';
const ADM_ST={solicitada:['A REVISAR','#e6b23a'],en_inspeccion:['EN INSPECCIÓN','#3a8fd6'],propuesta:['PROPUESTA ENVIADA','#e6b23a'],aprobada:['EN SUBASTA','#37d66f'],rechazada:['RECHAZADA','#e23950'],rechazada_duenio:['DEVUELTA','#8a93ab']};
let SUBS=[];
function toast(m,ok=true){const t=document.getElementById('toast');t.textContent=m;t.style.background=ok?'#123a22':'#3a1220';t.style.color=ok?'#37d66f':'#ff8393';t.style.display='block';setTimeout(()=>t.style.display='none',2600)}
async function api(path,method='GET',body){const o={method,headers:{'Content-Type':'application/json'}};if(body!==undefined)o.body=JSON.stringify(body);const r=await fetch(API+path,o);const tx=await r.text();let d=null;try{d=tx?JSON.parse(tx):null}catch(e){}if(!r.ok)throw new Error((d&&(d.message||d.error))||('HTTP '+r.status));return d}
function show(k){for(const x of ['adm','pos','sub','reem']){document.getElementById('s-'+x).style.display=x===k?'':'none';document.getElementById('t-'+x).classList.toggle('active',x===k)}if(k==='adm')loadAdm();if(k==='pos')loadPos();if(k==='sub')loadSub();if(k==='reem')loadReem()}
function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// ── ADMISIONES ──
async function loadAdm(){
  const el=document.getElementById('adm');el.innerHTML='Cargando…';
  try{const [adm,subs]=await Promise.all([api('/admisiones'),api('/subastas')]);SUBS=subs||[];
    const disp=SUBS.filter(s=>s.estado!=='cerrada');
    if(!adm.length){el.innerHTML='<p class="muted">No hay solicitudes.</p>';return}
    el.innerHTML=adm.map(a=>admCard(a,disp)).join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}
}
function admCard(a,disp){
  const [lbl,col]=ADM_ST[a.estado]||ADM_ST.solicitada;
  const opts=disp.map(s=>'<option value="'+s.identificador+'">#'+s.identificador+' · '+esc(s.categoria||'')+' · '+esc(s.moneda||'pesos')+'</option>').join('');
  let acc='';
  if(a.estado==='solicitada'){
    acc='<input id="dir'+a.identificador+'" value="Depósito BIDLY · Av. Corrientes 1234, CABA">'
       +'<button class="act b-blue" onclick="insp('+a.identificador+')">Pedir inspección</button>'
       +rechazoBox(a);
  } else if(a.estado==='en_inspeccion'){
    acc='<div class="grid2"><input id="vb'+a.identificador+'" placeholder="Valor base $" type="number">'
       +'<input id="co'+a.identificador+'" placeholder="Comisión $ (opc.)" type="number"></div>'
       +'<select id="su'+a.identificador+'">'+opts+'</select>'
       +'<button class="act b-green" onclick="proponer('+a.identificador+')">Aceptar y proponer</button>'
       +rechazoBox(a);
  } else if(a.estado==='propuesta'){ acc='<p class="muted">Propuesto: base $'+esc(a.valorBase)+' · comisión $'+esc(a.comision)+' · subasta #'+esc(a.subastaId)+' — esperando al dueño.</p>'; }
  else if(a.estado==='rechazada'){ acc='<p class="muted" style="color:var(--red)">Motivo: '+esc(a.observacion)+'</p>'; }
  return '<div class="card"><div class="row"><div><div class="title">'+esc(a.producto&&a.producto.titulo||('Producto #'+(a.producto&&a.producto.identificador)))+'</div>'
    +'<div class="muted">#'+a.identificador+' · dueño '+a.duenio+' · '+(a.producto&&a.producto.fotos||0)+' fotos · propiedad:'+esc(a.declaraPropiedad)+' · origen:'+esc(a.declaraOrigen)+'</div>'
    +(a.esColeccion==='si'?'<div class="muted" style="color:var(--blue)">Colección: '+esc(a.nombreColeccion)+'</div>':'')+'</div>'
    +'<span class="st" style="background:'+col+'">'+lbl+'</span></div>'+acc+origenBox(a)+'</div>';
}
function rechazoBox(a){return '<input id="obs'+a.identificador+'" placeholder="Motivo del rechazo"><button class="act b-red" onclick="rechazar('+a.identificador+')">Rechazar y devolver</button>'}
function origenBox(a){
  if(a.alertaOrigen==='si')return '<div class="muted" style="color:var(--red);margin-top:6px">⚠ Origen observado — autoridades avisadas'+(a.alertaOrigenMotivo?': '+esc(a.alertaOrigenMotivo):'')+'</div>';
  if(!['solicitada','en_inspeccion'].includes(a.estado))return '';
  return '<input id="org'+a.identificador+'" placeholder="Motivo de la duda de origen (opcional)"><button class="act b-ghost" onclick="alertarOrigen('+a.identificador+')">⚠ Alertar origen a autoridades</button>';
}
async function insp(id){const dir=document.getElementById('dir'+id).value;try{await api('/admisiones/'+id+'/inspeccion','PATCH',{direccionEnvio:dir});toast('Inspección solicitada');loadAdm()}catch(e){toast(e.message,false)}}
async function proponer(id){const vb=+document.getElementById('vb'+id).value,co=document.getElementById('co'+id).value,su=+document.getElementById('su'+id).value;
  if(!vb||vb<=0)return toast('Ingresá un valor base',false);if(!su)return toast('Elegí una subasta',false);
  try{await api('/admisiones/'+id+'/proponer','PATCH',{valorBase:vb,comision:co?+co:null,subastaId:su});toast('Propuesta enviada al dueño');loadAdm()}catch(e){toast(e.message,false)}}
async function rechazar(id){const o=document.getElementById('obs'+id).value;if(!o.trim())return toast('Ingresá el motivo',false);
  try{await api('/admisiones/'+id+'/rechazar','PATCH',{observacion:o.trim()});toast('Admisión rechazada');loadAdm()}catch(e){toast(e.message,false)}}
async function alertarOrigen(id){const m=(document.getElementById('org'+id).value||'').trim();
  try{await api('/admisiones/'+id+'/alertar-origen','PATCH',{motivo:m||'Sin especificar'});toast('Aviso de origen registrado');loadAdm()}catch(e){toast(e.message,false)}}

// ── POSTORES ──
async function loadPos(){const el=document.getElementById('pos');el.innerHTML='Cargando…';
  try{const ps=await api('/clientes/pendientes/lista');if(!ps.length){el.innerHTML='<p class="muted">No hay postores pendientes.</p>';return}
    el.innerHTML=ps.map(p=>'<div class="card"><div class="row"><div><div class="title">'+esc(p.nombre||'Postor')+'</div><div class="muted">#'+p.identificador+' · '+esc(p.email||'—')+'</div></div><span class="st" style="background:var(--gold)">PENDIENTE</span></div>'
      +'<select id="cat'+p.identificador+'"><option>comun</option><option>especial</option><option>plata</option><option>oro</option><option>platino</option></select>'
      +'<button class="act b-green" onclick="admitir('+p.identificador+')">Admitir con categoría</button></div>').join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function admitir(id){const cat=document.getElementById('cat'+id).value;try{await api('/clientes/'+id+'/categoria','PATCH',{categoria:cat});await api('/clientes/'+id+'/admitido','PATCH',{admitido:'si'});toast('Postor admitido');loadPos()}catch(e){toast(e.message,false)}}

// ── SUBASTAS ──
async function crearSub(){const b={fecha:document.getElementById('ns-fecha').value,hora:document.getElementById('ns-hora').value+':00',estado:'cerrada',subastador:+document.getElementById('ns-subastador').value,categoria:document.getElementById('ns-cat').value,moneda:document.getElementById('ns-mon').value,ubicacion:document.getElementById('ns-ubi').value};
  if(!b.fecha)return toast('Elegí una fecha',false);if(!b.subastador)return toast('ID de subastador',false);
  try{await api('/subastas','POST',b);toast('Subasta creada');loadSub()}catch(e){toast(e.message,false)}}
async function loadSub(){const el=document.getElementById('sub');el.innerHTML='Cargando…';
  try{const subs=await api('/subastas');SUBS=subs||[];if(!subs.length){el.innerHTML='<p class="muted">No hay subastas.</p>';return}
    const cards=await Promise.all(subs.map(subCard));el.innerHTML=cards.join('')}
  catch(e){el.innerHTML='<p class="muted">Error: '+esc(e.message)+'</p>'}}
async function subCard(s){
  const ab=s.estado==='abierta';
  let its=[];try{its=await api('/subastas/'+s.identificador+'/catalogos')}catch(e){}
  const items=(its||[]).map(it=>'<div class="row" style="margin-top:6px"><div class="muted">'+esc(it.producto&&it.producto.descripcionCatalogo||('Ítem #'+it.identificador))+' · base '+esc(it.precioBase)+(it.subastado==='si'?' · <b style="color:var(--green)">ADJUDICADO</b>':'')+'</div>'
    +(it.subastado==='si'?'':'<button class="act b-ghost" onclick="adjudicar('+it.identificador+')">Adjudicar</button>')+'</div>').join('')||'<div class="muted" style="margin-top:6px">Sin ítems.</div>';
  return '<div class="card"><div class="row"><div><div class="title">'+esc(s.titulo||('Subasta #'+s.identificador))+'</div>'
    +'<div class="muted">#'+s.identificador+' · '+esc(s.categoria||'—')+' · '+esc(s.moneda||'pesos')+' · '+esc(s.fecha||'—')+' · '+(s.totalItems||0)+' ítems</div></div>'
    +'<span class="st" style="background:'+(ab?'var(--green)':'var(--muted)')+'">'+(ab?'ABIERTA':'CERRADA')+'</span></div>'
    +'<div style="margin-top:8px"><button class="act b-green" '+(ab?'disabled style="opacity:.4"':'')+' onclick="setEstado('+s.identificador+',\'abierta\')">Abrir puja</button> '
    +'<button class="act b-red" '+(ab?'':'disabled style="opacity:.4"')+' onclick="setEstado('+s.identificador+',\'cerrada\')">Cerrar</button></div>'+items+'</div>';
}
async function setEstado(id,e){try{await api('/subastas/'+id+'/estado','PATCH',{estado:e});toast('Subasta '+(e==='abierta'?'abierta':'cerrada'));loadSub()}catch(x){toast(x.message,false)}}
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

loadAdm();
</script>
</body></html>"""


@router.get("/admin", response_class=HTMLResponse)
def admin_panel():
    return PAGE
