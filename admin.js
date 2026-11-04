
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const ADMIN_UID = "rnKdPtUyFKhTRwV6WfKf8VdSnat1";
const adminBtn = document.getElementById("adminBtn");

let dashboardCreated = false;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeImage(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

onAuthStateChanged(auth, user => {
  const isAdmin = !!user && user.uid === ADMIN_UID;

  if (adminBtn) adminBtn.hidden = !isAdmin;

  if (!isAdmin) {
    dashboardCreated = false;
    document.getElementById("adminDashboard")?.remove();
  }
});

function showImagePreview(url) {
  const safeUrl = safeImage(url);
  if (!safeUrl) return;

  document.getElementById("adminImagePreview")?.remove();

  const preview = document.createElement("div");
  preview.id = "adminImagePreview";
  preview.style.cssText = `
    position:fixed;inset:0;z-index:10002;
    background:#071426eF;display:grid;
    place-items:center;padding:20px;
  `;

  const image = document.createElement("img");
  image.src = safeUrl;
  image.alt = "App screenshot";
  image.style.cssText = `
    max-width:100%;max-height:85vh;
    object-fit:contain;border-radius:12px;
  `;

  const close = document.createElement("button");
  close.textContent = "✕ Close";
  close.style.cssText = `
    position:absolute;top:20px;right:20px;
    border:0;border-radius:9px;padding:11px 15px;
    background:white;color:#17243a;font-weight:bold;
  `;
  close.onclick = () => preview.remove();

  preview.onclick = event => {
    if (event.target === preview) preview.remove();
  };

  preview.append(image, close);
  document.body.appendChild(preview);
}

function createDashboard() {
  if (dashboardCreated) return;

  const dashboard = document.createElement("section");
  dashboard.id = "adminDashboard";

  dashboard.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:#f4f7fc;overflow-y:auto;
    padding:20px;font-family:Arial,sans-serif;
  `;

  dashboard.innerHTML = `
    <div style="max-width:850px;margin:auto">

      <div style="
        display:flex;justify-content:space-between;
        align-items:center;gap:12px;flex-wrap:wrap;
        margin-bottom:25px;
      ">
        <div>
          <h1 style="color:#1769E0;margin:0">Pienora Admin</h1>
          <p style="color:#64748b">Manage your app store</p>
        </div>
        <button id="closeAdmin" style="
          border:0;background:#e2e8f0;padding:12px 18px;
          border-radius:10px;font-weight:bold;
        ">Close ✕</button>
      </div>

      <div style="
        background:white;padding:20px;border-radius:16px;
        margin-bottom:15px;
      ">
        <h2 style="margin:0 0 5px">Pending Applications</h2>
        <p id="pendingCount" style="color:#64748b">Loading...</p>
      </div>

      <div id="pendingApps"></div>

      <div style="
        background:white;padding:20px;border-radius:16px;
        margin:25px 0 15px;
      ">
        <h2 style="margin:0 0 5px">Published Apps</h2>
        <p id="publishedCount" style="color:#64748b">Loading...</p>
      </div>

      <div id="publishedApps"></div>
    </div>
  `;

  document.body.appendChild(dashboard);
  dashboardCreated = true;

  document.getElementById("closeAdmin").onclick = () => {
    dashboard.remove();
    dashboardCreated = false;
  };

  loadPendingApps();
  loadPublishedApps();
}

function createAppCard(appDoc, app, type) {
  const card = document.createElement("div");

  card.style.cssText = `
    background:white;padding:20px;border-radius:16px;
    margin-bottom:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.05);
  `;

  const isFeatured = app.isFeatured === true;
  const iconUrl = safeImage(app.iconUrl);

  const screenshots = Array.isArray(app.screenshots)
    ? app.screenshots.map(safeImage).filter(Boolean).slice(0, 5)
    : [];

  card.innerHTML = `
    <div style="display:flex;gap:15px;align-items:center">
      <img
        src="${escapeHTML(iconUrl || "data:,")}"
        alt=""
        style="
          width:65px;height:65px;object-fit:cover;
          border-radius:14px;background:#e2e8f0;
        "
        onerror="this.style.display='none'"
      >
      <div>
        <h3 style="margin:0 0 6px">
          ${escapeHTML(app.name || "Unnamed App")}
        </h3>
        <p style="margin:0;color:#64748b">
          ${escapeHTML(app.category || "Other")}
          · Version ${escapeHTML(app.version || "N/A")}
        </p>
        ${type === "published" && isFeatured
          ? `<p style="color:#1769E0;font-weight:bold;margin:7px 0 0">★ FEATURED</p>`
          : ""}
      </div>
    </div>

    <p style="color:#475569;line-height:1.5;margin-top:15px">
      ${escapeHTML(app.description || "No description")}
    </p>

    <p style="font-size:13px;color:#64748b">
      Developer: ${escapeHTML(app.developerName || "Unknown")}
    </p>

    <p style="font-size:13px;color:#64748b;word-break:break-all">
      Package: ${escapeHTML(app.packageName || "N/A")}
    </p>

    <div style="margin-top:18px">
      <h4 style="margin-bottom:10px">
        App Screenshots (${screenshots.length})
      </h4>

      <div class="admin-screenshot-grid"
        style="
          display:grid;
          grid-template-columns:repeat(auto-fit,minmax(110px,1fr));
          gap:10px;
        ">
        ${
          screenshots.length
            ? screenshots.map((url, index) => `
                <button type="button"
                  data-screenshot="${index}"
                  style="
                    padding:0;border:1px solid #e2e8f0;
                    border-radius:10px;overflow:hidden;
                    background:#f1f5f9;
                  ">
                  <img
                    src="${escapeHTML(url)}"
                    alt="Screenshot ${index + 1}"
                    loading="lazy"
                    style="
                      width:100%;height:135px;
                      object-fit:contain;display:block;
                    "
                    onerror="this.style.display='none'"
                  >
                </button>
              `).join("")
            : `<p style="color:#dc3545;font-size:13px">
                 No screenshots submitted.
               </p>`
        }
      </div>
    </div>

    <div style="
      display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;
    ">
      ${type === "pending" ? `
        <button data-action="approve" style="
          background:#16834a;color:white;border:0;
          padding:12px 18px;border-radius:9px;font-weight:bold;
        ">✓ Approve</button>

        <button data-action="reject" style="
          background:#dc3545;color:white;border:0;
          padding:12px 18px;border-radius:9px;font-weight:bold;
        ">✕ Reject</button>
      ` : `
        <button data-action="promote" style="
          background:${isFeatured ? "#64748b" : "#1769E0"};
          color:white;border:0;padding:12px 18px;
          border-radius:9px;font-weight:bold;
        ">${isFeatured ? "Remove Promotion" : "★ Promote"}</button>
      `}
    </div>
  `;

  card.querySelectorAll("[data-screenshot]").forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.screenshot);
      showImagePreview(screenshots[index]);
    });
  });

  if (type === "pending") {
    card.querySelector('[data-action="approve"]').onclick = () =>
      changeStatus(appDoc.id, "published");

    card.querySelector('[data-action="reject"]').onclick = () =>
      changeStatus(appDoc.id, "rejected");
  } else {
    card.querySelector('[data-action="promote"]').onclick = () =>
      togglePromotion(appDoc.id, isFeatured);
  }

  return card;
}

async function loadPendingApps() {
  const container = document.getElementById("pendingApps");
  const count = document.getElementById("pendingCount");

  if (!container || !count) return;

  container.innerHTML = "<p>Loading applications...</p>";

  try {
    const appsQuery = query(
      collection(db, "apps"),
      where("status", "==", "pending")
    );

    const snapshot = await getDocs(appsQuery);

    count.textContent =
      `${snapshot.size} application(s) waiting for review`;

    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="background:white;padding:25px;border-radius:15px">
          No pending applications.
        </div>
      `;
      return;
    }

    snapshot.forEach(appDoc => {
      container.appendChild(
        createAppCard(appDoc, appDoc.data(), "pending")
      );
    });

  } catch (error) {
    count.textContent = "Could not load applications.";
    container.textContent = error.message;
    console.error(error);
  }
}

