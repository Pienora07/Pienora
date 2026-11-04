
import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

let developerModal = null;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function validHTTPSUrl(value) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function addDeveloperStyles() {
  if (document.getElementById("developerStyles")) return;

  const style = document.createElement("style");
  style.id = "developerStyles";
  style.textContent = `
    .dev-modal-overlay {
      position:fixed;inset:0;background:#071426bb;
      z-index:9998;display:grid;place-items:center;
      padding:14px;
    }
    .dev-modal {
      background:#fff;width:100%;max-width:720px;
      max-height:92vh;overflow-y:auto;border-radius:18px;
      padding:22px;color:#17243a;
    }
    .dev-tabs {
      display:flex;gap:10px;flex-wrap:wrap;margin:18px 0;
    }
    .dev-tab {
      border:0;padding:11px 16px;border-radius:9px;
      background:#edf3fc;color:#1769e0;font-weight:bold;
    }
    .dev-tab.active {background:#1769e0;color:white;}
    .dev-form label {
      display:block;font-weight:700;margin:14px 0 6px;
    }
    .dev-form input,.dev-form textarea,.dev-form select {
      width:100%;padding:12px;border:1px solid #dce4ef;
      border-radius:9px;font:inherit;box-sizing:border-box;
      background:white;color:#17243a;
    }
    .dev-form textarea {min-height:100px;resize:vertical;}
    .dev-submit {
      width:100%;border:0;background:#1769e0;color:white;
      padding:14px;border-radius:10px;font-weight:bold;
      margin-top:20px;
    }
    .dev-screenshot-grid {
      display:grid;grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;margin-top:12px;
    }
    .dev-shot {
      border:1px solid #dce4ef;border-radius:10px;
      padding:7px;background:#f6f9ff;min-width:0;
    }
    .dev-shot img {
      width:100%;height:130px;object-fit:contain;
      display:block;background:#e9eef7;border-radius:7px;
    }
    .dev-hint {font-size:12px;color:#64748b;line-height:1.5;}
    @media(max-width:450px) {
      .dev-modal {padding:16px;}
      .dev-screenshot-grid {grid-template-columns:1fr 1fr;}
    }
  `;

  document.head.appendChild(style);
}

function closeDeveloperDashboard() {
  developerModal?.remove();
  developerModal = null;
  document.getElementById("developerStyles")?.remove();
}

export function openDeveloperDashboard() {
  if (!auth.currentUser) {
    alert("Please login first to access Developer Dashboard.");
    return;
  }

  closeDeveloperDashboard();
  addDeveloperStyles();

  developerModal = document.createElement("div");
  developerModal.className = "dev-modal-overlay";

  developerModal.innerHTML = `
    <div class="dev-modal">
      <div style="
        display:flex;justify-content:space-between;
        align-items:center;gap:10px;
      ">
        <div>
          <h2 style="margin:0;color:#1769e0">Developer Dashboard</h2>
          <p style="color:#64748b;margin:6px 0 0">
            Publish your app on Pienora
          </p>
        </div>
        <button id="devClose" type="button" style="
          border:0;background:#edf3fc;padding:10px 13px;
          border-radius:9px;font-weight:bold;
        ">✕</button>
      </div>

      <div class="dev-tabs">
        <button class="dev-tab active" id="submitTab">Submit App</button>
        <button class="dev-tab" id="myAppsTab">My Submissions</button>
      </div>

      <div id="devContent"></div>
    </div>
  `;

  document.body.appendChild(developerModal);

  developerModal.querySelector("#devClose").onclick =
    closeDeveloperDashboard;

  developerModal.addEventListener("click", event => {
    if (event.target === developerModal) {
      closeDeveloperDashboard();
    }
  });

  developerModal.querySelector("#submitTab").onclick = () => {
    setActiveTab("submit");
    renderSubmitForm();
  };

  developerModal.querySelector("#myAppsTab").onclick = () => {
    setActiveTab("apps");
    loadMySubmissions();
  };

  renderSubmitForm();
}

function setActiveTab(tab) {
  const submitTab = document.getElementById("submitTab");
  const myAppsTab = document.getElementById("myAppsTab");

  submitTab?.classList.toggle("active", tab === "submit");
  myAppsTab?.classList.toggle("active", tab === "apps");
}

