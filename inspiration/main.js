// -------- Globals --------
let currentSortKey = null;
let currentSortDirection = "desc";
let isGasReady = false;
let chartInstance;
let breakdownChartInstance;
let exitPopupShown = false;

// -------- Helpers --------
const $ = (id) => document.getElementById(id);
function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}
function safeFixed(val, decimals = 2, fallback = "0.00") {
  return typeof val === "number" && !isNaN(val)
    ? val.toFixed(decimals)
    : fallback;
}

// Tailwind toast (falls back to alert if toast not present)
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  // Prevent duplicate messages
  const existing = [...container.children].find(
    (el) => el.textContent === message,
  );
  if (existing) return;

  // Base styles
  const baseClasses =
    "px-4 py-2 rounded-lg shadow-md text-sm font-medium transition transform opacity-0 translate-y-2";

  // Color by type
  let colorClasses = "bg-gray-800 text-white";
  if (type === "success") colorClasses = "bg-green-600 text-white";
  if (type === "error") colorClasses = "bg-red-600 text-white";
  if (type === "warning") colorClasses = "bg-yellow-500 text-black";

  // Create toast
  const toast = document.createElement("div");
  toast.className = `${baseClasses} ${colorClasses}`;
  toast.textContent = message;

  // Add to container
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
    toast.classList.add("opacity-100", "translate-y-0");
  });

  // Auto remove after 4s
  setTimeout(() => {
    toast.classList.remove("opacity-100", "translate-y-0");
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// -------- Core --------
function analyzeTrip() {
  const $ = (id) => document.getElementById(id);

  // Parse raw values
  let deliveryOffer = parseFloat($("deliveryOffer")?.value);
  let time = parseFloat($("time")?.value);
  let tripDistance = parseFloat($("tripDistance")?.value);
  let preferredHourlyRate = parseFloat($("preferredHourlyRate")?.value);

  // ---- Clamp values to safe ranges ----
  deliveryOffer = Math.min(Math.max(deliveryOffer || 0, 1), 500);
  time = Math.min(Math.max(time || 0, 1), 240);
  tripDistance = Math.min(Math.max(tripDistance || 0, 0.1), 100);
  preferredHourlyRate = Math.min(Math.max(preferredHourlyRate || 0, 5), 200);

  // ---- Push clamped values back into inputs ----
  $("deliveryOffer").value = deliveryOffer;
  $("time").value = time;
  $("tripDistance").value = tripDistance;
  $("preferredHourlyRate").value = preferredHourlyRate;

  // ---- Validation ----
  if (isNaN(deliveryOffer) || isNaN(time) || isNaN(tripDistance)) {
    showToast("❌ Please fill in valid values for Offer, Time, and Distance.");
    return;
  }
  if (isNaN(preferredHourlyRate)) {
    showToast("❌ Please enter a realistic hourly rate ($5–$200).");
    return;
  }

  // ---- Build JSON payload ----
  const payload = {
    deliveryOffer,
    time,
    tripDistance,
    gasPricePerGallon: $("gasPricePerGallon")?.value,
    mpg: $("mpg")?.value,
    outOfWayDelay: $("outOfWayDelay")?.value,
    waitTime: $("waitTime")?.value,
    wearCostPerMile: $("wearCostPerMile")?.value,
    preferredHourlyRate,
  };

  fetch("/api/analyzeTrip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => r.json())
    .then((data) => {
      if (!data || data.error) {
        showToast("❌ " + (data?.error || "Unknown error from server"));
        return;
      }

      // --- Desktop Results Summary ---
      setText("effectiveHourlyWageDR", safeFixed(data.effectiveHourlyWage));
      setText("profitDR", safeFixed(data.profit));
      setText("mpd", safeFixed(data.mpd));
      setText("dollarsPerMinute", safeFixed(data.dollarsPerMinute));
      setText("totalCostsDR", safeFixed(data.totalCosts));

      // --- Mobile Snapshot Bar ---
      setText("snapshotHourly", "$" + safeFixed(data.effectiveHourlyWage));
      setText("snapshotProfit", "$" + safeFixed(data.profit));
      setText("snapshotPerMile", "$" + safeFixed(data.mpd));
      setText("snapshotCosts", "$" + safeFixed(data.totalCosts));

      // --- Update Daily Summary ---
      if (!window.dailyStats) {
        window.dailyStats = { profit: 0, miles: 0, time: 0 };
      }
      window.dailyStats.profit += data.profit || 0;
      window.dailyStats.miles += data.totalMiles || 0;
      window.dailyStats.time += data.totalTime || 0;

      setText("dayProfit", safeFixed(window.dailyStats.profit));
      setText("dayMiles", safeFixed(window.dailyStats.miles));
      setText("dayTime", safeFixed(window.dailyStats.time, 0, "0"));
      setText(
        "dayAvgMile",
        safeFixed(window.dailyStats.profit / (window.dailyStats.miles || 1)),
      );

      document.getElementById("dailySummary")?.classList.remove("hidden");

      // --- Detailed resultsRow2 fields ---
      setText("effectiveHourlyWage", safeFixed(data.effectiveHourlyWage));
      setText("totalMiles", safeFixed(data.totalMiles));
      setText("totalTime", safeFixed(data.totalTime, 0, "0"));
      setText("gallons", safeFixed(data.gallons));
      setText("gasCost", safeFixed(data.gasCost));
      setText("wearAndTearCost", safeFixed(data.wearCost));
      setText("totalCosts", safeFixed(data.totalCosts));
      setText("deliveryOfferResults", safeFixed(data.deliveryOffer));
      setText("profit", safeFixed(data.profit));
      setText("deductionEstimate", safeFixed(data.deduction));

      // --- Verdict Card (desktop only) ---
      const verdictCard = $("verdictCard");

      if (verdictCard) {
        const verdictMsg = data.verdict?.msg || "";
        const verdictSubtitle = data.verdict?.subtitle || "";

        if (verdictMsg.trim() !== "") {
          verdictCard.innerHTML = `
			  <div class="rounded-xl p-5 shadow-lg text-center transition w-full md:w-auto">
				<p id="tripVerdict" class="text-lg md:text-xl font-extrabold">${verdictMsg}</p>
				<p id="verdictSubtitle" class="mt-1 text-sm text-gray-600 dark:text-gray-400">${verdictSubtitle}</p>
			  </div>
			`;

          const wrapper = verdictCard.firstElementChild;
          const verdictEl = wrapper.querySelector("#tripVerdict");

          if (data.verdict?.class?.includes("success")) {
            wrapper.classList.add(
              "bg-green-100",
              "dark:bg-green-900/40",
              "border",
              "border-green-300",
              "dark:border-green-700",
            );
            verdictEl.classList.add("text-green-700", "dark:text-green-300");
          } else if (data.verdict?.class?.includes("warning")) {
            wrapper.classList.add(
              "bg-yellow-100",
              "dark:bg-yellow-900/40",
              "border",
              "border-yellow-300",
              "dark:border-yellow-700",
            );
            verdictEl.classList.add("text-yellow-700", "dark:text-yellow-300");
          } else {
            wrapper.classList.add(
              "bg-red-100",
              "dark:bg-red-900/40",
              "border",
              "border-red-300",
              "dark:border-red-700",
            );
            verdictEl.classList.add("text-red-700", "dark:text-red-300");
          }
        } else {
          verdictCard.innerHTML = ""; // nothing shown when verdict is empty
        }
      }

      // --- Mobile Verdict ---
      const snapshotVerdict = $("snapshotVerdict");
      if (snapshotVerdict) {
        const rawVerdict = (data.verdict?.msg || "—").trim();
        const verdictMsg = rawVerdict.replace(/[^a-z ]/gi, ""); // strip emojis/symbols
        let shortMsg = "—";

        if (/accept/i.test(verdictMsg)) shortMsg = "✅ Accept";
        else if (/borderline/i.test(verdictMsg)) shortMsg = "⚠ Borderline";
        else if (/reject|Not worth it/i.test(verdictMsg))
          shortMsg = "❌ Reject";

        snapshotVerdict.textContent = shortMsg;
        snapshotVerdict.className =
          "font-bold whitespace-nowrap " +
          (data.verdict?.class?.includes("success")
            ? "text-green-400"
            : data.verdict?.class?.includes("warning")
              ? "text-yellow-400"
              : "text-red-400");
      }

      // --- Charts ---
      updateChart(data.profit || 0, data.totalCosts || 0);
      updateBreakdownChart(
        parseFloat($("time")?.value) || 0, // driveTime
        parseFloat($("outOfWayDelay")?.value) || 0, // outOfWayDelay
        parseFloat($("waitTime")?.value) || 0, // waitTime
        data.gasCost || 0, // gasCost
        data.wearCost || 0, // wearCost
      );

      // Show hidden results blocks
      const summary = $("resultsSummary");
      if (summary) {
        summary.classList.remove("d-none"); // only remove bootstrap-style if you still use it
        // Leave `hidden md:block` intact → still hidden on mobile, shown on md+
      }
      $("resultsRow2")?.classList.remove("hidden", "d-none");

      // Show Trip Analysis Card with animation
      const tripCard = $("tripAnalysisCard");
      if (tripCard) {
        tripCard.classList.remove("hidden");
        requestAnimationFrame(() => {
          tripCard.classList.remove("opacity-0", "translate-y-4");
          tripCard.classList.add("opacity-100", "translate-y-0");
        });
      }

      // Save trip log
      saveTripLog(
        safeFixed(data.deliveryOffer),
        safeFixed(data.totalTime, 0, "0"),
        safeFixed(data.totalMiles),
        safeFixed(data.profit),
        safeFixed(data.effectiveHourlyWage),
        data.verdict?.msg || "—",
      );

      showToast("✅ Trip analyzed and saved.");
    })
    .catch((err) => {
      showToast("❌ Error: " + err.message);
    });

  // Show share actions after results are ready
  const shareEl = document.getElementById("shareActions");
  if (shareEl) shareEl.classList.remove("hidden");
}

// Charts
function updateChart(profit, totalCosts) {
  const canvas = $("profitChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Profit", "Costs"],
      datasets: [
        {
          data: [profit, totalCosts],
          backgroundColor: ["#22c55e", "#ef4444"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: window.innerWidth > 640 ? "bottom" : "top",
        },
      },
    },
  });
}

function updateBreakdownChart(time, delay, wait, gasCost, wearCost) {
  const canvas = $("breakdownChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (breakdownChartInstance) breakdownChartInstance.destroy();

  breakdownChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Drive", "Delay", "Wait", "Gas", "Wear"],
      datasets: [
        {
          data: [time, delay, wait, gasCost, wearCost],
          backgroundColor: [
            "#6366f1",
            "#facc15",
            "#f97316",
            "#22c55e",
            "#ef4444",
          ],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
      plugins: { legend: { display: false } },
    },
  });
}

// Theme (kept for compatibility if button calls it)
function toggleTheme() {
  const root = document.documentElement;
  root.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    root.classList.contains("dark") ? "dark" : "light",
  );
}

