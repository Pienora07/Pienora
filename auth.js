
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

function createAuthUI() {
  if (document.getElementById("authModal")) return;

  const modal = document.createElement("div");
  modal.id = "authModal";

  modal.innerHTML = `
    <div class="auth-overlay">
      <div class="auth-card">
        <button id="closeAuth" class="auth-close">×</button>

        <div class="auth-logo"><img src="https://i.postimg.cc/cLkzvmp2/file-000000000378820786c8c650aaec7bc8.png" alt="Pienora logo"></div>
        <h2 id="authTitle">Welcome to Pienora</h2>
        <p id="authSubtitle">Sign in to continue</p>

        <form id="authForm">
          <div id="nameField" hidden>
            <label>Full Name</label>
            <input id="fullName" type="text"
              placeholder="Enter your full name">
          </div>

          <div id="mobileField" hidden>
            <label>Mobile Number</label>
            <input id="mobile" type="tel"
              placeholder="03XXXXXXXXX">
          </div>

          <label>Email Address</label>
          <input id="email" type="email"
            placeholder="Enter your email" required>

          <label>Password</label>
          <input id="password" type="password"
            placeholder="Enter password" required minlength="6">

          <button id="authSubmit" type="submit">Sign In</button>
          <p id="authError" role="alert"></p>
        </form>

        <button id="forgotPassword" class="auth-link">
          Forgot password?
        </button>

        <p class="auth-switch">
          <span id="switchText">Don't have an account?</span>
          <button id="switchAuth" class="auth-link">
            Create account
          </button>
        </p>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");

  style.textContent = `
    .auth-overlay {
      position:fixed; inset:0; z-index:9999;
      background:#101c31a8; display:grid;
      place-items:center; padding:18px;
    }
    .auth-card {
      position:relative; background:white;
      width:100%; max-width:420px; padding:30px;
      border-radius:22px; max-height:90vh;
      overflow-y:auto; text-align:left;
    }
    .auth-close {
      position:absolute; right:18px; top:12px;
      border:0; background:none; font-size:28px;
      color:#78869b;
    }
    .auth-logo {
      background:#1769e0; color:white;
      width:45px; height:45px; display:grid;
      place-items:center; border-radius:13px;
      overflow:hidden;
      margin-bottom:18px;
    }
    .auth-logo img {width:100%;height:100%;object-fit:cover;display:block;
    }
    .auth-card h2 {font-size:23px;color:#17243a}
    .auth-card>p {color:#78869b;font-size:13px;margin:9px 0 22px}
    .auth-card label {
      display:block; font-size:12px;
      font-weight:700; margin:14px 0 7px;
      color:#34445d;
    }
    .auth-card input {
      width:100%; padding:13px;
      border:1px solid #dfe6f0;
      border-radius:10px; outline:none;
      background:white; color:#17243a;
    }
    .auth-card input:focus {border-color:#1769e0}
    #authSubmit {
      width:100%; margin-top:20px;
      padding:14px; background:#1769e0;
      color:white; border:0; border-radius:10px;
      font-weight:800;
    }
    .auth-link {
      border:0; background:none; color:#1769e0;
      font-weight:700; cursor:pointer; padding:8px 0;
    }
    .auth-switch {
      font-size:12px; color:#78869b;
      text-align:center; margin-top:17px;
    }
    #authError {
      color:#d33; font-size:12px;
      margin-top:12px; line-height:1.5;
    }
  `;

  document.head.appendChild(style);

  let mode = "login";
  const $ = id => document.getElementById(id);

  function setMode(nextMode) {
    mode = nextMode;

    $("authTitle").textContent =
      mode === "login" ? "Welcome to Pienora" : "Create your account";

    $("authSubtitle").textContent =
      mode === "login" ? "Sign in to continue" : "Join Pienora";

    $("nameField").hidden = mode !== "register";
    $("mobileField").hidden = mode !== "register";

    $("fullName").required = mode === "register";
    $("mobile").required = mode === "register";

    $("authSubmit").textContent =
      mode === "login" ? "Sign In" : "Create Account";

    $("switchText").textContent =
      mode === "login" ? "Don't have an account?" : "Already registered?";

    $("switchAuth").textContent =
      mode === "login" ? "Create account" : "Sign in";

    $("forgotPassword").hidden = mode !== "login";
    $("authError").textContent = "";
  }

  $("closeAuth").onclick = () => modal.remove();

  $("switchAuth").onclick = () => {
    setMode(mode === "login" ? "register" : "login");
  };

  $("forgotPassword").onclick = async () => {
    const email = $("email").value.trim();

    if (!email) {
      $("authError").textContent = "Enter your email first.";
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      $("authError").textContent = "Password reset email sent.";
    } catch (error) {
      $("authError").textContent = error.message;
    }
  };

  $("authForm").onsubmit = async event => {
    event.preventDefault();

    const email = $("email").value.trim();
    const password = $("password").value;

    $("authError").textContent = "";
    $("authSubmit").disabled = true;

    try {
      if (mode === "register") {
        const fullName = $("fullName").value.trim();
        const mobile = $("mobile").value.trim();

        if (fullName.length < 2) {
          throw new Error("Enter your full name.");
        }

        if (!/^\+?[0-9]{10,15}$/.test(mobile.replace(/[\s-]/g, ""))) {
          throw new Error("Enter a valid mobile number.");
        }

        const result = await createUserWithEmailAndPassword(
          auth, email, password
        );

        await updateProfile(result.user, {
          displayName: fullName
        });

        await setDoc(doc(db, "users", result.user.uid), {
          fullName,
          mobile,
          email,
          createdAt: serverTimestamp()
        });

      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      modal.remove();

    } catch (error) {
      $("authError").textContent =
        error.code === "auth/email-already-in-use"
          ? "This email is already registered."
          : error.code === "auth/invalid-credential"
          ? "Incorrect email or password."
          : error.message;

    } finally {
      $("authSubmit").disabled = false;
    }
  };

  setMode("login");
}

export function openLogin() {
  createAuthUI();
}

export async function logoutUser() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}