async function loadPublishedApps() {
  const container = document.getElementById("publishedApps");
  const count = document.getElementById("publishedCount");

  if (!container || !count) return;

  container.innerHTML = "<p>Loading published apps...</p>";

  try {
    const appsQuery = query(
      collection(db, "apps"),
      where("status", "==", "published")
    );

    const snapshot = await getDocs(appsQuery);

    count.textContent = `${snapshot.size} published app(s)`;

    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <div style="background:white;padding:25px;border-radius:15px">
          No published apps yet.
        </div>
      `;
      return;
    }

    snapshot.forEach(appDoc => {
      container.appendChild(
        createAppCard(appDoc, appDoc.data(), "published")
      );
    });

  } catch (error) {
    count.textContent = "Could not load published apps.";
    container.textContent = error.message;
    console.error(error);
  }
}

async function changeStatus(appId, status) {
  const action = status === "published" ? "approve" : "reject";

  if (!confirm(`Are you sure you want to ${action} this app?`)) {
    return;
  }

  try {
    await updateDoc(doc(db, "apps", appId), {
      status,
      reviewedAt: serverTimestamp()
    });

    alert(status === "published"
      ? "App approved successfully!"
      : "App rejected successfully!"
    );

    await loadPendingApps();
    await loadPublishedApps();

  } catch (error) {
    alert("Action failed: " + error.message);
    console.error(error);
  }
}

async function togglePromotion(appId, currentlyFeatured) {
  const action = currentlyFeatured
    ? "remove promotion from"
    : "promote";

  if (!confirm(`Are you sure you want to ${action} this app?`)) {
    return;
  }

  try {
    await updateDoc(doc(db, "apps", appId), {
      isFeatured: !currentlyFeatured,
      featuredAt: currentlyFeatured ? null : serverTimestamp()
    });

    alert(currentlyFeatured
      ? "Promotion removed!"
      : "App promoted successfully!"
    );

    await loadPublishedApps();

  } catch (error) {
    console.error(error);
    alert("Promotion failed: " + error.message);
  }
}

if (adminBtn) {
  adminBtn.addEventListener("click", () => {
    if (auth.currentUser?.uid !== ADMIN_UID) {
      alert("Admin access denied.");
      return;
    }

    createDashboard();
  });
}