// Advanced settings (in case the inline handler calls this)
function toggleAdvancedSettings() {
  const el = $("advancedSettings");
  if (el) el.classList.toggle("hidden");
}

// NEWSLETTER FORM
function submitNewsletter(e) {
  e.preventDefault();

  const form = document.getElementById("newsletterForm");
  const email = document.getElementById("userEmail")?.value.trim();
  const tips = document.getElementById("tipsCheckbox")?.checked
    ? "true"
    : "false";
  const btn = form?.querySelector('button[type="submit"]');
  const statusEl = document.getElementById("newsletterStatus");

  if (!email) {
    showToast("❌ Please enter your email.");
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.classList.add("hidden");

  grecaptcha.ready(function () {
    grecaptcha
      .execute("6LeGK1MrAAAAAGc19Grzz8V2grYy9ZRQReTF9Yy1", {
        action: "submit_newsletter",
      })
      .then(function (token) {
        fetch("/api/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formType: "newsletter",
            email,
            tips,
            "g-recaptcha-response": token,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              showToast("✅ Subscription successful!");
              if (statusEl) statusEl.classList.remove("hidden");
              form?.reset();
            } else {
              showToast("❌ " + (data.error || "Unknown error occurred."));
            }
          })
          .catch((err) => showToast("❌ Network error: " + err.message))
          .finally(() => {
            if (btn) btn.disabled = false;
          });
      });
  });
}

