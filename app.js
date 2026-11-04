import { db } from "./firebase.js";
import { collection, getDocs, query, where, addDoc, doc, getDoc, updateDoc, increment, serverTimestamp, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { openLogin, watchAuth, logoutUser } from "./auth.js";
import { openDeveloperDashboard } from "./developer.js";
const $ = id => document.getElementById(id);
let allApps = [], selectedCategory = "All", currentUser = null;
if ($("year")) $("year").textContent = new Date().getFullYear();
const esc = v => String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function https(v){try{const u=new URL(v);return u.protocol==="https:"?u.href:""}catch{return ""}}
function mediafire(v){const u=https(v);if(!u)return "";const h=new URL(u).hostname.toLowerCase();return h==="mediafire.com"||h.endsWith(".mediafire.com")?u:""}
async function loadApps(){const grid=$("appsGrid");if(!grid)return;grid.innerHTML='<div class="loading"><p>Loading Pienora apps...</p></div>';try{const snap=await getDocs(query(collection(db,"apps"),where("status","==","published")));allApps=snap.docs.map(d=>({id:d.id,...d.data()}));renderApps();if(!$("searchPage")?.hidden)renderSearchPage();const sharedId=new URLSearchParams(location.search).get("app");if(sharedId&&allApps.some(a=>a.id===sharedId))showDetails(sharedId)}catch(e){console.error(e);grid.innerHTML=`<p>Could not load apps: ${esc(e.message)}</p>`}}
function filtered(){const term=($("searchInput")?.value||"").toLowerCase().trim();return allApps.filter(a=>(selectedCategory==="All"||a.category===selectedCategory)&&[a.name,a.developerName,a.category,a.description,a.packageName,a.version].join(" ").toLowerCase().includes(term))}
function sorted(arr){const mode=$("sortSelect")?.value||"latest";return [...arr].sort((a,b)=>mode==="popular"?(Number(b.downloads)||0)-(Number(a.downloads)||0):mode==="name"?String(a.name||"").localeCompare(String(b.name||"")):(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))}
function shareUrl(id){const u=new URL(location.href);u.search="";u.hash="";u.searchParams.set("app",id);return u.href}
async function copyAppLink(id,name="this app"){
  const link=shareUrl(id);
  try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(link);else{const t=document.createElement("textarea");t.value=link;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();document.execCommand("copy");t.remove()}
    showShareToast(`${name} link copied!`);
  }catch(e){window.prompt("Copy this app link:",link)}
}
function showShareToast(message){let t=$("shareToast");if(!t){t=document.createElement("div");t.id="shareToast";t.className="share-toast";document.body.appendChild(t)}t.textContent=message;t.classList.add("visible");clearTimeout(window.__pienoraShareTimer);window.__pienoraShareTimer=setTimeout(()=>t.classList.remove("visible"),2200)}
function card(a,featured=false){return `<article class="app-card ${featured?'featured-app-card':''}"><div class="app-card-top"><img class="app-icon" src="${esc(https(a.iconUrl))}" alt="" onerror="this.style.visibility='hidden'"><div class="app-info"><h3>${esc(a.name||"Unnamed app")}</h3><p>${esc(a.developerName||"Developer")}</p></div></div><p class="app-description">${esc(a.description||"Explore this app on Pienora.")}</p><div class="app-card-bottom"><span class="app-category">${esc(a.category||"Other")}</span><div class="app-card-actions"><button class="share-app" type="button" data-share-app="${esc(a.id)}" aria-label="Copy ${esc(a.name||"app")} share link">↗ Share</button><button class="view-app" data-app="${esc(a.id)}">View app</button></div></div></article>`}
function bindCards(el){el?.querySelectorAll(".app-card").forEach(c=>c.addEventListener("click",e=>{if(e.target.closest("[data-share-app]"))return;const b=c.querySelector("[data-app]");if(b)showDetails(b.dataset.app)}));el?.querySelectorAll("[data-share-app]").forEach(b=>b.addEventListener("click",()=>{const a=allApps.find(x=>x.id===b.dataset.shareApp);copyAppLink(b.dataset.shareApp,a?.name||"App")}))}
function openSearchPage(){
  const page=$("searchPage");if(!page)return;
  document.querySelector("main .hero")?.setAttribute("hidden","");
  document.querySelectorAll("main > section:not(#searchPage)").forEach(x=>x.setAttribute("hidden",""));
  page.hidden=false;document.querySelector("footer")?.setAttribute("hidden","");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("selected"));$("navSearch")?.classList.add("selected");
  renderSearchPage();setTimeout(()=>$("searchPageInput")?.focus(),40);
}
function closeSearchPage(){
  const page=$("searchPage");if(!page)return;
  // Keep the dedicated search screen hidden when returning to Home.
  page.hidden=true;
  document.querySelectorAll("main > section").forEach(section=>{
    if(section.id === "searchPage") section.hidden=true;
    else section.removeAttribute("hidden");
  });
  document.querySelector("footer")?.removeAttribute("hidden");
  renderApps();
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("selected"));
  $("navHome")?.classList.add("selected");
}
function renderSearchPage(){
  const term=($("searchPageInput")?.value||"").trim().toLowerCase();
  const discover=$("searchDiscover"),wrap=$("searchResultsWrap"),results=$("searchResults"),popular=$("searchPopular");
  if(!term){discover.hidden=false;wrap.hidden=true;if(popular){popular.innerHTML=sorted(allApps).slice(0,5).map(a=>card(a)).join("");bindCards(popular)}return}
  discover.hidden=true;wrap.hidden=false;
  const matches=sorted(allApps.filter(a=>[a.name,a.developerName,a.category,a.description,a.packageName,a.version].filter(Boolean).join(" ").toLowerCase().includes(term)));
  results.innerHTML=matches.length?matches.map(a=>card(a)).join(""):'<div class="search-suggestion-empty"><strong>No apps found</strong><span>Try another app name, category or developer.</span></div>';bindCards(results);
}

