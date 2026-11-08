const apiBase = (window.ACERVO_CONFIG?.apiBase || "").replace(/\/$/, "");
const apiURL = path => `${apiBase}${path}`;
async function api(path, options = {}) {
  if (!window.ACERVO_CONFIG?.serviceEnabled) throw new Error(path.startsWith("/api/drive") ? "A navegação pelas pastas está sendo conectada ao serviço do acervo." : path.startsWith("/api/search") ? "A busca por IA ainda está sendo conectada. Por enquanto, consulte o botão Drive da Turma." : "O envio para a galeria ainda está sendo conectado. Sua imagem foi convertida, mas ainda não foi publicada.");
  let response;
  try { response = await fetch(apiURL(path), { ...options, signal: AbortSignal.timeout(60000) }); }
  catch { throw new Error("Não foi possível conectar ao serviço. Tente novamente em instantes."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Serviço indisponível. Tente novamente em instantes.");
  return data;
}
for (const button of document.querySelectorAll("[data-dialog]")) {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.dialog).showModal();
    if (button.dataset.dialog === "drive-dialog") loadDrive();
  });
}
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.querySelector(".close-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
}
let tree;
async function loadDrive() {
  const container = document.querySelector("#drive-tree");
  if (tree) return;
  container.textContent = "Carregando pastas…";
  try {
    tree = await api("/api/drive"); container.replaceChildren();
    renderFolders(tree.root, container, new Set());
  } catch (error) { tree = null; container.textContent = error.message; }
}
function safeLink(url, name, className = "drive-link") {
  const a = document.createElement("a");
  try { const u = new URL(url); if (u.protocol !== "https:" || !["drive.google.com","docs.google.com"].includes(u.hostname)) return document.createTextNode(name); } catch { return document.createTextNode(name); }
  a.href = url; a.textContent = name; a.target = "_blank"; a.rel = "noopener noreferrer"; a.className = className; return a;
}
function renderFolders(parent, container, ancestors) {
  const children = tree.folders[parent];
  if (!children) { container.append(document.createTextNode("Abra no Drive para consultar esta pasta.")); return; }
  const sorted = [...children].sort((a,b) => a.name.localeCompare(b.name,"pt-BR",{numeric:true}));
  for (const node of sorted) {
    if (!node.folder) { container.append(safeLink(node.url,node.name)); continue; }
    const details = document.createElement("details"); details.className = "drive-folder";
    const summary = document.createElement("summary"); summary.textContent = node.name; details.append(summary);
    const content = document.createElement("div"); content.className = "drive-children"; details.append(content);
    content.append(safeLink(node.url,"Abrir pasta no Drive ↗","drive-link drive-open"));
    let loaded = false;
    details.addEventListener("toggle", () => {
      if (details.open && !loaded && !ancestors.has(node.id)) { loaded=true; renderFolders(node.id,content,new Set([...ancestors,node.id])); }
    }); container.append(details);
  }
}
let convertedFile, previewURL, conversionVersion = 0;
const fileInput=document.querySelector("#meme-file"), uploadStatus=document.querySelector("#upload-status"), uploadSubmit=document.querySelector("#upload-submit"), preview=document.querySelector("#upload-preview");
fileInput.addEventListener("change", async () => {
  const version=++conversionVersion; convertedFile=null; uploadSubmit.disabled=true; preview.hidden=true;
  if(previewURL)URL.revokeObjectURL(previewURL);
  const file=fileInput.files[0]; if(!file)return;
  try {
    if(!/\.(png|jpe?g|bmp|dib)$/i.test(file.name))throw new Error("Escolha um PNG, JPG ou BMP.");
    if(file.size>20*1024*1024)throw new Error("A imagem deve ter até 20 MB.");
    uploadStatus.textContent="Convertendo para WebP…";
    const bitmap=await createImageBitmap(file);
    if(bitmap.width*bitmap.height>40_000_000){bitmap.close();throw new Error("A imagem deve ter até 40 megapixels.");}
    const ratio=Math.min(1,2560/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.88));
    if(!blob || blob.type!=="image/webp")throw new Error("Este navegador não conseguiu converter para WebP.");
    if(version!==conversionVersion)return;
    convertedFile=blob;previewURL=URL.createObjectURL(blob);preview.src=previewURL;preview.hidden=false;uploadSubmit.disabled=false;
    uploadStatus.textContent=`Pronto para enviar · WebP · ${Math.ceil(blob.size/1024)} KB`;
  } catch(error){if(version===conversionVersion)uploadStatus.textContent=error.message || "Não foi possível abrir essa imagem.";}
});
document.querySelector("#upload-form").addEventListener("submit", async e=>{
  e.preventDefault();if(!convertedFile)return;
  uploadSubmit.disabled=true;fileInput.disabled=true;uploadStatus.textContent="Enviando para a galeria da turma…";
  try {
    const caption=document.querySelector("#meme-caption").value.trim();
    const data=await api(`/api/memes?caption=${encodeURIComponent(caption)}`,{method:"POST",headers:{"Content-Type":"image/webp"},body:convertedFile});
    addSharedMeme(data);window.showLatestMeme();uploadStatus.textContent="Meme incluído na galeria da turma.";convertedFile=null;
    e.target.reset();preview.hidden=true;if(previewURL)URL.revokeObjectURL(previewURL);
  }catch(error){uploadStatus.textContent=error.message;uploadSubmit.disabled=false;}
  finally{fileInput.disabled=false;}
});
const sharedIds=new Set();
function addSharedMeme(item){
  if(!/^[a-f0-9]{64}$/.test(item.id)||sharedIds.has(item.id))return;
  sharedIds.add(item.id);window.addGalleryImage(apiURL(`/media/${item.id}.webp`),item.caption);
}
async function syncGallery(){try{const data=await api("/api/memes");data.items.forEach(addSharedMeme);}catch{/* Original gallery remains available offline. */}}
syncGallery();setInterval(()=>{if(!document.hidden)syncGallery();},60000);
const history=[];
document.querySelector("#chat-form").addEventListener("submit",async e=>{
  e.preventDefault();const input=document.querySelector("#chat-input"),status=document.querySelector("#chat-status"),button=e.target.querySelector("button");
  const message=input.value.trim();if(!message)return;
  const log=document.querySelector("#chat-log");
  function bubble(text,role){const p=document.createElement("p");p.className=`chat-message ${role}`;p.textContent=text;log.append(p);p.scrollIntoView({block:"nearest"});}
  bubble(message,"user");input.value="";button.disabled=true;status.textContent="Consultando o acervo…";
  try{
    const data=await api("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,history:history.slice(-8)})});
    bubble(data.answer,"assistant");
    const links=document.createElement("div");links.className="chat-sources";
    for(const source of data.sources||[])links.append(safeLink(source.url,source.name));log.append(links);
    history.push({role:"user",content:message},{role:"assistant",content:data.answer});status.textContent="";
  }catch(error){status.textContent=error.message;input.value=message;}
  finally{button.disabled=false;input.focus();}
});