// FEEDBACK FORM
function submitFeedback(e) {
  e.preventDefault();

  const form = document.getElementById("feedbackForm");
  const email = document.getElementById("feedbackEmail")?.value.trim();
  const message = document.getElementById("feedbackText")?.value.trim();
  const btn = form?.querySelector('button[type="submit"]');
  const statusEl = document.getElementById("feedbackStatus");

  if (!email || !message) {
    showToast("❌ Please enter your email and feedback message.");
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) statusEl.classList.add("hidden");

  grecaptcha.ready(function () {
    grecaptcha
      .execute("6LeGK1MrAAAAAGc19Grzz8V2grYy9ZRQReTF9Yy1", {
        action: "submit_feedback",
      })
      .then(function (token) {
        fetch("/api/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formType: "feedback",
            email,
            message,
            "g-recaptcha-response": token,
          }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              showToast("✅ Feedback submitted successfully!");
              if (statusEl) statusEl.classList.remove("hidden");
              form?.reset();
            } else {
              showToast("❌ " + (data.error || "Unknown error occurred."));
            }
          })
          .catch((err) => showToast("❌ Network error: " + err.message))
          .finally(() => {
            if (btn) btn.disabled = false;
          });
      });
  });
}

// Trip log
function saveTripLog(offer, time, distance, profit, rate, verdict) {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  const last = log[0];
  if (
    last &&
    last.offer === offer &&
    last.time === time &&
    last.distance === distance
  )
    return;
  log.unshift({ offer, time, distance, profit, rate, verdict });
  localStorage.setItem("tripLog", JSON.stringify(log));
  renderTripLog();
}