function renderSubmitForm() {
  const content = document.getElementById("devContent");
  if (!content) return;

  content.innerHTML = `
    <form class="dev-form" id="submitAppForm">

      <label>App Name *</label>
      <input name="name" required maxlength="70"
        placeholder="Example: Photo Editor">

      <label>Developer Name *</label>
      <input name="developerName" required maxlength="60"
        placeholder="Your developer name">

      <label>App Icon URL *</label>
      <input name="iconUrl" type="url" required
        placeholder="https://example.com/icon.png">

      <label>App Description *</label>
      <textarea name="description" required maxlength="1500"
        placeholder="Describe your app and its features..."></textarea>

      <label>Category *</label>
      <select name="category" required>
        <option value="">Select Category</option>
        <option>Tools</option>
        <option>Entertainment</option>
        <option>Education</option>
        <option>Games</option>
        <option>Social</option>
        <option>Photography</option>
        <option>Business</option>
        <option>Productivity</option>
        <option>Other</option>
      </select>

      <label>App Version *</label>
      <input name="version" required placeholder="1.0.0">

      <label>Package Name *</label>
      <input name="packageName" required
        placeholder="com.example.myapp">

      <label>Download Link (MediaFire) *</label>
      <input name="downloadUrl" type="url" required
        placeholder="https://www.mediafire.com/...">

      <div style="
        border:1px solid #dce8fa;background:#f5f9ff;
        padding:15px;border-radius:12px;margin-top:22px;
      ">
        <h3 style="margin:0 0 7px;color:#1769e0">
          App Screenshots *
        </h3>

        <p class="dev-hint">
          Add at least 2 screenshots. You can add up to 5.
          Use direct HTTPS image links.
        </p>

        <label>Screenshot 1 URL *</label>
        <input class="dev-screenshot-input" type="url"
          placeholder="https://example.com/screenshot1.jpg" required>

        <label>Screenshot 2 URL *</label>
        <input class="dev-screenshot-input" type="url"
          placeholder="https://example.com/screenshot2.jpg" required>

        <label>Screenshot 3 URL (Optional)</label>
        <input class="dev-screenshot-input" type="url"
          placeholder="https://example.com/screenshot3.jpg">

        <label>Screenshot 4 URL (Optional)</label>
        <input class="dev-screenshot-input" type="url"
          placeholder="https://example.com/screenshot4.jpg">

        <label>Screenshot 5 URL (Optional)</label>
        <input class="dev-screenshot-input" type="url"
          placeholder="https://example.com/screenshot5.jpg">

        <div id="devScreenshotPreview"
          class="dev-screenshot-grid"></div>
      </div>

      <button class="dev-submit" type="submit">
        Submit App for Review →
      </button>

      <p class="dev-hint" style="text-align:center">
        Your app will be reviewed by the Pienora admin.
      </p>
    </form>
  `;

  const screenshotInputs = [
    ...content.querySelectorAll(".dev-screenshot-input")
  ];

  const preview = content.querySelector("#devScreenshotPreview");

  function updatePreview() {
    const urls = screenshotInputs
      .map(input => validHTTPSUrl(input.value))
      .filter(Boolean);

    preview.innerHTML = urls.map((url, index) => `
      <div class="dev-shot">
        <img src="${escapeHTML(url)}"
          alt="Screenshot ${index + 1}"
          onerror="this.alt='Image could not be loaded';this.style.opacity='.35'">
        <p class="dev-hint">Screenshot ${index + 1}</p>
      </div>
    `).join("");
  }

  screenshotInputs.forEach(input => {
    input.addEventListener("input", updatePreview);
  });

  content.querySelector("#submitAppForm").onsubmit =
    submitApp;
}

async function submitApp(event) {
  event.preventDefault();

  const user = auth.currentUser;
  if (!user) {
    alert("Please login first.");
    return;
  }

  const form = event.currentTarget;
  const submitButton = form.querySelector(".dev-submit");
  const inputs = [...form.querySelectorAll(".dev-screenshot-input")];

  const screenshots = inputs
    .map(input => input.value.trim())
    .filter(Boolean)
    .map(validHTTPSUrl);

  if (screenshots.some(url => !url)) {
    alert("Please enter valid HTTPS screenshot URLs.");
    return;
  }

  if (screenshots.length < 2 || screenshots.length > 5) {
    alert("Please add at least 2 and at most 5 screenshots.");
    return;
  }

  const data = new FormData(form);

  const iconUrl = validHTTPSUrl(data.get("iconUrl"));
  const downloadUrl = validHTTPSUrl(data.get("downloadUrl"));

  if (!iconUrl || !downloadUrl) {
    alert("Icon and download links must be valid HTTPS URLs.");
    return;
  }

  const packageName = String(data.get("packageName") || "").trim();

  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(packageName)) {
    alert("Please enter a valid package name.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    await addDoc(collection(db, "apps"), {
      name: String(data.get("name")).trim(),
      developerName: String(data.get("developerName")).trim(),
      developerId: user.uid,
      iconUrl,
      description: String(data.get("description")).trim(),
      category: String(data.get("category")),
      version: String(data.get("version")).trim(),
      packageName,
      downloadUrl,
      screenshots,
      status: "pending",
      isFeatured: false,
      downloads: 0,
      createdAt: serverTimestamp()
    });

    alert("App submitted successfully! Waiting for admin review.");
    form.reset();

    document.getElementById("devScreenshotPreview").innerHTML = "";

    setActiveTab("apps");
    await loadMySubmissions();

  } catch (error) {
    console.error(error);
    alert("Submission failed: " + error.message);

  } finally {
    if (submitButton.isConnected) {
      submitButton.disabled = false;
      submitButton.textContent = "Submit App for Review →";
    }
  }
}

