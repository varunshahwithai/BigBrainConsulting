/* ===== "Our team": the student consultants behind "Hire a team".
   To add or change someone, edit BBC_TEAM below. photo is a web address or a file in /public/team/ (leave "" to show initials).
   Only add people who have agreed to their name, photo and details being public. ===== */
const BBC_TEAM=[
];
const TEAM_PUBLIC=false; // false hides the team page, its links and the "Preferred team member" choice
const TEAM_APPLY_URL=""; // the Google Form link for "Apply to join our team"

function teamInitials(n){return String(n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");}
function teamReal(){return BBC_TEAM.filter(m=>!m.example);}
function teamCss(){if($("teamCss"))return;const st=document.createElement("style");st.id="teamCss";st.textContent=`
#team{display:flex;flex-direction:column;gap:28px;padding-top:18px}
.tmhero{display:flex;flex-direction:column;gap:12px;max-width:720px}
.tmhero h1{font:700 clamp(34px,6vw,56px)/1.05 var(--display);letter-spacing:-.02em;margin:0;text-wrap:balance}
.tmhero h1 em{font-style:italic;font-weight:400}
.tmhero p{margin:0;color:var(--muted);font-size:17px;max-width:62ch}
.tmgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.tmcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:22px;display:flex;flex-direction:column;gap:10px;min-width:0}
.tmphoto{width:96px;height:96px;border-radius:50%;object-fit:cover;background:var(--sunk);display:grid;place-items:center;font:700 32px var(--display);color:var(--muted);border:1px solid var(--line)}
.tmcard h3{font:700 22px/1.2 var(--display);margin:4px 0 0}
.tmuni{font-weight:600;font-size:14px}
.tmcred{font-size:14px;color:var(--muted);margin:0}
.tmspec{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.tmspec span{font:500 12px var(--body);border:1px solid var(--line);border-radius:999px;padding:4px 10px;background:var(--bg)}
.tmnote{background:var(--sunk);border-radius:var(--r-md);padding:12px 16px;font-size:13px}
.tmband{display:flex;gap:20px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:28px}
.tmband h2{font:700 26px/1.2 var(--display);margin:0 0 6px}
.tmband h2 em{font-style:italic;font-weight:400}
.tmband p{margin:0;color:var(--muted);max-width:56ch}
.tmband.dark{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tmband.dark p{color:#C9C9C2}
.tmband.dark .pill{background:var(--bg);color:var(--ink);border-color:var(--bg)}`;document.head.appendChild(st);}
function teamRender(){const el=$("team");if(!el)return;teamCss();
  const ex=BBC_TEAM.some(m=>m.example);
  const card=m=>`<article class="tmcard">${m.photo?`<img class="tmphoto" src="${esc(m.photo)}" alt="Photo of ${esc(m.name)}" loading="lazy">`:`<div class="tmphoto" aria-hidden="true">${esc(teamInitials(m.name))}</div>`}
      <div>${m.role?`<div class="small muted" style="letter-spacing:.06em;text-transform:uppercase;font-size:11px;font-weight:600">${esc(m.role)}</div>`:""}<h3>${esc(m.name)}</h3><div class="tmuni">${esc(m.university)}</div></div>
      <p class="tmcred">${esc(m.credentials)}</p>
      <div class="tmspec" aria-label="Specialities">${(m.specialities||[]).map(s=>`<span>${esc(s)}</span>`).join("")}</div>
      ${m.example?'<span class="chip" style="align-self:flex-start">Example profile</span>':""}</article>`;
  el.innerHTML=`<section class="tmhero"><span class="chip go" style="align-self:flex-start">Free · Pro bono</span>
      <h1>Our <em>team</em></h1>
      <p>Business school students from top universities around the world who help small businesses and founders make sense of their decisions, for free.</p></section>
    ${ex?`<div class="tmnote">These are example profiles to show the layout. The real team will appear here once their details are added.</div>`:""}
    <section class="tmgrid" aria-label="Team members">${BBC_TEAM.map(card).join("")}</section>
    <section class="tmband dark"><div><h2>Want to work with <em>them</em>?</h2><p>Tell us about your decision and pick who you'd like to work with. It's free.</p></div><button type="button" class="pill" data-hire="open">Request a student team</button></section>
    <section class="tmband"><div><h2>Join the <em>team</em></h2><p>Are you a business school student who wants real consulting and problem-solving experience? Apply to join our student pool.</p></div>
      ${TEAM_APPLY_URL?`<a class="pill" href="${esc(TEAM_APPLY_URL)}" target="_blank" rel="noopener">Apply to join our team →</a>`:`<span class="pill ghost" aria-disabled="true">Applications open soon</span>`}</section>
    <p class="small muted">Everyone on this page has agreed to their name, photo and details being shown here. <a href="/privacy" target="_blank" rel="noopener">How we handle data</a>.</p>`;}
/* the "Hire a team" form gets a "Preferred team member" choice listing the real team */
function teamFillPref(){const w=$("hrPrefWrap"),s=$("hrPref");if(!w||!s)return;const real=BBC_TEAM;w.hidden=!real.length;
  const keep=s.value;s.innerHTML=`<option value="">No preference</option>`+real.map(m=>`<option value="${esc(m.name)}">${esc(m.name)} · ${esc(m.university)}${m.example?" (example)":""}</option>`).join("");if(keep)s.value=keep;}
if(!TEAM_PUBLIC){["team","navTeam"].forEach(id=>{const e=$(id);if(e)e.remove();});document.querySelectorAll('[data-view="team"]').forEach(e=>e.remove());const w=$("hrPrefWrap");if(w)w.remove();
  if(typeof setView==="function"){const sv0=setView;setView=function(v){sv0(v==="team"?"home":v);};}}
else{teamRender();teamFillPref();}