function renderTripLog() {
  const tbody = $("tripLogTableBody");
  if (!tbody) return;

  const filterText = ($("tripLogFilter")?.value || "").toLowerCase();
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");

  tbody.innerHTML = "";
  log.forEach((t) => {
    const rowText =
      `${t.offer} ${t.time} ${t.distance} ${t.profit} ${t.rate} ${t.verdict}`.toLowerCase();
    if (!rowText.includes(filterText)) return;

    let rowClass = "";
    if ((t.verdict || "").includes("✅"))
      rowClass = "bg-green-100 text-green-800";
    else if ((t.verdict || "").includes("⚠️"))
      rowClass = "bg-yellow-100 text-yellow-800";
    else if ((t.verdict || "").includes("❌"))
      rowClass = "bg-red-100 text-red-800";

    const row = document.createElement("tr");
    row.className = rowClass;
    row.innerHTML = `
      <td class="px-2 py-1">$${t.offer}</td>
      <td class="px-2 py-1">${t.time} min</td>
      <td class="px-2 py-1">${t.distance} mi</td>
      <td class="px-2 py-1">$${t.profit}</td>
      <td class="px-2 py-1">$${t.rate}</td>
      <td class="px-2 py-1">${t.verdict}</td>
    `;
    tbody.appendChild(row);
  });
}

function filterTripLog(type) {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  const tbody = document.getElementById("tripLogTableBody");
  tbody.innerHTML = "";

  log.forEach((t) => {
    if (type !== "all" && !t.verdict.includes(type)) return;

    let rowClass = "";
    if ((t.verdict || "").includes("✅"))
      rowClass = "bg-green-50 dark:bg-green-900/30";
    else if ((t.verdict || "").includes("⚠️"))
      rowClass = "bg-yellow-50 dark:bg-yellow-900/30";
    else if ((t.verdict || "").includes("❌"))
      rowClass = "bg-red-50 dark:bg-red-900/30";

    const row = document.createElement("tr");
    row.className = rowClass;
    row.innerHTML = `
      <td class="px-3 py-2">$${t.offer}</td>
      <td class="px-3 py-2">${t.time} min</td>
      <td class="px-3 py-2">${t.distance} mi</td>
      <td class="px-3 py-2">$${t.profit}</td>
      <td class="px-3 py-2">$${t.rate}</td>
      <td class="px-3 py-2">${t.verdict}</td>
    `;
    tbody.appendChild(row);
  });
}