async function loadMySubmissions() {
  const content = document.getElementById("devContent");
  if (!content || !auth.currentUser) return;

  content.innerHTML = "<p>Loading your submissions...</p>";

  try {
    const appsQuery = query(
      collection(db, "apps"),
      where("developerId", "==", auth.currentUser.uid)
    );

    const snapshot = await getDocs(appsQuery);

    content.innerHTML = "";

    if (snapshot.empty) {
      content.innerHTML = `
        <div style="
          background:#f4f7fc;padding:25px;
          border-radius:12px;text-align:center;
        ">
          <h3>No submissions yet</h3>
          <p style="color:#64748b">
            Submit your first app to Pienora.
          </p>
        </div>
      `;
      return;
    }

    snapshot.forEach(appDoc => {
      const app = appDoc.data();

      const statusColors = {
        pending: "#d97706",
        published: "#16834a",
        rejected: "#dc3545"
      };

      const card = document.createElement("div");
      card.style.cssText = `
        background:#f5f8fd;padding:16px;
        border-radius:12px;margin-bottom:12px;
      `;

      card.innerHTML = `
        <div style="
          display:flex;justify-content:space-between;
          gap:10px;align-items:center;flex-wrap:wrap;
        ">
          <h3 style="margin:0">
            ${escapeHTML(app.name || "Unnamed App")}
          </h3>

          <span style="
            color:${statusColors[app.status] || "#64748b"};
            font-weight:bold;text-transform:uppercase;
            font-size:12px;
          ">
            ${escapeHTML(app.status || "Unknown")}
          </span>
        </div>

        <p style="color:#64748b;margin-bottom:5px">
          ${escapeHTML(app.category || "Other")}
          · Version ${escapeHTML(app.version || "N/A")}
        </p>

        <p style="font-size:13px;color:#64748b">
          ${Array.isArray(app.screenshots)
            ? app.screenshots.length
            : 0} screenshots submitted
        </p>
      `;

      if (app.status === "published") {
        card.style.cursor = "pointer";
        card.style.border = "1px solid #dce8fa";
        card.innerHTML += `<button type="button" class="dev-submit" style="margin-top:10px">Open app dashboard →</button>`;
        card.querySelector("button").onclick = () => showPublishedDashboard(appDoc.id, app);
      }
      content.appendChild(card);
    });

  } catch (error) {
    console.error(error);
    content.innerHTML = `
      <p style="color:#dc3545">
        Could not load submissions: ${escapeHTML(error.message)}
      </p>
    `;
  }
}


function showPublishedDashboard(appId, app) {
  const content = document.getElementById("devContent");
  if (!content) return;
  const wa = "https://wa.me/923084062053?text=I%20want%20to%20promote%20my%20application";
  content.innerHTML = `
    <button type="button" id="backToSubmissions" style="border:0;background:#edf3fc;color:#1769e0;padding:10px 13px;border-radius:9px;font-weight:bold">← My Submissions</button>
    <div style="background:#f4f8ff;border:1px solid #dce8fa;border-radius:16px;padding:20px;margin-top:14px">
      <h2 style="margin:0 0 7px">${escapeHTML(app.name || "Published app")}</h2>
      <p style="color:#16834a;font-weight:bold">● Published</p>
      <div style="font-size:34px;font-weight:900;color:#1769e0;margin-top:18px">${Number(app.downloads || 0).toLocaleString()}</div>
      <p style="color:#64748b">Total download clicks</p>
      <p style="font-size:12px;color:#64748b;margin-top:12px">This counts download button clicks, not confirmed installations.</p>
    </div>
    <div style="border:1px solid #dce8fa;border-radius:16px;padding:20px;margin-top:14px">
      <h3>Promote your app</h3>
      <p style="color:#64748b;line-height:1.6;margin:8px 0 15px">Contact the Pienora team on WhatsApp to ask about promoting your application.</p>
      <a href="${wa}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#1769e0;color:#fff;text-decoration:none;padding:14px;border-radius:10px;font-weight:bold">Chat on WhatsApp</a>
    </div>`;
  document.getElementById("backToSubmissions").onclick = loadMySubmissions;
}