function renderApps(){
  const normal=$("appsGrid"),fg=$("featuredGrid"),fs=$("featuredSection");
  if(!normal)return;
  const list=sorted(filtered()),featured=list.filter(a=>a.isFeatured===true),others=list.filter(a=>a.isFeatured!==true);
  if(fg&&fs){fs.hidden=!featured.length;fg.innerHTML=featured.map(a=>card(a,true)).join("");bindCards(fg)}
  normal.innerHTML=others.map(a=>card(a)).join("");
  bindCards(normal);
  const empty=$("emptyMessage");
  if(empty){
    empty.hidden=list.length>0;
    if(!list.length){
      const term=$("searchInput")?.value.trim();
      empty.innerHTML=`<div class="no-results-icon">⌕</div><strong>No apps found</strong><span>${term?'We couldn’t find an app matching “'+esc(term)+'”. Try another name.':'No apps are available in this category yet.'}</span><button type="button" id="clearSearchBtn">Clear search</button>`;
      $("clearSearchBtn")?.addEventListener("click",()=>{if($("searchInput"))$("searchInput").value="";selectedCategory="All";document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x.dataset.category==="All"));renderApps();hideSuggestions()});
    }
  }
}
function showSuggestions(){
  const box=$("searchSuggestions"),input=$("searchInput");
  if(!box||!input)return;
  const term=input.value.trim().toLowerCase();
  const matches=sorted(allApps.filter(a=>!term||[a.name,a.developerName,a.category,a.description,a.packageName,a.version].filter(Boolean).join(" ").toLowerCase().includes(term))).slice(0,7);
  const heading=term?"SEARCH RESULTS":"POPULAR & RECENT APPS";
  box.innerHTML=matches.length
    ? `<div class="search-suggestion-heading">${heading}</div>`+matches.map(a=>`<button class="search-suggestion" type="button" data-suggest="${esc(a.id)}"><img src="${esc(https(a.iconUrl))}" alt=""><span><b>${esc(a.name)}</b><small>${esc(a.category||"App")} · ${esc(a.developerName||"Developer")}</small></span><span class="suggestion-arrow">›</span></button>`).join("")+'<div class="search-suggestion-footer">Tap an app to view details · Press Enter to see all results</div>'
    : `<div class="search-suggestion-empty"><strong>No apps found</strong><span>Try a different app name or keyword.</span></div>`;
  box.hidden=false;
  input.setAttribute("aria-expanded","true");
  box.querySelectorAll("[data-suggest]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.suggest,a=allApps.find(x=>x.id===id);
    input.value=a?.name||"";
    hideSuggestions();
    selectedCategory="All";
    document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x.dataset.category==="All"));
    renderApps();
    showDetails(id);
  });
}
function hideSuggestions(){const b=$("searchSuggestions");if(b){b.hidden=true;$("searchInput")?.setAttribute("aria-expanded","false")}}
async function fetchAppReviews(appId){
  try {
    const snap=await getDocs(query(collection(db,"reviews"),where("appId","==",appId),orderBy("createdAt","desc"),limit(100)));
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch(firstError) {
    console.warn("Ordered review query unavailable; trying a basic app review query.",firstError);
    const snap=await getDocs(query(collection(db,"reviews"),where("appId","==",appId)));
    return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0)).slice(0,100);
  }
}
function renderReviewSummary(reviews){
  const avg=reviews.length?reviews.reduce((n,r)=>n+(Number(r.rating)||0),0)/reviews.length:0;
  const rating=$("detailsAverageRating"),count=$("detailsReviewCount"),stats=$("detailsStatsRating");
  if(rating)rating.textContent=avg?avg.toFixed(1):"New";
  if(count)count.textContent=`(${reviews.length} reviews)`;
  if(stats)stats.textContent=avg?`${avg.toFixed(1)} ★`:"—";
  const total=$("detailsTotalReviews");if(total)total.textContent=String(reviews.length);
  const list=$("reviewList");
  if(list)list.innerHTML=reviews.length?reviews.map(r=>`<article class="review-item"><b>${esc(r.userName||"Pienora user")}</b> <span style="color:#e6a400">${"★".repeat(Math.max(1,Math.min(5,Number(r.rating)||1)))}</span><small style="color:#78869b"> · ${r.createdAt?.toDate?.().toLocaleDateString?.()||"Recently"}</small><p>${esc(r.comment||"")}</p></article>`).join(""):'<p style="color:#78869b">No reviews yet. Be the first to review.</p>';
  return avg;
}
async function showDetails(id){const a=allApps.find(x=>x.id===id);if(!a)return;document.getElementById("appDetailsModal")?.remove();if(new URLSearchParams(location.search).get("app")!==id){const u=new URL(location.href);u.searchParams.set("app",id);history.pushState({pienoraApp:id},"",u)}const icon=https(a.iconUrl),url=mediafire(a.downloadUrl);let reviews=[];try{reviews=await fetchAppReviews(id)}catch(e){console.warn("Review query:",e)}const avg=reviews.length?reviews.reduce((n,r)=>n+(Number(r.rating)||0),0)/reviews.length:0;const shots=Array.isArray(a.screenshots)?a.screenshots.filter(https):[];const overlay=document.createElement("div");overlay.id="appDetailsModal";overlay.className="details-overlay";overlay.innerHTML=`<section class="details-panel" role="dialog" aria-modal="true"><button id="closeDetails" class="details-back">← Back to apps</button><div class="details-top"><img class="details-icon" src="${esc(icon)}" alt=""><div><h2>${esc(a.name)}</h2><p style="color:#78869b;margin-top:5px">${esc(a.developerName||"Developer")}</p><p style="color:#e6a400;margin-top:6px">★ <span id="detailsAverageRating">${avg?avg.toFixed(1):"New"}</span> <span id="detailsReviewCount" style="color:#78869b">(${reviews.length} reviews)</span></p></div></div><div class="details-stats" id="detailsStats"><div class="details-stat"><strong id="detailsDownloadCount">${Number(a.downloads||0).toLocaleString()}</strong><span>Download clicks</span></div><div class="details-stat"><strong id="detailsStatsRating">${avg?avg.toFixed(1)+" ★":"—"}</strong><span>Average rating</span></div><div class="details-stat"><strong id="detailsTotalReviews">${reviews.length}</strong><span>Reviews</span></div><button type="button" class="details-stat details-share" id="detailsShare"><strong>↗ Share</strong><span>Share app</span></button></div><p style="line-height:1.65;white-space:pre-wrap">${esc(a.description||"No description available.")}</p><p style="color:#78869b;font-size:13px;margin-top:12px">${esc(a.category||"Other")} · Version ${esc(a.version||"N/A")} · ${esc(a.packageName||"Package not specified")}</p>${shots.length?`<div class="details-shots">${shots.map(s=>`<img src="${esc(s)}" alt="App screenshot" loading="lazy">`).join("")}</div>`:""}${url?`<a class="details-download" id="downloadApp" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Download from MediaFire</a>`:'<p style="color:#c33;margin-top:12px">A valid MediaFire download link is not available.</p>'}<h3 style="margin:22px 0 10px">Ratings & reviews</h3><div id="reviewList">${reviews.length?reviews.map(r=>`<article class="review-item"><b>${esc(r.userName||"Pienora user")}</b> <span style="color:#e6a400">${"★".repeat(Math.max(1,Math.min(5,Number(r.rating)||1)))}</span><small style="color:#78869b"> · ${r.createdAt?.toDate?.().toLocaleDateString?.()||"Recently"}</small><p>${esc(r.comment||"")}</p></article>`).join(""):'<p style="color:#78869b">No reviews yet. Be the first to review.</p>'}</div><form id="reviewForm" class="review-form" style="margin-top:15px"><h4>Write a review</h4><select name="rating" required><option value="5">★★★★★ — Excellent</option><option value="4">★★★★ — Good</option><option value="3">★★★ — Average</option><option value="2">★★ — Poor</option><option value="1">★ — Very poor</option></select><textarea name="comment" maxlength="1000" placeholder="Share your experience (optional)"></textarea><button type="submit">Submit review</button><p id="reviewStatus" style="font-size:12px;color:#78869b;margin-top:8px"></p></form></section>`;document.body.appendChild(overlay);document.body.classList.add("app-detail-open");$("closeDetails").onclick=()=>{overlay.remove();document.body.classList.remove("app-detail-open");const u=new URL(location.href);u.searchParams.delete("app");history.pushState({},"",u)};$("detailsShare").onclick=()=>copyAppLink(id,a.name||"App");$("reviewForm").onsubmit=async e=>{
  e.preventDefault();
  if(!currentUser){openLogin();return}
  const f=e.currentTarget,status=$("reviewStatus"),rating=Number(f.rating.value),comment=f.comment.value.trim();
  status.textContent="Submitting...";
  const submit=f.querySelector('button[type="submit"]');if(submit)submit.disabled=true;
  try{
    const existing=await getDocs(query(collection(db,"reviews"),where("appId","==",id),where("userId","==",currentUser.uid)));
    if(existing.empty){
      await addDoc(collection(db,"reviews"),{appId:id,userId:currentUser.uid,userName:currentUser.displayName||currentUser.email?.split("@")[0]||"User",rating,comment,createdAt:serverTimestamp()});
    }else{
      await updateDoc(doc(db,"reviews",existing.docs[0].id),{rating,comment,updatedAt:serverTimestamp()});
    }
    reviews=await fetchAppReviews(id);
    renderReviewSummary(reviews);
    status.textContent="Review saved. Rating updated.";
    f.reset();
  }catch(err){
    console.error("Review submit failed:",err);
    status.textContent="Could not submit/refresh review: "+err.message;
  }finally{if(submit)submit.disabled=false}
};
$("downloadApp")?.addEventListener("click",async e=>{
  e.preventDefault();
  const link=e.currentTarget;
  if(link.dataset.counting==="1")return;
  link.dataset.counting="1";
  const downloadUrl=link.href;
  const downloadTab=window.open("about:blank","_blank");
  try{
    await updateDoc(doc(db,"apps",id),{downloads:increment(1)});
    const current=Number(a.downloads||0)+1;
    a.downloads=current;
    const stored=allApps.find(x=>x.id===id);if(stored)stored.downloads=current;
    const counter=$("detailsDownloadCount");if(counter)counter.textContent=current.toLocaleString();
    console.log("Download counter updated:",current);
  }catch(err){
    console.error("Download counter error:",err);
  }finally{
    if(downloadTab){downloadTab.location.href=downloadUrl;}
    else{window.location.href=downloadUrl;}
    link.dataset.counting="0";
  }
})}
$("searchInput")?.addEventListener("focus",e=>{e.preventDefault();openSearchPage()});
$("searchInput")?.addEventListener("click",e=>{e.preventDefault();openSearchPage()});
$("navSearch")?.addEventListener("click",openSearchPage);
$("searchBack")?.addEventListener("click",closeSearchPage);
$("navHome")?.addEventListener("click",e=>{e.preventDefault();closeSearchPage();window.scrollTo({top:0,behavior:"smooth"})});
$("searchPageInput")?.addEventListener("input",renderSearchPage);
$("searchPageInput")?.addEventListener("keydown",e=>{if(e.key==="Escape")closeSearchPage()});
document.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>{const input=$("searchPageInput");if(input){input.value=b.dataset.topic;renderSearchPage()}}));
$("searchInput")?.addEventListener("input",()=>{renderApps();showSuggestions()});
$("searchInput")?.addEventListener("keydown",e=>{
  if(e.key==="Escape"){hideSuggestions();$("searchInput").blur();}
  if(e.key==="Enter"){hideSuggestions();selectedCategory="All";document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x.dataset.category==="All"));renderApps();}
});
document.addEventListener("click",e=>{if(!e.target.closest(".search-box"))hideSuggestions()});$("sortSelect")?.addEventListener("change",renderApps);
document.querySelectorAll(".category").forEach(b=>b.addEventListener("click",()=>{selectedCategory=b.dataset.category;document.querySelectorAll(".category").forEach(x=>x.classList.toggle("active",x===b));renderApps()}));
function openDeveloper(){if(!currentUser){openLogin();return}openDeveloperDashboard()}
$("developerBtn")?.addEventListener("click",openDeveloper);$("navDeveloper")?.addEventListener("click",openDeveloper);
$("loginBtn")?.addEventListener("click",()=>currentUser?logoutUser().catch(e=>alert(e.message)):openLogin());$("navAccount")?.addEventListener("click",()=>currentUser?logoutUser().catch(e=>alert(e.message)):openLogin());
watchAuth(user=>{currentUser=user;if($("loginBtn"))$("loginBtn").textContent=user?"Sign out":"Sign in";const label=$("navAccount")?.querySelector("span");if(label)label.textContent=user?"Sign out":"Account"});
loadApps();


window.addEventListener("popstate",()=>{const id=new URLSearchParams(location.search).get("app");if(id&&allApps.some(a=>a.id===id)){showDetails(id)}else{document.getElementById("appDetailsModal")?.remove();document.body.classList.remove("app-detail-open")}});