function sortTripLog(key) {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");

  if (currentSortKey === key) {
    currentSortDirection = currentSortDirection === "asc" ? "desc" : "asc";
  } else {
    currentSortKey = key;
    currentSortDirection = "desc";
  }

  log.sort((a, b) => {
    const valA = parseFloat(a[key]);
    const valB = parseFloat(b[key]);
    if (currentSortDirection === "asc") return valA > valB ? 1 : -1;
    return valA < valB ? 1 : -1;
  });

  localStorage.setItem("tripLog", JSON.stringify(log));
  renderTripLog();
}

function exportTripLog() {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  if (!log.length) return;
  const rows = [["Offer", "Time", "Distance", "Profit", "Rate", "Verdict"]];
  log.forEach((t) =>
    rows.push([t.offer, t.time, t.distance, t.profit, t.rate, t.verdict]),
  );
  const csv = rows.map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "trip_log.csv";
  a.click();
}

let lastClearedLog = null; // store last cleared data for undo

function clearTripLog() {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  if (!log.length) {
    showToast("⚠️ Trip history is already empty.");
    return;
  }

  // Show the modal instead of native confirm
  document.getElementById("clearLogModal").classList.remove("hidden");
  document.getElementById("clearLogModal").classList.add("flex");
}

function hideClearLogModal() {
  const modal = document.getElementById("clearLogModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function confirmClearLog() {
  hideClearLogModal();

  // Save backup
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  lastClearedLog = log;
  localStorage.removeItem("tripLog");
  renderTripLog();
  updateLogButtons();

  // Show toast with Undo option (same as before)
  const container = document.getElementById("toastContainer");
  if (container) {
    const toast = document.createElement("div");
    toast.className =
      "px-4 py-2 rounded-lg shadow-md text-sm font-medium bg-red-600 text-white flex items-center gap-3 transition opacity-0 translate-y-2";
    toast.innerHTML = `
      🗑️ Trip history cleared.
      <button onclick="undoClearTripLog()" class="underline text-white">Undo</button>
    `;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("opacity-0", "translate-y-2");
      toast.classList.add("opacity-100", "translate-y-0");
    });

    setTimeout(() => {
      if (toast.isConnected) toast.remove();
      lastClearedLog = null;
    }, 5000);
  }
}

function undoClearTripLog() {
  if (lastClearedLog) {
    localStorage.setItem("tripLog", JSON.stringify(lastClearedLog));
    renderTripLog();
    showToast("✅ Trip history restored.");
    lastClearedLog = null;
  }
}

function updateLogButtons() {
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  const clearBtn = document.getElementById("clearLogBtn");
  const exportBtn = document.getElementById("exportLogBtn");

  if (clearBtn) clearBtn.disabled = log.length === 0;
  if (exportBtn) exportBtn.disabled = log.length === 0;
}

// Gas price
async function fetchGasPrice() {
  try {
    const r = await fetch("/api/gas_price");
    const data = await r.json();
    const rawValue = data?.response?.data?.[0]?.value;
    const latestPrice = parseFloat(rawValue);
    if (!isNaN(latestPrice)) {
      isGasReady = true;
      const gasInput = $("gasPricePerGallon");
      if (gasInput && (!gasInput.value || parseFloat(gasInput.value) === 0)) {
        gasInput.value = latestPrice.toFixed(2);
        showToast("⛽ Gas price auto-filled from latest U.S. average.");
      }
    }
  } catch (e) {
    console.warn("⚠️ Failed to fetch gas price:", e);
    isGasReady = true;
  }
}

// Quick estimate
function quickEstimate() {
  const miles = parseFloat($("quickMiles")?.value);
  const offer = parseFloat($("quickOffer")?.value);
  const rate = miles > 0 ? (offer / miles).toFixed(2) : 0;
  const verdict =
    offer < 5
      ? "❌ Probably not worth it"
      : rate >= 2
        ? "✅ Great!"
        : rate >= 1.5
          ? "⚠️ Okay-ish"
          : "❌ Too low";
  setText("quickEstimateResult", `$${rate}/mi · ${verdict}`);
}

function showRateComparison(userRate) {
  const average = 18,
    top10 = 25;
  let msg = "";
  if (userRate >= top10) msg = "🔥 You're in the top 10% of delivery drivers!";
  else if (userRate >= average) msg = "👍 You're earning above average.";
  else msg = "📉 Below average – maybe skip this trip.";
  setText("rateComparison", msg);
}

function calculateBreakEven() {
  const fixed = parseFloat($("monthlyFixedCosts")?.value);
  const profit = parseFloat(
    ($("profitDR")?.textContent || "0").replace(/[^\d.-]/g, ""),
  );
  if (isNaN(fixed) || profit <= 0) {
    setText("breakEvenResult", "Enter valid profit and cost.");
    return;
  }
  const trips = Math.ceil(fixed / profit);
  setText(
    "breakEvenResult",
    `You need around ${trips} trips like this to break even.`,
  );
}

// Build shareable link from current inputs
async function buildShareURL() {
  const payload = {
    o: $("deliveryOffer").value,
    t: $("time").value,
    d: $("tripDistance").value,
    r: $("preferredHourlyRate").value,
    g: $("gasPricePerGallon").value,
    m: $("mpg").value,
    od: $("outOfWayDelay").value,
    w: $("waitTime").value,
    wc: $("wearCostPerMile").value,
  };

  try {
    const res = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data || !data.id) throw new Error("No ID returned");
    return `${window.location.origin}/share/${data.id}`;
  } catch (err) {
    showToast("❌ Failed to generate share link");
    console.error(err);
    return null;
  }
}

// Copy link to clipboard
async function generateShareLink() {
  const url = await buildShareURL();
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    showToast("🔗 Share link copied!");
  } catch (err) {
    console.warn("⚠️ Clipboard API failed, falling back:", err);

    // Fallback for Safari/older browsers
    const tempInput = document.createElement("input");
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand("copy");
      showToast("🔗 Share link copied!");
    } catch (err2) {
      showToast("❌ Failed to copy link");
    }
    document.body.removeChild(tempInput);
  }
}

// Social share handlers
async function shareOn(platform) {
  const url = await buildShareURL();
  if (!url) return;

  const encodedUrl = encodeURIComponent(url);
  const text = encodeURIComponent("Check out my trip analysis!");

  let shareUrl = "";
  if (platform === "twitter") {
    shareUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${text}`;
  } else if (platform === "facebook") {
    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  } else if (platform === "reddit") {
    shareUrl = `https://www.reddit.com/submit?url=${encodedUrl}&title=${text}`;
  }

  window.open(shareUrl, "_blank", "width=600,height=400");
}

function resetForm() {
  // Trip Info (baseline defaults)
  document.getElementById("deliveryOffer").value = 0;
  document.getElementById("time").value = 0;
  document.getElementById("tripDistance").value = 0;
  document.getElementById("preferredHourlyRate").value = 20;

  // Advanced settings (keep gas price API result intact!)
  document.getElementById("mpg").value = "25"; // default Average
  document.getElementById("outOfWayDelay").value = 0;
  document.getElementById("waitTime").value = 0;
  document.getElementById("wearCostPerMile").value = "0.1043"; // default Gas

  // Reset results
  const idsToReset = [
    "effectiveHourlyWageDR",
    "profitDR",
    "mpd",
    "dollarsPerMinute",
    "totalCostsDR",
    "effectiveHourlyWage",
    "totalMiles",
    "totalTime",
    "gallons",
    "gasCost",
    "wearAndTearCost",
    "totalCosts",
    "deliveryOfferResults",
    "profit",
    "deductionEstimate",
  ];
  idsToReset.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "0.00";
  });

  // Hide detailed results
  const resultsRow2 = document.getElementById("resultsRow2");
  if (resultsRow2) resultsRow2.classList.add("hidden");

  // Hide Trip Analysis
  const tripCard = $("tripAnalysisCard");
  if (tripCard) tripCard.classList.add("hidden", "opacity-0", "translate-y-4");

  // Hide share actions again
  const shareEl = document.getElementById("shareActions");
  if (shareEl) shareEl.classList.add("hidden");

  // Clear verdict
  const verdictCard = document.getElementById("verdictCard");
  if (verdictCard) {
    verdictCard.innerHTML = ""; // remove inner verdict content
    verdictCard.className = "hidden md:block mt-6"; // reset back to default classes
  }
  // Clear Trip Log filter if any
  const logFilter = document.getElementById("tripLogFilter");
  if (logFilter) logFilter.value = "";

  showToast("♻️ Form reset to defaults");
}

async function preloadFromQuery() {
  const pathParts = window.location.pathname.split("/");
  if (pathParts[1] === "share" && pathParts[2]) {
    const id = pathParts[2];
    try {
      const res = await fetch(`/api/share/${id}`);
      const data = await res.json();

      if (!data) return;

      const map = {
        o: "deliveryOffer",
        t: "time",
        d: "tripDistance",
        r: "preferredHourlyRate",
        g: "gasPricePerGallon",
        m: "mpg",
        od: "outOfWayDelay",
        w: "waitTime",
        wc: "wearCostPerMile",
      };

      for (const [key, id] of Object.entries(map)) {
        if (data[key] !== undefined) {
          const el = document.getElementById(id);
          if (el) el.value = data[key];
        }
      }

      analyzeTrip();
    } catch (e) {
      console.error("❌ Failed to load share data:", e);
    }
  }
}

function quickEstimate(suffix = "") {
  const miles = parseFloat($(`quickMiles${suffix}`)?.value);
  const offer = parseFloat($(`quickOffer${suffix}`)?.value);

  if (isNaN(miles) || isNaN(offer) || miles <= 0 || offer <= 0) {
    setText(`quickEstimateResult${suffix}`, "❌ Enter valid miles & offer.");
    return;
  }

  const rate = offer / miles;
  let verdict;

  if (rate >= 2) {
    verdict = `✅ Great · $${rate.toFixed(2)}/mi`;
  } else if (rate >= 1.5) {
    verdict = `⚠️ Okay-ish · $${rate.toFixed(2)}/mi`;
  } else {
    verdict = `❌ Too Low · $${rate.toFixed(2)}/mi`;
  }

  setText(`quickEstimateResult${suffix}`, verdict);
}

function openFeedback() {
  document.getElementById("feedbackModal").classList.remove("hidden");
}

function closeFeedback() {
  document.getElementById("feedbackModal").classList.add("hidden");
}

function submitFeedback(event) {
  event.preventDefault();
  const statusEl = document.getElementById("feedbackStatus");
  statusEl.classList.remove("hidden");
  // Demo: auto-hide modal after success
  setTimeout(() => {
    closeFeedback();
    statusEl.classList.add("hidden");
    document.getElementById("feedbackForm").reset();
  }, 2000);
}

// -------- Init --------
document.addEventListener("DOMContentLoaded", async () => {
  // Theme from storage
  const root = document.documentElement;
  if (localStorage.getItem("theme") === "dark") root.classList.add("dark");

  // Prefill from URL params or /share/... path
  preloadFromQuery();

  // --- Only apply defaults if no share data ---
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split("/");
  const hasShare =
    params.has("d") || (pathParts[1] === "share" && pathParts[2]);

  if (!hasShare) {
    $("deliveryOffer").value = "0";
    $("time").value = "0";
    $("tripDistance").value = "0";
    $("preferredHourlyRate").value = 20;
    $("gasPricePerGallon").value = "0"; // will be replaced by API
    $("mpg").value = 25;
    $("outOfWayDelay").value = "0";
    $("waitTime").value = "0";
    $("wearCostPerMile").value = "0.1043";
    await fetchGasPrice();
  }

  // Trip log render + filter
  renderTripLog();
  $("tripLogFilter")?.addEventListener("input", renderTripLog);

  // Recent trip summary
  const log = JSON.parse(localStorage.getItem("tripLog") || "[]");
  if (log.length) {
    const t = log[0];
    const recent = $("recentTripSummary");
    if (recent) {
      recent.innerHTML = `
        <li><strong>Offer:</strong> $${t.offer}</li>
        <li><strong>Distance:</strong> ${t.distance} mi</li>
        <li><strong>Profit:</strong> $${t.profit}</li>
        <li><strong>Verdict:</strong> ${t.verdict}</li>
      `;
    }
  }

  // Restore preferred hourly
  const storedRate = localStorage.getItem("preferredHourlyRate");
  if (storedRate) $("preferredHourlyRate").value = storedRate;
  $("preferredHourlyRate")?.addEventListener("change", () => {
    localStorage.setItem("preferredHourlyRate", $("preferredHourlyRate").value);
  });

  // Motivational quote
  const quotes = [
    "🚗 ‘Every mile counts. Make it pay.’",
    "💡 ‘Don’t drive blind. Analyze every trip.’",
    "🛠️ ‘Efficiency is your real wage.’",
    "🔥 ‘Time is money. Know your worth.’",
    "📈 ‘Drive smarter, not harder.’",
    "🥡 ‘Small orders add up — but only if they make sense.’",
    "🕒 ‘Minutes matter. Respect your time like cash.’",
    "⚡ ‘Fast isn’t always better — profitable is better.’",
    "📊 ‘Track it, or you’ll never improve it.’",
    "💵 ‘Profit isn’t the payout, it’s what’s left after costs.’",
    "👟 ‘Every extra mile wears your shoes, your car, and your wallet.’",
    "📍 ‘Know your zones. Not every neighborhood is worth the drive.’",
    "⛽ ‘Gas costs don’t lie. Don’t ignore them.’",
    "🧾 ‘The IRS pays attention to your miles — so should you.’",
    "🥤 ‘Don’t chase drinks at midnight — chase trips that pay right.’",
    "📦 ‘Dead miles are dead money. Keep them low.’",
    "💡 ‘The best drivers aren’t faster — they’re smarter.’",
    "🎯 ‘Set a goal per hour, not per day. Hours build days.’",
    "🛑 ‘Sometimes the smartest move is skipping the order.’",
    "🌙 ‘Night miles count double — your wear, your risk, your time.’",
  ];
  const q = $("dailyQuote");
  if (q) q.textContent = quotes[Math.floor(Math.random() * quotes.length)];

  // Tips toast
  const shown = +localStorage.getItem("tipsShown") || 0;
  const tips = [
    "💡 Tip: Avoid chains during peak hours – wait time kills profit.",
    "⛽ Use GasBuddy to find cheap fuel nearby.",
    "🧾 Use Stride or Everlance to track every delivery mile.",
  ];
  if (shown < tips.length) {
    showToast(tips[shown]);
    localStorage.setItem("tipsShown", shown + 1);
  }

  const toolboxOptions = [
    "📍 Mileage Deduction Estimator <span class='italic text-gray-400'>(coming soon)</span>",
    "📦 Prop 22 Estimator (CA) <span class='italic text-gray-400'>(coming soon)</span>",
    "📊 Earnings Tracker <span class='italic text-gray-400'>(coming soon)</span>",
  ];

  const randomTool =
    toolboxOptions[Math.floor(Math.random() * toolboxOptions.length)];
  const toolboxEl = document.getElementById("toolboxText");
  if (toolboxEl) toolboxEl.innerHTML = randomTool;

  // Export PDF
  const exportBtn = $("exportPdfBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const element = $("resultsSummary");
      if (!element) {
        showToast("❌ Export target not found.");
        return;
      }
      const options = {
        filename: "trip-summary.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      };
      html2pdf().set(options).from(element).save();
    });
  }
});

